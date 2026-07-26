import * as fs from 'fs';
import * as path from 'path';
import { LocalCommandRunner } from '../../domain/usecases/adapter-interfaces/LocalCommandRunner';
import { TmuxSessionRepository } from '../../domain/usecases/adapter-interfaces/TmuxSessionRepository';
import { LiveTmuxSession } from '../../domain/entities/LiveTmuxSession';
import { clSessionScopeUnitName } from './clSessionScopeUnitName';
import { clSessionScopeUnitNameFromCgroupContent } from './clSessionScopeUnitNameFromCgroupContent';

export class NodeTmuxSessionRepository implements TmuxSessionRepository {
  constructor(
    private readonly localCommandRunner: LocalCommandRunner,
    private readonly procDirectory: string = '/proc',
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
}
