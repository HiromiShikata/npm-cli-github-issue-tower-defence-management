import { LocalCommandRunner } from '../../domain/usecases/adapter-interfaces/LocalCommandRunner';
import { TmuxSessionRepository } from '../../domain/usecases/adapter-interfaces/TmuxSessionRepository';

export class NodeTmuxSessionRepository implements TmuxSessionRepository {
  constructor(private readonly localCommandRunner: LocalCommandRunner) {}

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
}
