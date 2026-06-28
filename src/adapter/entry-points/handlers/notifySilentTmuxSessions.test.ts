import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { LocalCommandRunner } from '../../../domain/usecases/adapter-interfaces/LocalCommandRunner';
import { ProcessEnvironReader } from '../../../domain/usecases/adapter-interfaces/ProcessEnvironReader';
import { LocalStorageCacheRepository } from '../../repositories/LocalStorageCacheRepository';
import { LocalStorageRepository } from '../../repositories/LocalStorageRepository';
import { SilentSessionMessageTemplates } from '../../repositories/ConfigurableSilentSessionMessageComposer';
import { SILENT_SESSION_REMINDER_SENTINEL } from '../../../domain/usecases/silentSessionReminderSentinel';
import {
  notifySilentTmuxSessions,
  DEFAULT_NOTIFY_SILENT_TMUX_SESSIONS_PARAMS,
} from './notifySilentTmuxSessions';

const NOW = new Date('2026-06-26T00:00:00.000Z');
const NOW_EPOCH_SECONDS = Math.floor(NOW.getTime() / 1000);
const SESSION_NAME = 'workbench';
const SESSION_ID = 'wb-uuid';
const PANE_PID = 200;
const CLAUDE_PID = 201;

const EMPTY_TEMPLATES: SilentSessionMessageTemplates = {
  mainStalledMessage: null,
  subAgentMessageHeader: null,
  subAgentMessageFooter: null,
};

type Mocked<T> = jest.Mocked<T> & jest.MockedObject<T>;

const createMockRunner = (): Mocked<LocalCommandRunner> => ({
  runCommand: jest.fn().mockResolvedValue({
    stdout: '',
    stderr: '',
    exitCode: 0,
  }),
});

