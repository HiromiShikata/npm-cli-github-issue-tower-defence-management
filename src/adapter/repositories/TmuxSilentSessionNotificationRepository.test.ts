import { LocalCommandRunner } from '../../domain/usecases/adapter-interfaces/LocalCommandRunner';
import { LocalStorageCacheRepository } from './LocalStorageCacheRepository';
import { TmuxSilentSessionNotificationRepository } from './TmuxSilentSessionNotificationRepository';

type Mocked<T> = jest.Mocked<T> & jest.MockedObject<T>;

const createMockRunner = (): Mocked<LocalCommandRunner> => ({
  runCommand: jest.fn().mockResolvedValue({
    stdout: '',
    stderr: '',
    exitCode: 0,
  }),
});

const createMockCacheRepository = (): Mocked<
  Pick<LocalStorageCacheRepository, 'getLatest' | 'set'>
> => ({
  getLatest: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
});

describe('TmuxSilentSessionNotificationRepository', () => {
  describe('sendSelfCheckNotification', () => {
    it('sends the message literally then submits it with Enter', async () => {
      const runner = createMockRunner();
      const cache = createMockCacheRepository();
      const repository = new TmuxSilentSessionNotificationRepository(
        runner,
        cache,
      );

      await repository.sendSelfCheckNotification(
        'https_//github_com/owner/repo/issues/9',
        'self check message',
      );

      expect(runner.runCommand.mock.calls[0]).toEqual([
        'tmux',
        [
          'send-keys',
          '-t',
          'https_//github_com/owner/repo/issues/9',
          '-l',
          'self check message',
        ],
      ]);
      expect(runner.runCommand.mock.calls[1]).toEqual([
        'tmux',
        ['send-keys', '-t', 'https_//github_com/owner/repo/issues/9', 'Enter'],
      ]);
    });

    it('throws when sending the message literally fails', async () => {
      const runner = createMockRunner();
      runner.runCommand.mockResolvedValueOnce({
        stdout: '',
        stderr: "can't find session",
        exitCode: 1,
      });
      const cache = createMockCacheRepository();
      const repository = new TmuxSilentSessionNotificationRepository(
        runner,
        cache,
      );

      await expect(
        repository.sendSelfCheckNotification('missing_session', 'message'),
      ).rejects.toThrow(
        'Failed to send notification to tmux session "missing_session"',
      );
    });
  });

  describe('getLastNotifiedEpochSeconds', () => {
    it('returns the cached epoch seconds for a session', async () => {
      const runner = createMockRunner();
      const cache = createMockCacheRepository();
      cache.getLatest.mockResolvedValue({
        value: { epochSeconds: 1700000000 },
        timestamp: new Date(),
      });
      const repository = new TmuxSilentSessionNotificationRepository(
        runner,
        cache,
      );

      const result = await repository.getLastNotifiedEpochSeconds(
        'https_//github_com/owner/repo/issues/9',
      );

      expect(result).toBe(1700000000);
      expect(cache.getLatest).toHaveBeenCalledWith(
        'silent-session-notification/https___github_com_owner_repo_issues_9',
      );
    });

    it('returns null when no cache entry exists', async () => {
      const runner = createMockRunner();
      const cache = createMockCacheRepository();
      cache.getLatest.mockResolvedValue(null);
      const repository = new TmuxSilentSessionNotificationRepository(
        runner,
        cache,
      );

      const result = await repository.getLastNotifiedEpochSeconds(
        'https_//github_com/owner/repo/issues/9',
      );

      expect(result).toBeNull();
    });

    it('returns null when the cached value has no numeric epoch', async () => {
      const runner = createMockRunner();
      const cache = createMockCacheRepository();
      cache.getLatest.mockResolvedValue({
        value: {},
        timestamp: new Date(),
      });
      const repository = new TmuxSilentSessionNotificationRepository(
        runner,
        cache,
      );

      const result = await repository.getLastNotifiedEpochSeconds(
        'https_//github_com/owner/repo/issues/9',
      );

      expect(result).toBeNull();
    });
  });

  describe('setLastNotifiedEpochSeconds', () => {
    it('persists the epoch seconds keyed by the sanitized session name', async () => {
      const runner = createMockRunner();
      const cache = createMockCacheRepository();
      const repository = new TmuxSilentSessionNotificationRepository(
        runner,
        cache,
      );

      await repository.setLastNotifiedEpochSeconds(
        'https_//github_com/owner/repo/issues/9',
        1700000000,
      );

      expect(cache.set).toHaveBeenCalledWith(
        'silent-session-notification/https___github_com_owner_repo_issues_9',
        { epochSeconds: 1700000000 },
      );
    });
  });
});
