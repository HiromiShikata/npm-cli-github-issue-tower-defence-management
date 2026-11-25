/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import fs from 'fs';
import { execFileSync } from 'child_process';
import path from 'path';
import {
  buildSshInvocation,
  parseRemoteMetricsOutput,
  parseWorkerHostsYaml,
  REMOTE_COMMAND_TIMEOUT_MS,
  REMOTE_METRICS_COMMAND,
  writeRemoteMachineStatus,
} from './remoteMachineStatusWriter';

const makeTempDirectory = (): string =>
  execFileSync('mktemp', ['-d', '/mnt/storage/tmp/remote-machine-status.XXXXXX'], {
    encoding: 'utf8',
  }).trim();

const makeTempFile = (content: string): string => {
  const filePath = execFileSync('mktemp', ['/mnt/storage/tmp/remote-hosts.XXXXXX'], {
    encoding: 'utf8',
  }).trim();
  fs.writeFileSync(filePath, content);
  return filePath;
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
    ['name is empty', 'hosts:\n  - name: ""\n    address: 192.0.2.10\n    port: 2222\n    user: worker-user\n'],
    ['address is empty', 'hosts:\n  - name: worker-a\n    address: ""\n    port: 2222\n    user: worker-user\n'],
    ['user is empty', 'hosts:\n  - name: worker-a\n    address: 192.0.2.10\n    port: 2222\n    user: ""\n'],
    ['port is invalid', 'hosts:\n  - name: worker-a\n    address: 192.0.2.10\n    port: 0\n    user: worker-user\n'],
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
    if (dashboardDataDir) fs.rmSync(dashboardDataDir, { recursive: true, force: true });
    if (workerHostsPath) fs.rmSync(workerHostsPath, { force: true });
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
    const runner = jest.fn().mockResolvedValue(metricsOutput);
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
    expect(
      JSON.parse(fs.readFileSync(path.join(dashboardDataDir, 'remote-machine-status.json'), 'utf8')),
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
          capturedAt: '2026-11-25T00:00:00.000Z',
        },
      ],
    });
  });

  it('continues after one host fails and reports an unreachable entry', async () => {
    dashboardDataDir = makeTempDirectory();
    workerHostsPath = makeTempFile(
      'hosts:\n  - name: worker-a\n    address: 192.0.2.10\n    port: 2222\n    user: worker-user\n  - name: worker-b\n    address: 192.0.2.10\n    port: 2222\n    user: worker-user\n',
    );
    const reportError = jest.fn();
    const runner = jest.fn()
      .mockRejectedValueOnce(new Error('connection refused'))
      .mockResolvedValueOnce(metricsOutput);
    await writeRemoteMachineStatus({
      dashboardDataDir,
      workerHostsPath,
      runRemoteCommand: runner,
      reportError,
      now: new Date('2026-11-25T00:00:00.000Z'),
    });
    const written = JSON.parse(
      fs.readFileSync(path.join(dashboardDataDir, 'remote-machine-status.json'), 'utf8'),
    );
    expect(written.machines[0]).toMatchObject({
      name: 'worker-a',
      reachable: false,
      memPct: null,
      cpuPct: null,
      diskPct: null,
      load: null,
    });
    expect(written.machines[1].reachable).toBe(true);
    expect(reportError).toHaveBeenCalledWith(
      'remote machine worker-a could not be measured: connection refused',
    );
    expect(runner).toHaveBeenCalledTimes(2);
  });

  it('propagates a YAML read error without writing a status file', async () => {
    dashboardDataDir = makeTempDirectory();
    await expect(
      writeRemoteMachineStatus({
        dashboardDataDir,
        workerHostsPath: '/missing/worker-hosts.yml',
      }),
    ).rejects.toThrow();
    expect(fs.readdirSync(dashboardDataDir)).toEqual([]);
  });
});
