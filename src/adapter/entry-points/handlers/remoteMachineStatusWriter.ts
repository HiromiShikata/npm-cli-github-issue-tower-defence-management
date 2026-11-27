import { execFile } from 'child_process';
import * as crypto from 'crypto';
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
import {
  countRunningSubagentsByTokenKey,
  ProcessFact,
} from '../../../domain/usecases/dashboard/CountRunningSubagentsUseCase';

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
export const REMOTE_SUBAGENT_FACTS_COMMAND = `for directory in "\${TDPM_PROC_DIR:-/proc}"/[0-9]*; do [ -d "$directory" ] || continue; pid=\${directory##*/}; stat=$(cat "$directory/stat" 2>/dev/null) || continue; ppid=$(printf '%s\\n' "$stat" | sed 's/.*) //; s/^[^ ]* //; s/ .*//'); argv=$(cat "$directory/cmdline" 2>/dev/null) || continue; environment=$(cat "$directory/environ" 2>/dev/null || true); first=$(cat "$directory/cmdline" | tr '\\0' '\\n' | sed -n '1p'); if [ "\${first##*/}" = claude ] && cat "$directory/cmdline" | tr '\\0' '\\n' | awk 'p && /^Take ownership of/ { found=1 } /-p$/ { p=1; next } { p=0 } END { exit found ? 0 : 1 }'; then token=$(cat "$directory/environ" | tr '\\0' '\\n' | sed -n 's/^CLAUDE_CODE_OAUTH_TOKEN=//p'); if [ -n "$token" ]; then key=$(printf '%s' "$token" | sha256sum | cut -d ' ' -f1); config=$(cat "$directory/environ" | tr '\\0' '\\n' | sed -n 's/^CLAUDE_CONFIG_DIR=//p'); home=$(cat "$directory/environ" | tr '\\0' '\\n' | sed -n 's/^HOME=//p'); [ -n "$config" ] || config="$home/.claude"; session=$(cat "$directory/environ" | tr '\\0' '\\n' | sed -n 's/^CLAUDE_CODE_SESSION_ID=//p'); count=0; unreadable=0; [ -d "$config/projects" ] || unreadable=1; for project in "$config"/projects/*; do [ -d "$project" ] || continue; if [ -n "$session" ]; then sessions="$project/$session"; else sessions="$project"/*; fi; for sessionDirectory in $sessions; do [ -d "$sessionDirectory/subagents" ] || { unreadable=1; continue; }; for meta in "$sessionDirectory/subagents"/*.meta.json; do [ -f "$meta" ] || { unreadable=1; continue; }; content=$(cat "$meta" 2>/dev/null) || { unreadable=1; continue; }; printf '%s' "$content" | grep -Eq '"finished"[[:space:]]*:[[:space:]]*true' || count=$((count + 1)); done; done; done; [ "$unreadable" -eq 0 ] && unfinished="$count" || unfinished='?'; printf '%s\\t%s\\tclaude-worker\\t%s\\t%s\\n' "$pid" "$ppid" "$key" "$unfinished"; continue; fi; fi; if [ "\${first##*/}" = node ] && cat "$directory/cmdline" | tr '\\0' '\\n' | sed -n '2p' | grep -q '/codex$' && [ "$(cat "$directory/cmdline" | tr '\\0' '\\n' | sed -n '3p')" = exec ]; then printf '%s\\t%s\\tcodex-launcher\\t-\\t-\\n' "$pid" "$ppid"; else printf '%s\\t%s\\tother\\t-\\t-\\n' "$pid" "$ppid"; fi; done`;
export const REMOTE_METRICS_COMMAND = `cat /proc/meminfo; echo '${REMOTE_METRICS_SEPARATOR}'; grep '^cpu ' /proc/stat; sleep 0.4; grep '^cpu ' /proc/stat; echo '${REMOTE_METRICS_SEPARATOR}'; cat /proc/loadavg; echo '${REMOTE_METRICS_SEPARATOR}'; stat -f -c '%b %f %a' /; echo '${REMOTE_METRICS_SEPARATOR}'; ${REMOTE_SUBAGENT_FACTS_COMMAND}`;

export type RemoteMachineMetrics = {
  memPct: number;
  cpuPct: number;
  diskPct: number;
  load: [number, number, number];
  subagentCounts: {
    claudeByTokenKey: Record<string, number>;
    codexByTokenKey: Record<string, number>;
  };
};

