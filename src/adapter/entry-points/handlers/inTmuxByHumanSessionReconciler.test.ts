import { Project } from '../../../domain/entities/Project';
import { Issue } from '../../../domain/entities/Issue';
import { IssueRepository } from '../../../domain/usecases/adapter-interfaces/IssueRepository';
import { LocalCommandRunner } from '../../../domain/usecases/adapter-interfaces/LocalCommandRunner';
import { reconcileInTmuxByHumanSessions } from './inTmuxByHumanSessionReconciler';

const ASSIGNEE = 'owner-login';
const NOW = new Date('2026-06-25T12:00:00.000Z');

const PROJECT: Project = {
  id: 'selected-project',
  url: 'https://github.com/users/demo/projects/9',
  databaseId: 9,
  name: 'Selected project',
  status: { name: 'Status', fieldId: 'selected-status', statuses: [] },
  nextActionDate: null,
  nextActionHour: null,
  story: null,
  remainingEstimationMinutes: null,
  dependedIssueUrlSeparatedByComma: null,
  completionDate50PercentConfidence: null,
  agent: null,
};

const makeIssue = (overrides: Partial<Issue> = {}): Issue => ({
  nameWithOwner: 'demo/repo',
  number: 1,
  title: 'Issue 1',
  state: 'OPEN',
  status: 'In Tmux by human',
  story: null,
  nextActionDate: null,
  nextActionHour: null,
  estimationMinutes: null,
  dependedIssueUrls: [],
  completionDate50PercentConfidence: null,
  url: 'https://github.com/demo/repo/issues/1',
  assignees: [ASSIGNEE],
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
  plainCrossRepoIssueReferenceUrls: [],
  agent: null,
  stateReason: null,
  ...overrides,
});

type Mocked<T> = jest.Mocked<T> & jest.MockedObject<T>;

const createMockRunner = (): Mocked<LocalCommandRunner> => ({
  runCommand: jest.fn(),
  spawnInteractive: jest.fn(),
});

const createIssueStateRepository = (
  state = 'open',
): Pick<
  IssueRepository,
  'getIssueOrPullRequestState' | 'getIssueByUrl' | 'get'
> => ({
  get: async () =>
    makeIssue({
      state: state === 'closed' ? 'CLOSED' : 'OPEN',
      isClosed: state === 'closed',
    }),
  getIssueByUrl: async () =>
    makeIssue({
      state: state === 'closed' ? 'CLOSED' : 'OPEN',
      isClosed: state === 'closed',
    }),
  getIssueOrPullRequestState: async () => ({
    state,
    merged: false,
    isPullRequest: false,
    title: 'In tmux by human session issue',
    stateReason: '',
  }),
});

const reconcileWithProject = (
  params: Omit<Parameters<typeof reconcileInTmuxByHumanSessions>[0], 'project'>,
) => {
  const input = { ...params, project: PROJECT };
  return reconcileInTmuxByHumanSessions(input);
};

describe('reconcileInTmuxByHumanSessions', () => {
  it('does nothing when no launcher command is configured', async () => {
    const runner = createMockRunner();

    await reconcileWithProject({
      inTmuxLauncherCommand: null,
      assigneeLogin: ASSIGNEE,
      issues: [makeIssue()],
      localCommandRunner: runner,
      issueStateRepository: createIssueStateRepository(),
      now: NOW,
    });

    expect(runner.runCommand.mock.calls).toHaveLength(0);
  });

  it('launches a detached tmux session when an In Tmux by human session is missing', async () => {
    const runner = createMockRunner();
    runner.runCommand.mockImplementation(async (program, args) => {
      if (program === 'tmux' && args[0] === 'list-sessions') {
        return { stdout: '', stderr: '', exitCode: 0 };
      }
      if (program === 'ps') {
        return { stdout: '', stderr: '', exitCode: 0 };
      }
      return { stdout: '', stderr: '', exitCode: 0 };
    });

    await reconcileWithProject({
      inTmuxLauncherCommand: 'cl',
      assigneeLogin: ASSIGNEE,
      issues: [makeIssue()],
      localCommandRunner: runner,
      issueStateRepository: createIssueStateRepository(),
      now: NOW,
    });

    const newSessionCall = runner.runCommand.mock.calls.find(
      (call) => call[0] === 'tmux' && call[1][0] === 'new-session',
    );
    expect(newSessionCall).toBeDefined();
    expect(newSessionCall?.[1]).toEqual([
      'new-session',
      '-A',
      '-d',
      '-s',
      'https_//github_com/demo/repo/issues/1',
      'sh',
      '-lc',
      'exec "$1" "$2"',
      'sh',
      'cl',
      'https://github.com/demo/repo/issues/1',
    ]);
  });

  it('does not launch when a live session already exists', async () => {
    const runner = createMockRunner();
    runner.runCommand.mockImplementation(async (program, args) => {
      if (program === 'tmux' && args[0] === 'list-sessions') {
        return {
          stdout: 'https_//github_com/demo/repo/issues/1\n',
          stderr: '',
          exitCode: 0,
        };
      }
      if (program === 'ps') {
        return {
          stdout: 'claude --name https://github.com/demo/repo/issues/1\n',
          stderr: '',
          exitCode: 0,
        };
      }
      return { stdout: '', stderr: '', exitCode: 0 };
    });

    await reconcileWithProject({
      inTmuxLauncherCommand: 'cl',
      assigneeLogin: ASSIGNEE,
      issues: [makeIssue()],
      localCommandRunner: runner,
      issueStateRepository: createIssueStateRepository(),
      now: NOW,
    });

    const newSessionCalls = runner.runCommand.mock.calls.filter(
      (call) => call[0] === 'tmux' && call[1][0] === 'new-session',
    );
    expect(newSessionCalls).toHaveLength(0);
  });

  it('does not launch when the live GitHub state of the issue is closed', async () => {
    const runner = createMockRunner();
    runner.runCommand.mockImplementation(async () => ({
      stdout: '',
      stderr: '',
      exitCode: 0,
    }));

    await reconcileWithProject({
      inTmuxLauncherCommand: 'cl',
      assigneeLogin: ASSIGNEE,
      issues: [makeIssue()],
      localCommandRunner: runner,
      issueStateRepository: createIssueStateRepository('closed'),
      now: NOW,
    });

    const newSessionCalls = runner.runCommand.mock.calls.filter(
      (call) => call[0] === 'tmux' && call[1][0] === 'new-session',
    );
    expect(newSessionCalls).toHaveLength(0);
  });
  it('forwards the selected project to the project-scoped live issue lookup', async () => {
    const issue = makeIssue();
    const repository = createIssueStateRepository();
    repository.get = jest
      .fn()
      .mockResolvedValue({ ...issue, nextActionHour: 0 });
    repository.getIssueByUrl = jest.fn().mockResolvedValue(issue);
    const runner = createMockRunner();
    runner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });
    await reconcileWithProject({
      inTmuxLauncherCommand: 'cl',
      assigneeLogin: ASSIGNEE,
      issues: [issue],
      localCommandRunner: runner,
      issueStateRepository: repository,
      now: NOW,
    });
    expect(repository.get).toHaveBeenCalledWith(issue.url, PROJECT);
    expect(repository.getIssueByUrl).not.toHaveBeenCalled();
    expect(
      runner.runCommand.mock.calls.some(
        ([program, args]) => program === 'tmux' && args[0] === 'new-session',
      ),
    ).toBe(false);
  });
});
