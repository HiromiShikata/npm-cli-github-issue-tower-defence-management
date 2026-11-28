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
  countRunningSubagentsByWorkerKey,
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
export const REMOTE_SUBAGENT_FACTS_PERL_MISSING_MARKER = 'TDPM-PERL-MISSING';
const REMOTE_SUBAGENT_FACTS_PERL_PROGRAM = String.raw`use strict;
sub slurp {
  my ($path) = @_;
  open my $fh, q{<}, $path or return;
  binmode $fh;
  local $/;
  my $data = <$fh>;
  close $fh;
  return defined $data ? $data : q{};
}
sub visible_names {
  my ($dir) = @_;
  opendir my $dh, $dir or return;
  my @names = grep { $_ !~ /\A\./ } readdir $dh;
  closedir $dh;
  return sort @names;
}
sub meta_files {
  my ($dir) = @_;
  my @files;
  for my $name (visible_names($dir)) {
    next unless $name =~ /\.meta\.json\z/;
    push @files, "$dir/$name" if -f "$dir/$name";
  }
  return @files;
}
sub word_paths {
  my ($value) = @_;
  my @paths;
  for my $piece (grep { length } split /[ \t\n]+/, $value) {
    if ($piece =~ /[*?\[]/) {
      push @paths, glob($piece);
    } else {
      push @paths, $piece;
    }
  }
  return @paths;
}
sub env_values {
  my ($environ, $name) = @_;
  (my $text = $environ) =~ tr/\0/\n/;
  my @values;
  for my $line (split /\n/, $text, -1) {
    push @values, substr($line, length($name) + 1) if index($line, "$name=") == 0;
  }
  my $value = join "\n", @values;
  $value =~ s/\n+\z//;
  return $value;
}
sub ppid_of {
  my ($stat) = @_;
  $stat =~ s/\n+\z//;
  $stat =~ s/.*\) //;
  $stat =~ s/^[^ ]* //;
  $stat =~ s/ .*//;
  return $stat;
}
sub cmdline_lines {
  my ($cmdline) = @_;
  (my $text = $cmdline) =~ tr/\0/\n/;
  return split /\n/, $text, -1;
}
sub base64 {
  my ($data) = @_;
  my $alphabet = join q{}, (q{A}..q{Z}), (q{a}..q{z}), (0..9), q{+}, q{/};
  my $bits = unpack q{B*}, $data;
  my $encoded = q{};
  for (my $offset = 0; $offset < length $bits; $offset += 6) {
    my $chunk = substr($bits, $offset, 6);
    $chunk .= q{0} x (6 - length $chunk);
    $encoded .= substr($alphabet, oct(qq{0b$chunk}), 1);
  }
  $encoded .= q{=} x ((4 - length($encoded) % 4) % 4);
  return $encoded;
}
my $proc = defined $ENV{TDPM_PROC_DIR} && $ENV{TDPM_PROC_DIR} ne q{} ? $ENV{TDPM_PROC_DIR} : q{/proc};
for my $name (grep { /\A[0-9]/ } visible_names($proc)) {
  my $dir = "$proc/$name";
  next unless -d $dir;
  my $stat = slurp("$dir/stat");
  next unless defined $stat;
  my $ppid = ppid_of($stat);
  my $cmdline = slurp("$dir/cmdline");
  next unless defined $cmdline;
  my @lines = cmdline_lines($cmdline);
  my $first = @lines ? $lines[0] : q{};
  my ($base) = $first =~ m{([^/]*)\z};
  my $issue;
  for my $i (1 .. $#lines) {
    if ($lines[$i - 1] eq q{-p} && index($lines[$i], q{Take ownership of }) == 0) {
      $issue = substr($lines[$i], length(q{Take ownership of }));
      last;
    }
  }
  if ($base eq q{claude} && defined $issue) {
    print "$name\t$ppid\tclaude-worker\t$issue\t-\n";
    my $environ = slurp("$dir/environ");
    if (!defined $environ) {
      print "$name\tmeta\t!\n";
      next;
    }
    my $config = env_values($environ, q{CLAUDE_CONFIG_DIR});
    $config = env_values($environ, q{HOME}) . q{/.claude} if $config eq q{};
    my $session = env_values($environ, q{CLAUDE_CODE_SESSION_ID});
    for my $project (map { "$config/projects/$_" } visible_names("$config/projects")) {
      next unless -d $project;
      my @sessions = $session ne q{} ? word_paths("$project/$session") : word_paths("$project/*");
      for my $session_directory (@sessions) {
        next unless -d "$session_directory/subagents";
        for my $meta (meta_files("$session_directory/subagents")) {
          my $data = slurp($meta);
          my $encoded = defined $data ? base64($data) : q{};
          $encoded = q{!} if $encoded eq q{};
          print "$name\tmeta\t$encoded\n";
        }
      }
    }
    next;
  }
  if ($base eq q{node} && defined $lines[1] && $lines[1] =~ m{/codex\z} && defined $lines[2] && $lines[2] eq q{exec}) {
    print "$name\t$ppid\tcodex-launcher\t-\t-\n";
  } else {
    print "$name\t$ppid\tother\t-\t-\n";
  }
}
`;
export const REMOTE_SUBAGENT_FACTS_COMMAND = `if command -v perl >/dev/null 2>&1; then exec perl -e '${REMOTE_SUBAGENT_FACTS_PERL_PROGRAM}'; else echo ${REMOTE_SUBAGENT_FACTS_PERL_MISSING_MARKER}; fi`;
export const REMOTE_METRICS_COMMAND = `cat /proc/meminfo; echo '${REMOTE_METRICS_SEPARATOR}'; grep '^cpu ' /proc/stat; sleep 0.4; grep '^cpu ' /proc/stat; echo '${REMOTE_METRICS_SEPARATOR}'; cat /proc/loadavg; echo '${REMOTE_METRICS_SEPARATOR}'; stat -f -c '%b %f %a' /`;

