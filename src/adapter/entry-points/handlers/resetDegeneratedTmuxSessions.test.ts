import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  resetDegeneratedTmuxSessions,
  DEFAULT_RESET_DEGENERATED_TMUX_SESSIONS_PARAMS,
} from './resetDegeneratedTmuxSessions';
import { LocalCommandRunner } from '../../../domain/usecases/adapter-interfaces/LocalCommandRunner';

describe('resetDegeneratedTmuxSessions', () => {
  let temporaryDirectory: string;
  let cooldownStateFilePath: string;
  let loggedMessages: string[];
  let consoleLogSpy: jest.SpiedFunction<typeof console.log>;

  beforeEach(() => {
    temporaryDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'reset-degenerated-'),
    );
    cooldownStateFilePath = path.join(temporaryDirectory, 'cooldown.json');
    loggedMessages = [];
    consoleLogSpy = jest
      .spyOn(console, 'log')
      .mockImplementation((...args: unknown[]): void => {
        loggedMessages.push(args.map((arg) => String(arg)).join(' '));
      });
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  });

  it('wires the real adapters and runs end to end without acting when no sessions exist', async () => {
    const runCommand: jest.MockedFunction<LocalCommandRunner['runCommand']> =
      jest.fn().mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });
    const commandRunner: LocalCommandRunner = {
      runCommand,
      spawnInteractive: jest.fn(),
    };

    await resetDegeneratedTmuxSessions({
      enabled: false,
      localCommandRunner: commandRunner,
      warningMessage:
        DEFAULT_RESET_DEGENERATED_TMUX_SESSIONS_PARAMS.warningMessage,
      graceSeconds: DEFAULT_RESET_DEGENERATED_TMUX_SESSIONS_PARAMS.graceSeconds,
      cooldownSeconds:
        DEFAULT_RESET_DEGENERATED_TMUX_SESSIONS_PARAMS.cooldownSeconds,
      cooldownStateFilePath,
      now: new Date('2026-07-26T00:00:00Z'),
    });

    const summaryLogged = loggedMessages.some((message) =>
      message.includes(
        'Output degeneration recovery: detected 0 degenerated session(s) of 0 interactive session(s)',
      ),
    );
    expect(summaryLogged).toBe(true);
    const killInvoked = runCommand.mock.calls.some((callArguments) =>
      callArguments[1].includes('kill-session'),
    );
    expect(killInvoked).toBe(false);
  });

  it('exposes safe defaults with a five second grace and 300 second cooldown', () => {
    expect(DEFAULT_RESET_DEGENERATED_TMUX_SESSIONS_PARAMS.graceSeconds).toBe(5);
    expect(DEFAULT_RESET_DEGENERATED_TMUX_SESSIONS_PARAMS.cooldownSeconds).toBe(
      300,
    );
  });
});
