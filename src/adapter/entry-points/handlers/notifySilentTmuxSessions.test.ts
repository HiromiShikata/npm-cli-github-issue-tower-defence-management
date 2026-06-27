import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Issue } from '../../../domain/entities/Issue';
import { Project } from '../../../domain/entities/Project';
import { LocalCommandRunner } from '../../../domain/usecases/adapter-interfaces/LocalCommandRunner';
import { IssueRepository } from '../../../domain/usecases/adapter-interfaces/IssueRepository';
import { IN_TMUX_STATUS_NAME } from '../../../domain/entities/WorkflowStatus';
import { LocalStorageCacheRepository } from '../../repositories/LocalStorageCacheRepository';
import { LocalStorageRepository } from '../../repositories/LocalStorageRepository';
import { SilentSessionMessageTemplates } from '../../repositories/ConfigurableSilentSessionMessageComposer';
import {
  notifySilentTmuxSessions,
  DEFAULT_NOTIFY_SILENT_TMUX_SESSIONS_PARAMS,
} from './notifySilentTmuxSessions';

const NOW = new Date('2026-06-26T00:00:00.000Z');
const NOW_EPOCH_SECONDS = Math.floor(NOW.getTime() / 1000);
const ALLOW_CACHE_MINUTES = 10;
const SESSION_NAME = 'https_//github_com/demo/repo/issues/1';

const EMPTY_TEMPLATES: SilentSessionMessageTemplates = {
  mainStalledMessage: null,
  subAgentMessageHeader: null,
  subAgentMessageFooter: null,
};

const makeProject = (): Project => ({
  id: 'project-1',
  url: 'https://github.com/users/user/projects/1',
  databaseId: 1,
  name: 'Test Project',
  status: {
    name: 'Status',
    fieldId: 'field-1',
    statuses: [],
  },
  nextActionDate: null,
  nextActionHour: null,
  story: null,
  remainingEstimationMinutes: null,
  dependedIssueUrlSeparatedByComma: null,
  completionDate50PercentConfidence: null,
});

const makeIssue = (overrides: Partial<Issue> = {}): Issue => ({
  nameWithOwner: 'demo/repo',
  number: 1,
  title: 'Issue 1',
  state: 'OPEN',
  status: IN_TMUX_STATUS_NAME,
  story: null,
  nextActionDate: null,
  nextActionHour: null,
  estimationMinutes: null,
  dependedIssueUrls: [],
  completionDate50PercentConfidence: null,
  url: 'https://github.com/demo/repo/issues/1',
  assignees: [],
  labels: [],
  org: 'demo',
  repo: 'repo',
  body: '',
  itemId: 'item-1',
  isPr: false,
  isInProgress: false,
  isClosed: false,
  createdAt: new Date(),
  author: '',
  closingIssueReferenceUrls: [],
  ...overrides,
});

type Mocked<T> = jest.Mocked<T> & jest.MockedObject<T>;

const createMockRunner = (): Mocked<LocalCommandRunner> => ({
  runCommand: jest.fn().mockResolvedValue({
    stdout: '',
    stderr: '',
    exitCode: 0,
  }),
});

const createMockIssueRepository = (
  issues: Issue[],
): Pick<IssueRepository, 'getAllOpened'> => ({
  getAllOpened: jest.fn().mockResolvedValue(issues),
});

