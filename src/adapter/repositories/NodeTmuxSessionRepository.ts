import * as fs from 'fs';
import * as path from 'path';
import { LocalCommandRunner } from '../../domain/usecases/adapter-interfaces/LocalCommandRunner';
import { TmuxSessionRepository } from '../../domain/usecases/adapter-interfaces/TmuxSessionRepository';
import { LiveTmuxSession } from '../../domain/entities/LiveTmuxSession';
import { clSessionScopeUnitNameFromCgroupContent } from './clSessionScopeUnitNameFromCgroupContent';

const DEFAULT_SEND_KEYS_SUBMIT_DELAY_MS = 1000;
const BRACKETED_PASTE_START = '\x1b[200~';
const BRACKETED_PASTE_END = '\x1b[201~';

type ProcessTableEntry = {
  pid: number;
  ppid: number;
  args: string;
};

const nonEmptyTrimmedLines = (stdout: string): string[] =>
  stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

const parseProcessTable = (stdout: string): ProcessTableEntry[] =>
  nonEmptyTrimmedLines(stdout).flatMap((line) => {
    const match = line.match(/^(\d+)\s+(\d+)\s+(.*)/);
    if (!match) return [];
    return [
      {
        pid: parseInt(match[1], 10),
        ppid: parseInt(match[2], 10),
        args: match[3],
      },
    ];
  });

const parsePaneSessionMap = (stdout: string): Map<number, string> => {
  const paneSessionMap = new Map<number, string>();
  for (const line of nonEmptyTrimmedLines(stdout)) {
    const spaceIdx = line.indexOf(' ');
    if (spaceIdx < 0) continue;
    const panePid = parseInt(line.slice(0, spaceIdx), 10);
    const sessionName = line.slice(spaceIdx + 1);
    if (!isNaN(panePid) && sessionName.length > 0) {
      paneSessionMap.set(panePid, sessionName);
    }
  }
  return paneSessionMap;
};

