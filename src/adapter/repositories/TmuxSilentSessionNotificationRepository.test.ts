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
    it('wraps the message in bracketed-paste framing, sends it literally, then submits it with Enter', async () => {
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
          '\x1b[200~self check message\x1b[201~',
        ],
      ]);
      expect(runner.runCommand.mock.calls[1]).toEqual([
        'tmux',
        ['send-keys', '-t', 'https_//github_com/owner/repo/issues/9', 'Enter'],
      ]);
    });

    it('preserves an unchanged multi-line message body inside the bracketed-paste frame', async () => {
      const runner = createMockRunner();
      const repository = new TmuxSilentSessionNotificationRepository(runner);
      const multiLineMessage = 'first line\nsecond line\n\nthird line';

      await repository.sendSelfCheckNotification(
        'https_//github_com/owner/repo/issues/9',
        multiLineMessage,
      );

      const literalArgument = runner.runCommand.mock.calls[0][1][4];
      expect(literalArgument.startsWith('\x1b[200~')).toBe(true);
      expect(literalArgument.endsWith('\x1b[201~')).toBe(true);
      expect(
        literalArgument.slice('\x1b[200~'.length, -'\x1b[201~'.length),
      ).toBe(multiLineMessage);
      const literalBytes = Buffer.from(literalArgument, 'utf8').toString('hex');
      expect(literalBytes.startsWith('1b5b3230307e')).toBe(true);
      expect(literalBytes.endsWith('1b5b3230317e')).toBe(true);
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
