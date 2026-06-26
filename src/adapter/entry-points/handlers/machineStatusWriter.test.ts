import fs from 'fs';
import os from 'os';
import path from 'path';
import { ProcHostMetricsRepository } from '../../repositories/ProcHostMetricsRepository';
import { MachineStatusFile, writeMachineStatus } from './machineStatusWriter';

const readJson = (filePath: string): unknown =>
  JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;

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
  return { repository: new ProcHostMetricsRepository(procDirectory, sleep) };
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

  it('writes machine-status.json with mem, cpu, load and cycle minutes', async () => {
    const { repository } = buildHostMetricsRepository(procDirectory);
    const cacheDir = path.join(dir, 'allIssues-PVT');
    fs.mkdirSync(cacheDir, { recursive: true });
    const newer = path.join(cacheDir, 'a.json');
    const older = path.join(cacheDir, 'b.json');
    fs.writeFileSync(older, '[]');
    fs.writeFileSync(newer, '[]');
    const base = Date.now();
    fs.utimesSync(older, new Date(base - 900000), new Date(base - 900000));
    fs.utimesSync(newer, new Date(base), new Date(base));

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
      load: [1.5, 0.8, 0.4],
      cycleMinutes: 15,
      capturedAt: '2026-06-26T12:00:00.000Z',
    };
    expect(written).toEqual(expected);
  });

  it('writes cycleMinutes null when fewer than two cache files exist', async () => {
    const { repository } = buildHostMetricsRepository(procDirectory);
    const cacheDir = path.join(dir, 'allIssues-PVT');
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(path.join(cacheDir, 'only.json'), '[]');

    await writeMachineStatus({
      dashboardDataDir: dir,
      allIssuesCacheDir: cacheDir,
      hostMetricsRepository: repository,
    });

    const written = readJson(path.join(dir, 'machine-status.json'));
    expect(written).toMatchObject({ cycleMinutes: null });
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
