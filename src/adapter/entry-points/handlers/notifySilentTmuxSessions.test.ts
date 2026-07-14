import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { LocalCommandRunner } from '../../../domain/usecases/adapter-interfaces/LocalCommandRunner';
import { ProcessEnvironReader } from '../../../domain/usecases/adapter-interfaces/ProcessEnvironReader';
import { SilentSessionMessageTemplates } from '../../repositories/ConfigurableSilentSessionMessageComposer';
import { Issue } from '../../../domain/entities/Issue';
import { SILENT_SESSION_REMINDER_SENTINEL } from '../../../domain/usecases/silentSessionReminderSentinel';
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
  mainStalledMessage: null,
  mainStalledStaleOwnerCallMessage: null,
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
    ownerCallMarker: null,
    subAgentOutputRootDirectory: null,
    subAgentProcessMatchPattern: null,
    subAgentTranscriptRootDirectory: null,
    candidateDebounceStateFilePath: candidateStateFilePath,
    activeHubTaskStatus: null,
    hubTaskStatusResolver: null,
    hubTaskStatusCacheStateFilePath: hubTaskStatusCacheStateFilePath,
    messageTemplates: EMPTY_TEMPLATES,
    now: NOW,
    ...DEFAULT_NOTIFY_SILENT_TMUX_SESSIONS_PARAMS,
  });

  it('sends a main stalled notification to a silent github-named live session that was already a candidate in the previous cycle', async () => {
    silentAssistantTranscript();
    seedPreviousCandidates([SESSION_NAME]);
    const runner = liveSessionRunner();

    await notifySilentTmuxSessions(baseParams(runner));

    const sendCall = runner.runCommand.mock.calls.find(
      (call) => call[0] === 'tmux' && call[1][0] === 'send-keys',
    );
    expect(sendCall?.[1][2]).toBe(SESSION_NAME);
    expect(sendCall?.[1][4]).toContain('No output has been observed for');
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

  it('sends no notification to a silent non-github-named live session', async () => {
    silentAssistantTranscript();
    const runner = createMockRunner();
    runner.runCommand.mockImplementation(async (program, args) => {
      if (program === 'tmux' && args[0] === 'list-sessions') {
        return { stdout: 'orchestrator\n', stderr: '', exitCode: 0 };
      }
      if (program === 'tmux' && args[0] === 'list-panes') {
        return { stdout: `${PANE_PID}\n`, stderr: '', exitCode: 0 };
      }
      if (program === 'ps') {
        return {
          stdout: `  ${PANE_PID}       1 shell\n  ${CLAUDE_PID}     ${PANE_PID} claude --name orchestrator\n`,
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

  it('uses the configured main stalled message template when provided', async () => {
    silentAssistantTranscript();
    seedPreviousCandidates([SESSION_NAME]);
    const runner = liveSessionRunner();

    await notifySilentTmuxSessions({
      ...baseParams(runner),
      messageTemplates: {
        ...EMPTY_TEMPLATES,
        mainStalledMessage: 'CUSTOM_MAIN_TEMPLATE',
      },
    });

    const sendCall = runner.runCommand.mock.calls.find(
      (call) => call[0] === 'tmux' && call[1][0] === 'send-keys',
    );
    expect(sendCall?.[1][4]).toContain(
      `${SILENT_SESSION_REMINDER_SENTINEL} CUSTOM_MAIN_TEMPLATE`,
    );
    expect(sendCall?.[1][4]).toContain(
      'complete opening and closing pair on one line',
    );
  });

  it('suppresses the notification while the latest owner call is unanswered', async () => {
    const recentPendingOwnerCall = new Date(
      (NOW_EPOCH_SECONDS - 11 * 60) * 1000,
    ).toISOString();
    writeTranscript([
      {
        type: 'user',
        timestamp: '2026-06-25T23:00:00.000Z',
        message: { role: 'user', content: 'go ahead' },
      },
      {
        type: 'assistant',
        timestamp: recentPendingOwnerCall,
        message: {
          role: 'assistant',
          stop_reason: 'end_turn',
          content: [
            { type: 'text', text: 'waiting <<OWNER_CALL>> please decide' },
          ],
        },
      },
    ]);
    seedPreviousCandidates([SESSION_NAME]);
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

  it('suppresses the notification even when the unanswered owner call is older than the former grace period', async () => {
    const stalePendingOwnerCall = new Date(
      (NOW_EPOCH_SECONDS - 2 * 60 * 60) * 1000,
    ).toISOString();
    writeTranscript([
      {
        type: 'user',
        timestamp: '2026-06-25T20:00:00.000Z',
        message: { role: 'user', content: 'go ahead' },
      },
      {
        type: 'assistant',
        timestamp: stalePendingOwnerCall,
        message: {
          role: 'assistant',
          stop_reason: 'end_turn',
          content: [
            { type: 'text', text: 'waiting <<OWNER_CALL>> please decide' },
          ],
        },
      },
    ]);
    seedPreviousCandidates([SESSION_NAME]);
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

  it('defers the first cycle then notifies on the next cycle once the persisted candidate state confirms a second consecutive cycle', async () => {
    silentAssistantTranscript();
    const firstRunner = liveSessionRunner();

    await notifySilentTmuxSessions(baseParams(firstRunner));

    const firstSendCall = firstRunner.runCommand.mock.calls.find(
      (call) => call[0] === 'tmux' && call[1][0] === 'send-keys',
    );
    expect(firstSendCall).toBeUndefined();

    const secondRunner = liveSessionRunner();
    await notifySilentTmuxSessions({
      ...baseParams(secondRunner),
      now: new Date(NOW.getTime() + 60 * 1000),
    });

    const secondSendCall = secondRunner.runCommand.mock.calls.find(
      (call) => call[0] === 'tmux' && call[1][0] === 'send-keys',
    );
    expect(secondSendCall?.[1][2]).toBe(SESSION_NAME);
  });

  const HUB_TASK_SESSION_NAME =
    'https://github.com/HiromiShikata/repo/issues/42';

  const writeUrlSessionTranscript = (): void => {
    const projectDirectory = path.join(configDir, 'projects', '-home-user');
    fs.mkdirSync(projectDirectory, { recursive: true });
    const silentTimestamp = new Date(
      (NOW_EPOCH_SECONDS - 11 * 60) * 1000,
    ).toISOString();
    fs.writeFileSync(
      path.join(projectDirectory, `${SESSION_ID}.jsonl`),
      JSON.stringify({
        type: 'assistant',
        timestamp: silentTimestamp,
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: 'progress update' }],
        },
      }),
      'utf8',
    );
  };

  const urlSessionRunner = (): Mocked<LocalCommandRunner> => {
    const runner = createMockRunner();
    runner.runCommand.mockImplementation(async (program, args) => {
      if (program === 'tmux' && args[0] === 'list-sessions') {
        return {
          stdout: `${HUB_TASK_SESSION_NAME}\n`,
          stderr: '',
          exitCode: 0,
        };
      }
      if (program === 'tmux' && args[0] === 'list-panes') {
        return { stdout: `${PANE_PID}\n`, stderr: '', exitCode: 0 };
      }
      if (program === 'ps') {
        return {
          stdout: `  ${PANE_PID}       1 shell\n  ${CLAUDE_PID}     ${PANE_PID} claude --name ${HUB_TASK_SESSION_NAME}\n`,
          stderr: '',
          exitCode: 0,
        };
      }
      return { stdout: '', stderr: '', exitCode: 0 };
    });
    return runner;
  };

  const makeIssue = (overrides: {
    state: Issue['state'];
    status: string | null;
  }): Issue => ({
    nameWithOwner: 'HiromiShikata/repo',
    number: 42,
    title: 'Hub task',
    state: overrides.state,
    status: overrides.status,
    story: null,
    nextActionDate: null,
    nextActionHour: null,
    estimationMinutes: null,
    dependedIssueUrls: [],
    completionDate50PercentConfidence: null,
    url: HUB_TASK_SESSION_NAME,
    assignees: [],
    labels: [],
    org: 'HiromiShikata',
    repo: 'repo',
    body: '',
    itemId: 'item-id',
    isPr: false,
    isInProgress: false,
    isClosed: overrides.state !== 'OPEN',
    createdAt: NOW,
    author: 'HiromiShikata',
    closingIssueReferenceUrls: [],
  });

  it('skips a URL-named session whose hub task is no longer in the active status', async () => {
    writeUrlSessionTranscript();
    seedPreviousCandidates([HUB_TASK_SESSION_NAME]);
    const runner = urlSessionRunner();
    const getIssueByUrl = jest
      .fn()
      .mockResolvedValue(makeIssue({ state: 'OPEN', status: 'Todo' }));

    await notifySilentTmuxSessions({
      ...baseParams(runner),
      activeHubTaskStatus: 'In tmux',
      hubTaskStatusResolver: { getIssueByUrl },
    });

    expect(getIssueByUrl).toHaveBeenCalledWith(HUB_TASK_SESSION_NAME);
    const sendCall = runner.runCommand.mock.calls.find(
      (call) => call[0] === 'tmux' && call[1][0] === 'send-keys',
    );
    expect(sendCall).toBeUndefined();
  });

  it('sends to a URL-named session whose hub task is in the active status', async () => {
    writeUrlSessionTranscript();
    seedPreviousCandidates([HUB_TASK_SESSION_NAME]);
    const runner = urlSessionRunner();
    const getIssueByUrl = jest
      .fn()
      .mockResolvedValue(makeIssue({ state: 'OPEN', status: 'In tmux' }));

    await notifySilentTmuxSessions({
      ...baseParams(runner),
      activeHubTaskStatus: 'In tmux',
      hubTaskStatusResolver: { getIssueByUrl },
    });

    const sendCall = runner.runCommand.mock.calls.find(
      (call) => call[0] === 'tmux' && call[1][0] === 'send-keys',
    );
    expect(sendCall?.[1][2]).toBe(HUB_TASK_SESSION_NAME);
  });
});
