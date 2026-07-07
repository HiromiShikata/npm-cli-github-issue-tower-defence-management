import { Issue } from '../../../domain/entities/Issue';
import { Project } from '../../../domain/entities/Project';
import { LocalCommandRunner } from '../../../domain/usecases/adapter-interfaces/LocalCommandRunner';
import { IssueRepository } from '../../../domain/usecases/adapter-interfaces/IssueRepository';
import { IN_TMUX_STATUS_NAME } from '../../../domain/entities/WorkflowStatus';
import { cleanStaleTmuxSessions } from './staleTmuxSessionCleaner';

const NOW = new Date('2026-06-26T00:00:00.000Z');
const NOW_EPOCH_SECONDS = Math.floor(NOW.getTime() / 1000);
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
  runCommand: jest.fn(),
});

const createMockIssueRepository = (
  issues: Issue[],
): Pick<IssueRepository, 'getAllOpened'> => ({
  getAllOpened: jest.fn().mockResolvedValue(issues),
});

describe('cleanStaleTmuxSessions', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('kills a session mapping to an open issue whose status is not the excluded status', async () => {
    const runner = createMockRunner();
    runner.runCommand.mockImplementation(async (program, args) => {
      if (program === 'tmux' && args[0] === 'list-sessions') {
        return {
          stdout: `https_//github_com/demo/repo/issues/1 ${NOW_EPOCH_SECONDS}\n`,
          stderr: '',
          exitCode: 0,
        };
      }
      return { stdout: '', stderr: '', exitCode: 0 };
    });

    await cleanStaleTmuxSessions({
      project: makeProject(),
      issueRepository: createMockIssueRepository([
        makeIssue({ status: 'In Progress' }),
      ]),
      localCommandRunner: runner,
      now: NOW,
    });

    const killCall = runner.runCommand.mock.calls.find(
      (call) => call[0] === 'tmux' && call[1][0] === 'kill-session',
    );
    expect(killCall?.[1]).toEqual([
      'kill-session',
      '-t',
      'https_//github_com/demo/repo/issues/1',
    ]);
  });

  it('does not kill an excluded-status session that has no reactivation trigger', async () => {
    const runner = createMockRunner();
    runner.runCommand.mockImplementation(async (program, args) => {
      if (program === 'tmux' && args[0] === 'list-sessions') {
        return {
          stdout: `https_//github_com/demo/repo/issues/1 ${NOW_EPOCH_SECONDS}\n`,
          stderr: '',
          exitCode: 0,
        };
      }
      return { stdout: '', stderr: '', exitCode: 0 };
    });

    await cleanStaleTmuxSessions({
      project: makeProject(),
      issueRepository: createMockIssueRepository([
        makeIssue({ status: IN_TMUX_STATUS_NAME }),
      ]),
      localCommandRunner: runner,
      now: NOW,
    });

    const killCalls = runner.runCommand.mock.calls.filter(
      (call) => call[0] === 'tmux' && call[1][0] === 'kill-session',
    );
    expect(killCalls).toHaveLength(0);
  });

  it('kills a no-task session idle at least 24 hours and spares a recently active one', async () => {
    const runner = createMockRunner();
    const idleActivity = NOW_EPOCH_SECONDS - 24 * 60 * 60;
    const recentActivity = NOW_EPOCH_SECONDS - 24 * 60 * 60 + 1;
    runner.runCommand.mockImplementation(async (program, args) => {
      if (program === 'tmux' && args[0] === 'list-sessions') {
        return {
          stdout: `idle_no_task ${idleActivity}\nrecent_no_task ${recentActivity}\n`,
          stderr: '',
          exitCode: 0,
        };
      }
      return { stdout: '', stderr: '', exitCode: 0 };
    });

    await cleanStaleTmuxSessions({
      project: makeProject(),
      issueRepository: createMockIssueRepository([]),
      localCommandRunner: runner,
      now: NOW,
    });

    const killCalls = runner.runCommand.mock.calls.filter(
      (call) => call[0] === 'tmux' && call[1][0] === 'kill-session',
    );
    expect(killCalls).toHaveLength(1);
    expect(killCalls[0][1]).toEqual(['kill-session', '-t', 'idle_no_task']);
  });
});
