import { SilentSessionNotificationRepository } from '../../domain/usecases/adapter-interfaces/SilentSessionNotificationRepository';
import { LocalCommandRunner } from '../../domain/usecases/adapter-interfaces/LocalCommandRunner';
import { LocalStorageCacheRepository } from './LocalStorageCacheRepository';

const CACHE_KEY_PREFIX = 'silent-session-notification';

const readEpochSeconds = (value: object): number | null => {
  if (!('epochSeconds' in value)) {
    return null;
  }
  const candidate = value.epochSeconds;
  if (typeof candidate !== 'number') {
    return null;
  }
  return candidate;
};

export class TmuxSilentSessionNotificationRepository implements SilentSessionNotificationRepository {
  constructor(
    private readonly localCommandRunner: LocalCommandRunner,
    private readonly cacheRepository: Pick<
      LocalStorageCacheRepository,
      'getLatest' | 'set'
    >,
  ) {}

  getLastNotifiedEpochSeconds = async (
    sessionName: string,
  ): Promise<number | null> => {
    const cached = await this.cacheRepository.getLatest(
      this.toCacheKey(sessionName),
    );
    if (cached === null) {
      return null;
    }
    return readEpochSeconds(cached.value);
  };

  setLastNotifiedEpochSeconds = async (
    sessionName: string,
    epochSeconds: number,
  ): Promise<void> => {
    await this.cacheRepository.set(this.toCacheKey(sessionName), {
      epochSeconds,
    });
  };

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

  private toCacheKey = (sessionName: string): string =>
    `${CACHE_KEY_PREFIX}/${sessionName.replace(/\//g, '_')}`;
}
