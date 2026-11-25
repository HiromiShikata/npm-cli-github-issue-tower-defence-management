import { execFile } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import YAML from 'yaml';
import {
  cpuUsedPercentFromSamples,
  parseCpuSample,
  parseDiskUsedPercent,
  parseLoadAverages,
  parseMemoryUsedPercent,
} from '../../repositories/ProcHostMetricsRepository';

export type WorkerHost = {
  name: string;
  address: string;
  port: number;
  user: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

export const parseWorkerHostsYaml = (text: string): WorkerHost[] => {
  const value: unknown = YAML.parse(text);
  if (!isRecord(value) || !Array.isArray(value.hosts)) {
    throw new Error('hosts must be an array');
  }
  return value.hosts.map((entry) => {
    if (!isRecord(entry)) throw new Error('host must be an object');
    const { name, address, user, port } = entry;
    if (
      typeof name !== 'string' ||
      name.trim() === '' ||
      typeof address !== 'string' ||
      address.trim() === '' ||
      typeof user !== 'string' ||
      user.trim() === '' ||
      typeof port !== 'number' ||
      !Number.isInteger(port) ||
      port < 1 ||
      port > 65535
    ) {
      throw new Error('invalid worker host');
    }
    return { name, address, port, user };
  });
};

export const REMOTE_METRICS_SEPARATOR = '#TDPM-SEP';
export const REMOTE_METRICS_COMMAND =
  "cat /proc/meminfo; echo '#TDPM-SEP'; grep '^cpu ' /proc/stat; sleep 0.4; grep '^cpu ' /proc/stat; echo '#TDPM-SEP'; cat /proc/loadavg; echo '#TDPM-SEP'; stat -f -c '%b %f %a' /";

export type RemoteMachineMetrics = {
  memPct: number;
  cpuPct: number;
  diskPct: number;
  load: [number, number, number];
};

export const parseRemoteMetricsOutput = (
  stdout: string,
): RemoteMachineMetrics => {
  const sections = stdout.split(/^(?:#TDPM-SEP)\s*$/m);
  if (sections.length !== 4)
    throw new Error('remote metrics sections are malformed');
  const cpuLines = sections[1]
    .split('\n')
    .filter((line) => line.startsWith('cpu '));
  if (cpuLines.length !== 2)
    throw new Error('remote cpu samples are malformed');
  const stat = sections[3].trim().split(/\s+/).map(Number);
  if (stat.length !== 3 || stat.some((value) => !Number.isFinite(value)))
    throw new Error('remote disk sample is malformed');
  const load = parseLoadAverages(sections[2]);
  return {
    memPct: parseMemoryUsedPercent(sections[0]),
    cpuPct: cpuUsedPercentFromSamples(
      parseCpuSample(cpuLines[0]),
      parseCpuSample(cpuLines[1]),
    ),
    diskPct: parseDiskUsedPercent(stat[0], stat[1], stat[2]),
    load: [load.oneMinute, load.fiveMinute, load.fifteenMinute],
  };
};

export const buildSshInvocation = (
  host: WorkerHost,
  command: string,
): { file: string; args: string[] } => ({
  file: 'ssh',
  args: [
    '-o',
    'BatchMode=yes',
    '-o',
    'ConnectTimeout=5',
    '-p',
    String(host.port),
    `${host.user}@${host.address}`,
    command,
  ],
});

export type RemoteCommandRunner = (
  invocation: { file: string; args: string[] },
  timeoutMs: number,
) => Promise<string>;

const defaultRemoteCommandRunner: RemoteCommandRunner = (
  invocation,
  timeoutMs,
) =>
  new Promise((resolve, reject) => {
    execFile(
      invocation.file,
      invocation.args,
      { timeout: timeoutMs },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr.trim() || error.message));
          return;
        }
        resolve(stdout);
      },
    );
  });

