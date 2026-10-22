import {
  StaleTmuxSessionKillUseCase,
  DEFAULT_EXCLUDED_STATUS_NAMES,
  DEFAULT_IDLE_THRESHOLD_SECONDS,
} from './StaleTmuxSessionKillUseCase';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { TmuxSessionRepository } from './adapter-interfaces/TmuxSessionRepository';
import { toTmuxSessionName } from './intmux/InTmuxByHumanSessionReconcileUseCase';
import { Issue } from '../entities/Issue';
import { LiveTmuxSession } from '../entities/LiveTmuxSession';
import { Project } from '../entities/Project';
import {
  IN_TMUX_STATUS_NAME,
  IN_TMUX_BY_AGENT_STATUS_NAME,
} from '../entities/WorkflowStatus';

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
  agent: null,
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
    plainCrossRepoIssueReferenceUrls: [],
    agent: null,
    stateReason: null,
    ...overrides,
  };
};

describe('StaleTmuxSessionKillUseCase', () => {
  let useCase: StaleTmuxSessionKillUseCase;
  let mockIssueRepository: Mocked<
    Pick<IssueRepository, 'getAllOpened' | 'getIssueByUrl' | 'get'>
  >;
  let mockTmuxSessionRepository: Mocked<
    Pick<
      TmuxSessionRepository,
      'listLiveSessionsWithActivity' | 'killSession'
    > & { listSessionNamesForIssueUrl: (url: string) => Promise<string[]> }
  >;
  let mockProject: Project;
  const now = new Date('2026-06-26T00:00:00Z');
  const nowEpochSeconds = Math.floor(now.getTime() / 1000);

  const runParams = (): {
    project: Project;
    excludedStatusNames: readonly string[];
    idleThresholdSeconds: number;
    now: Date;
  } => ({
    project: mockProject,
    excludedStatusNames: DEFAULT_EXCLUDED_STATUS_NAMES,
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
      get: jest
        .fn()
        .mockImplementation(
          async (url: string) =>
            (await mockIssueRepository.getAllOpened(mockProject)).find(
              (issue) => issue.url === url,
            ) ?? null,
        ),
      getIssueByUrl: jest
        .fn()
        .mockImplementation(
          async (url) =>
            (await mockIssueRepository.getAllOpened(mockProject)).find(
              (issue) => issue.url === url,
            ) ?? null,
        ),
    };
    mockTmuxSessionRepository = {
      listLiveSessionsWithActivity: jest.fn().mockResolvedValue([]),
      killSession: jest.fn().mockResolvedValue(undefined),
      listSessionNamesForIssueUrl: jest
        .fn()
        .mockImplementation(async (url: string) => [toTmuxSessionName(url)]),
    };
    useCase = new StaleTmuxSessionKillUseCase(
      mockIssueRepository,
      mockTmuxSessionRepository,
    );
  });

  it('exposes the excluded status names and idle threshold as named constants', () => {
    expect(DEFAULT_EXCLUDED_STATUS_NAMES).toEqual([
      IN_TMUX_STATUS_NAME,
      IN_TMUX_BY_AGENT_STATUS_NAME,
    ]);
    expect(DEFAULT_IDLE_THRESHOLD_SECONDS).toBe(86400);
  });

  it('lists live sessions with activity and loads open issues for the project', async () => {
    setLiveSessions([]);
    await useCase.run(runParams());
    expect(
      mockTmuxSessionRepository.listLiveSessionsWithActivity,
    ).toHaveBeenCalledTimes(1);
    expect(mockIssueRepository.getAllOpened).toHaveBeenCalledWith(mockProject);
  });

  const OTHER_STATUS_NAME = 'Awaiting Workspace';

  type KillDecisionRow = {
    row: number;
    name: string;
    mappedToIssue: boolean;
    issueStatus: string | null;
    nextActionDate: Date | null;
    nextActionHour: number | null;
    idleAtOrBeyondThreshold: boolean;
    expectedKilled: boolean;
  };

  const killDecisionRows: KillDecisionRow[] = [
    {
      row: 1,
      name: 'no mapped issue, idle >= threshold -> killed',
      mappedToIssue: false,
      issueStatus: null,
      nextActionDate: null,
      nextActionHour: null,
      idleAtOrBeyondThreshold: true,
      expectedKilled: true,
    },
    {
      row: 2,
      name: 'no mapped issue, recent activity -> not killed',
      mappedToIssue: false,
      issueStatus: null,
      nextActionDate: null,
      nextActionHour: null,
      idleAtOrBeyondThreshold: false,
      expectedKilled: false,
    },
    {
      row: 3,
      name: 'In Tmux by human, no trigger, recent activity -> not killed',
      mappedToIssue: true,
      issueStatus: IN_TMUX_STATUS_NAME,
      nextActionDate: null,
      nextActionHour: null,
      idleAtOrBeyondThreshold: false,
      expectedKilled: false,
    },
    {
      row: 4,
      name: 'In Tmux by human, no trigger, idle -> not killed',
      mappedToIssue: true,
      issueStatus: IN_TMUX_STATUS_NAME,
      nextActionDate: null,
      nextActionHour: null,
      idleAtOrBeyondThreshold: true,
      expectedKilled: false,
    },
    {
      row: 5,
      name: 'In Tmux by human, next action date set, recent activity -> killed',
      mappedToIssue: true,
      issueStatus: IN_TMUX_STATUS_NAME,
      nextActionDate: new Date('2026-06-27T00:00:00Z'),
      nextActionHour: null,
      idleAtOrBeyondThreshold: false,
      expectedKilled: true,
    },
    {
      row: 6,
      name: 'In Tmux by human, next action hour set, recent activity -> killed',
      mappedToIssue: true,
      issueStatus: IN_TMUX_STATUS_NAME,
      nextActionDate: null,
      nextActionHour: 9,
      idleAtOrBeyondThreshold: false,
      expectedKilled: true,
    },
    {
      row: 7,
      name: 'In Tmux by agent, no trigger, recent activity -> not killed',
      mappedToIssue: true,
      issueStatus: IN_TMUX_BY_AGENT_STATUS_NAME,
      nextActionDate: null,
      nextActionHour: null,
      idleAtOrBeyondThreshold: false,
      expectedKilled: false,
    },
    {
      row: 8,
      name: 'In Tmux by agent, no trigger, idle -> not killed',
      mappedToIssue: true,
      issueStatus: IN_TMUX_BY_AGENT_STATUS_NAME,
      nextActionDate: null,
      nextActionHour: null,
      idleAtOrBeyondThreshold: true,
      expectedKilled: false,
    },
    {
      row: 9,
      name: 'In Tmux by agent, next action date set, recent activity -> killed',
      mappedToIssue: true,
      issueStatus: IN_TMUX_BY_AGENT_STATUS_NAME,
      nextActionDate: new Date('2026-06-27T00:00:00Z'),
      nextActionHour: null,
      idleAtOrBeyondThreshold: false,
      expectedKilled: true,
    },
    {
      row: 10,
      name: 'In Tmux by agent, next action hour set, recent activity -> killed',
      mappedToIssue: true,
      issueStatus: IN_TMUX_BY_AGENT_STATUS_NAME,
      nextActionDate: null,
      nextActionHour: 9,
      idleAtOrBeyondThreshold: false,
      expectedKilled: true,
    },
    {
      row: 11,
      name: 'status not excluded (Awaiting Workspace), recent activity -> not killed',
      mappedToIssue: true,
      issueStatus: OTHER_STATUS_NAME,
      nextActionDate: null,
      nextActionHour: null,
      idleAtOrBeyondThreshold: false,
      expectedKilled: false,
    },
    {
      row: 12,
      name: 'status not excluded (Awaiting Workspace), idle -> killed',
      mappedToIssue: true,
      issueStatus: OTHER_STATUS_NAME,
      nextActionDate: null,
      nextActionHour: null,
      idleAtOrBeyondThreshold: true,
      expectedKilled: true,
    },
    {
      row: 13,
      name: 'null/unset status, recent activity -> not killed',
      mappedToIssue: true,
      issueStatus: null,
      nextActionDate: null,
      nextActionHour: null,
      idleAtOrBeyondThreshold: false,
      expectedKilled: false,
    },
    {
      row: 14,
      name: 'null/unset status, idle -> killed',
      mappedToIssue: true,
      issueStatus: null,
      nextActionDate: null,
      nextActionHour: null,
      idleAtOrBeyondThreshold: true,
      expectedKilled: true,
    },
  ];

  it.each(killDecisionRows)(
    'row $row: $name',
    async ({
      mappedToIssue,
      issueStatus,
      nextActionDate,
      nextActionHour,
      idleAtOrBeyondThreshold,
      expectedKilled,
    }) => {
      const activityEpochSeconds = idleAtOrBeyondThreshold
        ? nowEpochSeconds - DEFAULT_IDLE_THRESHOLD_SECONDS
        : nowEpochSeconds - DEFAULT_IDLE_THRESHOLD_SECONDS + 1;

      let sessionName: string;
      if (mappedToIssue) {
        const issue = createMockIssue({
          status: issueStatus,
          nextActionDate,
          nextActionHour,
        });
        sessionName = toTmuxSessionName(issue.url);
        mockIssueRepository.getAllOpened.mockResolvedValue([issue]);
      } else {
        sessionName = 'no_task_session';
        mockIssueRepository.getAllOpened.mockResolvedValue([]);
      }
      setLiveSessions([{ sessionName, activityEpochSeconds }]);

      await useCase.run(runParams());

      if (expectedKilled) {
        expect(mockTmuxSessionRepository.killSession).toHaveBeenCalledWith(
          sessionName,
        );
      } else {
        expect(mockTmuxSessionRepository.killSession).not.toHaveBeenCalled();
      }
    },
  );

  it('never kills an excluded-status session that has no reactivation trigger', async () => {
    const issue = createMockIssue({
      status: IN_TMUX_STATUS_NAME,
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
    const idleActivity = nowEpochSeconds - DEFAULT_IDLE_THRESHOLD_SECONDS;
    setLiveSessions([{ sessionName, activityEpochSeconds: idleActivity }]);
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
    const idleActivity = nowEpochSeconds - DEFAULT_IDLE_THRESHOLD_SECONDS;
    setLiveSessions([{ sessionName, activityEpochSeconds: idleActivity }]);
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
    const idleActivity = nowEpochSeconds - DEFAULT_IDLE_THRESHOLD_SECONDS;
    setLiveSessions([{ sessionName, activityEpochSeconds: idleActivity }]);
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
  it('stops all sessions for held issues before status and idle exemptions', async () => {
    for (const hold of [
      { dependedIssueUrls: ['https://github.com/user/repo/issues/8'] },
      { nextActionDate: new Date('2020-01-01T00:00:00Z') },
      { nextActionDate: now },
      { nextActionDate: new Date('2030-01-01T00:00:00Z') },
      { nextActionHour: 0 },
    ]) {
      for (const status of [
        IN_TMUX_STATUS_NAME,
        IN_TMUX_BY_AGENT_STATUS_NAME,
        'Done',
        null,
      ]) {
        mockTmuxSessionRepository.killSession.mockClear();
        const issue = createMockIssue({
          url: 'https://github.com/user/repo/issues/9',
          status,
          ...hold,
        });
        mockIssueRepository.getAllOpened.mockResolvedValue([issue]);
        mockIssueRepository.get.mockResolvedValue(issue);
        mockTmuxSessionRepository.listSessionNamesForIssueUrl.mockResolvedValue(
          ['renamed-first', 'renamed-second'],
        );
        setLiveSessions(
          ['renamed-first', 'renamed-second', 'issue-90', 'unmapped'].map(
            (sessionName) => ({
              sessionName,
              activityEpochSeconds: nowEpochSeconds,
            }),
          ),
        );
        await useCase.run(runParams());
        expect(mockIssueRepository.get).toHaveBeenCalledWith(
          issue.url,
          mockProject,
        );
        expect(
          mockTmuxSessionRepository.listSessionNamesForIssueUrl,
        ).toHaveBeenCalledWith(issue.url);
        expect(mockTmuxSessionRepository.killSession.mock.calls).toEqual([
          ['renamed-first'],
          ['renamed-second'],
        ]);
      }
    }
  });

  it('preserves a session when a live hold is cleared', async () => {
    const issue = createMockIssue({ nextActionHour: 0 });
    mockIssueRepository.getAllOpened.mockResolvedValue([issue]);
    mockIssueRepository.get.mockResolvedValue({
      ...issue,
      nextActionHour: null,
    });
    setLiveSessions([
      {
        sessionName: toTmuxSessionName(issue.url),
        activityEpochSeconds: nowEpochSeconds,
      },
    ]);
    await useCase.run(runParams());
    expect(mockIssueRepository.get).toHaveBeenCalledWith(
      issue.url,
      mockProject,
    );
    expect(mockTmuxSessionRepository.killSession).not.toHaveBeenCalled();
  });

  it('keeps a session when the live read of a snapshot-held issue returns null', async () => {
    const issue = createMockIssue({ nextActionHour: 0 });
    mockIssueRepository.getAllOpened.mockResolvedValue([issue]);
    mockIssueRepository.get.mockResolvedValue(null);
    setLiveSessions([
      {
        sessionName: toTmuxSessionName(issue.url),
        activityEpochSeconds: nowEpochSeconds,
      },
    ]);
    await useCase.run(runParams());
    expect(mockIssueRepository.get).toHaveBeenCalledTimes(1);
    expect(mockIssueRepository.get).toHaveBeenCalledWith(
      issue.url,
      mockProject,
    );
    expect(mockTmuxSessionRepository.killSession).not.toHaveBeenCalled();
  });

  it('reads live only the held issue that owns a live session and no held issue without one', async () => {
    const heldWithoutSession = [1, 2, 3].map((hour) =>
      createMockIssue({ nextActionHour: hour }),
    );
    const heldWithSession = createMockIssue({ nextActionHour: 0 });
    const unheldWithSession = createMockIssue();
    mockIssueRepository.getAllOpened.mockResolvedValue([
      ...heldWithoutSession,
      heldWithSession,
      unheldWithSession,
    ]);
    mockIssueRepository.get.mockResolvedValue(heldWithSession);
    mockTmuxSessionRepository.listSessionNamesForIssueUrl.mockImplementation(
      async (url: string) =>
        url === heldWithSession.url || url === unheldWithSession.url
          ? [toTmuxSessionName(url)]
          : [],
    );
    setLiveSessions(
      [heldWithSession, unheldWithSession].map((issue) => ({
        sessionName: toTmuxSessionName(issue.url),
        activityEpochSeconds: nowEpochSeconds,
      })),
    );
    await useCase.run(runParams());
    expect(mockIssueRepository.get.mock.calls).toEqual([
      [heldWithSession.url, mockProject],
    ]);
    expect(mockTmuxSessionRepository.killSession.mock.calls).toEqual([
      [toTmuxSessionName(heldWithSession.url)],
    ]);
  });

  it('does not report successful cleanup when live issue reading or mapping fails', async () => {
    const issue = createMockIssue({ nextActionHour: 0 });
    mockIssueRepository.getAllOpened.mockResolvedValue([issue]);
    setLiveSessions([
      {
        sessionName: toTmuxSessionName(issue.url),
        activityEpochSeconds: nowEpochSeconds,
      },
    ]);
    mockIssueRepository.get.mockRejectedValue(
      new Error('live issue unavailable'),
    );
    await expect(useCase.run(runParams())).rejects.toThrow(
      'live issue unavailable',
    );
    expect(mockTmuxSessionRepository.killSession).not.toHaveBeenCalled();
    mockIssueRepository.get.mockResolvedValue(issue);
    mockTmuxSessionRepository.listSessionNamesForIssueUrl.mockRejectedValue(
      new Error('pane mapping failed'),
    );
    await expect(useCase.run(runParams())).rejects.toThrow(
      'pane mapping failed',
    );
  });
  it('continues independent session stops and propagates collected failures', async () => {
    const issue = createMockIssue({ nextActionHour: 0 });
    mockIssueRepository.getAllOpened.mockResolvedValue([issue]);
    mockIssueRepository.get.mockResolvedValue(issue);
    mockTmuxSessionRepository.listSessionNamesForIssueUrl.mockResolvedValue([
      'first',
      'second',
    ]);
    setLiveSessions(
      ['first', 'second'].map((sessionName) => ({
        sessionName,
        activityEpochSeconds: nowEpochSeconds,
      })),
    );
    mockTmuxSessionRepository.killSession
      .mockRejectedValueOnce(new Error('first stop failed'))
      .mockResolvedValueOnce(undefined);
    await expect(useCase.run(runParams())).rejects.toThrow();
    expect(mockTmuxSessionRepository.killSession.mock.calls).toEqual([
      ['first'],
      ['second'],
    ]);
  });
  it.each([true, false])(
    'uses the selected project live hold for cleanup when membership fields disagree: selected held=%s',
    async (selectedHeld) => {
      const issue = createMockIssue();
      const otherProject: Project = {
        ...mockProject,
        id: 'other-project',
        databaseId: 10,
        url: 'https://github.com/users/user/projects/10',
      };
      const selectedIssue = {
        ...issue,
        nextActionHour: selectedHeld ? 0 : null,
      };
      const otherIssue = { ...issue, nextActionHour: selectedHeld ? null : 0 };
      const projectMemberships = new Map([
        [mockProject.id, selectedIssue],
        [otherProject.id, otherIssue],
      ]);
      mockIssueRepository.getAllOpened.mockResolvedValue([selectedIssue]);
      mockIssueRepository.get.mockImplementation(
        async (_url: string, project: Project) =>
          projectMemberships.get(project.id) ?? null,
      );
      mockIssueRepository.getIssueByUrl.mockResolvedValue(otherIssue);
      const sessionName = toTmuxSessionName(issue.url);
      setLiveSessions([{ sessionName, activityEpochSeconds: nowEpochSeconds }]);
      await useCase.run(runParams());
      expect(mockTmuxSessionRepository.killSession.mock.calls).toEqual(
        selectedHeld ? [[sessionName]] : [],
      );
      expect(mockIssueRepository.get).toHaveBeenCalledTimes(
        selectedHeld ? 1 : 0,
      );
      if (selectedHeld) {
        expect(mockIssueRepository.get).toHaveBeenCalledWith(
          issue.url,
          mockProject,
        );
      }
      expect(mockIssueRepository.getIssueByUrl).not.toHaveBeenCalled();
    },
  );

  describe('one live session shared by an unheld issue and a held issue', () => {
    const SHARED_SESSION_NAME = 'leader-session';
    const UNHELD_ISSUE_URL = 'https://github.com/user/repo/issues/21';
    const HELD_ISSUE_URL = 'https://github.com/user/repo/issues/22';

    const createSharedSessionIssues = (): {
      unheldIssue: Issue;
      heldIssue: Issue;
    } => ({
      unheldIssue: createMockIssue({
        url: UNHELD_ISSUE_URL,
        status: 'In Progress',
        nextActionHour: null,
      }),
      heldIssue: createMockIssue({
        url: HELD_ISSUE_URL,
        status: 'In Progress',
        nextActionHour: 0,
      }),
    });

    const killCandidateLines = (
      logSpy: jest.SpyInstance<void, unknown[]>,
    ): string[] =>
      logSpy.mock.calls
        .map((call: unknown[]) => String(call[0]))
        .filter((line: string) => line.startsWith('Kill candidate:'));

    beforeEach(() => {
      mockTmuxSessionRepository.listSessionNamesForIssueUrl.mockResolvedValue([
        SHARED_SESSION_NAME,
      ]);
      setLiveSessions([
        {
          sessionName: SHARED_SESSION_NAME,
          activityEpochSeconds:
            nowEpochSeconds - DEFAULT_IDLE_THRESHOLD_SECONDS,
        },
      ]);
    });

    it('does not stop the shared session when the unheld issue is listed before the held issue', async () => {
      const logSpy = jest.spyOn(console, 'log');
      const { unheldIssue, heldIssue } = createSharedSessionIssues();
      mockIssueRepository.getAllOpened.mockResolvedValue([
        unheldIssue,
        heldIssue,
      ]);

      await useCase.run(runParams());

      expect(mockTmuxSessionRepository.killSession).not.toHaveBeenCalled();
      expect(killCandidateLines(logSpy)).toEqual([]);
    });

    it('does not stop the shared session when the held issue is listed before the unheld issue', async () => {
      const logSpy = jest.spyOn(console, 'log');
      const { unheldIssue, heldIssue } = createSharedSessionIssues();
      mockIssueRepository.getAllOpened.mockResolvedValue([
        heldIssue,
        unheldIssue,
      ]);

      await useCase.run(runParams());

      expect(mockTmuxSessionRepository.killSession).not.toHaveBeenCalled();
      expect(killCandidateLines(logSpy)).toEqual([]);
    });

    it('stops a session whose only mapped issue is held, with the held issue URL as the reason', async () => {
      const logSpy = jest.spyOn(console, 'log');
      const { heldIssue } = createSharedSessionIssues();
      mockIssueRepository.getAllOpened.mockResolvedValue([heldIssue]);

      await useCase.run(runParams());

      expect(mockTmuxSessionRepository.killSession).toHaveBeenCalledWith(
        SHARED_SESSION_NAME,
      );
      expect(killCandidateLines(logSpy)).toEqual([
        `Kill candidate: ${SHARED_SESSION_NAME} (mapped to held issue ${HELD_ISSUE_URL})`,
      ]);
    });
  });
});