const matchingPidsForIssueUrl = (
  processes: ProcessTableEntry[],
  issueUrl: string,
): Set<number> =>
  new Set(
    processes
      .filter((entry) => entry.args.split(/[\s'"]+/).includes(issueUrl))
      .map((entry) => entry.pid),
  );

const parentPidMapOf = (processes: ProcessTableEntry[]): Map<number, number> =>
  new Map<number, number>(processes.map((entry) => [entry.pid, entry.ppid]));

const sessionNamesForPids = (
  startPids: Iterable<number>,
  parentPidMap: Map<number, number>,
  paneSessionMap: Map<number, string>,
): string[] => {
  const sessionNames = new Set<string>();
  for (const startPid of startPids) {
    let pid = startPid;
    const visited = new Set<number>();
    while (pid > 1 && !visited.has(pid)) {
      const found = paneSessionMap.get(pid);
      if (found !== undefined) {
        sessionNames.add(found);
        break;
      }
      visited.add(pid);
      pid = parentPidMap.get(pid) ?? 0;
    }
  }
  return [...sessionNames];
};

const selectLiveSessionNamesForIssueUrl = (
  issueUrl: string,
  liveNames: string[],
  mappedNames: string[],
): string[] => {
  const canonicalName = issueUrl.replace(/[.:]/g, '_');
  return [
    ...new Set([
      ...liveNames.filter((name) => name === canonicalName),
      ...mappedNames.filter((name) => liveNames.includes(name)),
    ]),
  ];
};

export class NodeTmuxSessionRepository implements TmuxSessionRepository {
  constructor(
    private readonly localCommandRunner: LocalCommandRunner,
    private readonly procDirectory: string = '/proc',
    private readonly submitDelayMilliseconds: number = DEFAULT_SEND_KEYS_SUBMIT_DELAY_MS,
  ) {}

  listLiveSessionNames = async (): Promise<string[]> => {
    const { stdout, stderr, exitCode } =
      await this.localCommandRunner.runCommand('tmux', [
        'list-sessions',
        '-F',
        '#{session_name}',
      ]);
    if (exitCode !== 0) {
      if (this.isAbsentTmuxServer(stderr)) return [];
      throw new Error(`Failed to list tmux sessions: ${stderr}`);
    }
    return stdout
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  };

  listLiveSessionsWithActivity = async (): Promise<LiveTmuxSession[]> => {
    const { stdout, stderr, exitCode } =
      await this.localCommandRunner.runCommand('tmux', [
        'list-sessions',
        '-F',
        '#{session_name} #{session_activity}',
      ]);
    if (exitCode !== 0) {
      if (this.isAbsentTmuxServer(stderr)) return [];
      throw new Error(`Failed to list tmux sessions: ${stderr}`);
    }
    return stdout
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => {
        const separatorIndex = line.lastIndexOf(' ');
        const sessionName = line.slice(0, separatorIndex);
        const activityEpochSeconds = Number(line.slice(separatorIndex + 1));
        return { sessionName, activityEpochSeconds };
      });
  };

  listRunningWorkerScopeUnitNames = async (): Promise<string[]> => {
    const { stdout, exitCode } = await this.localCommandRunner.runCommand(
      'systemctl',
      [
        '--user',
        'list-units',
        '--type=scope',
        '--no-legend',
        '--plain',
        'aw-*.scope',
      ],
    );
    if (exitCode !== 0) {
      return [];
    }
    return stdout
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => line.split(/\s+/)[0])
      .filter(
        (unitName) => unitName.startsWith('aw-') && unitName.endsWith('.scope'),
      );
  };

  stopWorkerScopeUnit = async (scopeUnitName: string): Promise<void> => {
    await this.stopScopeUnit(scopeUnitName);
  };

  listInteractiveProcessCommandLines = async (): Promise<string[]> => {
    const { stdout, stderr, exitCode } =
      await this.localCommandRunner.runCommand('ps', ['-eo', 'args=']);
    if (exitCode !== 0) {
      throw new Error(`Failed to list interactive processes: ${stderr}`);
    }
    return stdout
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  };

  launchDetachedSession = async (
    sessionName: string,
    launcherCommand: string,
    issueUrl: string,
  ): Promise<void> => {
    const result = await this.localCommandRunner.runCommand('tmux', [
      'new-session',
      '-A',
      '-d',
      '-s',
      sessionName,
      'sh',
      '-lc',
      `exec "$1" "$2"`,
      'sh',
      launcherCommand,
      issueUrl,
    ]);
    if (result.exitCode !== 0)
      throw new Error(`Failed to launch tmux session: ${result.stderr}`);
  };

  killSession = async (sessionName: string): Promise<void> => {
    const scopeUnitNames = await this.sessionScopeUnitNames(sessionName);
    for (const scopeUnitName of scopeUnitNames) {
      await this.stopScopeUnit(scopeUnitName);
    }
    const { stderr, exitCode } = await this.localCommandRunner.runCommand(
      'tmux',
      ['kill-session', '-t', `=${sessionName}`],
    );
    if (exitCode !== 0) {
      throw new Error(
        `Failed to kill tmux session "${sessionName}": exit code ${exitCode}${
          stderr ? `: ${stderr}` : ''
        }`,
      );
    }
  };

  private sessionScopeUnitNames = async (
    sessionName: string,
  ): Promise<string[]> => {
    const panes = await this.localCommandRunner.runCommand('tmux', [
      'list-panes',
      '-a',
      '-F',
      '#{pane_pid} #{session_name}',
    ]);
    if (panes.exitCode !== 0) {
      throw new Error(
        `Failed to list panes for session "${sessionName}": ${panes.stderr}`,
      );
    }
    const panePids = new Set(
      panes.stdout.split('\n').flatMap((line) => {
        const match = line.trim().match(/^(\d+) (.+)$/);
        return match !== null && match[2] === sessionName
          ? [Number(match[1])]
          : [];
      }),
    );
    if (panePids.size === 0) {
      throw new Error(
        `No pane process found for tmux session "${sessionName}"`,
      );
    }
    const processResult = await this.localCommandRunner.runCommand('ps', [
      '-eo',
      'pid=,ppid=,args=',
    ]);
    if (processResult.exitCode !== 0) {
      throw new Error(
        `Failed to list processes for session "${sessionName}": ${processResult.stderr}`,
      );
    }
    const parentPidByPid = new Map(
      processResult.stdout.split('\n').flatMap((line): [number, number][] => {
        const match = line.trim().match(/^(\d+)\s+(\d+)(?:\s|$)/);
        return match === null ? [] : [[Number(match[1]), Number(match[2])]];
      }),
    );
    const sessionPids = new Set(panePids);
    for (const processPid of parentPidByPid.keys()) {
      let ancestorPid = processPid;
      const visitedPids = new Set<number>();
      while (ancestorPid > 1 && !visitedPids.has(ancestorPid)) {
        if (panePids.has(ancestorPid)) {
          sessionPids.add(processPid);
          break;
        }
        visitedPids.add(ancestorPid);
        ancestorPid = parentPidByPid.get(ancestorPid) ?? 0;
      }
    }
    const scopeUnitNames = new Set<string>();
    for (const processPid of sessionPids) {
      const cgroupContent = fs.readFileSync(
        path.join(this.procDirectory, String(processPid), 'cgroup'),
        'utf8',
      );
      const scopeUnitName =
        clSessionScopeUnitNameFromCgroupContent(cgroupContent);
      if (scopeUnitName !== null) scopeUnitNames.add(scopeUnitName);
    }
    return [...scopeUnitNames];
  };

  killOwnSession = async (): Promise<void> => {
    const cgroupContent = fs.readFileSync(
      path.join(this.procDirectory, 'self', 'cgroup'),
      'utf8',
    );
    const scopeUnitName =
      clSessionScopeUnitNameFromCgroupContent(cgroupContent);
    if (scopeUnitName === null) {
      throw new Error(
        'Failed to determine the current cl-*.scope systemd user unit from /proc/self/cgroup',
      );
    }
    await this.stopScopeUnit(scopeUnitName);
  };

  private stopScopeUnit = async (scopeUnitName: string): Promise<void> => {
    await this.localCommandRunner.runCommand('systemctl', [
      '--user',
      'reset-failed',
      scopeUnitName,
    ]);
    const { stderr, exitCode } = await this.localCommandRunner.runCommand(
      'systemctl',
      ['--user', 'stop', scopeUnitName],
    );
    await this.localCommandRunner.runCommand('systemctl', [
      '--user',
      'reset-failed',
      scopeUnitName,
    ]);
    if (exitCode !== 0) {
      throw new Error(
        `Failed to stop systemd user scope "${scopeUnitName}": exit code ${exitCode}${
          stderr ? `: ${stderr}` : ''
        }`,
      );
    }
  };

  sendKeys = async (
    sessionName: string,
    literalText: string,
  ): Promise<void> => {
    const literalResult = await this.localCommandRunner.runCommand('tmux', [
      'send-keys',
      '-t',
      sessionName,
      '-l',
      `${BRACKETED_PASTE_START}${literalText}${BRACKETED_PASTE_END}`,
    ]);
    if (literalResult.exitCode !== 0) {
      throw new Error(
        `Failed to send keys to tmux session "${sessionName}": exit code ${literalResult.exitCode}${
          literalResult.stderr ? `: ${literalResult.stderr}` : ''
        }`,
      );
    }
    await this.delaySubmit();
    await this.sendEnter(sessionName);
  };

  attachOrCreateInteractiveSession = async (
    issueUrl: string,
    scopeLibPath: string | null,
  ): Promise<void> => {
    if (scopeLibPath !== null) {
      const { stdout, exitCode } = await this.localCommandRunner.runCommand(
        'bash',
        [scopeLibPath, 'registry-get-session', issueUrl],
      );
      if (exitCode === 0 && stdout.trim().length > 0) {
        const registeredSessionName = stdout.trim();
        const { exitCode: hasSessionExitCode } =
          await this.localCommandRunner.runCommand('tmux', [
            'has-session',
            '-t',
            `=${registeredSessionName}`,
          ]);
        if (hasSessionExitCode === 0) {
          this.localCommandRunner.spawnInteractive('tmux', [
            'attach-session',
            '-t',
            `=${registeredSessionName}`,
          ]);
          return;
        }
      }
    }
    const sessionName = await this.findSessionNameForUrl(issueUrl);
    if (sessionName !== null) {
      this.localCommandRunner.spawnInteractive('tmux', [
        'attach-session',
        '-t',
        `=${sessionName}`,
      ]);
      return;
    }
    this.localCommandRunner.spawnInteractive('tmux', [
      'new-session',
      '-A',
      '-s',
      issueUrl,
      'cl',
      issueUrl,
    ]);
  };

  listSessionNamesForIssueUrl = async (issueUrl: string): Promise<string[]> => {
    const liveNames = await this.listLiveSessionNames();
    if (liveNames.length === 0) return [];
    const mappedNames = await this.findSessionNamesForUrl(issueUrl);
    return selectLiveSessionNamesForIssueUrl(issueUrl, liveNames, mappedNames);
  };

  listSessionNamesForIssueUrls = async (
    issueUrls: string[],
  ): Promise<Map<string, string[]>> => {
    if (issueUrls.length === 0) return new Map<string, string[]>();
    const liveNames = await this.listLiveSessionNames();
    if (liveNames.length === 0)
      return new Map<string, string[]>(
        issueUrls.map((issueUrl): [string, string[]] => [issueUrl, []]),
      );
    const processes = await this.readProcessTable();
    const parentPidMap = parentPidMapOf(processes);
    const matchesByUrl = issueUrls.map((issueUrl) => ({
      issueUrl,
      matchingPids: matchingPidsForIssueUrl(processes, issueUrl),
    }));
    const anyUrlMatchesProcess = matchesByUrl.some(
      ({ matchingPids }) => matchingPids.size > 0,
    );
    const paneSessionMap = anyUrlMatchesProcess
      ? await this.readPaneSessionMap()
      : new Map<number, string>();
    return new Map<string, string[]>(
      matchesByUrl.map(({ issueUrl, matchingPids }): [string, string[]] => [
        issueUrl,
        selectLiveSessionNamesForIssueUrl(
          issueUrl,
          liveNames,
          sessionNamesForPids(matchingPids, parentPidMap, paneSessionMap),
        ),
      ]),
    );
  };

  private isAbsentTmuxServer = (stderr: string): boolean =>
    /no server running|no sessions|error connecting to .+(?:: No such file or directory| \(No such file or directory\))/i.test(
      stderr,
    );

  private findSessionNameForUrl = async (
    issueUrl: string,
  ): Promise<string | null> =>
    (await this.findSessionNamesForUrl(issueUrl))[0] ?? null;

  private readProcessTable = async (): Promise<ProcessTableEntry[]> => {
    const { stdout, stderr, exitCode } =
      await this.localCommandRunner.runCommand('ps', [
        '-eo',
        'pid=,ppid=,args=',
      ]);
    if (exitCode !== 0) {
      throw new Error(
        `Failed to list processes for session mapping: ${stderr}`,
      );
    }
    return parseProcessTable(stdout);
  };

  private readPaneSessionMap = async (): Promise<Map<number, string>> => {
    const { stdout, stderr, exitCode } =
      await this.localCommandRunner.runCommand('tmux', [
        'list-panes',
        '-a',
        '-F',
        '#{pane_pid} #{session_name}',
      ]);
    if (exitCode !== 0) {
      if (this.isAbsentTmuxServer(stderr)) return new Map<number, string>();
      throw new Error(`Failed to list panes for session mapping: ${stderr}`);
    }
    return parsePaneSessionMap(stdout);
  };

  private findSessionNamesForUrl = async (
    issueUrl: string,
  ): Promise<string[]> => {
    const processes = await this.readProcessTable();
    const matchingPids = matchingPidsForIssueUrl(processes, issueUrl);
    if (matchingPids.size === 0) return [];
    const paneSessionMap = await this.readPaneSessionMap();
    return sessionNamesForPids(
      matchingPids,
      parentPidMapOf(processes),
      paneSessionMap,
    );
  };

  private sendEnter = async (sessionName: string): Promise<void> => {
    const enterResult = await this.localCommandRunner.runCommand('tmux', [
      'send-keys',
      '-t',
      sessionName,
      'Enter',
    ]);
    if (enterResult.exitCode !== 0) {
      throw new Error(
        `Failed to send Enter to tmux session "${sessionName}": exit code ${enterResult.exitCode}${
          enterResult.stderr ? `: ${enterResult.stderr}` : ''
        }`,
      );
    }
  };

  private delaySubmit = async (): Promise<void> => {
    if (this.submitDelayMilliseconds <= 0) {
      return;
    }
    await new Promise((resolve) =>
      setTimeout(resolve, this.submitDelayMilliseconds),
    );
  };
}
