import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  buildSshInvocation,
  parseRemoteMetricsOutput,
  parseRemoteSubagentFactsOutput,
  parseWorkerHostsYaml,
  REMOTE_COMMAND_TIMEOUT_MS,
  REMOTE_METRICS_COMMAND,
  REMOTE_SUBAGENT_FACTS_COMMAND,
  REMOTE_SUBAGENT_FACTS_TIMEOUT_MS,
  type RemoteMachineStatusEntry,
  type RemoteMachineStatusFile,
  writeRemoteMachineStatus,
} from './remoteMachineStatusWriter';

const temporaryPaths: string[] = [];

const makeTempDirectory = (): string => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'tdpm-remote-status-'),
  );
  temporaryPaths.push(directory);
  return directory;
};

const makeTempFile = (content: string): string => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'tdpm-remote-status-'),
  );
  temporaryPaths.push(directory);
  const filePath = path.join(directory, 'worker-hosts.yml');
  fs.writeFileSync(filePath, content);
  return filePath;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const isStatusEntry = (value: unknown): value is RemoteMachineStatusEntry => {
  if (!isRecord(value)) return false;
  const load = value.load;
  return (
    typeof value.name === 'string' &&
    typeof value.reachable === 'boolean' &&
    (value.memPct === null || typeof value.memPct === 'number') &&
    (value.cpuPct === null || typeof value.cpuPct === 'number') &&
    (value.diskPct === null || typeof value.diskPct === 'number') &&
    (load === null ||
      (Array.isArray(load) &&
        load.length === 3 &&
        load.every((item) => typeof item === 'number'))) &&
    typeof value.capturedAt === 'string'
  );
};

const parseStatusFile = (content: string): RemoteMachineStatusFile => {
  const parsed: unknown = JSON.parse(content);
  if (
    !isRecord(parsed) ||
    typeof parsed.capturedAt !== 'string' ||
    !Array.isArray(parsed.machines) ||
    !parsed.machines.every(isStatusEntry)
  ) {
    throw new Error('invalid remote machine status file');
  }
  return { capturedAt: parsed.capturedAt, machines: parsed.machines };
};

const host = {
  name: 'worker-a',
  address: '192.0.2.10',
  port: 2222,
  user: 'worker-user',
};

const metricsOutput = [
  'MemTotal: 1000 kB',
  'MemAvailable: 750 kB',
  '#TDPM-SEP',
  'cpu  100 0 100 800 0 0 0 0 0 0',
  'cpu  130 0 130 840 0 0 0 0 0 0',
  '#TDPM-SEP',
  '3.5 2.5 1.5 1/100 200',
  '#TDPM-SEP',
  '1000 200 200',
].join('\n');

const encodedMetadata = (content: string): string =>
  Buffer.from(content).toString('base64');

const factsOutput = [
  '10\t1\tclaude-worker\t0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef\t-',
  `10\tmeta\t${encodedMetadata('{}')}`,
  `10\tmeta\t${encodedMetadata('{"finished":true}')}`,
  `10\tmeta\t${encodedMetadata('{"finished":false}')}`,
  '11\t10\tcodex-launcher\t-\t-',
].join('\n');

