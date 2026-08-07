import { LocalCommandRunner } from '../../domain/usecases/adapter-interfaces/LocalCommandRunner';
import { Sleeper } from '../../domain/usecases/adapter-interfaces/Sleeper';
import { TmuxSilentSessionNotificationRepository } from './TmuxSilentSessionNotificationRepository';

type Mocked<T> = jest.Mocked<T> & jest.MockedObject<T>;

const createMockRunner = (): Mocked<LocalCommandRunner> => ({
  runCommand: jest.fn().mockResolvedValue({
    stdout: '',
    stderr: '',
    exitCode: 0,
  }),
});

const createMockSleeper = (): Mocked<Sleeper> => ({
  sleep: jest.fn().mockResolvedValue(undefined),
});

const sessionName = 'https_//github_com/owner/repo/issues/9';

const paneWithInputBoxContent = (inputBoxContent: string): string =>
  [
    '● The previous assistant output line',
    '',
    '────────────────────────────────────────',
    inputBoxContent,
    '────────────────────────────────────────',
    '  {Opus 4.5} (dev1)  CTX[██░░░░░░░░]16%',
  ].join('\n');

const createPaneAwareRunner = (
  paneTexts: string[],
): Mocked<LocalCommandRunner> => {
  let capturedPaneIndex = 0;
  return {
    runCommand: jest.fn().mockImplementation((_program, args: string[]) => {
      if (args[0] !== 'capture-pane') {
        return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 });
      }
      const paneText =
        paneTexts[Math.min(capturedPaneIndex, paneTexts.length - 1)];
      capturedPaneIndex += 1;
      return Promise.resolve({ stdout: paneText, stderr: '', exitCode: 0 });
    }),
  };
};

const submitKeyCallCount = (runner: Mocked<LocalCommandRunner>): number =>
  runner.runCommand.mock.calls.filter(
    (call) => call[1][0] === 'send-keys' && call[1][3] === 'Enter',
  ).length;

