"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DailySecurityScanUseCase = void 0;
const isKevVulnerability = (value) => {
    if (typeof value !== 'object' || value === null) {
        return false;
    }
    const record = { ...value };
    return (typeof record.cveID === 'string' &&
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
            await this.scanRepositories(input.org, input.manager, today, input.dailySecurityScan);
            await this.reportKevAdditions(input.org, input.manager, lastTargetDate, input.dailySecurityScan);
        };
        this.scanRepositories = async (org, manager, today, config) => {
            const { stdout: findOutput } = await this.localCommandRunner.runCommand('find', [
                config.scanBaseDirectory,
                '-mindepth',
                '4',
                '-maxdepth',
                '4',
                '-name',
                '.git',
                '-type',
                'd',
            ]);
            const repositoryDirectories = findOutput
                .split('\n')
                .filter((line) => line.length > 0)
                .map((gitDirectory) => gitDirectory.replace(/\/\.git$/, ''));
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
                const repositoryOrg = remoteMatch[1];
                const repositoryName = remoteMatch[2];
                const { stdout: scanOutput, exitCode: scanExitCode } = await this.localCommandRunner.runCommand('osv-scanner', [
                    'scan',
                    'source',
                    '-r',
                    repositoryDirectory,
                ]);
                if (scanExitCode !== 1) {
                    continue;
                }
                await this.issueRepository.createNewIssue(repositoryOrg, repositoryName, `Daily security scan findings: ${today}`, `## OSV-Scanner findings\n\n\`\`\`\n${scanOutput}\n\`\`\``, [manager], []);
            }
        };
        this.reportKevAdditions = async (org, manager, lastTargetDate, config) => {
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
            const newKevEntries = parsedKev.vulnerabilities
                .filter((vulnerability) => vulnerability.dateAdded >= yesterdayYmd)
                .map((vulnerability) => `- ${vulnerability.dateAdded} ${vulnerability.cveID} ${vulnerability.vulnerabilityName}`);
            if (newKevEntries.length === 0) {
                return;
            }
            await this.issueRepository.createNewIssue(org, config.kevReportRepo, `CISA KEV new additions since ${yesterdayYmd}`, newKevEntries.join('\n'), [manager], []);
        };
    }
}
exports.DailySecurityScanUseCase = DailySecurityScanUseCase;
//# sourceMappingURL=DailySecurityScanUseCase.js.map