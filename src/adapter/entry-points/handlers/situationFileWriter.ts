import fs from 'fs';
import type { Issue } from '../../../domain/entities/Issue';
import type { LocalCommandRunner } from '../../../domain/usecases/adapter-interfaces/LocalCommandRunner';

export type SituationFileParams = {
  cachePath: string;
  projectId: string;
  issues: Issue[];
  statusNames: {
    awaitingQualityCheckStatus: string | null;
    preparationStatus: string | null;
    awaitingWorkspaceStatus: string | null;
    failedPreparationStatus: string | null;
  };
  config: {
    maximumPreparingIssuesCount: number | null;
    utilizationPercentageThreshold: number;
    thresholdForAutoReject: number;
  };
  preparationProcessCheckCommand?: string | null;
  localCommandRunner?: LocalCommandRunner;
};

type MeminfoValues = {
  memTotalKb: number;
  memAvailableKb: number;
  swapTotalKb: number;
  swapFreeKb: number;
};

export const parseMeminfo = (meminfo: string): MeminfoValues => {
  const getValue = (key: string): number => {
    const match = meminfo.match(new RegExp(`^${key}:\\s+(\\d+)`, 'm'));
    return match ? parseInt(match[1], 10) : 0;
  };
  return {
    memTotalKb: getValue('MemTotal'),
    memAvailableKb: getValue('MemAvailable'),
    swapTotalKb: getValue('SwapTotal'),
    swapFreeKb: getValue('SwapFree'),
  };
};

const kbToGib = (kb: number): number =>
  Math.round((kb / 1024 / 1024) * 100) / 100;

const toPercent = (used: number, total: number): number =>
  total > 0 ? Math.round((used / total) * 1000) / 10 : 0;

const isImmediatelyActionable = (issue: Issue): boolean =>
  !issue.isClosed &&
  issue.dependedIssueUrls.length === 0 &&
  issue.nextActionDate === null &&
  issue.nextActionHour === null;

const countRunningProcesses = async (
  preparationIssues: Issue[],
  commandTemplate: string,
  localCommandRunner: LocalCommandRunner,
): Promise<number> => {
  const resolvedTemplate = commandTemplate.replace('{URL}', '$1');
  const checks = await Promise.all(
    preparationIssues.map(async (issue) => {
      const { exitCode } = await localCommandRunner.runCommand('sh', [
        '-c',
        resolvedTemplate,
        '--',
        issue.url,
      ]);
      return exitCode === 0;
    }),
  );
  return checks.filter(Boolean).length;
};

export const writeSituationFile = async (
  params: SituationFileParams,
): Promise<void> => {
  const {
    cachePath,
    projectId,
    issues,
    statusNames,
    config,
    preparationProcessCheckCommand,
    localCommandRunner,
  } = params;

  const awaitingQualityCheckImmediatelyActionable =
    statusNames.awaitingQualityCheckStatus !== null
      ? issues.filter(
          (i) =>
            i.status === statusNames.awaitingQualityCheckStatus &&
            isImmediatelyActionable(i),
        ).length
      : 0;

  const preparationIssues =
    statusNames.preparationStatus !== null
      ? issues.filter((i) => i.status === statusNames.preparationStatus)
      : [];

  const awaitingWorkspaceIssues =
    statusNames.awaitingWorkspaceStatus !== null
      ? issues.filter((i) => i.status === statusNames.awaitingWorkspaceStatus)
      : [];

  const failedPreparation =
    statusNames.failedPreparationStatus !== null
      ? issues.filter((i) => i.status === statusNames.failedPreparationStatus)
          .length
      : 0;

  const awaitingWorkspaceImmediatelyActionable = awaitingWorkspaceIssues.filter(
    isImmediatelyActionable,
  ).length;

  const awaitingWorkspaceBlockedByDependency = awaitingWorkspaceIssues.filter(
    (i) => i.dependedIssueUrls.length > 0,
  ).length;

  let runningPreparation: number | null = null;
  if (
    preparationProcessCheckCommand &&
    localCommandRunner &&
    preparationIssues.length > 0
  ) {
    runningPreparation = await countRunningProcesses(
      preparationIssues,
      preparationProcessCheckCommand,
      localCommandRunner,
    );
  } else if (preparationProcessCheckCommand && localCommandRunner) {
    runningPreparation = 0;
  }

  const meminfo = fs.readFileSync('/proc/meminfo', 'utf-8');
  const { memTotalKb, memAvailableKb, swapTotalKb, swapFreeKb } =
    parseMeminfo(meminfo);

  const memUsedKb = memTotalKb - memAvailableKb;
  const swapUsedKb = swapTotalKb - swapFreeKb;

  const situation = {
    capturedAt: new Date().toISOString(),
    config,
    status: {
      awaitingQualityCheckImmediatelyActionable,
      preparation: preparationIssues.length,
      awaitingWorkspaceImmediatelyActionable,
      awaitingWorkspaceBlockedByDependency,
      failedPreparation,
    },
    processes: {
      runningPreparation,
    },
    system: {
      memory: {
        usedPercent: toPercent(memUsedKb, memTotalKb),
        usedGib: kbToGib(memUsedKb),
        totalGib: kbToGib(memTotalKb),
      },
      swap: {
        usedPercent: toPercent(swapUsedKb, swapTotalKb),
        usedGib: kbToGib(swapUsedKb),
        totalGib: kbToGib(swapTotalKb),
      },
    },
  };

  const finalPath = `${cachePath}/situation-${projectId}.json`;
  const tmpPath = `${finalPath}.tmp`;
  fs.mkdirSync(cachePath, { recursive: true });
  fs.writeFileSync(tmpPath, JSON.stringify(situation));
  fs.renameSync(tmpPath, finalPath);
};