describe('TmuxSilentSessionNotificationRepository', () => {
  describe('sendSelfCheckNotification', () => {
    it('wraps the message in bracketed-paste framing, sends it literally, then submits it with Enter', async () => {
      const runner = createMockRunner();
      const repository = new TmuxSilentSessionNotificationRepository(
        runner,
        createMockSleeper(),
      );

      await repository.sendSelfCheckNotification(
        sessionName,
        'self check message',
      );

      expect(runner.runCommand.mock.calls[0]).toEqual([
        'tmux',
        [
          'send-keys',
          '-t',
          sessionName,
          '-l',
          '\x1b[200~self check message\x1b[201~',
        ],
      ]);
      expect(runner.runCommand.mock.calls[1]).toEqual([
        'tmux',
        ['send-keys', '-t', sessionName, 'Enter'],
      ]);
    });

    it('flattens a multi-line message into a single line so no newline reaches the input box', async () => {
      const runner = createMockRunner();
      const repository = new TmuxSilentSessionNotificationRepository(
        runner,
        createMockSleeper(),
      );
      const multiLineMessage = 'first line\nsecond line\n\nthird line';

      await repository.sendSelfCheckNotification(sessionName, multiLineMessage);

      const literalArgument = runner.runCommand.mock.calls[0][1][4];
      expect(literalArgument).not.toContain('\n');
      expect(literalArgument).not.toContain('\r');
      expect(
        literalArgument.slice('\x1b[200~'.length, -'\x1b[201~'.length),
      ).toBe('first line second line third line');
    });

    it('keeps the bracketed-paste framing around the flattened message', async () => {
      const runner = createMockRunner();
      const repository = new TmuxSilentSessionNotificationRepository(
        runner,
        createMockSleeper(),
      );

      await repository.sendSelfCheckNotification(
        sessionName,
        'first line\nsecond line',
      );

      const literalArgument = runner.runCommand.mock.calls[0][1][4];
      const literalBytes = Buffer.from(literalArgument, 'utf8').toString('hex');
      expect(literalBytes.startsWith('1b5b3230307e')).toBe(true);
      expect(literalBytes.endsWith('1b5b3230317e')).toBe(true);
      expect(runner.runCommand.mock.calls[1]).toEqual([
        'tmux',
        ['send-keys', '-t', sessionName, 'Enter'],
      ]);
    });

    it('collapses the run of spaces left by consecutive line breaks', async () => {
      const runner = createMockRunner();
      const repository = new TmuxSilentSessionNotificationRepository(
        runner,
        createMockSleeper(),
      );

      await repository.sendSelfCheckNotification(
        sessionName,
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
      const repository = new TmuxSilentSessionNotificationRepository(
        runner,
        createMockSleeper(),
      );

      await expect(
        repository.sendSelfCheckNotification('missing_session', 'message'),
      ).rejects.toThrow(
        'Failed to send notification to tmux session "missing_session"',
      );
    });

    it('pushes the message out with another Enter while it is still sitting in the input box', async () => {
      const runner = createPaneAwareRunner([
        paneWithInputBoxContent(
          '❯ [TDPM_SILENT_SESSION_SELF_CHECK_REMINDER] report your state',
        ),
        paneWithInputBoxContent('❯ '),
      ]);
      const repository = new TmuxSilentSessionNotificationRepository(
        runner,
        createMockSleeper(),
      );

      await repository.sendSelfCheckNotification(
        sessionName,
        '[TDPM_SILENT_SESSION_SELF_CHECK_REMINDER] report your state',
      );

      expect(submitKeyCallCount(runner)).toBe(2);
      expect(runner.runCommand.mock.calls[2]).toEqual([
        'tmux',
        ['capture-pane', '-p', '-t', sessionName],
      ]);
    });

    it('sends no further Enter once the input box no longer holds the message', async () => {
      const runner = createPaneAwareRunner([paneWithInputBoxContent('❯ ')]);
      const repository = new TmuxSilentSessionNotificationRepository(
        runner,
        createMockSleeper(),
      );

      await repository.sendSelfCheckNotification(
        sessionName,
        '[TDPM_SILENT_SESSION_SELF_CHECK_REMINDER] report your state',
      );

      expect(submitKeyCallCount(runner)).toBe(1);
    });

    it('sends no further Enter while the message is held as a queued message', async () => {
      const runner = createPaneAwareRunner([
        paneWithInputBoxContent('❯ Press up to edit queued messages'),
      ]);
      const repository = new TmuxSilentSessionNotificationRepository(
        runner,
        createMockSleeper(),
      );

      await repository.sendSelfCheckNotification(
        sessionName,
        '[TDPM_SILENT_SESSION_SELF_CHECK_REMINDER] report your state',
      );

      expect(submitKeyCallCount(runner)).toBe(1);
    });

    it('stops pushing after the configured attempt limit so newlines cannot pile up', async () => {
      const runner = createPaneAwareRunner([
        paneWithInputBoxContent(
          '❯ [TDPM_SILENT_SESSION_SELF_CHECK_REMINDER] report your state',
        ),
      ]);
      const repository = new TmuxSilentSessionNotificationRepository(
        runner,
        createMockSleeper(),
        2,
      );

      await repository.sendSelfCheckNotification(
        sessionName,
        '[TDPM_SILENT_SESSION_SELF_CHECK_REMINDER] report your state',
      );

      expect(submitKeyCallCount(runner)).toBe(3);
    });

    it('waits for the bracketed-paste parsing and rendering window before reading the input box back', async () => {
      const runner = createPaneAwareRunner([paneWithInputBoxContent('❯ ')]);
      const sleeper = createMockSleeper();
      const repository = new TmuxSilentSessionNotificationRepository(
        runner,
        sleeper,
        3,
        2500,
      );

      await repository.sendSelfCheckNotification(sessionName, 'self check');

      expect(sleeper.sleep).toHaveBeenCalledWith(2500);
    });
  });
});