export type RemoteMachineMetrics = {
  memPct: number;
  cpuPct: number;
  diskPct: number;
  load: [number, number, number];
};

export type RemoteSubagentCounts = {
  claudeByIssueUrl: Record<string, number>;
  codexByIssueUrl: Record<string, number>;
};

const parseRemoteMetricsOutputSections = (stdout: string): string[] => {
  const sections = stdout.split(/^(?:#TDPM-SEP)\s*$/m);
  if (sections.length !== 4)
    throw new Error('remote metrics sections are malformed');
  return sections;
};

export const parseRemoteMetricsOutput = (
  stdout: string,
): RemoteMachineMetrics => {
  const sections = parseRemoteMetricsOutputSections(stdout);
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

const countUnfinishedFromEncodedMetadata = (
  encodedFiles: string[],
): number | null => {
  let count = 0;
  for (const encoded of encodedFiles) {
    if (encoded === '!') return null;
    let parsed: unknown;
    try {
      parsed = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
    } catch {
      return null;
    }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed))
      return null;
    if (!('finished' in parsed) || parsed.finished !== true) count += 1;
  }
  return count;
};

const WORKER_ISSUE_URL_FIELD_PATTERN = /^https:\/\/\S+$/;

export const parseRemoteSubagentFactsOutput = (
  stdout: string,
): {
  subagentCounts: RemoteSubagentCounts;
  unreadableWorkerPids: number[];
  unmeasuredIssueUrls: string[];
} => {
  if (stdout.trim() === REMOTE_SUBAGENT_FACTS_PERL_MISSING_MARKER)
    throw new Error('perl not found on the worker');
  const processRows: ProcessFact[] = [];
  const encodedMetadataByPid = new Map<number, string[]>();
  for (const line of stdout.trim().split('\n').filter(Boolean)) {
    const fields = line.split('\t');
    if (fields.length === 3 && fields[1] === 'meta') {
      if (!/^\d+$/.test(fields[0] ?? ''))
        throw new Error('remote subagent facts are malformed');
      const pid = Number(fields[0]);
      encodedMetadataByPid.set(pid, [
        ...(encodedMetadataByPid.get(pid) ?? []),
        fields[2] ?? '',
      ]);
      continue;
    }
    const [pid, ppid, kind, issueUrl, unfinished] = fields;
    if (
      fields.length !== 5 ||
      !/^\d+$/.test(pid ?? '') ||
      !/^\d+$/.test(ppid ?? '') ||
      (kind !== 'claude-worker' &&
        kind !== 'codex-launcher' &&
        kind !== 'other') ||
      issueUrl === undefined ||
      unfinished !== '-'
    )
      throw new Error('remote subagent facts are malformed');
    if (
      kind === 'claude-worker' &&
      !WORKER_ISSUE_URL_FIELD_PATTERN.test(issueUrl)
    )
      throw new Error('remote subagent facts are malformed');
    if (kind !== 'claude-worker' && issueUrl !== '-')
      throw new Error('remote subagent facts are malformed');
    processRows.push({
      pid: Number(pid),
      ppid: Number(ppid),
      kind,
      workerKey: issueUrl === '-' ? null : issueUrl,
      unfinishedClaudeSubagentCount: null,
    });
  }
  const facts: ProcessFact[] = processRows.map((fact) =>
    fact.kind === 'claude-worker'
      ? {
          ...fact,
          unfinishedClaudeSubagentCount: countUnfinishedFromEncodedMetadata(
            encodedMetadataByPid.get(fact.pid) ?? [],
          ),
        }
      : fact,
  );
  const workerPids = new Set(
    processRows
      .filter((fact) => fact.kind === 'claude-worker')
      .map((fact) => fact.pid),
  );
  for (const pid of encodedMetadataByPid.keys()) {
    if (!workerPids.has(pid))
      throw new Error('remote subagent facts are malformed');
  }
  const counts = countRunningSubagentsByWorkerKey(facts);
  return {
    subagentCounts: {
      claudeByIssueUrl: Object.fromEntries(counts.claudeByWorkerKey),
      codexByIssueUrl: Object.fromEntries(counts.codexByWorkerKey),
    },
    unreadableWorkerPids: counts.unreadableWorkerPids,
    unmeasuredIssueUrls: counts.unmeasuredWorkerKeys,
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

export const REMOTE_COMMAND_MAX_OUTPUT_BYTES = 1024 * 1024;

export const describeRemoteCommandFailure = (
  failure: { code?: unknown; killed?: boolean; signal?: unknown },
  stderr: string,
  timeoutMs: number,
): string => {
  let reason: string;
  if (failure.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') {
    reason = 'output over 1 MB';
  } else if (failure.killed === true) {
    reason = `exceeded the ${timeoutMs / 1000} s timeout`;
  } else if (typeof failure.code === 'number') {
    reason = `non-zero exit code ${failure.code}`;
  } else if (typeof failure.signal === 'string') {
    reason = `terminated by signal ${failure.signal}`;
  } else {
    reason = `could not run the command: ${String(failure.code)}`;
  }
  const detail = stderr.trim();
  return detail === '' ? reason : `${reason}; stderr: ${detail}`;
};

export const defaultRemoteCommandRunner: RemoteCommandRunner = (
  invocation,
  timeoutMs,
) =>
  new Promise((resolve, reject) => {
    execFile(
      invocation.file,
      invocation.args,
      { timeout: timeoutMs, maxBuffer: REMOTE_COMMAND_MAX_OUTPUT_BYTES },
      (error, stdout, stderr) => {
        if (error) {
          reject(
            new Error(describeRemoteCommandFailure(error, stderr, timeoutMs)),
          );
          return;
        }
        resolve(stdout);
      },
    );
  });

export const REMOTE_COMMAND_TIMEOUT_MS = 15000;
export const REMOTE_SUBAGENT_FACTS_TIMEOUT_MS = 30000;
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
    claudeByIssueUrl: Record<string, number>;
    codexByIssueUrl: Record<string, number>;
  } | null;
  unmeasuredClaudeIssueUrls?: string[];
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
    let metrics: RemoteMachineMetrics;
    try {
      metrics = parseRemoteMetricsOutput(
        await runRemoteCommand(
          buildSshInvocation(host, REMOTE_METRICS_COMMAND),
          REMOTE_COMMAND_TIMEOUT_MS,
        ),
      );
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
      continue;
    }
    let subagentCounts: RemoteSubagentCounts | null = null;
    let unmeasuredClaudeIssueUrls: string[] = [];
    try {
      const measured = parseRemoteSubagentFactsOutput(
        await runRemoteCommand(
          buildSshInvocation(host, REMOTE_SUBAGENT_FACTS_COMMAND),
          REMOTE_SUBAGENT_FACTS_TIMEOUT_MS,
        ),
      );
      for (const pid of measured.unreadableWorkerPids) {
        reportError(
          `remote machine ${host.name} has unreadable Claude worker subagent count for pid ${pid}`,
        );
      }
      subagentCounts = measured.subagentCounts;
      unmeasuredClaudeIssueUrls = measured.unmeasuredIssueUrls;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      reportError(
        `remote machine ${host.name} subagent counts could not be measured: ${message}`,
      );
    }
    machines.push({
      name: host.name,
      reachable: true,
      ...metrics,
      subagentCounts,
      unmeasuredClaudeIssueUrls,
      capturedAt,
    });
  }
  fs.mkdirSync(params.dashboardDataDir, { recursive: true });
  writeJsonAtomically(
    outputPath,
    JSON.stringify({ capturedAt, machines } satisfies RemoteMachineStatusFile),
    reportError,
  );
};