describe('remote machine status writer parsing', () => {
  it('parses valid worker hosts and ignores tdpmBin', () => {
    expect(
      parseWorkerHostsYaml(
        'hosts:\n  - name: worker-a\n    address: 192.0.2.10\n    port: 2222\n    user: worker-user\n    tdpmBin: ignored\n',
      ),
    ).toEqual([host]);
  });

  it('parses an empty host list', () => {
    expect(parseWorkerHostsYaml('hosts: []\n')).toEqual([]);
  });

  it.each([
    ['hosts is missing', 'worker: []\n'],
    [
      'name is empty',
      'hosts:\n  - name: ""\n    address: 192.0.2.10\n    port: 2222\n    user: worker-user\n',
    ],
    [
      'address is empty',
      'hosts:\n  - name: worker-a\n    address: ""\n    port: 2222\n    user: worker-user\n',
    ],
    [
      'user is empty',
      'hosts:\n  - name: worker-a\n    address: 192.0.2.10\n    port: 2222\n    user: ""\n',
    ],
    [
      'port is invalid',
      'hosts:\n  - name: worker-a\n    address: 192.0.2.10\n    port: 0\n    user: worker-user\n',
    ],
  ])('rejects %s', (_name, yaml) => {
    expect(() => parseWorkerHostsYaml(yaml)).toThrow(Error);
  });

  it('parses remote metrics sections using the repository helper contract', () => {
    expect(parseRemoteMetricsOutput(metricsOutput)).toEqual({
      memPct: 25,
      cpuPct: 60,
      diskPct: 80,
      load: [3.5, 2.5, 1.5],
    });
  });

  it('parses remote subagent facts into per-token counts', () => {
    expect(parseRemoteSubagentFactsOutput(factsOutput)).toEqual({
      subagentCounts: {
        claudeByTokenKey: {
          '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef': 2,
        },
        codexByTokenKey: {
          '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef': 1,
        },
      },
      unreadableWorkerPids: [],
      unmeasuredClaudeTokenKeys: [],
    });
  });

  it('rejects malformed remote subagent facts', () => {
    expect(() =>
      parseRemoteSubagentFactsOutput('10\t1\tclaude-worker\tnot-a-key\t2'),
    ).toThrow(Error);
  });

  it('rejects output with only three sections', () => {
    expect(() =>
      parseRemoteMetricsOutput(
        metricsOutput.split('\n#TDPM-SEP\n').slice(0, 3).join('\n#TDPM-SEP\n'),
      ),
    ).toThrow(Error);
  });

  it('rejects malformed remote metrics output', () => {
    expect(() => parseRemoteMetricsOutput('MemTotal: 1000 kB')).toThrow(Error);
  });

  it('builds the exact batch-mode ssh invocation', () => {
    expect(buildSshInvocation(host, REMOTE_METRICS_COMMAND)).toEqual({
      file: 'ssh',
      args: [
        '-o',
        'BatchMode=yes',
        '-o',
        'ConnectTimeout=5',
        '-p',
        '2222',
        'worker-user@192.0.2.10',
        REMOTE_METRICS_COMMAND,
      ],
    });
  });
});

