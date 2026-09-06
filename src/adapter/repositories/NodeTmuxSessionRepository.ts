import * as fs from 'fs';
import * as path from 'path';
import { LocalCommandRunner } from '../../domain/usecases/adapter-interfaces/LocalCommandRunner';
import { TmuxSessionRepository } from '../../domain/usecases/adapter-interfaces/TmuxSessionRepository';
import { LiveTmuxSession } from '../../domain/entities/LiveTmuxSession';
import { clSessionScopeUnitName } from './clSessionScopeUnitName';
import { clSessionScopeUnitNameFromCgroupContent } from './clSessionScopeUnitNameFromCgroupContent';

const DEFAULT_SEND_KEYS_SUBMIT_DELAY_MS = 1000;
const BRACKETED_PASTE_START = '\x1b[200~';
const BRACKETED_PASTE_END = '\x1b[201~';

const shellSingleQuote = (value: string): string =>
  `'${value.replace(/'/g, `'\\''`)}'`;

export class NodeTmuxSessionRepository implements TmuxSessionRepository {
  constructor(
    private readonly localCommandRunner: LocalCommandRunner,
    private readonly procDirectory: string = '/proc',
    private readonly submitDelayMilliseconds: number = DEFAULT_SEND_KEYS_SUBMIT_DELAY_MS,
  ) {}

  listLiveSessionNames = async (): Promise<string[]> => {
    const { stdout, exitCode } = await this.localCommandRunner.runCommand(
      'tmux',
      ['list-sessions', '-F', '#{session_name}'],
    );
    if (exitCode !== 0) {
      return [];
    }
    return stdout
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  };

  listLiveSessionsWithActivity = async (): Promise<LiveTmuxSession[]> => {
    const { stdout, exitCode } = await this.localCommandRunner.runCommand(
      'tmux',
      ['list-sessions', '-F', '#{session_name} #{session_activity}'],
    );
    if (exitCode !== 0) {
      return [];
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

  listInteractiveProcessCommandLines = async (): Promise<string[]> => {
    const { stdout, exitCode } = await this.localCommandRunner.runCommand(
      'ps',
      ['-eo', 'args='],
    );
    if (exitCode !== 0) {
      return [];
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
    await this.localCommandRunner.runCommand('tmux', [
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
  };

  killSession = async (sessionName: string): Promise<void> => {
    const scopeUnitName = clSessionScopeUnitName(sessionName);
    await this.stopScopeUnit(scopeUnitName);
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
      console.error(
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

  private findSessionNameForUrl = async (
    issueUrl: string,
  ): Promise<string | null> => {
    const { stdout: psOut, exitCode: psExit } =
      await this.localCommandRunner.runCommand('ps', [
        '-eo',
        'pid=,ppid=,args=',
      ]);
    if (psExit !== 0) {
      return null;
    }
    const processes = psOut
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .flatMap((line) => {
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
    const matchingPids = new Set(
      processes.filter((p) => p.args.includes(issueUrl)).map((p) => p.pid),
    );
    if (matchingPids.size === 0) {
      return null;
    }
    const { stdout: panesOut, exitCode: panesExit } =
      await this.localCommandRunner.runCommand('tmux', [
        'list-panes',
        '-a',
        '-F',
        '#{pane_pid} #{session_name}',
      ]);
    if (panesExit !== 0) {
      return null;
    }
    const paneSessionMap = new Map<number, string>();
    for (const line of panesOut
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0)) {
      const spaceIdx = line.indexOf(' ');
      if (spaceIdx < 0) continue;
      const panePid = parseInt(line.slice(0, spaceIdx), 10);
      const sessionName = line.slice(spaceIdx + 1);
      if (!isNaN(panePid) && sessionName.length > 0) {
        paneSessionMap.set(panePid, sessionName);
      }
    }
    const ppidMap = new Map<number, number>(
      processes.map((p) => [p.pid, p.ppid]),
    );
    for (const startPid of matchingPids) {
      let pid = startPid;
      const visited = new Set<number>();
      while (pid > 1 && !visited.has(pid)) {
        const found = paneSessionMap.get(pid);
        if (found !== undefined) {
          return found;
        }
        visited.add(pid);
        pid = ppidMap.get(pid) ?? 0;
      }
    }
    return null;
  };

  launchBareNameLeaderSession = async (name: string): Promise<void> => {
    const sessionName = name.replace(/[.:]/g, '_');
    const leaderCommand = `cl ${shellSingleQuote(name)}; exec /bin/bash`;
    const { stderr, exitCode } = await this.localCommandRunner.runCommand(
      'tmux',
      ['new-session', '-d', '-s', sessionName, 'bash', '-lc', leaderCommand],
    );
    if (exitCode !== 0) {
      throw new Error(
        `Failed to relaunch bare-name leader session "${sessionName}": exit code ${exitCode}${
          stderr ? `: ${stderr}` : ''
        }`,
      );
    }
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
