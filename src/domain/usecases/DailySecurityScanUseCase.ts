import { LocalCommandRunner } from './adapter-interfaces/LocalCommandRunner';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { HttpRepository } from './adapter-interfaces/HttpRepository';
import { Member } from '../entities/Member';

export type DailySecurityScanConfig = {
  scanBaseDirectory: string;
  targetHourUtc: number;
  enableKevNvdReport?: boolean;
  kevReportRepo?: string;
};

type KevVulnerability = {
  cveID: string;
  vendorProject: string;
  product: string;
  vulnerabilityName: string;
  dateAdded: string;
};

type KevCatalog = {
  vulnerabilities: KevVulnerability[];
};

const isKevVulnerability = (value: unknown): value is KevVulnerability => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const record: Record<string, unknown> = { ...value };
  return (
    typeof record.cveID === 'string' &&
    typeof record.vendorProject === 'string' &&
    typeof record.product === 'string' &&
    typeof record.vulnerabilityName === 'string' &&
    typeof record.dateAdded === 'string'
  );
};

const isKevCatalog = (value: unknown): value is KevCatalog => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const record: Record<string, unknown> = { ...value };
  return (
    Array.isArray(record.vulnerabilities) &&
    record.vulnerabilities.every(isKevVulnerability)
  );
};

type ScannedVulnerablePackage = {
  repositoryName: string;
  ecosystem: string;
  packageName: string;
  packageVersion: string;
  vulnerabilityId: string;
  vulnerabilityIdentifiers: string[];
  summary: string;
};

const parseScannerVulnerabilities = (
  repositoryName: string,
  scannerOutput: string,
): ScannedVulnerablePackage[] => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(scannerOutput);
  } catch (error) {
    console.error(
      `Unparsable osv-scanner output for ${repositoryName}: ${String(error)}`,
    );
    return [];
  }
  const readArray = (value: unknown, key: string): unknown[] => {
    if (typeof value !== 'object' || value === null) {
      return [];
    }
    const entry = Reflect.get(value, key);
    return Array.isArray(entry) ? entry : [];
  };
  const readString = (value: unknown, key: string): string => {
    if (typeof value !== 'object' || value === null) {
      return '';
    }
    const entry = Reflect.get(value, key);
    return typeof entry === 'string' ? entry : '';
  };
  return readArray(parsed, 'results').flatMap((result) =>
    readArray(result, 'packages').flatMap((scannedPackage) => {
      const packageDetail =
        typeof scannedPackage === 'object' && scannedPackage !== null
          ? Reflect.get(scannedPackage, 'package')
          : null;
      return readArray(scannedPackage, 'vulnerabilities').map(
        (vulnerability) => {
          const vulnerabilityId = readString(vulnerability, 'id');
          const aliases = readArray(vulnerability, 'aliases').filter(
            (alias): alias is string => typeof alias === 'string',
          );
          return {
            repositoryName,
            ecosystem: readString(packageDetail, 'ecosystem'),
            packageName: readString(packageDetail, 'name'),
            packageVersion: readString(packageDetail, 'version'),
            vulnerabilityId,
            vulnerabilityIdentifiers: [vulnerabilityId, ...aliases],
            summary: readString(vulnerability, 'summary'),
          };
        },
      );
    }),
  );
};

const renderScannerFindings = (
  today: string,
  vulnerablePackages: ScannedVulnerablePackage[],
): string =>
  [
    '## OSV-Scanner findings',
    '',
    `### ${today}`,
    '',
    ...vulnerablePackages.map(
      (vulnerablePackage) =>
        `- ${vulnerablePackage.ecosystem} ${vulnerablePackage.packageName} ${vulnerablePackage.packageVersion} ${vulnerablePackage.vulnerabilityIdentifiers.join(' ')} ${vulnerablePackage.summary}`,
    ),
  ].join('\n');

const KEV_CATALOG_URL =
  'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json';

export class DailySecurityScanUseCase {
  constructor(
    readonly localCommandRunner: LocalCommandRunner,
    readonly issueRepository: Pick<
      IssueRepository,
      'createNewIssue' | 'searchIssue' | 'createCommentByUrl'
    >,
    readonly httpRepository: HttpRepository,
  ) {}

  run = async (input: {
    targetDates: Date[];
    org: string;
    manager: Member['name'];
    dailySecurityScan: DailySecurityScanConfig;
  }): Promise<void> => {
    const shouldRun = input.targetDates.some(
      (targetDate) =>
        targetDate.getUTCHours() === input.dailySecurityScan.targetHourUtc &&
        targetDate.getUTCMinutes() === 0,
    );
    if (!shouldRun) {
      return;
    }

    const lastTargetDate = input.targetDates[input.targetDates.length - 1];
    const today = lastTargetDate.toISOString().slice(0, 10);

    const scannedVulnerablePackages = await this.scanRepositories(
      input.org,
      input.manager,
      today,
      input.dailySecurityScan,
    );

    await this.reportKevAdditions(
      input.org,
      input.manager,
      lastTargetDate,
      input.dailySecurityScan,
      scannedVulnerablePackages,
    );
  };

