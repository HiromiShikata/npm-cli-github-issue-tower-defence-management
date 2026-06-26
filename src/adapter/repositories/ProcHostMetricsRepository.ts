import * as fs from 'fs';
import * as path from 'path';

export type CpuSample = {
  total: number;
  idle: number;
};

export type LoadAverages = {
  oneMinute: number;
  fiveMinute: number;
  fifteenMinute: number;
};

const DEFAULT_PROC_DIRECTORY = '/proc';
const DEFAULT_ROOT_PATH = '/';
const CPU_SAMPLE_INTERVAL_MS = 400;

export type DiskBlocks = {
  blocks: number;
  bfree: number;
  bavail: number;
};

export const parseMemoryUsedPercent = (meminfoText: string): number => {
  const fields = new Map<string, number>();
  for (const line of meminfoText.split('\n')) {
    const separatorIndex = line.indexOf(':');
    if (separatorIndex <= 0) {
      continue;
    }
    const key = line.slice(0, separatorIndex).trim();
    const valuePart = line
      .slice(separatorIndex + 1)
      .trim()
      .split(/\s+/)[0];
    const value = Number(valuePart);
    if (Number.isFinite(value)) {
      fields.set(key, value);
    }
  }
  const total = fields.get('MemTotal');
  const available = fields.get('MemAvailable');
  if (total === undefined || available === undefined) {
    throw new Error('MemTotal and MemAvailable are required');
  }
  if (total <= 0) {
    throw new Error('MemTotal must be positive');
  }
  const used = total - available;
  return Math.round((used / total) * 100);
};

export const parseCpuSample = (statText: string): CpuSample => {
  for (const line of statText.split('\n')) {
    if (line.startsWith('cpu ')) {
      const values = line
        .trim()
        .split(/\s+/)
        .slice(1)
        .map((value) => Number(value));
      if (values.some((value) => !Number.isFinite(value))) {
        throw new Error('aggregate cpu line contains non-numeric values');
      }
      const idle = values[3] + (values.length > 4 ? values[4] : 0);
      const total = values.reduce((sum, value) => sum + value, 0);
      return { total, idle };
    }
  }
  throw new Error('aggregate cpu line not found');
};

export const cpuUsedPercentFromSamples = (
  first: CpuSample,
  second: CpuSample,
): number => {
  const totalDelta = second.total - first.total;
  const idleDelta = second.idle - first.idle;
  if (totalDelta <= 0) {
    throw new Error('total delta must be positive');
  }
  const busyDelta = totalDelta - idleDelta;
  return Math.round((busyDelta / totalDelta) * 100);
};

export const parseDiskUsedPercent = (
  blocks: number,
  bfree: number,
  bavail: number,
): number => {
  const total = blocks - bfree + bavail;
  if (total <= 0) {
    throw new Error('disk total must be positive');
  }
  const used = blocks - bfree;
  return Math.round((used / total) * 100);
};

export const parseLoadAverages = (loadavgText: string): LoadAverages => {
  const parts = loadavgText.trim().split(/\s+/);
  const oneMinute = Number(parts[0]);
  const fiveMinute = Number(parts[1]);
  const fifteenMinute = Number(parts[2]);
  if (
    !Number.isFinite(oneMinute) ||
    !Number.isFinite(fiveMinute) ||
    !Number.isFinite(fifteenMinute)
  ) {
    throw new Error('loadavg must contain three numeric values');
  }
  return { oneMinute, fiveMinute, fifteenMinute };
};

export const cycleMinutesFromMtimes = (
  mtimesDescendingSeconds: number[],
): number | null => {
  if (mtimesDescendingSeconds.length < 2) {
    return null;
  }
  return Math.round(
    (mtimesDescendingSeconds[0] - mtimesDescendingSeconds[1]) / 60,
  );
};

export class ProcHostMetricsRepository {
  constructor(
    private readonly procDirectory: string = DEFAULT_PROC_DIRECTORY,
    private readonly sleep: (milliseconds: number) => Promise<void> = (
      milliseconds,
    ) =>
      new Promise((resolve) => {
        setTimeout(resolve, milliseconds);
      }),
    private readonly readDiskBlocks: (rootPath: string) => DiskBlocks = (
      rootPath,
    ) => {
      const stats = fs.statfsSync(rootPath);
      return {
        blocks: Number(stats.blocks),
        bfree: Number(stats.bfree),
        bavail: Number(stats.bavail),
      };
    },
    private readonly rootPath: string = DEFAULT_ROOT_PATH,
  ) {}

  readMemoryUsedPercent = (): number =>
    parseMemoryUsedPercent(
      fs.readFileSync(path.join(this.procDirectory, 'meminfo'), 'utf8'),
    );

  readCpuUsedPercent = async (): Promise<number> => {
    const first = parseCpuSample(
      fs.readFileSync(path.join(this.procDirectory, 'stat'), 'utf8'),
    );
    await this.sleep(CPU_SAMPLE_INTERVAL_MS);
    const second = parseCpuSample(
      fs.readFileSync(path.join(this.procDirectory, 'stat'), 'utf8'),
    );
    return cpuUsedPercentFromSamples(first, second);
  };

  readLoadAverages = (): LoadAverages =>
    parseLoadAverages(
      fs.readFileSync(path.join(this.procDirectory, 'loadavg'), 'utf8'),
    );

  readDiskUsedPercent = (): number => {
    const { blocks, bfree, bavail } = this.readDiskBlocks(this.rootPath);
    return parseDiskUsedPercent(blocks, bfree, bavail);
  };
}
