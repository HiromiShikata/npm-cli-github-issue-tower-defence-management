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

    it('flattens a multi-line message into a single line so no newline reaches the input box', async () => {
      const runner = createMockRunner();
      const repository = new TmuxSilentSessionNotificationRepository(runner);
      const multiLineMessage = 'first line\nsecond line\n\nthird line';

      await repository.sendSelfCheckNotification(
        'https_//github_com/owner/repo/issues/9',
        multiLineMessage,
      );

      const literalArgument = runner.runCommand.mock.calls[0][1][4];
      expect(literalArgument).not.toContain('\n');
      expect(literalArgument).not.toContain('\r');
      expect(
        literalArgument.slice('\x1b[200~'.length, -'\x1b[201~'.length),
      ).toBe('first line second line third line');
    });

    it('keeps the bracketed-paste framing around the flattened message', async () => {
      const runner = createMockRunner();
      const repository = new TmuxSilentSessionNotificationRepository(runner);

      await repository.sendSelfCheckNotification(
        'https_//github_com/owner/repo/issues/9',
        'first line\nsecond line',
      );

      const literalArgument = runner.runCommand.mock.calls[0][1][4];
      const literalBytes = Buffer.from(literalArgument, 'utf8').toString('hex');
      expect(literalBytes.startsWith('1b5b3230307e')).toBe(true);
      expect(literalBytes.endsWith('1b5b3230317e')).toBe(true);
      expect(runner.runCommand.mock.calls[1]).toEqual([
        'tmux',
        ['send-keys', '-t', 'https_//github_com/owner/repo/issues/9', 'Enter'],
      ]);
    });

    it('collapses the run of spaces left by consecutive line breaks', async () => {
      const runner = createMockRunner();
      const repository = new TmuxSilentSessionNotificationRepository(runner);

      await repository.sendSelfCheckNotification(
        'https_//github_com/owner/repo/issues/9',
        'section one\n\n\nsection two',
      );

      const literalArgument = runner.runCommand.mock.calls[0][1][4];
      expect(
        literalArgument.slice('\x1b[200~'.length, -'\x1b[201~'.length),
      ).toBe('section one section two');
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