describe('writeRemoteMachineStatus', () => {
  let dashboardDataDir = '';
  let workerHostsPath = '';

  afterEach(() => {
    jest.restoreAllMocks();
    for (const temporaryPath of temporaryPaths.splice(0)) {
      fs.rmSync(temporaryPath, { recursive: true, force: true });
    }
    dashboardDataDir = '';
    workerHostsPath = '';
  });

  it.each([
    [{ dashboardDataDir: null, workerHostsPath: null }],
    [{ dashboardDataDir: '', workerHostsPath: '/unconfigured' }],
  ])('does nothing when paths are missing', async (params) => {
    await writeRemoteMachineStatus(params);
  });

  it('writes successful measurements in YAML order with the supplied capture time', async () => {
    dashboardDataDir = makeTempDirectory();
    workerHostsPath = makeTempFile(
      'hosts:\n  - name: worker-a\n    address: 192.0.2.10\n    port: 2222\n    user: worker-user\n',
    );
    const runner = jest.fn((invocation: { args: string[] }) =>
      Promise.resolve(
        invocation.args[invocation.args.length - 1] ===
          REMOTE_SUBAGENT_FACTS_COMMAND
          ? factsOutput
          : metricsOutput,
      ),
    );
    await writeRemoteMachineStatus({
      dashboardDataDir,
      workerHostsPath,
      runRemoteCommand: runner,
      now: new Date('2026-11-25T00:00:00.000Z'),
    });
    expect(runner).toHaveBeenCalledWith(
      buildSshInvocation(host, REMOTE_METRICS_COMMAND),
      REMOTE_COMMAND_TIMEOUT_MS,
    );
    expect(runner).toHaveBeenCalledWith(
      buildSshInvocation(host, REMOTE_SUBAGENT_FACTS_COMMAND),
      REMOTE_SUBAGENT_FACTS_TIMEOUT_MS,
    );
    expect(
      JSON.parse(
        fs.readFileSync(
          path.join(dashboardDataDir, 'remote-machine-status.json'),
          'utf8',
        ),
      ),
    ).toEqual({
      capturedAt: '2026-11-25T00:00:00.000Z',
      machines: [
        {
          name: 'worker-a',
          reachable: true,
          memPct: 25,
          cpuPct: 60,
          diskPct: 80,
          load: [3.5, 2.5, 1.5],
          subagentCounts: {
            claudeByTokenKey: {
              '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef': 2,
            },
            codexByTokenKey: {
              '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef': 1,
            },
          },
          unmeasuredClaudeTokenKeys: [],
          capturedAt: '2026-11-25T00:00:00.000Z',
        },
      ],
    });
  });

  it('keeps the host metrics and marks its subagent counts unavailable when the facts scan fails', async () => {
    dashboardDataDir = makeTempDirectory();
    workerHostsPath = makeTempFile(
      'hosts:\n  - name: worker-a\n    address: 192.0.2.10\n    port: 2222\n    user: worker-user\n',
    );
    const reportError = jest.fn<void, [string]>();
    const runner = jest.fn((invocation: { args: string[] }) =>
      invocation.args[invocation.args.length - 1] ===
      REMOTE_SUBAGENT_FACTS_COMMAND
        ? Promise.reject(new Error('timed out'))
        : Promise.resolve(metricsOutput),
    );
    await writeRemoteMachineStatus({
      dashboardDataDir,
      workerHostsPath,
      runRemoteCommand: runner,
      reportError,
      now: new Date('2026-11-25T00:00:00.000Z'),
    });
    const written = parseStatusFile(
      fs.readFileSync(
        path.join(dashboardDataDir, 'remote-machine-status.json'),
        'utf8',
      ),
    );
    expect(written.machines[0]).toMatchObject({
      name: 'worker-a',
      reachable: true,
      memPct: 25,
      cpuPct: 60,
      diskPct: 80,
      subagentCounts: null,
    });
    expect(reportError).toHaveBeenCalledWith(
      'remote machine worker-a subagent counts could not be measured: timed out',
    );
  });

  it('keeps the readable counts and lists the unreadable worker token when a worker is unreadable', async () => {
    dashboardDataDir = makeTempDirectory();
    workerHostsPath = makeTempFile(
      'hosts:\n  - name: worker-a\n    address: 192.0.2.10\n    port: 2222\n    user: worker-user\n',
    );
    const reportError = jest.fn<void, [string]>();
    const unreadableFacts = [
      '10\t1\tclaude-worker\t0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef\t-',
      '10\tmeta\t!',
    ].join('\n');
    const runner = jest.fn((invocation: { args: string[] }) =>
      Promise.resolve(
        invocation.args[invocation.args.length - 1] ===
          REMOTE_SUBAGENT_FACTS_COMMAND
          ? unreadableFacts
          : metricsOutput,
      ),
    );
    await writeRemoteMachineStatus({
      dashboardDataDir,
      workerHostsPath,
      runRemoteCommand: runner,
      reportError,
      now: new Date('2026-11-25T00:00:00.000Z'),
    });
    const written = parseStatusFile(
      fs.readFileSync(
        path.join(dashboardDataDir, 'remote-machine-status.json'),
        'utf8',
      ),
    );
    expect(written.machines[0]).toMatchObject({
      reachable: true,
      subagentCounts: { claudeByTokenKey: {}, codexByTokenKey: {} },
      unmeasuredClaudeTokenKeys: [
        '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      ],
    });
    expect(reportError).toHaveBeenCalledWith(
      'remote machine worker-a has unreadable Claude worker subagent count for pid 10',
    );
  });

  it('continues after one host fails and reports an unreachable entry', async () => {
    dashboardDataDir = makeTempDirectory();
    workerHostsPath = makeTempFile(
      'hosts:\n  - name: worker-a\n    address: 192.0.2.10\n    port: 2222\n    user: worker-user\n  - name: worker-b\n    address: 192.0.2.10\n    port: 2222\n    user: worker-user\n',
    );
    const reportError = jest.fn<void, [string]>();
    const runner = jest
      .fn()
      .mockRejectedValueOnce(new Error('connection refused'))
      .mockResolvedValueOnce(metricsOutput)
      .mockResolvedValueOnce(factsOutput);
    await writeRemoteMachineStatus({
      dashboardDataDir,
      workerHostsPath,
      runRemoteCommand: runner,
      reportError,
      now: new Date('2026-11-25T00:00:00.000Z'),
    });
    const written = parseStatusFile(
      fs.readFileSync(
        path.join(dashboardDataDir, 'remote-machine-status.json'),
        'utf8',
      ),
    );
    expect(written.machines[0]).toMatchObject({
      name: 'worker-a',
      reachable: false,
      memPct: null,
      cpuPct: null,
      diskPct: null,
      load: null,
      subagentCounts: null,
    });
    expect(written.machines[1].reachable).toBe(true);
    expect(reportError).toHaveBeenCalledWith(
      'remote machine worker-a could not be measured: connection refused',
    );
    expect(runner).toHaveBeenCalledTimes(3);
  });

  it('writes previous hosts as unreachable when the YAML cannot be read', async () => {
    dashboardDataDir = makeTempDirectory();
    const outputPath = path.join(
      dashboardDataDir,
      'remote-machine-status.json',
    );
    const previous: RemoteMachineStatusFile = {
      capturedAt: '2026-11-24T00:00:00.000Z',
      machines: [
        {
          name: 'worker-a',
          reachable: true,
          memPct: 25,
          cpuPct: 60,
          diskPct: 80,
          load: [3.5, 2.5, 1.5],
          capturedAt: '2026-11-24T00:00:00.000Z',
        },
        {
          name: 'worker-b',
          reachable: true,
          memPct: 30,
          cpuPct: 40,
          diskPct: 50,
          load: [1, 2, 3],
          capturedAt: '2026-11-24T00:00:00.000Z',
        },
      ],
    };
    fs.writeFileSync(outputPath, JSON.stringify(previous));
    const reportError = jest.fn<void, [string]>();

    await writeRemoteMachineStatus({
      dashboardDataDir,
      workerHostsPath: makeTempFile('hosts: [\n'),
      readFile: () => {
        throw new Error('YAML config is unreadable');
      },
      reportError,
      now: new Date('2026-11-25T00:00:00.000Z'),
    });

    const written = parseStatusFile(fs.readFileSync(outputPath, 'utf8'));
    expect(written).toEqual({
      capturedAt: '2026-11-25T00:00:00.000Z',
      machines: previous.machines.map(({ name }) => ({
        name,
        reachable: false,
        memPct: null,
        cpuPct: null,
        diskPct: null,
        load: null,
        subagentCounts: null,
        capturedAt: '2026-11-25T00:00:00.000Z',
      })),
    });
    expect(reportError).toHaveBeenCalledTimes(1);
    const [message] = reportError.mock.calls[0];
    expect(message).toContain('YAML config is unreadable');
  });

  it('removes a stale status file when worker hosts are not configured', async () => {
    dashboardDataDir = makeTempDirectory();
    const outputPath = path.join(
      dashboardDataDir,
      'remote-machine-status.json',
    );
    fs.writeFileSync(outputPath, '{}');

    await expect(
      writeRemoteMachineStatus({ dashboardDataDir, workerHostsPath: null }),
    ).resolves.toBeUndefined();
    expect(fs.existsSync(outputPath)).toBe(false);
  });

  it('does not throw when no status file exists and worker hosts are not configured', async () => {
    dashboardDataDir = makeTempDirectory();

    await expect(
      writeRemoteMachineStatus({
        dashboardDataDir,
        workerHostsPath: undefined,
      }),
    ).resolves.toBeUndefined();
  });

  it('uses different temporary paths for consecutive successful writes', async () => {
    dashboardDataDir = makeTempDirectory();
    workerHostsPath = makeTempFile(
      'hosts:\n  - name: worker-a\n    address: 192.0.2.10\n    port: 2222\n    user: worker-user\n',
    );
    const renameSpy = jest.spyOn(fs, 'renameSync');
    const runner = jest.fn().mockResolvedValue(metricsOutput);

    await writeRemoteMachineStatus({
      dashboardDataDir,
      workerHostsPath,
      runRemoteCommand: runner,
    });
    await writeRemoteMachineStatus({
      dashboardDataDir,
      workerHostsPath,
      runRemoteCommand: runner,
    });

    const temporaryPathsUsed = renameSpy.mock.calls.map(
      ([sourcePath]) => sourcePath,
    );
    expect(temporaryPathsUsed).toHaveLength(2);
    expect(new Set(temporaryPathsUsed).size).toBe(2);
    expect(
      temporaryPathsUsed.every(
        (temporaryPath) =>
          path.dirname(String(temporaryPath)) === dashboardDataDir,
      ),
    ).toBe(true);
    const written = parseStatusFile(
      fs.readFileSync(
        path.join(dashboardDataDir, 'remote-machine-status.json'),
        'utf8',
      ),
    );
    expect(written.machines).toHaveLength(1);
  });

  it('rethrows a rename error and removes the temporary file', async () => {
    dashboardDataDir = makeTempDirectory();
    workerHostsPath = makeTempFile('hosts: []\n');
    const renameError = new Error('rename failed');
    jest.spyOn(fs, 'renameSync').mockImplementation(() => {
      throw renameError;
    });

    await expect(
      writeRemoteMachineStatus({ dashboardDataDir, workerHostsPath }),
    ).rejects.toBe(renameError);
    expect(
      fs
        .readdirSync(dashboardDataDir)
        .filter(
          (fileName) =>
            fileName !==
            path.basename(
              path.join(dashboardDataDir, 'remote-machine-status.json'),
            ),
        ),
    ).toEqual([]);
  });

  it('reports a temporary-file cleanup error and rethrows the rename error', async () => {
    dashboardDataDir = makeTempDirectory();
    workerHostsPath = makeTempFile(
      'hosts:\n  - name: worker-a\n    address: 192.0.2.10\n    port: 2222\n    user: worker-user\n',
    );
    const renameError = new Error('rename failed for test');
    const reportError = jest.fn<void, [string]>();
    const runner = jest.fn((invocation: { args: string[] }) =>
      Promise.resolve(
        invocation.args[invocation.args.length - 1] ===
          REMOTE_SUBAGENT_FACTS_COMMAND
          ? factsOutput
          : metricsOutput,
      ),
    );
    jest.spyOn(fs, 'renameSync').mockImplementation(() => {
      throw renameError;
    });
    jest.spyOn(fs, 'rmSync').mockImplementation(() => {
      throw new Error('cleanup failed for test');
    });

    await expect(
      writeRemoteMachineStatus({
        dashboardDataDir,
        workerHostsPath,
        reportError,
        runRemoteCommand: runner,
      }),
    ).rejects.toBe(renameError);
    expect(reportError).toHaveBeenCalledTimes(1);
    const [message] = reportError.mock.calls[0];
    expect(message).toContain(
      'could not remove temporary remote machine status file',
    );
    expect(message).toContain('cleanup failed for test');
  });

  it('propagates a temporary-file write error and removes the temporary file', async () => {
    dashboardDataDir = makeTempDirectory();
    workerHostsPath = makeTempFile('hosts: []\n');
    const writeError = new Error('write failed');
    jest.spyOn(fs, 'writeFileSync').mockImplementationOnce(() => {
      throw writeError;
    });

    await expect(
      writeRemoteMachineStatus({ dashboardDataDir, workerHostsPath }),
    ).rejects.toBe(writeError);
    expect(
      fs
        .readdirSync(dashboardDataDir)
        .filter(
          (fileName) =>
            fileName !==
            path.basename(
              path.join(dashboardDataDir, 'remote-machine-status.json'),
            ),
        ),
    ).toEqual([]);
  });

  it('rethrows a rename error and removes the temporary file after worker-hosts parsing fails', async () => {
    dashboardDataDir = makeTempDirectory();
    workerHostsPath = makeTempFile('hosts: [\n');
    const renameError = new Error('rename failed after parse error');
    jest.spyOn(fs, 'renameSync').mockImplementation(() => {
      throw renameError;
    });

    await expect(
      writeRemoteMachineStatus({
        dashboardDataDir,
        workerHostsPath,
        readFile: () => {
          throw new Error('YAML config is unreadable');
        },
      }),
    ).rejects.toBe(renameError);
    expect(
      fs
        .readdirSync(dashboardDataDir)
        .filter(
          (fileName) =>
            fileName !==
            path.basename(
              path.join(dashboardDataDir, 'remote-machine-status.json'),
            ),
        ),
    ).toEqual([]);
  });

  it('propagates a temporary-file write error after worker-hosts parsing fails', async () => {
    dashboardDataDir = makeTempDirectory();
    workerHostsPath = makeTempFile('hosts: [\n');
    const writeError = new Error('write failed after parse error');
    jest.spyOn(fs, 'writeFileSync').mockImplementationOnce(() => {
      throw writeError;
    });

    await expect(
      writeRemoteMachineStatus({
        dashboardDataDir,
        workerHostsPath,
        readFile: () => {
          throw new Error('YAML config is unreadable');
        },
      }),
    ).rejects.toBe(writeError);
    expect(
      fs
        .readdirSync(dashboardDataDir)
        .filter(
          (fileName) =>
            fileName !==
            path.basename(
              path.join(dashboardDataDir, 'remote-machine-status.json'),
            ),
        ),
    ).toEqual([]);
  });
});
