import { LocalCommandRunner } from '../../domain/usecases/adapter-interfaces/LocalCommandRunner';
import { TmuxSilentSessionNotificationRepository } from './TmuxSilentSessionNotificationRepository';

type Mocked<T> = jest.Mocked<T> & jest.MockedObject<T>;

const bracketedPasteStart = '\x1b[200~';
const bracketedPasteEnd = '\x1b[201~';

const createMockRunner = (): Mocked<LocalCommandRunner> => ({
  runCommand: jest.fn().mockResolvedValue({
    stdout: '',
    stderr: '',
    exitCode: 0,
  }),
});

describe('TmuxSilentSessionNotificationRepository', () => {
  describe('sendSelfCheckNotification', () => {
    it('wraps the message in bracketed-paste framing then submits it with Enter', async () => {
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
          `${bracketedPasteStart}self check message${bracketedPasteEnd}`,
        ],
      ]);
      expect(runner.runCommand.mock.calls[1]).toEqual([
        'tmux',
        ['send-keys', '-t', 'https_//github_com/owner/repo/issues/9', 'Enter'],
      ]);
    });

    it('emits the exact byte sequence ESC[200~ then payload then ESC[201~ before the Enter submit', async () => {
      const runner = createMockRunner();
      const repository = new TmuxSilentSessionNotificationRepository(runner);

      await repository.sendSelfCheckNotification(
        'session',
        'line-one\nline-two',
      );

      const literalArg = runner.runCommand.mock.calls[0][1][4];
      expect(literalArg.startsWith(bracketedPasteStart)).toBe(true);
      expect(literalArg.endsWith(bracketedPasteEnd)).toBe(true);
      expect(literalArg).toBe(
        `${bracketedPasteStart}line-one\nline-two${bracketedPasteEnd}`,
      );
      expect(Buffer.from(literalArg, 'utf8').toString('hex')).toBe(
        '1b5b3230307e6c696e652d6f6e650a6c696e652d74776f1b5b3230317e',
      );
      expect(runner.runCommand.mock.calls[0][1][3]).toBe('-l');
      expect(runner.runCommand.mock.calls[1][1]).toEqual([
        'send-keys',
        '-t',
        'session',
        'Enter',
      ]);
    });

    it('preserves the message content unchanged between the framing markers', async () => {
      const runner = createMockRunner();
      const repository = new TmuxSilentSessionNotificationRepository(runner);
      const message = 'reminder sentinel prefix\n\nplease run a self check';

      await repository.sendSelfCheckNotification('session', message);

      const literalArg = runner.runCommand.mock.calls[0][1][4];
      expect(literalArg).toBe(
        `${bracketedPasteStart}${message}${bracketedPasteEnd}`,
      );
      expect(
        literalArg.slice(
          bracketedPasteStart.length,
          literalArg.length - bracketedPasteEnd.length,
        ),
      ).toBe(message);
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

    it('throws when submitting the message with Enter fails', async () => {
      const runner = createMockRunner();
      runner.runCommand
        .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })
        .mockResolvedValueOnce({
          stdout: '',
          stderr: 'submit failed',
          exitCode: 1,
        });
      const repository = new TmuxSilentSessionNotificationRepository(runner);

      await expect(
        repository.sendSelfCheckNotification('session', 'message'),
      ).rejects.toThrow(
        'Failed to send notification to tmux session "session"',
      );
    });
  });
});
