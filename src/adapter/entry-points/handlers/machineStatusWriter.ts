import fs from 'fs';
import path from 'path';
import {
  ProcHostMetricsRepository,
  cycleMinutesFromMtimes,
} from '../../repositories/ProcHostMetricsRepository';

export type MachineStatusWriterParams = {
  dashboardDataDir: string | null | undefined;
  allIssuesCacheDir: string | null | undefined;
  hostMetricsRepository?: ProcHostMetricsRepository;
  now?: Date;
};

export type MachineStatusFile = {
  memPct: number;
  cpuPct: number;
  diskPct: number;
  load: [number, number, number];
  cycleMinutes: number | null;
  capturedAt: string;
};

const writeJsonAtomic = (filePath: string, data: unknown): void => {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data));
  fs.renameSync(tmpPath, filePath);
};

const cacheFileMtimesDescending = (allIssuesCacheDir: string): number[] => {
  let entries: string[];
  try {
    entries = fs.readdirSync(allIssuesCacheDir);
  } catch {
    return [];
  }
  return entries
    .filter((entry) => entry.endsWith('.json'))
    .map((entry) => {
      try {
        return fs.statSync(path.join(allIssuesCacheDir, entry)).mtimeMs / 1000;
      } catch {
        return null;
      }
    })
    .filter((value): value is number => value !== null)
    .sort((a, b) => b - a);
};

export const writeMachineStatus = async (
  params: MachineStatusWriterParams,
): Promise<void> => {
  const { dashboardDataDir, allIssuesCacheDir } = params;
  if (!dashboardDataDir) {
    return;
  }

  const hostMetricsRepository =
    params.hostMetricsRepository ?? new ProcHostMetricsRepository();

  const memPct = hostMetricsRepository.readMemoryUsedPercent();
  const cpuPct = await hostMetricsRepository.readCpuUsedPercent();
  const diskPct = hostMetricsRepository.readDiskUsedPercent();
  const load = hostMetricsRepository.readLoadAverages();

  const cycleMinutes = allIssuesCacheDir
    ? cycleMinutesFromMtimes(cacheFileMtimesDescending(allIssuesCacheDir))
    : null;

  const file: MachineStatusFile = {
    memPct,
    cpuPct,
    diskPct,
    load: [load.oneMinute, load.fiveMinute, load.fifteenMinute],
    cycleMinutes,
    capturedAt: (params.now ?? new Date()).toISOString(),
  };

  writeJsonAtomic(path.join(dashboardDataDir, 'machine-status.json'), file);
};