export const REMOTE_COMMAND_TIMEOUT_MS = 15000;
export const REMOTE_MACHINE_STATUS_FILE_NAME = 'remote-machine-status.json';
export type RemoteMachineStatusEntry = {
  name: string;
  reachable: boolean;
  memPct: number | null;
  cpuPct: number | null;
  diskPct: number | null;
  load: [number, number, number] | null;
  capturedAt: string;
};
export type RemoteMachineStatusFile = {
  capturedAt: string;
  machines: RemoteMachineStatusEntry[];
};

export const writeRemoteMachineStatus = async (params: {
  dashboardDataDir: string | null | undefined;
  workerHostsPath: string | null | undefined;
  readFile?: (path: string) => string;
  runRemoteCommand?: RemoteCommandRunner;
  now?: Date;
  reportError?: (message: string) => void;
}): Promise<void> => {
  if (!params.dashboardDataDir) return;
  const outputPath = path.join(
    params.dashboardDataDir,
    REMOTE_MACHINE_STATUS_FILE_NAME,
  );
  if (!params.workerHostsPath) {
    try {
      fs.unlinkSync(outputPath);
    } catch (error) {
      if (!(isRecord(error) && error.code === 'ENOENT')) {
        throw error;
      }
    }
    return;
  }
  const readFile =
    params.readFile ??
    ((filePath: string) => fs.readFileSync(filePath, 'utf8'));
  const capturedAt = (params.now ?? new Date()).toISOString();
  let hosts: WorkerHost[];
  try {
    hosts = parseWorkerHostsYaml(readFile(params.workerHostsPath));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    params.reportError?.(`could not read or parse worker hosts: ${message}`);
    let previousNames: string[] = [];
    try {
      const previousText = fs.readFileSync(outputPath, 'utf8');
      const extractMachines = (value: unknown): unknown =>
        isRecord(value) ? value.machines : null;
      const previousMachines = extractMachines(JSON.parse(previousText));
      if (Array.isArray(previousMachines)) {
        previousNames = previousMachines.flatMap((machine: unknown) =>
          isRecord(machine) && typeof machine.name === 'string'
            ? [machine.name]
            : [],
        );
      }
    } catch {
      previousNames = [];
    }
    const machines = previousNames.map((name) => ({
      name,
      reachable: false,
      memPct: null,
      cpuPct: null,
      diskPct: null,
      load: null,
      capturedAt,
    }));
    fs.mkdirSync(params.dashboardDataDir, { recursive: true });
    const temporaryPath = `${outputPath}.tmp`;
    fs.writeFileSync(
      temporaryPath,
      JSON.stringify({
        capturedAt,
        machines,
      } satisfies RemoteMachineStatusFile),
    );
    fs.renameSync(temporaryPath, outputPath);
    return;
  }
  const runRemoteCommand =
    params.runRemoteCommand ?? defaultRemoteCommandRunner;
  const machines: RemoteMachineStatusEntry[] = [];
  for (const host of hosts) {
    try {
      const metrics = parseRemoteMetricsOutput(
        await runRemoteCommand(
          buildSshInvocation(host, REMOTE_METRICS_COMMAND),
          REMOTE_COMMAND_TIMEOUT_MS,
        ),
      );
      machines.push({
        name: host.name,
        reachable: true,
        ...metrics,
        capturedAt,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      params.reportError?.(
        `remote machine ${host.name} could not be measured: ${message}`,
      );
      machines.push({
        name: host.name,
        reachable: false,
        memPct: null,
        cpuPct: null,
        diskPct: null,
        load: null,
        capturedAt,
      });
    }
  }
  const temporaryPath = `${outputPath}.tmp`;
  fs.mkdirSync(params.dashboardDataDir, { recursive: true });
  fs.writeFileSync(
    temporaryPath,
    JSON.stringify({ capturedAt, machines } satisfies RemoteMachineStatusFile),
  );
  fs.renameSync(temporaryPath, outputPath);
};
