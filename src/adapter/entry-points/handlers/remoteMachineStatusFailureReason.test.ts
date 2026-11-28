import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  defaultRemoteCommandRunner,
  describeRemoteCommandFailure,
  REMOTE_SUBAGENT_FACTS_COMMAND,
  REMOTE_SUBAGENT_FACTS_PERL_MISSING_MARKER,
  writeRemoteMachineStatus,
} from './remoteMachineStatusWriter';

const temporaryPaths: string[] = [];

afterEach(() => {
  for (const temporaryPath of temporaryPaths.splice(0))
    fs.rmSync(temporaryPath, { recursive: true, force: true });
});

const makeTempDirectory = (): string => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'tdpm-remote-failure-reason-'),
  );
  temporaryPaths.push(directory);
  return directory;
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

describe('describeRemoteCommandFailure', () => {
  it.each([
    {
      name: 'states the timeout before the stderr noise',
      failure: { killed: true, signal: 'SIGTERM' },
      stderr: 'ignored null byte in input\n',
      timeoutMs: 30000,
      expected: 'exceeded the 30 s timeout; stderr: ignored null byte in input',
    },
    {
      name: 'states the output size limit',
      failure: { code: 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER', killed: true },
      stderr: '',
      timeoutMs: 30000,
      expected: 'output over 1 MB',
    },
    {
      name: 'states a non-zero exit code with its stderr',
      failure: { code: 255 },
      stderr: 'Permission denied\n',
      timeoutMs: 15000,
      expected: 'non-zero exit code 255; stderr: Permission denied',
    },
    {
      name: 'states a non-zero exit code without stderr',
      failure: { code: 127 },
      stderr: '',
      timeoutMs: 15000,
      expected: 'non-zero exit code 127',
    },
    {
      name: 'states a terminating signal',
      failure: { code: null, signal: 'SIGKILL' },
      stderr: '',
      timeoutMs: 15000,
      expected: 'terminated by signal SIGKILL',
    },
    {
      name: 'states that the command could not run',
      failure: { code: 'ENOENT' },
      stderr: '',
      timeoutMs: 15000,
      expected: 'could not run the command: ENOENT',
    },
  ])('$name', ({ failure, stderr, timeoutMs, expected }) => {
    expect(describeRemoteCommandFailure(failure, stderr, timeoutMs)).toBe(
      expected,
    );
  });
});

describe('defaultRemoteCommandRunner', () => {
  it('resolves with the standard output of a successful command', async () => {
    await expect(
      defaultRemoteCommandRunner(
        { file: '/bin/sh', args: ['-c', 'printf ok'] },
        30000,
      ),
    ).resolves.toBe('ok');
  });

  it('rejects with the timeout as the reason when the command outlives its timeout', async () => {
    await expect(
      defaultRemoteCommandRunner(
        { file: '/bin/sh', args: ['-c', 'exec sleep 5'] },
        100,
      ),
    ).rejects.toThrow(/^exceeded the 0\.1 s timeout$/);
  });

  it('rejects with the exit code as the reason before the stderr noise', async () => {
    await expect(
      defaultRemoteCommandRunner(
        {
          file: '/bin/sh',
          args: ['-c', "printf 'ignored null byte in input\\n' >&2; exit 3"],
        },
        30000,
      ),
    ).rejects.toThrow(
      /^non-zero exit code 3; stderr: ignored null byte in input$/,
    );
  });

  it('rejects with the output size as the reason when stdout exceeds 1 MB', async () => {
    await expect(
      defaultRemoteCommandRunner(
        { file: '/bin/sh', args: ['-c', 'head -c 1100000 /dev/zero'] },
        30000,
      ),
    ).rejects.toThrow(/^output over 1 MB$/);
  });

  it('resolves with the perl-missing marker when perl is not on the remote PATH', async () => {
    await expect(
      defaultRemoteCommandRunner(
        {
          file: '/usr/bin/env',
          args: ['-i', 'PATH=', '/bin/sh', '-c', REMOTE_SUBAGENT_FACTS_COMMAND],
        },
        30000,
      ),
    ).resolves.toBe(`${REMOTE_SUBAGENT_FACTS_PERL_MISSING_MARKER}\n`);
  });
});

describe('writeRemoteMachineStatus subagent count failure logging', () => {
  it('logs that perl is missing and keeps the host metrics', async () => {
    const dashboardDataDir = makeTempDirectory();
    const workerHostsPath = path.join(makeTempDirectory(), 'worker-hosts.yml');
    fs.writeFileSync(
      workerHostsPath,
      'hosts:\n  - name: worker-a\n    address: 192.0.2.10\n    port: 2222\n    user: worker-user\n',
    );
    const reportError = jest.fn<void, [string]>();
    await writeRemoteMachineStatus({
      dashboardDataDir,
      workerHostsPath,
      reportError,
      now: new Date('2026-11-28T00:00:00.000Z'),
      runRemoteCommand: (invocation) =>
        Promise.resolve(
          invocation.args[invocation.args.length - 1] ===
            REMOTE_SUBAGENT_FACTS_COMMAND
            ? `${REMOTE_SUBAGENT_FACTS_PERL_MISSING_MARKER}\n`
            : metricsOutput,
        ),
    });
    expect(reportError).toHaveBeenCalledTimes(1);
    expect(reportError).toHaveBeenCalledWith(
      'remote machine worker-a subagent counts could not be measured: perl not found on the worker',
    );
    const written: unknown = JSON.parse(
      fs.readFileSync(
        path.join(dashboardDataDir, 'remote-machine-status.json'),
        'utf8',
      ),
    );
    expect(written).toMatchObject({
      machines: [
        {
          name: 'worker-a',
          reachable: true,
          memPct: 25,
          subagentCounts: null,
        },
      ],
    });
  });
  it.each([
    {
      name: 'the timeout',
      factsRunner: (): Promise<string> =>
        defaultRemoteCommandRunner(
          { file: '/bin/sh', args: ['-c', 'exec sleep 5'] },
          100,
        ),
      expected: 'exceeded the 0.1 s timeout',
    },
    {
      name: 'a non-zero exit code with stderr noise',
      factsRunner: (timeoutMs: number): Promise<string> =>
        defaultRemoteCommandRunner(
          {
            file: '/bin/sh',
            args: ['-c', "printf 'ignored null byte in input\\n' >&2; exit 3"],
          },
          timeoutMs,
        ),
      expected: 'non-zero exit code 3; stderr: ignored null byte in input',
    },
    {
      name: 'output over 1 MB',
      factsRunner: (timeoutMs: number): Promise<string> =>
        defaultRemoteCommandRunner(
          { file: '/bin/sh', args: ['-c', 'head -c 1100000 /dev/zero'] },
          timeoutMs,
        ),
      expected: 'output over 1 MB',
    },
    {
      name: 'perl not found',
      factsRunner: (): Promise<string> =>
        Promise.resolve(`${REMOTE_SUBAGENT_FACTS_PERL_MISSING_MARKER}\n`),
      expected: 'perl not found on the worker',
    },
  ])(
    'logs the reason first for $name and keeps the host metrics',
    async ({ factsRunner, expected }) => {
      const dashboardDataDir = makeTempDirectory();
      const workerHostsPath = path.join(
        makeTempDirectory(),
        'worker-hosts.yml',
      );
      fs.writeFileSync(
        workerHostsPath,
        'hosts:\n  - name: worker-a\n    address: 192.0.2.10\n    port: 2222\n    user: worker-user\n',
      );
      const reportError = jest.fn<void, [string]>();
      await writeRemoteMachineStatus({
        dashboardDataDir,
        workerHostsPath,
        reportError,
        now: new Date('2026-11-28T00:00:00.000Z'),
        runRemoteCommand: (invocation, timeoutMs) =>
          invocation.args[invocation.args.length - 1] ===
          REMOTE_SUBAGENT_FACTS_COMMAND
            ? factsRunner(timeoutMs)
            : Promise.resolve(metricsOutput),
      });
      expect(reportError).toHaveBeenCalledTimes(1);
      expect(reportError).toHaveBeenCalledWith(
        `remote machine worker-a subagent counts could not be measured: ${expected}`,
      );
      const written: unknown = JSON.parse(
        fs.readFileSync(
          path.join(dashboardDataDir, 'remote-machine-status.json'),
          'utf8',
        ),
      );
      expect(written).toMatchObject({
        machines: [
          {
            name: 'worker-a',
            reachable: true,
            memPct: 25,
            subagentCounts: null,
          },
        ],
      });
    },
  );
});
