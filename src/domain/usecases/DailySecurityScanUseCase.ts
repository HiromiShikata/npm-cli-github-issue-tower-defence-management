import { LocalCommandRunner } from './adapter-interfaces/LocalCommandRunner';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { HttpRepository } from './adapter-interfaces/HttpRepository';
import { KevReportWatermarkRepository } from './adapter-interfaces/KevReportWatermarkRepository';
import { DailySecurityScanRunLogRepository } from './adapter-interfaces/DailySecurityScanRunLogRepository';
import {
  commentCreateWithDedupRetry,
  realSleep,
  Sleep,
} from '../services/commentCreateWithDedupRetry';
import { KevReportWatermark } from '../entities/KevReportWatermark';
import { DailySecurityScanRunLogEntry } from '../entities/DailySecurityScanRunLogEntry';
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

type DailySecurityScanCheckoutResult =
  | { type: 'checkedOut'; checkoutDirectory: string; clonedCommitSha: string }
  | { type: 'checkoutFailed'; reason: string };

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
  const toRecord = (value: unknown): Record<string, unknown> =>
    typeof value === 'object' && value !== null ? { ...value } : {};
  const readArray = (value: unknown, key: string): unknown[] => {
    const entry = toRecord(value)[key];
    return Array.isArray(entry) ? entry : [];
  };
  const readString = (value: unknown, key: string): string => {
    const entry = toRecord(value)[key];
    return typeof entry === 'string' ? entry : '';
  };
  return readArray(parsed, 'results').flatMap((result) =>
    readArray(result, 'packages').flatMap((scannedPackage) => {
      const packageDetail = toRecord(scannedPackage).package;
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

const OSV_SCANNER_NO_PACKAGE_SOURCES_FOUND_EXIT_CODE = 128;

const dayBeforeUtcYmd = (date: Date): string => {
  const dayBefore = new Date(date);
  dayBefore.setUTCDate(dayBefore.getUTCDate() - 1);
  return dayBefore.toISOString().slice(0, 10);
};

const advanceWatermark = (
  storedWatermark: KevReportWatermark | null,
  reportedVulnerabilities: KevVulnerability[],
): KevReportWatermark => {
  const lastReportedDateAdded = reportedVulnerabilities.reduce(
    (latest, vulnerability) =>
      vulnerability.dateAdded > latest ? vulnerability.dateAdded : latest,
    storedWatermark === null ? '' : storedWatermark.lastReportedDateAdded,
  );
  const reportedCveIdsOnLastReportedDateAdded = new Set<string>(
    storedWatermark !== null &&
      storedWatermark.lastReportedDateAdded === lastReportedDateAdded
      ? storedWatermark.reportedCveIdsOnLastReportedDateAdded
      : [],
  );
  for (const vulnerability of reportedVulnerabilities) {
    if (vulnerability.dateAdded === lastReportedDateAdded) {
      reportedCveIdsOnLastReportedDateAdded.add(vulnerability.cveID);
    }
  }
  return {
    lastReportedDateAdded,
    reportedCveIdsOnLastReportedDateAdded: Array.from(
      reportedCveIdsOnLastReportedDateAdded,
    ),
  };
};

export class DailySecurityScanUseCase {
  constructor(
    readonly localCommandRunner: LocalCommandRunner,
    readonly issueRepository: Pick<
      IssueRepository,
      | 'createNewIssue'
      | 'searchIssue'
      | 'createCommentByUrl'
      | 'getIssueOrPullRequestComments'
    >,
    readonly httpRepository: HttpRepository,
    readonly kevReportWatermarkRepository: KevReportWatermarkRepository,
    private readonly dailySecurityScanRunLogRepository: DailySecurityScanRunLogRepository,
    private readonly clock: () => Date = () => new Date(),
    private readonly sleep: Sleep = realSleep,
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

    const remoteUrlByRepositoryName = new Map<string, string>();
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
      if (!remoteUrlByRepositoryName.has(remoteMatch[2])) {
        remoteUrlByRepositoryName.set(remoteMatch[2], remoteUrl.trim());
      }
    }

    const scannedVulnerablePackages: ScannedVulnerablePackage[] = [];
    for (const [repositoryName, remoteUrl] of remoteUrlByRepositoryName) {
      const repositoryOrg = org;
      const executedAtIso = this.clock().toISOString();
      const checkoutResult = await this.checkoutDefaultBranch(
        repositoryName,
        remoteUrl,
      );
      if (checkoutResult.type === 'checkoutFailed') {
        await this.appendDailySecurityScanRunLogEntry({
          repositoryName,
          executedAtIso,
          outcome: {
            type: 'checkoutFailed',
            reason: checkoutResult.reason,
          },
        });
        continue;
      }
      const { checkoutDirectory, clonedCommitSha } = checkoutResult;

      let scanResult: Awaited<ReturnType<LocalCommandRunner['runCommand']>>;
      try {
        scanResult = await this.localCommandRunner.runCommand('osv-scanner', [
          'scan',
          'source',
          '-r',
          checkoutDirectory,
          '--format',
          'json',
        ]);
      } catch (error) {
        const reason = String(error);
        console.error(
          `osv-scanner could not run for ${repositoryName}: ${reason}`,
        );
        await this.appendDailySecurityScanRunLogEntry({
          repositoryName,
          executedAtIso,
          outcome: {
            type: 'scanFailed',
            clonedCommitSha,
            exitCode: null,
            stderr: reason,
          },
        });
        continue;
      } finally {
        try {
          await this.localCommandRunner.runCommand('rm', [
            '-rf',
            checkoutDirectory,
          ]);
        } catch (error) {
          console.error(
            `Failed to clean up the checkout of ${repositoryName}: ${String(error)}`,
          );
        }
      }
      const {
        stdout: scanOutput,
        stderr: scanStderr,
        exitCode: scanExitCode,
      } = scanResult;
      if (scanExitCode === 0) {
        await this.appendDailySecurityScanRunLogEntry({
          repositoryName,
          executedAtIso,
          outcome: { type: 'scanCompletedClean', clonedCommitSha },
        });
        continue;
      }
      if (scanExitCode === OSV_SCANNER_NO_PACKAGE_SOURCES_FOUND_EXIT_CODE) {
        await this.appendDailySecurityScanRunLogEntry({
          repositoryName,
          executedAtIso,
          outcome: { type: 'scanNoPackageSourcesFound', clonedCommitSha },
        });
        continue;
      }
      if (scanExitCode !== 1) {
        console.error(
          `osv-scanner failed with exit code ${scanExitCode} for ${repositoryName}: ${scanStderr}`,
        );
        await this.appendDailySecurityScanRunLogEntry({
          repositoryName,
          executedAtIso,
          outcome: {
            type: 'scanFailed',
            clonedCommitSha,
            exitCode: scanExitCode,
            stderr: scanStderr,
          },
        });
        continue;
      }

      const vulnerablePackages = parseScannerVulnerabilities(
        repositoryName,
        scanOutput,
      );
      scannedVulnerablePackages.push(...vulnerablePackages);
      await this.appendDailySecurityScanRunLogEntry({
        repositoryName,
        executedAtIso,
        outcome: {
          type: 'scanCompletedWithVulnerabilities',
          clonedCommitSha,
          vulnerablePackageCount: vulnerablePackages.length,
        },
      });

      const findingsBody = renderScannerFindings(today, vulnerablePackages);
      try {
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
          await this.createCommentByUrlWithDedup(
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
      } catch (error) {
        console.error(
          `The findings of ${repositoryOrg}/${repositoryName} were not written to GitHub: ${String(error)}. The remaining repositories are still scanned and the CISA KEV report still runs.`,
        );
      }
    }
    return scannedVulnerablePackages;
  };

  private appendDailySecurityScanRunLogEntry = async (
    entry: DailySecurityScanRunLogEntry,
  ): Promise<void> => {
    try {
      await this.dailySecurityScanRunLogRepository.append(entry);
    } catch (error) {
      console.error(
        `Failed to persist the daily security scan run log entry for ${entry.repositoryName}: ${String(error)}. The remaining repositories are still scanned.`,
      );
    }
  };

  private createCommentByUrlWithDedup = async (
    url: string,
    commentBody: string,
  ): Promise<void> => {
    await commentCreateWithDedupRetry(
      commentBody,
      async () => {
        const existing =
          await this.issueRepository.getIssueOrPullRequestComments(url);
        return existing.map((c) => ({
          text: c.body,
          createdAt: c.createdAt,
        }));
      },
      async () => {
        await this.issueRepository.createCommentByUrl(url, commentBody);
      },
      () => new Date(),
      this.sleep,
    );
  };

  private checkoutDefaultBranch = async (
    repositoryName: string,
    remoteUrl: string,
  ): Promise<DailySecurityScanCheckoutResult> => {
    const { stdout: checkoutDirectoryOutput, exitCode: checkoutDirectoryExit } =
      await this.localCommandRunner.runCommand('mktemp', [
        '-d',
        '-t',
        `tdpm-daily-security-scan-${repositoryName}-XXXXXX`,
      ]);
    const checkoutDirectory = checkoutDirectoryOutput.trim();
    if (checkoutDirectoryExit !== 0 || checkoutDirectory.length === 0) {
      const reason = `Failed to create a checkout directory for ${repositoryName}`;
      console.error(reason);
      return { type: 'checkoutFailed', reason };
    }
    const { stderr: cloneStderr, exitCode: cloneExitCode } =
      await this.localCommandRunner.runCommand('git', [
        'clone',
        '--depth',
        '1',
        remoteUrl,
        checkoutDirectory,
      ]);
    if (cloneExitCode !== 0) {
      const reason = `Failed to clone the default branch of ${repositoryName}: ${cloneStderr}`;
      console.error(reason);
      await this.localCommandRunner.runCommand('rm', [
        '-rf',
        checkoutDirectory,
      ]);
      return { type: 'checkoutFailed', reason };
    }
    const {
      stdout: revParseStdout,
      stderr: revParseStderr,
      exitCode: revParseExitCode,
    } = await this.localCommandRunner.runCommand('git', [
      '-C',
      checkoutDirectory,
      'rev-parse',
      'HEAD',
    ]);
    if (revParseExitCode !== 0) {
      const reason = `Failed to resolve the cloned commit SHA for ${repositoryName}: ${revParseStderr}`;
      console.error(reason);
      await this.localCommandRunner.runCommand('rm', [
        '-rf',
        checkoutDirectory,
      ]);
      return { type: 'checkoutFailed', reason };
    }
    return {
      type: 'checkedOut',
      checkoutDirectory,
      clonedCommitSha: revParseStdout.trim(),
    };
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

    const watermarkLoadResult = await this.kevReportWatermarkRepository.load();
    if (watermarkLoadResult.type === 'unreadable') {
      console.error(
        `Skipping the CISA KEV report for this run because ${watermarkLoadResult.reason}. The stored watermark is left unchanged and no issue was created; reporting resumes once the stored watermark is readable again.`,
      );
      return;
    }
    const storedWatermark =
      watermarkLoadResult.type === 'stored'
        ? watermarkLoadResult.watermark
        : null;
    const reportBoundaryDateAdded =
      storedWatermark === null
        ? dayBeforeUtcYmd(lastTargetDate)
        : storedWatermark.lastReportedDateAdded;
    const alreadyReportedCveIdsOnBoundary = new Set<string>(
      storedWatermark === null
        ? []
        : storedWatermark.reportedCveIdsOnLastReportedDateAdded,
    );

    const kevJson = await this.httpRepository.get(KEV_CATALOG_URL);
    const parsedKev: unknown = JSON.parse(kevJson);
    if (!isKevCatalog(parsedKev)) {
      throw new Error(
        `Unexpected CISA KEV catalog format from ${KEV_CATALOG_URL}`,
      );
    }

    const unreportedVulnerabilities = parsedKev.vulnerabilities.filter(
      (vulnerability) =>
        vulnerability.dateAdded > reportBoundaryDateAdded ||
        (vulnerability.dateAdded === reportBoundaryDateAdded &&
          !alreadyReportedCveIdsOnBoundary.has(vulnerability.cveID)),
    );
    if (unreportedVulnerabilities.length === 0) {
      return;
    }
    const advancedWatermark = advanceWatermark(
      storedWatermark,
      unreportedVulnerabilities,
    );
    const saveAdvancedWatermark = async (): Promise<void> => {
      try {
        await this.kevReportWatermarkRepository.save(advancedWatermark);
      } catch (error) {
        console.error(
          `The CISA KEV additions considered in this run were not recorded because the KEV report watermark file did not advance to ${advancedWatermark.lastReportedDateAdded}: ${String(error)}. Those additions will be considered again on the next run, and the rest of the scheduled work continues.`,
        );
      }
    };

    const affectingKevEntries = unreportedVulnerabilities
      .map((vulnerability) => ({
        vulnerability,
        affectedPackages: scannedVulnerablePackages.filter((scannedPackage) =>
          scannedPackage.vulnerabilityIdentifiers.includes(vulnerability.cveID),
        ),
      }))
      .filter((entry) => entry.affectedPackages.length > 0);
    if (affectingKevEntries.length === 0) {
      await saveAdvancedWatermark();
      return;
    }

    await this.issueRepository.createNewIssue(
      org,
      config.kevReportRepo,
      `CISA KEV new additions since ${reportBoundaryDateAdded}`,
      `${affectingKevEntries
        .map((entry) =>
          [
            `- ${entry.vulnerability.dateAdded} ${entry.vulnerability.cveID} ${entry.vulnerability.vulnerabilityName}`,
            ...entry.affectedPackages.map(
              (affectedPackage) =>
                `  - ${affectedPackage.repositoryName} ${affectedPackage.ecosystem} ${affectedPackage.packageName} ${affectedPackage.packageVersion}`,
            ),
          ].join('\n'),
        )
        .join('\n')}`,
      [manager],
      [],
    );

    await saveAdvancedWatermark();
  };
}