  private scanRepositories = async (
    org: string,
    manager: Member['name'],
    today: string,
    config: DailySecurityScanConfig,
  ): Promise<ScannedVulnerablePackage[]> => {
    const { stdout: findOutput } = await this.localCommandRunner.runCommand(
      'find',
      [
        config.scanBaseDirectory,
        '-maxdepth',
        '5',
        '-name',
        '.git',
        '-type',
        'd',
      ],
    );

    const repositoryDirectories = findOutput
      .split('\n')
      .filter((line) => line.length > 0)
      .map((gitDirectory) => gitDirectory.replace(/\/\.git$/, ''));

    if (repositoryDirectories.length === 0) {
      console.error(
        `No repositories found in scan base directory: ${config.scanBaseDirectory}`,
      );
      return [];
    }

    const scannedVulnerablePackages: ScannedVulnerablePackage[] = [];
    for (const repositoryDirectory of repositoryDirectories) {
      const { stdout: remoteUrl, exitCode: remoteExitCode } =
        await this.localCommandRunner.runCommand('git', [
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

      const {
        stdout: scanOutput,
        stderr: scanStderr,
        exitCode: scanExitCode,
      } = await this.localCommandRunner.runCommand('osv-scanner', [
        'scan',
        'source',
        '-r',
        repositoryDirectory,
        '--format',
        'json',
      ]);
      if (scanExitCode === 0) {
        continue;
      }
      if (scanExitCode !== 1) {
        console.error(
          `osv-scanner failed with exit code ${scanExitCode} for ${repositoryDirectory}: ${scanStderr}`,
        );
        continue;
      }

      const vulnerablePackages = parseScannerVulnerabilities(
        repositoryName,
        scanOutput,
      );
      scannedVulnerablePackages.push(...vulnerablePackages);

      const findingsBody = renderScannerFindings(today, vulnerablePackages);
      const existingIssues = await this.issueRepository.searchIssue({
        owner: repositoryOrg,
        repositoryName,
        type: 'issue',
        state: 'open',
        title: 'Daily security scan findings',
      });
      const existingIssue = existingIssues.find(
        (issue) => issue.title === 'Daily security scan findings',
      );
      if (existingIssue) {
        await this.issueRepository.createCommentByUrl(
          existingIssue.url,
          findingsBody,
        );
      } else {
        await this.issueRepository.createNewIssue(
          repositoryOrg,
          repositoryName,
          'Daily security scan findings',
          findingsBody,
          [manager],
          [],
        );
      }
    }
    return scannedVulnerablePackages;
  };

  private reportKevAdditions = async (
    org: string,
    manager: Member['name'],
    lastTargetDate: Date,
    config: DailySecurityScanConfig,
    scannedVulnerablePackages: ScannedVulnerablePackage[],
  ): Promise<void> => {
    if (!config.enableKevNvdReport || !config.kevReportRepo) {
      return;
    }

    const yesterday = new Date(lastTargetDate);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const yesterdayYmd = yesterday.toISOString().slice(0, 10);

    const kevJson = await this.httpRepository.get(KEV_CATALOG_URL);
    const parsedKev: unknown = JSON.parse(kevJson);
    if (!isKevCatalog(parsedKev)) {
      throw new Error(
        `Unexpected CISA KEV catalog format from ${KEV_CATALOG_URL}`,
      );
    }

    const newKevEntries = parsedKev.vulnerabilities.filter(
      (vulnerability) => vulnerability.dateAdded >= yesterdayYmd,
    );
    const affectingKevEntries = newKevEntries
      .map((vulnerability) => ({
        vulnerability,
        affectedPackages: scannedVulnerablePackages.filter((scannedPackage) =>
          scannedPackage.vulnerabilityIdentifiers.includes(vulnerability.cveID),
        ),
      }))
      .filter((entry) => entry.affectedPackages.length > 0);
    if (affectingKevEntries.length === 0) {
      return;
    }

    await this.issueRepository.createNewIssue(
      org,
      config.kevReportRepo,
      `CISA KEV new additions since ${yesterdayYmd}`,
      affectingKevEntries
        .map((entry) =>
          [
            `- ${entry.vulnerability.dateAdded} ${entry.vulnerability.cveID} ${entry.vulnerability.vulnerabilityName}`,
            ...entry.affectedPackages.map(
              (affectedPackage) =>
                `  - ${affectedPackage.repositoryName} ${affectedPackage.ecosystem} ${affectedPackage.packageName} ${affectedPackage.packageVersion}`,
            ),
          ].join('\n'),
        )
        .join('\n'),
      [manager],
      [],
    );
  };
}
