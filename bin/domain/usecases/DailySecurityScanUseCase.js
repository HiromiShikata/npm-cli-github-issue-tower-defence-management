"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DailySecurityScanUseCase = void 0;
const isKevVulnerability = (value) => {
    if (typeof value !== 'object' || value === null) {
        return false;
    }
    const record = { ...value };
    return (typeof record.cveID === 'string' &&
        typeof record.vendorProject === 'string' &&
        typeof record.product === 'string' &&
        typeof record.vulnerabilityName === 'string' &&
        typeof record.dateAdded === 'string');
};
const isKevCatalog = (value) => {
    if (typeof value !== 'object' || value === null) {
        return false;
    }
    const record = { ...value };
    return (Array.isArray(record.vulnerabilities) &&
        record.vulnerabilities.every(isKevVulnerability));
};
const parseScannerVulnerabilities = (repositoryName, scannerOutput) => {
    let parsed;
    try {
        parsed = JSON.parse(scannerOutput);
    }
    catch (error) {
        console.error(`Unparsable osv-scanner output for ${repositoryName}: ${String(error)}`);
        return [];
    }
    const toRecord = (value) => typeof value === 'object' && value !== null ? { ...value } : {};
    const readArray = (value, key) => {
        const entry = toRecord(value)[key];
        return Array.isArray(entry) ? entry : [];
    };
    const readString = (value, key) => {
        const entry = toRecord(value)[key];
        return typeof entry === 'string' ? entry : '';
    };
    return readArray(parsed, 'results').flatMap((result) => readArray(result, 'packages').flatMap((scannedPackage) => {
        const packageDetail = toRecord(scannedPackage).package;
        return readArray(scannedPackage, 'vulnerabilities').map((vulnerability) => {
            const vulnerabilityId = readString(vulnerability, 'id');
            const aliases = readArray(vulnerability, 'aliases').filter((alias) => typeof alias === 'string');
            return {
                repositoryName,
                ecosystem: readString(packageDetail, 'ecosystem'),
                packageName: readString(packageDetail, 'name'),
                packageVersion: readString(packageDetail, 'version'),
                vulnerabilityId,
                vulnerabilityIdentifiers: [vulnerabilityId, ...aliases],
                summary: readString(vulnerability, 'summary'),
            };
        });
    }));
};
const renderScannerFindings = (today, vulnerablePackages) => [
    '## OSV-Scanner findings',
    '',
    `### ${today}`,
    '',
    ...vulnerablePackages.map((vulnerablePackage) => `- ${vulnerablePackage.ecosystem} ${vulnerablePackage.packageName} ${vulnerablePackage.packageVersion} ${vulnerablePackage.vulnerabilityIdentifiers.join(' ')} ${vulnerablePackage.summary}`),
].join('\n');
const KEV_CATALOG_URL = 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json';
class DailySecurityScanUseCase {
    constructor(localCommandRunner, issueRepository, httpRepository) {
        this.localCommandRunner = localCommandRunner;
        this.issueRepository = issueRepository;
        this.httpRepository = httpRepository;
        this.run = async (input) => {
            const shouldRun = input.targetDates.some((targetDate) => targetDate.getUTCHours() === input.dailySecurityScan.targetHourUtc &&
                targetDate.getUTCMinutes() === 0);
            if (!shouldRun) {
                return;
            }
            const lastTargetDate = input.targetDates[input.targetDates.length - 1];
            const today = lastTargetDate.toISOString().slice(0, 10);
            const scannedVulnerablePackages = await this.scanRepositories(input.org, input.manager, today, input.dailySecurityScan);
            await this.reportKevAdditions(input.org, input.manager, lastTargetDate, input.dailySecurityScan, scannedVulnerablePackages);
        };
        this.scanRepositories = async (org, manager, today, config) => {
            const { stdout: findOutput } = await this.localCommandRunner.runCommand('find', [
                config.scanBaseDirectory,
                '-maxdepth',
                '5',
                '-name',
                '.git',
                '-type',
                'd',
            ]);
            const repositoryDirectories = findOutput
                .split('\n')
                .filter((line) => line.length > 0)
                .map((gitDirectory) => gitDirectory.replace(/\/\.git$/, ''));
            if (repositoryDirectories.length === 0) {
                console.error(`No repositories found in scan base directory: ${config.scanBaseDirectory}`);
                return [];
            }
            const remoteUrlByRepositoryName = new Map();
            for (const repositoryDirectory of repositoryDirectories) {
                const { stdout: remoteUrl, exitCode: remoteExitCode } = await this.localCommandRunner.runCommand('git', [
                    '-C',
                    repositoryDirectory,
                    'remote',
                    'get-url',
                    'origin',
                ]);
                if (remoteExitCode !== 0) {
                    continue;
                }
                const remoteMatch = remoteUrl
                    .trim()
                    .match(/github\.com[:/]([^/]+)\/([^/.]+)/);
                if (!remoteMatch || remoteMatch[1] !== org) {
                    continue;
                }
                if (!remoteUrlByRepositoryName.has(remoteMatch[2])) {
                    remoteUrlByRepositoryName.set(remoteMatch[2], remoteUrl.trim());
                }
            }
            const scannedVulnerablePackages = [];
            for (const [repositoryName, remoteUrl] of remoteUrlByRepositoryName) {
                const repositoryOrg = org;
                const checkoutDirectory = await this.checkoutDefaultBranch(repositoryName, remoteUrl);
                if (checkoutDirectory === null) {
                    continue;
                }
                const { stdout: scanOutput, stderr: scanStderr, exitCode: scanExitCode, } = await this.localCommandRunner.runCommand('osv-scanner', [
                    'scan',
                    'source',
                    '-r',
                    checkoutDirectory,
                    '--format',
                    'json',
                ]);
                await this.localCommandRunner.runCommand('rm', [
                    '-rf',
                    checkoutDirectory,
                ]);
                if (scanExitCode === 0) {
                    continue;
                }
                if (scanExitCode !== 1) {
                    console.error(`osv-scanner failed with exit code ${scanExitCode} for ${repositoryName}: ${scanStderr}`);
                    continue;
                }
                const vulnerablePackages = parseScannerVulnerabilities(repositoryName, scanOutput);
                scannedVulnerablePackages.push(...vulnerablePackages);
                const findingsBody = renderScannerFindings(today, vulnerablePackages);
                const existingIssues = await this.issueRepository.searchIssue({
                    owner: repositoryOrg,
                    repositoryName,
                    type: 'issue',
                    state: 'open',
                    title: 'Daily security scan findings',
                });
                const existingIssue = existingIssues.find((issue) => issue.title === 'Daily security scan findings');
                if (existingIssue) {
                    await this.issueRepository.createCommentByUrl(existingIssue.url, findingsBody);
                }
                else {
                    await this.issueRepository.createNewIssue(repositoryOrg, repositoryName, 'Daily security scan findings', findingsBody, [manager], []);
                }
            }
            return scannedVulnerablePackages;
        };
        this.checkoutDefaultBranch = async (repositoryName, remoteUrl) => {
            const { stdout: checkoutDirectoryOutput, exitCode: checkoutDirectoryExit } = await this.localCommandRunner.runCommand('mktemp', [
                '-d',
                '-t',
                `tdpm-daily-security-scan-${repositoryName}-XXXXXX`,
            ]);
            const checkoutDirectory = checkoutDirectoryOutput.trim();
            if (checkoutDirectoryExit !== 0 || checkoutDirectory.length === 0) {
                console.error(`Failed to create a checkout directory for ${repositoryName}`);
                return null;
            }
            const { stderr: cloneStderr, exitCode: cloneExitCode } = await this.localCommandRunner.runCommand('git', [
                'clone',
                '--depth',
                '1',
                remoteUrl,
                checkoutDirectory,
            ]);
            if (cloneExitCode !== 0) {
                console.error(`Failed to clone the default branch of ${repositoryName}: ${cloneStderr}`);
                await this.localCommandRunner.runCommand('rm', [
                    '-rf',
                    checkoutDirectory,
                ]);
                return null;
            }
            return checkoutDirectory;
        };
        this.reportKevAdditions = async (org, manager, lastTargetDate, config, scannedVulnerablePackages) => {
            if (!config.enableKevNvdReport || !config.kevReportRepo) {
                return;
            }
            const yesterday = new Date(lastTargetDate);
            yesterday.setUTCDate(yesterday.getUTCDate() - 1);
            const yesterdayYmd = yesterday.toISOString().slice(0, 10);
            const kevJson = await this.httpRepository.get(KEV_CATALOG_URL);
            const parsedKev = JSON.parse(kevJson);
            if (!isKevCatalog(parsedKev)) {
                throw new Error(`Unexpected CISA KEV catalog format from ${KEV_CATALOG_URL}`);
            }
            const newKevEntries = parsedKev.vulnerabilities.filter((vulnerability) => vulnerability.dateAdded >= yesterdayYmd);
            const affectingKevEntries = newKevEntries
                .map((vulnerability) => ({
                vulnerability,
                affectedPackages: scannedVulnerablePackages.filter((scannedPackage) => scannedPackage.vulnerabilityIdentifiers.includes(vulnerability.cveID)),
            }))
                .filter((entry) => entry.affectedPackages.length > 0);
            if (affectingKevEntries.length === 0) {
                return;
            }
            await this.issueRepository.createNewIssue(org, config.kevReportRepo, `CISA KEV new additions since ${yesterdayYmd}`, affectingKevEntries
                .map((entry) => [
                `- ${entry.vulnerability.dateAdded} ${entry.vulnerability.cveID} ${entry.vulnerability.vulnerabilityName}`,
                ...entry.affectedPackages.map((affectedPackage) => `  - ${affectedPackage.repositoryName} ${affectedPackage.ecosystem} ${affectedPackage.packageName} ${affectedPackage.packageVersion}`),
            ].join('\n'))
                .join('\n'), [manager], []);
        };
    }
}
exports.DailySecurityScanUseCase = DailySecurityScanUseCase;
//# sourceMappingURL=DailySecurityScanUseCase.js.map