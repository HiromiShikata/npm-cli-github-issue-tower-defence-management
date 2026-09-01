import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { LocalCommandRunner } from '../../../domain/usecases/adapter-interfaces/LocalCommandRunner';
import { ProcessEnvironReader } from '../../../domain/usecases/adapter-interfaces/ProcessEnvironReader';
import { SilentSessionMessageTemplates } from '../../repositories/ConfigurableSilentSessionMessageComposer';
import {
  notifySilentTmuxSessions,
  DEFAULT_NOTIFY_SILENT_TMUX_SESSIONS_PARAMS,
} from './notifySilentTmuxSessions';

const NOW = new Date('2026-06-26T00:00:00.000Z');
const NOW_EPOCH_SECONDS = Math.floor(NOW.getTime() / 1000);
const SESSION_NAME = 'https_//github_com/HiromiShikata/repo/issues/9';
const SESSION_ID = 'wb-uuid';
const PANE_PID = 200;
const CLAUDE_PID = 201;

const EMPTY_TEMPLATES: SilentSessionMessageTemplates = {
  subAgentIdleMessageHeader: null,
  subAgentIdleMessageFooter: null,
  subAgentLongRunningMessageHeader: null,
  subAgentLongRunningMessageFooter: null,
};

type Mocked<T> = jest.Mocked<T> & jest.MockedObject<T>;

const createMockRunner = (): Mocked<LocalCommandRunner> => ({
  runCommand: jest.fn().mockResolvedValue({
    stdout: '',
    stderr: '',
    exitCode: 0,
  }),
  spawnInteractive: jest.fn(),
});

describe('notifySilentTmuxSessions', () => {
  let configDir: string;
  let candidateStateFilePath: string;
  let hubTaskStatusCacheStateFilePath: string;

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'silent-config-'));
    candidateStateFilePath = path.join(
      configDir,
      'silent-session-candidates.json',
    );
    hubTaskStatusCacheStateFilePath = path.join(
      configDir,
      'silent-session-hub-task-status.json',
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
    fs.rmSync(configDir, { force: true, recursive: true });
  });

  const seedPreviousCandidates = (sessionNames: string[]): void => {
    fs.writeFileSync(
      candidateStateFilePath,
      JSON.stringify({
        candidates: sessionNames.map((sessionName) => ({
          sessionName,
          recordedEpochSeconds: NOW_EPOCH_SECONDS,
        })),
      }),
    );
  };

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
    subAgentOutputRootDirectory: null,
    subAgentProcessMatchPattern: null,
    subAgentTranscriptRootDirectory: null,
    subAgentRuntimeRootDirectory: null,
    candidateDebounceStateFilePath: candidateStateFilePath,
    activeHubTaskStatus: null,
    hubTaskStatusResolver: null,
    hubTaskStatusCacheStateFilePath: hubTaskStatusCacheStateFilePath,
    messageTemplates: EMPTY_TEMPLATES,
    now: NOW,
    ...DEFAULT_NOTIFY_SILENT_TMUX_SESSIONS_PARAMS,
    submitPushOutWaitMilliseconds: 0,
  });

  it('does not notify a silent github-named live session on its first candidate cycle', async () => {
    silentAssistantTranscript();
    const runner = liveSessionRunner();

    await notifySilentTmuxSessions(baseParams(runner));

    const sendCall = runner.runCommand.mock.calls.find(
      (call) => call[0] === 'tmux' && call[1][0] === 'send-keys',
    );
    expect(sendCall).toBeUndefined();
  });

  it('sends no notification to a non-agent live session that has no resolvable transcript, even when it was already a candidate', async () => {
    seedPreviousCandidates(['sso_login']);
    const runner = createMockRunner();
    runner.runCommand.mockImplementation(async (program, args) => {
      if (program === 'tmux' && args[0] === 'list-sessions') {
        return { stdout: 'sso_login\n', stderr: '', exitCode: 0 };
      }
      if (program === 'tmux' && args[0] === 'list-panes') {
        return { stdout: `${PANE_PID}\n`, stderr: '', exitCode: 0 };
      }
      if (program === 'ps') {
        return {
          stdout: `  ${PANE_PID}       1 shell\n  ${CLAUDE_PID}     ${PANE_PID} claude --name sso_login\n`,
          stderr: '',
          exitCode: 0,
        };
      }
      return { stdout: '', stderr: '', exitCode: 0 };
    });

    await notifySilentTmuxSessions(baseParams(runner));

    const sendCall = runner.runCommand.mock.calls.find(
      (call) => call[0] === 'tmux' && call[1][0] === 'send-keys',
    );
    expect(sendCall).toBeUndefined();
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
});
