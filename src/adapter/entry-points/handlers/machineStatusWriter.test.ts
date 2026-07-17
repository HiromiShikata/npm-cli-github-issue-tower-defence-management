import fs from 'fs';
import os from 'os';
import path from 'path';
import { ProcHostMetricsRepository } from '../../repositories/ProcHostMetricsRepository';
import { MachineStatusFile, writeMachineStatus } from './machineStatusWriter';

const readJson = (filePath: string): unknown =>
  JSON.parse(fs.readFileSync(filePath, 'utf8'));

const buildHostMetricsRepository = (
  procDirectory: string,
): {
  repository: ProcHostMetricsRepository;
} => {
  fs.writeFileSync(
    path.join(procDirectory, 'meminfo'),
    'MemTotal: 1000 kB\nMemAvailable: 450 kB\n',
  );
  fs.writeFileSync(
    path.join(procDirectory, 'loadavg'),
    '1.50 0.80 0.40 1/100 200\n',
  );
  const statPath = path.join(procDirectory, 'stat');
  fs.writeFileSync(statPath, 'cpu  600 0 0 400 0 0 0 0 0 0\n');
  const sleep = async (): Promise<void> => {
    fs.writeFileSync(statPath, 'cpu  660 0 0 440 0 0 0 0 0 0\n');
  };
  const readDiskBlocks = (): {
    blocks: number;
    bfree: number;
    bavail: number;
  } => ({ blocks: 1100, bfree: 200, bavail: 100 });
  return {
    repository: new ProcHostMetricsRepository(
      procDirectory,
      sleep,
      readDiskBlocks,
    ),
  };
};

describe('writeMachineStatus', () => {
  let dir: string;
  let procDirectory: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'machine-status-'));
    procDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'machine-proc-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(procDirectory, { recursive: true, force: true });
  });

  it('writes machine-status.json with mem, cpu, disk, load and cycle minutes derived from lastFetchedAt', async () => {
    const { repository } = buildHostMetricsRepository(procDirectory);
    const cacheDir = path.join(dir, 'allIssues-PVT');
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(
      path.join(cacheDir, 'latest.json'),
      JSON.stringify({
        lastFetchedAt: '2026-06-26T12:00:00.000Z',
        lastFullFetchAt: '2026-06-26T11:00:00.000Z',
        project: {},
        issues: [],
      }),
    );
    fs.writeFileSync(
      path.join(dir, 'machine-status.json'),
      JSON.stringify({ lastFetchedAt: '2026-06-26T11:45:00.000Z' }),
    );

    await writeMachineStatus({
      dashboardDataDir: dir,
      allIssuesCacheDir: cacheDir,
      hostMetricsRepository: repository,
      now: new Date('2026-06-26T12:00:00.000Z'),
    });

    const written = readJson(path.join(dir, 'machine-status.json'));
    const expected: MachineStatusFile = {
      memPct: 55,
      cpuPct: 60,
      diskPct: 90,
      load: [1.5, 0.8, 0.4],
      cycleMinutes: 15,
      lastFetchedAt: '2026-06-26T12:00:00.000Z',
      capturedAt: '2026-06-26T12:00:00.000Z',
    };
    expect(written).toEqual(expected);
  });

  it('writes a per-mountpoint disks array when a disks list is configured', async () => {
    fs.writeFileSync(
      path.join(procDirectory, 'meminfo'),
      'MemTotal: 1000 kB\nMemAvailable: 450 kB\n',
    );
    fs.writeFileSync(
      path.join(procDirectory, 'loadavg'),
      '1.50 0.80 0.40 1/100 200\n',
    );
    const statPath = path.join(procDirectory, 'stat');
    fs.writeFileSync(statPath, 'cpu  600 0 0 400 0 0 0 0 0 0\n');
    const sleep = async (): Promise<void> => {
      fs.writeFileSync(statPath, 'cpu  660 0 0 440 0 0 0 0 0 0\n');
    };
    const blocksByMountpoint: Record<
      string,
      { blocks: number; bfree: number; bavail: number }
    > = {
      '/': { blocks: 1100, bfree: 200, bavail: 100 },
      '/mountpoint-secondary': { blocks: 1000, bfree: 700, bavail: 700 },
    };
    const repository = new ProcHostMetricsRepository(
      procDirectory,
      sleep,
      (mountpoint) => blocksByMountpoint[mountpoint],
    );

    await writeMachineStatus({
      dashboardDataDir: dir,
      allIssuesCacheDir: null,
      disks: [
        { title: 'D', mountpoint: '/' },
        { title: 'S', mountpoint: '/mountpoint-secondary' },
      ],
      hostMetricsRepository: repository,
      now: new Date('2026-06-26T12:00:00.000Z'),
    });

    const written = readJson(path.join(dir, 'machine-status.json'));
    expect(written).toMatchObject({
      diskPct: 90,
      disks: [
        { title: 'D', pct: 90 },
        { title: 'S', pct: 30 },
      ],
    });
  });

  it('omits the disks array when no disks list is configured', async () => {
    const { repository } = buildHostMetricsRepository(procDirectory);
    await writeMachineStatus({
      dashboardDataDir: dir,
      allIssuesCacheDir: null,
      hostMetricsRepository: repository,
      now: new Date('2026-06-26T12:00:00.000Z'),
    });
    const written = readJson(path.join(dir, 'machine-status.json'));
    expect(written).toMatchObject({ diskPct: 90 });
    expect(written).not.toHaveProperty('disks');
  });

  it('writes cycleMinutes null when there is no previous machine-status', async () => {
    const { repository } = buildHostMetricsRepository(procDirectory);
    const cacheDir = path.join(dir, 'allIssues-PVT');
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(
      path.join(cacheDir, 'latest.json'),
      JSON.stringify({
        lastFetchedAt: '2026-06-26T12:00:00.000Z',
        lastFullFetchAt: '2026-06-26T11:00:00.000Z',
        project: {},
        issues: [],
      }),
    );

    await writeMachineStatus({
      dashboardDataDir: dir,
      allIssuesCacheDir: cacheDir,
      hostMetricsRepository: repository,
    });

    const written = readJson(path.join(dir, 'machine-status.json'));
    expect(written).toMatchObject({
      cycleMinutes: null,
      lastFetchedAt: '2026-06-26T12:00:00.000Z',
    });
  });

  it('is a no-op when dashboardDataDir is unset', async () => {
    const { repository } = buildHostMetricsRepository(procDirectory);
    await writeMachineStatus({
      dashboardDataDir: null,
      allIssuesCacheDir: null,
      hostMetricsRepository: repository,
    });
    expect(fs.readdirSync(dir)).toEqual([]);
  });
});
