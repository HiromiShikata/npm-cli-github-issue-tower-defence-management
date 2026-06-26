import {
  StaleTmuxSessionKillUseCase,
  DEFAULT_EXCLUDED_STATUS,
  DEFAULT_IDLE_THRESHOLD_SECONDS,
} from './StaleTmuxSessionKillUseCase';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { TmuxSessionRepository } from './adapter-interfaces/TmuxSessionRepository';
import { toTmuxSessionName } from './intmux/InTmuxByHumanSessionReconcileUseCase';
import { Issue } from '../entities/Issue';
import { LiveTmuxSession } from '../entities/LiveTmuxSession';
import { Project } from '../entities/Project';
import { IN_TMUX_STATUS_NAME } from '../entities/WorkflowStatus';

type Mocked<T> = jest.Mocked<T> & jest.MockedObject<T>;

const createMockProject = (): Project => ({
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

let issueCounter = 0;
const createMockIssue = (overrides: Partial<Issue> = {}): Issue => {
  issueCounter += 1;
  return {
    nameWithOwner: 'user/repo',
    number: issueCounter,
    title: `Test Issue ${issueCounter}`,
    state: 'OPEN',
    status: IN_TMUX_STATUS_NAME,
    story: null,
    nextActionDate: null,
    nextActionHour: null,
    estimationMinutes: null,
    dependedIssueUrls: [],
    completionDate50PercentConfidence: null,
    url: `https://github.com/user/repo/issues/${issueCounter}`,
    assignees: [],
    labels: [],
    org: 'user',
    repo: 'repo',
    body: '',
    itemId: `item-${issueCounter}`,
    isPr: false,
    isInProgress: false,
    isClosed: false,
    createdAt: new Date(),
    author: 'testuser',
    closingIssueReferenceUrls: [],
    ...overrides,
  };
};

describe('StaleTmuxSessionKillUseCase', () => {
  let useCase: StaleTmuxSessionKillUseCase;
  let mockIssueRepository: Mocked<Pick<IssueRepository, 'getAllOpened'>>;
  let mockTmuxSessionRepository: Mocked<
    Pick<TmuxSessionRepository, 'listLiveSessionsWithActivity' | 'killSession'>
  >;
  let mockProject: Project;
  const now = new Date('2026-06-26T00:00:00Z');
  const nowEpochSeconds = Math.floor(now.getTime() / 1000);
  const allowCacheMinutes = 10;

  const runParams = (): {
    project: Project;
    allowCacheMinutes: number;
    excludedStatus: string;
    idleThresholdSeconds: number;
    now: Date;
  } => ({
    project: mockProject,
    allowCacheMinutes,
    excludedStatus: DEFAULT_EXCLUDED_STATUS,
    idleThresholdSeconds: DEFAULT_IDLE_THRESHOLD_SECONDS,
    now,
  });

  const setLiveSessions = (sessions: LiveTmuxSession[]): void => {
    mockTmuxSessionRepository.listLiveSessionsWithActivity.mockResolvedValue(
      sessions,
    );
  };

  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    mockProject = createMockProject();
    mockIssueRepository = {
      getAllOpened: jest.fn().mockResolvedValue([]),
    };
    mockTmuxSessionRepository = {
      listLiveSessionsWithActivity: jest.fn().mockResolvedValue([]),
      killSession: jest.fn().mockResolvedValue(undefined),
    };
    useCase = new StaleTmuxSessionKillUseCase(
      mockIssueRepository,
      mockTmuxSessionRepository,
    );
  });

  it('exposes the excluded status and idle threshold as named constants', () => {
    expect(DEFAULT_EXCLUDED_STATUS).toBe('In Tmux by human');
    expect(DEFAULT_EXCLUDED_STATUS).toBe(IN_TMUX_STATUS_NAME);
    expect(DEFAULT_IDLE_THRESHOLD_SECONDS).toBe(86400);
  });

  it('lists live sessions with activity and loads open issues for the project', async () => {
    setLiveSessions([]);
    await useCase.run(runParams());
    expect(
      mockTmuxSessionRepository.listLiveSessionsWithActivity,
    ).toHaveBeenCalledTimes(1);
    expect(mockIssueRepository.getAllOpened).toHaveBeenCalledWith(
      mockProject,
      allowCacheMinutes,
    );
  });

  it('kills a session mapping to an open issue whose status is not the excluded status', async () => {
    const issue = createMockIssue({ status: 'In Progress' });
    const sessionName = toTmuxSessionName(issue.url);
    setLiveSessions([{ sessionName, activityEpochSeconds: nowEpochSeconds }]);
    mockIssueRepository.getAllOpened.mockResolvedValue([issue]);
    await useCase.run(runParams());
    expect(mockTmuxSessionRepository.killSession).toHaveBeenCalledWith(
      sessionName,
    );
  });

  it('kills a session mapping to an open issue whose status is null', async () => {
    const issue = createMockIssue({ status: null });
    const sessionName = toTmuxSessionName(issue.url);
    setLiveSessions([{ sessionName, activityEpochSeconds: nowEpochSeconds }]);
    mockIssueRepository.getAllOpened.mockResolvedValue([issue]);
    await useCase.run(runParams());
    expect(mockTmuxSessionRepository.killSession).toHaveBeenCalledWith(
      sessionName,
    );
  });

  it('kills an excluded-status session that has a next action date set', async () => {
    const issue = createMockIssue({
      status: DEFAULT_EXCLUDED_STATUS,
      nextActionDate: new Date('2026-06-27T00:00:00Z'),
    });
    const sessionName = toTmuxSessionName(issue.url);
    setLiveSessions([{ sessionName, activityEpochSeconds: nowEpochSeconds }]);
    mockIssueRepository.getAllOpened.mockResolvedValue([issue]);
    await useCase.run(runParams());
    expect(mockTmuxSessionRepository.killSession).toHaveBeenCalledWith(
      sessionName,
    );
  });

  it('kills an excluded-status session that has a next action hour set', async () => {
    const issue = createMockIssue({
      status: DEFAULT_EXCLUDED_STATUS,
      nextActionHour: 9,
    });
    const sessionName = toTmuxSessionName(issue.url);
    setLiveSessions([{ sessionName, activityEpochSeconds: nowEpochSeconds }]);
    mockIssueRepository.getAllOpened.mockResolvedValue([issue]);
    await useCase.run(runParams());
    expect(mockTmuxSessionRepository.killSession).toHaveBeenCalledWith(
      sessionName,
    );
  });

  it('never kills an excluded-status session that has no reactivation trigger', async () => {
    const issue = createMockIssue({
      status: DEFAULT_EXCLUDED_STATUS,
      nextActionDate: null,
      nextActionHour: null,
    });
    const sessionName = toTmuxSessionName(issue.url);
    setLiveSessions([{ sessionName, activityEpochSeconds: nowEpochSeconds }]);
    mockIssueRepository.getAllOpened.mockResolvedValue([issue]);
    await useCase.run(runParams());
    expect(mockTmuxSessionRepository.killSession).not.toHaveBeenCalled();
  });

  it('kills a no-task session that has been idle at least the idle threshold', async () => {
    const sessionName = 'no_task_session';
    const idleActivity = nowEpochSeconds - DEFAULT_IDLE_THRESHOLD_SECONDS;
    setLiveSessions([{ sessionName, activityEpochSeconds: idleActivity }]);
    mockIssueRepository.getAllOpened.mockResolvedValue([]);
    await useCase.run(runParams());
    expect(mockTmuxSessionRepository.killSession).toHaveBeenCalledWith(
      sessionName,
    );
  });

  it('never kills a no-task session that was active within the idle threshold', async () => {
    const sessionName = 'no_task_session';
    const recentActivity = nowEpochSeconds - DEFAULT_IDLE_THRESHOLD_SECONDS + 1;
    setLiveSessions([{ sessionName, activityEpochSeconds: recentActivity }]);
    mockIssueRepository.getAllOpened.mockResolvedValue([]);
    await useCase.run(runParams());
    expect(mockTmuxSessionRepository.killSession).not.toHaveBeenCalled();
  });

  it('does nothing when there are no live sessions', async () => {
    setLiveSessions([]);
    mockIssueRepository.getAllOpened.mockResolvedValue([]);
    await useCase.run(runParams());
    expect(mockTmuxSessionRepository.killSession).not.toHaveBeenCalled();
  });

  it('maps a session back to its issue using the dot-and-colon-to-underscore convention', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/owner/repo/issues/9',
      status: 'In Progress',
    });
    const sessionName = 'https_//github_com/owner/repo/issues/9';
    expect(toTmuxSessionName(issue.url)).toBe(sessionName);
    setLiveSessions([{ sessionName, activityEpochSeconds: nowEpochSeconds }]);
    mockIssueRepository.getAllOpened.mockResolvedValue([issue]);
    await useCase.run(runParams());
    expect(mockTmuxSessionRepository.killSession).toHaveBeenCalledWith(
      sessionName,
    );
  });

  it('enumerates and logs the kill-candidate list before killing', async () => {
    const logSpy = jest.spyOn(console, 'log');
    const killOrder: string[] = [];
    mockTmuxSessionRepository.killSession.mockImplementation(
      async (sessionName: string) => {
        killOrder.push(sessionName);
      },
    );
    const issue = createMockIssue({ status: 'In Progress' });
    const sessionName = toTmuxSessionName(issue.url);
    setLiveSessions([{ sessionName, activityEpochSeconds: nowEpochSeconds }]);
    mockIssueRepository.getAllOpened.mockResolvedValue([issue]);

    await useCase.run(runParams());

    const candidateLogIndex = logSpy.mock.calls.findIndex((call) =>
      String(call[0]).startsWith('Kill candidate:'),
    );
    const killedLogIndex = logSpy.mock.calls.findIndex((call) =>
      String(call[0]).startsWith('Killed tmux session:'),
    );
    expect(candidateLogIndex).toBeGreaterThanOrEqual(0);
    expect(killedLogIndex).toBeGreaterThan(candidateLogIndex);
    expect(killOrder).toEqual([sessionName]);
  });

  it('does not suppress errors raised while killing a session', async () => {
    const issue = createMockIssue({ status: 'In Progress' });
    const sessionName = toTmuxSessionName(issue.url);
    setLiveSessions([{ sessionName, activityEpochSeconds: nowEpochSeconds }]);
    mockIssueRepository.getAllOpened.mockResolvedValue([issue]);
    mockTmuxSessionRepository.killSession.mockRejectedValue(
      new Error('tmux kill failed'),
    );
    await expect(useCase.run(runParams())).rejects.toThrow('tmux kill failed');
  });

  it('does not kill any session when loading open issues fails', async () => {
    const sessionName = 'no_task_session';
    const idleActivity = nowEpochSeconds - DEFAULT_IDLE_THRESHOLD_SECONDS;
    setLiveSessions([{ sessionName, activityEpochSeconds: idleActivity }]);
    mockIssueRepository.getAllOpened.mockRejectedValue(
      new Error('failed to load issues'),
    );
    await expect(useCase.run(runParams())).rejects.toThrow(
      'failed to load issues',
    );
    expect(mockTmuxSessionRepository.killSession).not.toHaveBeenCalled();
  });
});
