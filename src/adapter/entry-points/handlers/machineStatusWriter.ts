import fs from 'fs';
import path from 'path';
import { DiskConfig } from '../cli/projectConfig';
import {
  ProcHostMetricsRepository,
  cycleMinutesFromFetchTimestamps,
} from '../../repositories/ProcHostMetricsRepository';

export type MachineStatusWriterParams = {
  dashboardDataDir: string | null | undefined;
  allIssuesCacheDir: string | null | undefined;
  disks?: DiskConfig[] | null;
  hostMetricsRepository?: ProcHostMetricsRepository;
  now?: Date;
};

export type MachineStatusDisk = {
  title: string;
  pct: number;
};

export type MachineStatusFile = {
  memPct: number;
  cpuPct: number;
  diskPct: number;
  disks?: MachineStatusDisk[];
  load: [number, number, number];
  cycleMinutes: number | null;
  lastFetchedAt: string | null;
  capturedAt: string;
};

const writeJsonAtomic = (filePath: string, data: unknown): void => {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data));
  fs.renameSync(tmpPath, filePath);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const readLastFetchedAtFromJsonFile = (filePath: string): string | null => {
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (isRecord(parsed) && typeof parsed.lastFetchedAt === 'string') {
    return parsed.lastFetchedAt;
  }
  return null;
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

  const configuredDisks = params.disks ?? [];
  const disks: MachineStatusDisk[] = configuredDisks.map((disk) => ({
    title: disk.title,
    pct: hostMetricsRepository.readDiskUsedPercentForMountpoint(
      disk.mountpoint,
    ),
  }));

  const machineStatusPath = path.join(dashboardDataDir, 'machine-status.json');
  const previousLastFetchedAt =
    readLastFetchedAtFromJsonFile(machineStatusPath);
  const currentLastFetchedAt = allIssuesCacheDir
    ? readLastFetchedAtFromJsonFile(path.join(allIssuesCacheDir, 'latest.json'))
    : null;
  const cycleMinutes = cycleMinutesFromFetchTimestamps(
    previousLastFetchedAt,
    currentLastFetchedAt,
  );

  const file: MachineStatusFile = {
    memPct,
    cpuPct,
    diskPct,
    ...(disks.length > 0 ? { disks } : {}),
    load: [load.oneMinute, load.fiveMinute, load.fifteenMinute],
    cycleMinutes,
    lastFetchedAt: currentLastFetchedAt,
    capturedAt: (params.now ?? new Date()).toISOString(),
  };

  writeJsonAtomic(machineStatusPath, file);
};