describe('notifySilentTmuxSessions', () => {
  let outputDirectory: string;
  let cacheDirectory: string;

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    outputDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'silent-output-'));
    cacheDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'silent-cache-'));
  });

  afterEach(() => {
    jest.restoreAllMocks();
    fs.rmSync(outputDirectory, { force: true, recursive: true });
    fs.rmSync(cacheDirectory, { force: true, recursive: true });
  });

  const writeSilentOutputFile = (sessionName: string): void => {
    const fileName = sessionName.replace(/\//g, '_');
    const filePath = path.join(outputDirectory, fileName);
    fs.writeFileSync(filePath, 'output', 'utf8');
    const silentEpoch = NOW_EPOCH_SECONDS - 11 * 60;
    fs.utimesSync(filePath, silentEpoch, silentEpoch);
  };

  const makeCacheRepository = (): LocalStorageCacheRepository =>
    new LocalStorageCacheRepository(
      new LocalStorageRepository(),
      cacheDirectory,
    );

  const baseParams = (
    runner: LocalCommandRunner,
  ): Parameters<typeof notifySilentTmuxSessions>[0] => ({
    project: makeProject(),
    allowCacheMinutes: ALLOW_CACHE_MINUTES,
    issueRepository: createMockIssueRepository([makeIssue()]),
    localCommandRunner: runner,
    cacheRepository: makeCacheRepository(),
    sessionOutputRootDirectory: outputDirectory,
    sessionTranscriptRootDirectory: null,
    ownerCallMarker: null,
    subAgentOutputRootDirectory: null,
    subAgentProcessMatchPattern: null,
    subAgentTranscriptRootDirectory: null,
    messageTemplates: EMPTY_TEMPLATES,
    now: NOW,
    ...DEFAULT_NOTIFY_SILENT_TMUX_SESSIONS_PARAMS,
  });

  const listSessionsRunner = (): Mocked<LocalCommandRunner> => {
    const runner = createMockRunner();
    runner.runCommand.mockImplementation(async (program, args) => {
      if (program === 'tmux' && args[0] === 'list-sessions') {
        return { stdout: `${SESSION_NAME}\n`, stderr: '', exitCode: 0 };
      }
      return { stdout: '', stderr: '', exitCode: 0 };
    });
    return runner;
  };

  it('sends a main stalled notification to a silent monitored live session', async () => {
    writeSilentOutputFile(SESSION_NAME);
    const runner = listSessionsRunner();

    await notifySilentTmuxSessions(baseParams(runner));

    const sendCall = runner.runCommand.mock.calls.find(
      (call) => call[0] === 'tmux' && call[1][0] === 'send-keys',
    );
    expect(sendCall?.[1][2]).toBe(SESSION_NAME);
    expect(sendCall?.[1][4]).toContain('You have produced no output for');
  });

  it('does nothing when neither output root nor sub-agent pattern is configured', async () => {
    writeSilentOutputFile(SESSION_NAME);
    const runner = createMockRunner();

    await notifySilentTmuxSessions({
      ...baseParams(runner),
      sessionOutputRootDirectory: null,
      subAgentProcessMatchPattern: null,
    });

    expect(runner.runCommand.mock.calls).toHaveLength(0);
  });

  it('sends a sub-agent notification driven by the process match pattern even when the main session is not silent', async () => {
    const runner = createMockRunner();
    runner.runCommand.mockImplementation(async (program, args) => {
      if (program === 'tmux' && args[0] === 'list-sessions') {
        return { stdout: `${SESSION_NAME}\n`, stderr: '', exitCode: 0 };
      }
      if (program === 'ps') {
        return {
          stdout: `  1200 worker session=${SESSION_NAME} label=task-a\n`,
          stderr: '',
          exitCode: 0,
        };
      }
      return { stdout: '', stderr: '', exitCode: 0 };
    });

    await notifySilentTmuxSessions({
      ...baseParams(runner),
      sessionOutputRootDirectory: null,
      subAgentProcessMatchPattern:
        'session=(?<session>[^ ]+) label=(?<label>[^ ]+)',
    });

    const sendCall = runner.runCommand.mock.calls.find(
      (call) => call[0] === 'tmux' && call[1][0] === 'send-keys',
    );
    expect(sendCall?.[1][2]).toBe(SESSION_NAME);
    expect(sendCall?.[1][4]).toContain('task-a');
  });

  it('uses the configured main stalled message template when provided', async () => {
    writeSilentOutputFile(SESSION_NAME);
    const runner = listSessionsRunner();

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
    expect(sendCall?.[1][4]).toBe('CUSTOM_MAIN_TEMPLATE');
  });

  it('suppresses the main stalled notification when the transcript shows an unanswered owner call', async () => {
    writeSilentOutputFile(SESSION_NAME);
    const transcriptDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'silent-transcript-'),
    );
    const transcriptPath = path.join(
      transcriptDirectory,
      `${SESSION_NAME.replace(/\//g, '_')}.jsonl`,
    );
    fs.writeFileSync(
      transcriptPath,
      [
        JSON.stringify({
          type: 'user',
          timestamp: '2026-06-25T23:00:00.000Z',
          message: { role: 'user', content: 'go ahead' },
        }),
        JSON.stringify({
          type: 'assistant',
          timestamp: '2026-06-25T23:50:00.000Z',
          message: {
            role: 'assistant',
            stop_reason: 'end_turn',
            content: [
              { type: 'text', text: 'waiting <<OWNER_CALL>> please decide' },
            ],
          },
        }),
      ].join('\n'),
      'utf8',
    );
    const runner = listSessionsRunner();

    await notifySilentTmuxSessions({
      ...baseParams(runner),
      sessionTranscriptRootDirectory: transcriptDirectory,
      ownerCallMarker: '<<OWNER_CALL>>',
    });

    const sendCall = runner.runCommand.mock.calls.find(
      (call) => call[0] === 'tmux' && call[1][0] === 'send-keys',
    );
    expect(sendCall).toBeUndefined();
    fs.rmSync(transcriptDirectory, { force: true, recursive: true });
  });

  it('sends a sub-agent notification driven by a running transcript even when the main session is not silent', async () => {
    const transcriptRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'silent-subagent-tx-'),
    );
    const subAgentsDir = path.join(
      transcriptRoot,
      SESSION_NAME.replace(/\//g, '_'),
      'subagents',
    );
    fs.mkdirSync(subAgentsDir, { recursive: true });
    const agentPath = path.join(subAgentsDir, 'agent-running1.jsonl');
    fs.writeFileSync(
      agentPath,
      [
        JSON.stringify({
          type: 'user',
          timestamp: '2026-06-25T23:30:00.000Z',
          message: { role: 'user' },
        }),
        JSON.stringify({
          type: 'assistant',
          timestamp: '2026-06-25T23:40:00.000Z',
          message: { role: 'assistant', stop_reason: 'tool_use' },
        }),
      ].join('\n'),
      'utf8',
    );
    const silentEpoch = NOW_EPOCH_SECONDS - 6 * 60;
    fs.utimesSync(agentPath, silentEpoch, silentEpoch);
    const runner = listSessionsRunner();

    await notifySilentTmuxSessions({
      ...baseParams(runner),
      sessionOutputRootDirectory: null,
      subAgentTranscriptRootDirectory: transcriptRoot,
    });

    const sendCall = runner.runCommand.mock.calls.find(
      (call) => call[0] === 'tmux' && call[1][0] === 'send-keys',
    );
    expect(sendCall?.[1][2]).toBe(SESSION_NAME);
    expect(sendCall?.[1][4]).toContain('agent-running1');
    fs.rmSync(transcriptRoot, { force: true, recursive: true });
  });

  it('does not re-notify the same silent session on the next cycle within cooldown', async () => {
    writeSilentOutputFile(SESSION_NAME);
    const cacheRepository = makeCacheRepository();
    const firstRunner = listSessionsRunner();

    await notifySilentTmuxSessions({
      ...baseParams(firstRunner),
      cacheRepository,
    });

    const secondRunner = listSessionsRunner();
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