const parseRemoteMetricsOutputWithFacts = (
  stdout: string,
): { metrics: RemoteMachineMetrics; unreadableWorkerPids: number[] } => {
  const sections = stdout.split(/^(?:#TDPM-SEP)\s*$/m);
  if (sections.length !== 5)
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
  const facts: ProcessFact[] = sections[4]
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [pid, ppid, kind, tokenKey, unfinished] = line.split('\t');
      if (
        !/^\d+$/.test(pid ?? '') ||
        !/^\d+$/.test(ppid ?? '') ||
        (kind !== 'claude-worker' &&
          kind !== 'codex-launcher' &&
          kind !== 'other') ||
        tokenKey === undefined ||
        unfinished === undefined
      )
        throw new Error('remote subagent facts are malformed');
      if (kind === 'claude-worker' && !/^[0-9a-f]{64}$/.test(tokenKey))
        throw new Error('remote subagent facts are malformed');
      if (kind !== 'claude-worker' && (tokenKey !== '-' || unfinished !== '-'))
        throw new Error('remote subagent facts are malformed');
      if (
        kind === 'claude-worker' &&
        unfinished !== '?' &&
        !/^\d+$/.test(unfinished)
      )
        throw new Error('remote subagent facts are malformed');
      return {
        pid: Number(pid),
        ppid: Number(ppid),
        kind,
        tokenKey: tokenKey === '-' ? null : tokenKey,
        unfinishedClaudeSubagentCount:
          unfinished === '?' || unfinished === '-' ? null : Number(unfinished),
      };
    });
  const counts = countRunningSubagentsByTokenKey(facts);
  return {
    metrics: {
      memPct: parseMemoryUsedPercent(sections[0]),
      cpuPct: cpuUsedPercentFromSamples(
        parseCpuSample(cpuLines[0]),
        parseCpuSample(cpuLines[1]),
      ),
      diskPct: parseDiskUsedPercent(stat[0], stat[1], stat[2]),
      load: [load.oneMinute, load.fiveMinute, load.fifteenMinute],
      subagentCounts: {
        claudeByTokenKey: Object.fromEntries(counts.claudeByTokenKey),
        codexByTokenKey: Object.fromEntries(counts.codexByTokenKey),
      },
    },
    unreadableWorkerPids: counts.unreadableWorkerPids,
  };
};

export const parseRemoteMetricsOutput = (
  stdout: string,
): RemoteMachineMetrics => parseRemoteMetricsOutputWithFacts(stdout).metrics;

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
  subagentCounts?: {
    claudeByTokenKey: Record<string, number>;
    codexByTokenKey: Record<string, number>;
  } | null;
};
export type RemoteMachineStatusFile = {
  capturedAt: string;
  machines: RemoteMachineStatusEntry[];
};

const writeJsonAtomically = (
  outputPath: string,
  content: string,
  reportError?: (message: string) => void,
): void => {
  const temporaryPath = `${outputPath}.${process.pid}.${crypto.randomBytes(16).toString('hex')}.tmp`;
  try {
    fs.writeFileSync(temporaryPath, content);
    fs.renameSync(temporaryPath, outputPath);
  } catch (error) {
    try {
      fs.rmSync(temporaryPath, { force: true });
    } catch (cleanupError) {
      const message =
        cleanupError instanceof Error
          ? cleanupError.message
          : String(cleanupError);
      reportError?.(
        `could not remove temporary remote machine status file: ${message}`,
      );
    }
    throw error;
  }
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
  const reportError =
    params.reportError ?? ((message: string) => console.error(message));
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
    reportError(`could not read or parse worker hosts: ${message}`);
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
      subagentCounts: null,
      capturedAt,
    }));
    fs.mkdirSync(params.dashboardDataDir, { recursive: true });
    writeJsonAtomically(
      outputPath,
      JSON.stringify({
        capturedAt,
        machines,
      } satisfies RemoteMachineStatusFile),
      reportError,
    );
    return;
  }
  const runRemoteCommand =
    params.runRemoteCommand ?? defaultRemoteCommandRunner;
  const machines: RemoteMachineStatusEntry[] = [];
  for (const host of hosts) {
    try {
      const remoteOutput = await runRemoteCommand(
        buildSshInvocation(host, REMOTE_METRICS_COMMAND),
        REMOTE_COMMAND_TIMEOUT_MS,
      );
      const { metrics, unreadableWorkerPids } =
        parseRemoteMetricsOutputWithFacts(remoteOutput);
      for (const pid of unreadableWorkerPids) {
        reportError(
          `remote machine ${host.name} has unreadable Claude worker subagent count for pid ${pid}`,
        );
      }
      machines.push({
        name: host.name,
        reachable: true,
        ...metrics,
        capturedAt,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      reportError(
        `remote machine ${host.name} could not be measured: ${message}`,
      );
      machines.push({
        name: host.name,
        reachable: false,
        memPct: null,
        cpuPct: null,
        diskPct: null,
        load: null,
        subagentCounts: null,
        capturedAt,
      });
    }
  }
  fs.mkdirSync(params.dashboardDataDir, { recursive: true });
  writeJsonAtomically(
    outputPath,
    JSON.stringify({ capturedAt, machines } satisfies RemoteMachineStatusFile),
    reportError,
  );
};