describe('notifySilentTmuxSessions', () => {
  let configDir: string;
  let cacheDirectory: string;

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'silent-config-'));
    cacheDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'silent-cache-'));
  });

  afterEach(() => {
    jest.restoreAllMocks();
    fs.rmSync(configDir, { force: true, recursive: true });
    fs.rmSync(cacheDirectory, { force: true, recursive: true });
  });

  const writeTranscript = (lines: object[]): void => {
    const projectDirectory = path.join(configDir, 'projects', '-home-user');
    fs.mkdirSync(projectDirectory, { recursive: true });
    fs.writeFileSync(
      path.join(projectDirectory, `${SESSION_ID}.jsonl`),
      lines.map((line) => JSON.stringify(line)).join('\n'),
      'utf8',
    );
  };

  const silentAssistantTranscript = (): void => {
    const silentTimestamp = new Date(
      (NOW_EPOCH_SECONDS - 11 * 60) * 1000,
    ).toISOString();
    writeTranscript([
      {
        type: 'assistant',
        timestamp: silentTimestamp,
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: 'progress update' }],
        },
      },
    ]);
  };

  const makeCacheRepository = (): LocalStorageCacheRepository =>
    new LocalStorageCacheRepository(
      new LocalStorageRepository(),
      cacheDirectory,
    );

  const makeEnvironReader = (): ProcessEnvironReader => ({
    readEnviron: (pid: number) =>
      pid === CLAUDE_PID
        ? {
            CLAUDE_CODE_SESSION_ID: SESSION_ID,
            CLAUDE_CONFIG_DIR: configDir,
          }
        : null,
  });

  const liveSessionRunner = (): Mocked<LocalCommandRunner> => {
    const runner = createMockRunner();
    runner.runCommand.mockImplementation(async (program, args) => {
      if (program === 'tmux' && args[0] === 'list-sessions') {
        return { stdout: `${SESSION_NAME}\n`, stderr: '', exitCode: 0 };
      }
      if (program === 'tmux' && args[0] === 'list-panes') {
        return { stdout: `${PANE_PID}\n`, stderr: '', exitCode: 0 };
      }
      if (program === 'ps') {
        return {
          stdout: `  ${PANE_PID}       1 shell\n  ${CLAUDE_PID}     ${PANE_PID} claude --name ${SESSION_NAME}\n`,
          stderr: '',
          exitCode: 0,
        };
      }
      return { stdout: '', stderr: '', exitCode: 0 };
    });
    return runner;
  };

  const baseParams = (
    runner: LocalCommandRunner,
  ): Parameters<typeof notifySilentTmuxSessions>[0] => ({
    enabled: true,
    localCommandRunner: runner,
    processEnvironReader: makeEnvironReader(),
    cacheRepository: makeCacheRepository(),
    ownerCallMarker: null,
    subAgentOutputRootDirectory: null,
    subAgentProcessMatchPattern: null,
    subAgentTranscriptRootDirectory: null,
    messageTemplates: EMPTY_TEMPLATES,
    now: NOW,
    ...DEFAULT_NOTIFY_SILENT_TMUX_SESSIONS_PARAMS,
  });

  it('sends a main stalled notification to a silent plain-named live session', async () => {
    silentAssistantTranscript();
    const runner = liveSessionRunner();

    await notifySilentTmuxSessions(baseParams(runner));

    const sendCall = runner.runCommand.mock.calls.find(
      (call) => call[0] === 'tmux' && call[1][0] === 'send-keys',
    );
    expect(sendCall?.[1][2]).toBe(SESSION_NAME);
    expect(sendCall?.[1][4]).toContain('You have produced no output for');
  });

  it('does nothing when the step is not enabled', async () => {
    silentAssistantTranscript();
    const runner = liveSessionRunner();

    await notifySilentTmuxSessions({
      ...baseParams(runner),
      enabled: false,
    });

    expect(runner.runCommand.mock.calls).toHaveLength(0);
  });

  it('uses the configured main stalled message template when provided', async () => {
    silentAssistantTranscript();
    const runner = liveSessionRunner();

    await notifySilentTmuxSessions({
      ...baseParams(runner),
      messageTemplates: {
        mainStalledMessage: 'CUSTOM_MAIN_TEMPLATE',
        subAgentMessageHeader: null,
        subAgentMessageFooter: null,
      },
    });

    const sendCall = runner.runCommand.mock.calls.find(
      (call) => call[0] === 'tmux' && call[1][0] === 'send-keys',
    );
    expect(sendCall?.[1][4]).toBe(
      `${SILENT_SESSION_REMINDER_SENTINEL} CUSTOM_MAIN_TEMPLATE`,
    );
  });

  it('suppresses the main stalled notification when the transcript shows an unanswered owner call', async () => {
    writeTranscript([
      {
        type: 'user',
        timestamp: '2026-06-25T23:00:00.000Z',
        message: { role: 'user', content: 'go ahead' },
      },
      {
        type: 'assistant',
        timestamp: '2026-06-25T23:50:00.000Z',
        message: {
          role: 'assistant',
          stop_reason: 'end_turn',
          content: [
            { type: 'text', text: 'waiting <<OWNER_CALL>> please decide' },
          ],
        },
      },
    ]);
    const runner = liveSessionRunner();

    await notifySilentTmuxSessions({
      ...baseParams(runner),
      ownerCallMarker: '<<OWNER_CALL>>',
    });

    const sendCall = runner.runCommand.mock.calls.find(
      (call) => call[0] === 'tmux' && call[1][0] === 'send-keys',
    );
    expect(sendCall).toBeUndefined();
  });

  it('does not re-notify the same silent session on the next cycle within cooldown', async () => {
    silentAssistantTranscript();
    const cacheRepository = makeCacheRepository();
    const firstRunner = liveSessionRunner();

    await notifySilentTmuxSessions({
      ...baseParams(firstRunner),
      cacheRepository,
    });

    const secondRunner = liveSessionRunner();
    await notifySilentTmuxSessions({
      ...baseParams(secondRunner),
      cacheRepository,
      now: new Date(NOW.getTime() + 60 * 1000),
    });

    const secondSendCall = secondRunner.runCommand.mock.calls.find(
      (call) => call[0] === 'tmux' && call[1][0] === 'send-keys',
    );
    expect(secondSendCall).toBeUndefined();
  });
});
