import { LocalCommandRunner } from './adapter-interfaces/LocalCommandRunner';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { HttpRepository } from './adapter-interfaces/HttpRepository';
import { KevReportWatermarkRepository } from './adapter-interfaces/KevReportWatermarkRepository';
import { KevReportWatermark } from '../entities/KevReportWatermark';
import { Member } from '../entities/Member';

export type DailySecurityScanConfig = {
  scanBaseDirectory: string;
  targetHourUtc: number;
  enableKevNvdReport?: boolean;
  kevReportRepo?: string;
};

type KevVulnerability = {
  cveID: string;
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

const KEV_CATALOG_URL =
  'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json';

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
    readonly issueRepository: Pick<IssueRepository, 'createNewIssue'>,
    readonly httpRepository: HttpRepository,
    readonly kevReportWatermarkRepository: KevReportWatermarkRepository,
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

    await this.scanRepositories(
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
    );
  };

  private scanRepositories = async (
    org: string,
    manager: Member['name'],
    today: string,
    config: DailySecurityScanConfig,
  ): Promise<void> => {
    const { stdout: findOutput } = await this.localCommandRunner.runCommand(
      'find',
      [
        config.scanBaseDirectory,
        '-mindepth',
        '4',
        '-maxdepth',
        '4',
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

      const { stdout: scanOutput, exitCode: scanExitCode } =
        await this.localCommandRunner.runCommand('osv-scanner', [
          'scan',
          'source',
          '-r',
          repositoryDirectory,
        ]);
      if (scanExitCode !== 1) {
        continue;
      }

      await this.issueRepository.createNewIssue(
        repositoryOrg,
        repositoryName,
        `Daily security scan findings: ${today}`,
        `## OSV-Scanner findings\n\n\`\`\`\n${scanOutput}\n\`\`\``,
        [manager],
        [],
      );
    }
  };

  private reportKevAdditions = async (
    org: string,
    manager: Member['name'],
    lastTargetDate: Date,
    config: DailySecurityScanConfig,
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

    await this.issueRepository.createNewIssue(
      org,
      config.kevReportRepo,
      `CISA KEV new additions since ${reportBoundaryDateAdded}`,
      unreportedVulnerabilities
        .map(
          (vulnerability) =>
            `- ${vulnerability.dateAdded} ${vulnerability.cveID} ${vulnerability.vulnerabilityName}`,
        )
        .join('\n'),
      [manager],
      [],
    );

    const advancedWatermark = advanceWatermark(
      storedWatermark,
      unreportedVulnerabilities,
    );
    try {
      await this.kevReportWatermarkRepository.save(advancedWatermark);
    } catch (error) {
      console.error(
        `The CISA KEV report issue was created but the KEV report watermark file did not advance to ${advancedWatermark.lastReportedDateAdded}: ${String(error)}. The additions in that issue will be reported again on the next run, and the rest of the scheduled work continues.`,
      );
    }
  };
}
