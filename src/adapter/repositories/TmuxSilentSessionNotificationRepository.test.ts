import { LocalCommandRunner } from '../../domain/usecases/adapter-interfaces/LocalCommandRunner';
import { TmuxSilentSessionNotificationRepository } from './TmuxSilentSessionNotificationRepository';

type Mocked<T> = jest.Mocked<T> & jest.MockedObject<T>;

const createMockRunner = (): Mocked<LocalCommandRunner> => ({
  runCommand: jest.fn().mockResolvedValue({
    stdout: '',
    stderr: '',
    exitCode: 0,
  }),
});

describe('TmuxSilentSessionNotificationRepository', () => {
  describe('sendSelfCheckNotification', () => {
    it('sends the message literally then submits it with Enter', async () => {
      const runner = createMockRunner();
      const repository = new TmuxSilentSessionNotificationRepository(runner);

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
      const repository = new TmuxSilentSessionNotificationRepository(runner);

      await expect(
        repository.sendSelfCheckNotification('missing_session', 'message'),
      ).rejects.toThrow(
        'Failed to send notification to tmux session "missing_session"',
      );
    });
  });
});
