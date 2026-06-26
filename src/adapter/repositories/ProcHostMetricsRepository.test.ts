import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  DiskBlocks,
  ProcHostMetricsRepository,
  cpuUsedPercentFromSamples,
  cycleMinutesFromMtimes,
  parseCpuSample,
  parseDiskUsedPercent,
  parseLoadAverages,
  parseMemoryUsedPercent,
} from './ProcHostMetricsRepository';

describe('parseMemoryUsedPercent', () => {
  it('computes (total - available) / total rounded to a whole percent', () => {
    expect(
      parseMemoryUsedPercent(
        'MemTotal: 1000 kB\nMemFree: 100 kB\nMemAvailable: 380 kB\n',
      ),
    ).toBe(62);
  });

  it('throws when MemTotal is not positive', () => {
    expect(() =>
      parseMemoryUsedPercent('MemTotal: 0 kB\nMemAvailable: 0 kB\n'),
    ).toThrow();
  });
});

describe('parseCpuSample', () => {
  it('uses the aggregate cpu line with idle = idle + iowait and total = sum of all fields', () => {
    expect(
      parseCpuSample('cpu  100 0 100 700 100 0 0 0 0 0\ncpu0 1 2 3 4\n'),
    ).toEqual({ total: 1000, idle: 800 });
  });

  it('throws when there is no aggregate cpu line', () => {
    expect(() => parseCpuSample('cpu0 1 2 3 4\n')).toThrow();
  });
});

describe('cpuUsedPercentFromSamples', () => {
  it('computes (total_delta - idle_delta) / total_delta', () => {
    expect(
      cpuUsedPercentFromSamples(
        { total: 1000, idle: 700 },
        { total: 1100, idle: 770 },
      ),
    ).toBe(30);
  });

  it('throws when the total delta is not positive', () => {
    expect(() =>
      cpuUsedPercentFromSamples(
        { total: 1000, idle: 700 },
        { total: 1000, idle: 700 },
      ),
    ).toThrow();
  });
});

describe('parseLoadAverages', () => {
  it('parses the first three floats from /proc/loadavg', () => {
    expect(parseLoadAverages('1.20 0.98 0.75 1/123 4567\n')).toEqual({
      oneMinute: 1.2,
      fiveMinute: 0.98,
      fifteenMinute: 0.75,
    });
  });

  it('throws when fewer than three numeric values are present', () => {
    expect(() => parseLoadAverages('1.20 0.98\n')).toThrow();
  });
});

describe('parseDiskUsedPercent', () => {
  it('excludes root-reserved blocks from the denominator like df', () => {
    expect(parseDiskUsedPercent(1100, 200, 100)).toBe(90);
  });

  it('matches df when there is no root reservation (bfree equals bavail)', () => {
    expect(parseDiskUsedPercent(1000, 100, 100)).toBe(90);
  });

  it('throws when the disk total is not positive', () => {
    expect(() => parseDiskUsedPercent(100, 200, 0)).toThrow();
  });
});

describe('cycleMinutesFromMtimes', () => {
  it('rounds the gap between the two newest generations to whole minutes', () => {
    expect(cycleMinutesFromMtimes([1782469254.0, 1782468443.0])).toBe(14);
  });

  it('rounds a 1620 second gap to 27 minutes', () => {
    expect(cycleMinutesFromMtimes([1620.0, 0.0])).toBe(27);
  });

  it('returns null when a second generation is missing', () => {
    expect(cycleMinutesFromMtimes([1000.0])).toBeNull();
    expect(cycleMinutesFromMtimes([])).toBeNull();
  });
});

describe('ProcHostMetricsRepository', () => {
  let procDirectory: string;

  beforeEach(() => {
    procDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'fake-proc-host-'));
  });

  afterEach(() => {
    fs.rmSync(procDirectory, { recursive: true, force: true });
  });

  it('reads memory used percent from /proc/meminfo', () => {
    fs.writeFileSync(
      path.join(procDirectory, 'meminfo'),
      'MemTotal: 1000 kB\nMemAvailable: 380 kB\n',
    );
    const repository = new ProcHostMetricsRepository(procDirectory);
    expect(repository.readMemoryUsedPercent()).toBe(62);
  });

  it('reads load averages from /proc/loadavg', () => {
    fs.writeFileSync(
      path.join(procDirectory, 'loadavg'),
      '2.00 1.00 0.50 1/100 200\n',
    );
    const repository = new ProcHostMetricsRepository(procDirectory);
    expect(repository.readLoadAverages()).toEqual({
      oneMinute: 2.0,
      fiveMinute: 1.0,
      fifteenMinute: 0.5,
    });
  });

  it('reads the df-style disk used percent from the root filesystem statfs', () => {
    const diskBlocks: DiskBlocks = { blocks: 1100, bfree: 200, bavail: 100 };
    const repository = new ProcHostMetricsRepository(
      procDirectory,
      async () => {},
      () => diskBlocks,
    );
    expect(repository.readDiskUsedPercent()).toBe(90);
  });

  it('samples /proc/stat twice and computes the busy percent', async () => {
    const statPath = path.join(procDirectory, 'stat');
    let sampleIndex = 0;
    fs.writeFileSync(statPath, 'cpu  700 0 0 300 0 0 0 0 0 0\n');
    const sleep = async (): Promise<void> => {
      sampleIndex += 1;
      fs.writeFileSync(statPath, 'cpu  770 0 0 330 0 0 0 0 0 0\n');
    };
    const repository = new ProcHostMetricsRepository(procDirectory, sleep);
    expect(await repository.readCpuUsedPercent()).toBe(70);
    expect(sampleIndex).toBe(1);
  });
});
