import { SilentSessionNotificationRepository } from '../../domain/usecases/adapter-interfaces/SilentSessionNotificationRepository';
import { LocalCommandRunner } from '../../domain/usecases/adapter-interfaces/LocalCommandRunner';

export class TmuxSilentSessionNotificationRepository implements SilentSessionNotificationRepository {
  constructor(private readonly localCommandRunner: LocalCommandRunner) {}

  sendSelfCheckNotification = async (
    sessionName: string,
    message: string,
  ): Promise<void> => {
    const literalResult = await this.localCommandRunner.runCommand('tmux', [
      'send-keys',
      '-t',
      sessionName,
      '-l',
      message,
    ]);
    if (literalResult.exitCode !== 0) {
      throw new Error(
        `Failed to send notification to tmux session "${sessionName}": exit code ${literalResult.exitCode}${
          literalResult.stderr ? `: ${literalResult.stderr}` : ''
        }`,
      );
    }
    const submitResult = await this.localCommandRunner.runCommand('tmux', [
      'send-keys',
      '-t',
      sessionName,
      'Enter',
    ]);
    if (submitResult.exitCode !== 0) {
      throw new Error(
        `Failed to send notification to tmux session "${sessionName}": exit code ${submitResult.exitCode}${
          submitResult.stderr ? `: ${submitResult.stderr}` : ''
        }`,
      );
    }
  };
}
