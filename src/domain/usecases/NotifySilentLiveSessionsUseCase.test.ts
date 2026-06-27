import {
  NotifySilentLiveSessionsUseCase,
  DEFAULT_MONITORED_STATUS,
  DEFAULT_MAIN_SILENT_THRESHOLD_SECONDS,
  DEFAULT_SUBAGENT_SILENT_THRESHOLD_SECONDS,
  DEFAULT_SUBAGENT_RUNNING_THRESHOLD_SECONDS,
  DEFAULT_NOTIFICATION_COOLDOWN_SECONDS,
  DEFAULT_NOTIFICATION_STAGGER_SECONDS,
} from './NotifySilentLiveSessionsUseCase';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { TmuxSessionRepository } from './adapter-interfaces/TmuxSessionRepository';
import { SessionOutputActivityRepository } from './adapter-interfaces/SessionOutputActivityRepository';
import { SessionSubAgentActivityRepository } from './adapter-interfaces/SessionSubAgentActivityRepository';
import { OwnerCallStatusProvider } from './adapter-interfaces/OwnerCallStatusProvider';
import { SilentSessionNotificationRepository } from './adapter-interfaces/SilentSessionNotificationRepository';
import { SilentSessionMessageComposer } from './adapter-interfaces/SilentSessionMessageComposer';
import { Sleeper } from './adapter-interfaces/Sleeper';
import { toTmuxSessionName } from './intmux/InTmuxByHumanSessionReconcileUseCase';
import { Issue } from '../entities/Issue';
import { Project } from '../entities/Project';
import { SubAgentActivity } from '../entities/LiveSessionActivitySnapshot';
import { IN_TMUX_STATUS_NAME } from '../entities/WorkflowStatus';

type Mocked<T> = jest.Mocked<T> & jest.MockedObject<T>;

const MAIN_STALLED_SECTION = 'MAIN_STALLED_SECTION';
const SUBAGENT_SECTION = 'SUBAGENT_SECTION';

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

describe('NotifySilentLiveSessionsUseCase', () => {
  let useCase: NotifySilentLiveSessionsUseCase;
  let mockIssueRepository: Mocked<Pick<IssueRepository, 'getAllOpened'>>;
  let mockTmuxSessionRepository: Mocked<
    Pick<TmuxSessionRepository, 'listLiveSessionNames'>
  >;
  let mockSessionOutputActivityRepository: Mocked<SessionOutputActivityRepository>;
  let mockSubAgentActivityRepository: Mocked<SessionSubAgentActivityRepository>;
  let mockOwnerCallStatusProvider: Mocked<OwnerCallStatusProvider>;
  let mockNotificationRepository: Mocked<SilentSessionNotificationRepository>;
  let mockMessageComposer: Mocked<SilentSessionMessageComposer>;
  let mockSleeper: Mocked<Sleeper>;
  let mockProject: Project;
  const now = new Date('2026-06-26T00:00:00Z');
  const nowEpochSeconds = Math.floor(now.getTime() / 1000);
  const allowCacheMinutes = 10;

  const runParams = (): {
    project: Project;
    allowCacheMinutes: number;
    monitoredStatus: string;
    mainSilentThresholdSeconds: number;
    subAgentSilentThresholdSeconds: number;
    subAgentRunningThresholdSeconds: number;
    cooldownSeconds: number;
    staggerSeconds: number;
    now: Date;
  } => ({
    project: mockProject,
    allowCacheMinutes,
    monitoredStatus: DEFAULT_MONITORED_STATUS,
    mainSilentThresholdSeconds: DEFAULT_MAIN_SILENT_THRESHOLD_SECONDS,
    subAgentSilentThresholdSeconds: DEFAULT_SUBAGENT_SILENT_THRESHOLD_SECONDS,
    subAgentRunningThresholdSeconds: DEFAULT_SUBAGENT_RUNNING_THRESHOLD_SECONDS,
    cooldownSeconds: DEFAULT_NOTIFICATION_COOLDOWN_SECONDS,
    staggerSeconds: DEFAULT_NOTIFICATION_STAGGER_SECONDS,
    now,
  });

  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    mockProject = createMockProject();
    mockIssueRepository = {
      getAllOpened: jest.fn().mockResolvedValue([]),
    };
    mockTmuxSessionRepository = {
      listLiveSessionNames: jest.fn().mockResolvedValue([]),
    };
    mockSessionOutputActivityRepository = {
      listSessionOutputActivities: jest.fn().mockResolvedValue([]),
    };
    mockSubAgentActivityRepository = {
      listSubAgentActivitiesBySessionName: jest
        .fn()
        .mockResolvedValue(new Map<string, SubAgentActivity[]>()),
    };
    mockOwnerCallStatusProvider = {
      listSessionNamesWithUnansweredOwnerCall: jest
        .fn()
        .mockResolvedValue(new Set<string>()),
    };
    mockNotificationRepository = {
      getLastNotifiedEpochSeconds: jest.fn().mockResolvedValue(null),
      setLastNotifiedEpochSeconds: jest.fn().mockResolvedValue(undefined),
      sendSelfCheckNotification: jest.fn().mockResolvedValue(undefined),
    };
    mockMessageComposer = {
      composeMainStalledSection: jest
        .fn()
        .mockReturnValue(MAIN_STALLED_SECTION),
      composeSubAgentSection: jest.fn().mockReturnValue(SUBAGENT_SECTION),
    };
    mockSleeper = {
      sleep: jest.fn().mockResolvedValue(undefined),
    };
    useCase = new NotifySilentLiveSessionsUseCase(
      mockIssueRepository,
      mockTmuxSessionRepository,
      mockSessionOutputActivityRepository,
      mockSubAgentActivityRepository,
      mockOwnerCallStatusProvider,
      mockNotificationRepository,
      mockMessageComposer,
      mockSleeper,
    );
  });

  const setupLiveMonitoredSession = (
    overrides: Partial<Issue> = {},
  ): string => {
    const issue = createMockIssue({
      status: IN_TMUX_STATUS_NAME,
      ...overrides,
    });
    const sessionName = toTmuxSessionName(issue.url);
    mockIssueRepository.getAllOpened.mockResolvedValue([issue]);
    mockTmuxSessionRepository.listLiveSessionNames.mockResolvedValue([
      sessionName,
    ]);
    return sessionName;
  };

  it('exposes the monitored status and default thresholds as named constants', () => {
    expect(DEFAULT_MONITORED_STATUS).toBe('In Tmux by human');
    expect(DEFAULT_MONITORED_STATUS).toBe(IN_TMUX_STATUS_NAME);
    expect(DEFAULT_MAIN_SILENT_THRESHOLD_SECONDS).toBe(600);
    expect(DEFAULT_SUBAGENT_SILENT_THRESHOLD_SECONDS).toBe(300);
    expect(DEFAULT_SUBAGENT_RUNNING_THRESHOLD_SECONDS).toBe(900);
    expect(DEFAULT_NOTIFICATION_COOLDOWN_SECONDS).toBe(30 * 60);
    expect(DEFAULT_NOTIFICATION_STAGGER_SECONDS).toBe(25);
  });

  it('sends only the main stalled section when the main session is silent and no owner call is pending', async () => {
    const sessionName = setupLiveMonitoredSession();
    mockSessionOutputActivityRepository.listSessionOutputActivities.mockResolvedValue(
      [
        {
          sessionName,
          lastOutputEpochSeconds:
            nowEpochSeconds - DEFAULT_MAIN_SILENT_THRESHOLD_SECONDS,
        },
      ],
    );

    await useCase.run(runParams());

    expect(mockMessageComposer.composeMainStalledSection).toHaveBeenCalledWith(
      DEFAULT_MAIN_SILENT_THRESHOLD_SECONDS,
    );
    expect(mockMessageComposer.composeSubAgentSection).not.toHaveBeenCalled();
    expect(
      mockNotificationRepository.sendSelfCheckNotification,
    ).toHaveBeenCalledWith(sessionName, MAIN_STALLED_SECTION);
  });

  it('does not send the main stalled section when an owner call is pending', async () => {
    const sessionName = setupLiveMonitoredSession();
    mockSessionOutputActivityRepository.listSessionOutputActivities.mockResolvedValue(
      [
        {
          sessionName,
          lastOutputEpochSeconds:
            nowEpochSeconds - DEFAULT_MAIN_SILENT_THRESHOLD_SECONDS,
        },
      ],
    );
    mockOwnerCallStatusProvider.listSessionNamesWithUnansweredOwnerCall.mockResolvedValue(
      new Set([sessionName]),
    );

    await useCase.run(runParams());

    expect(
      mockMessageComposer.composeMainStalledSection,
    ).not.toHaveBeenCalled();
    expect(
      mockNotificationRepository.sendSelfCheckNotification,
    ).not.toHaveBeenCalled();
  });

  it('does not send the main stalled section when output is within the threshold', async () => {
    const sessionName = setupLiveMonitoredSession();
    mockSessionOutputActivityRepository.listSessionOutputActivities.mockResolvedValue(
      [
        {
          sessionName,
          lastOutputEpochSeconds:
            nowEpochSeconds - DEFAULT_MAIN_SILENT_THRESHOLD_SECONDS + 1,
        },
      ],
    );

    await useCase.run(runParams());

    expect(
      mockNotificationRepository.sendSelfCheckNotification,
    ).not.toHaveBeenCalled();
  });

  it('sends the sub-agent section when a sub-agent exceeds the silent threshold regardless of main output', async () => {
    const sessionName = setupLiveMonitoredSession();
    mockSessionOutputActivityRepository.listSessionOutputActivities.mockResolvedValue(
      [
        {
          sessionName,
          lastOutputEpochSeconds: nowEpochSeconds,
        },
      ],
    );
    const subAgents: SubAgentActivity[] = [
      {
        label: 'sub-process-1',
        silentSeconds: DEFAULT_SUBAGENT_SILENT_THRESHOLD_SECONDS,
        runningSeconds: 60,
      },
    ];
    mockSubAgentActivityRepository.listSubAgentActivitiesBySessionName.mockResolvedValue(
      new Map([[sessionName, subAgents]]),
    );

    await useCase.run(runParams());

    expect(
      mockMessageComposer.composeMainStalledSection,
    ).not.toHaveBeenCalled();
    expect(mockMessageComposer.composeSubAgentSection).toHaveBeenCalledWith(
      subAgents,
    );
    expect(
      mockNotificationRepository.sendSelfCheckNotification,
    ).toHaveBeenCalledWith(sessionName, SUBAGENT_SECTION);
  });

  it('sends the sub-agent section when a sub-agent exceeds the running threshold', async () => {
    const sessionName = setupLiveMonitoredSession();
    const subAgents: SubAgentActivity[] = [
      {
        label: 'sub-process-1',
        silentSeconds: 10,
        runningSeconds: DEFAULT_SUBAGENT_RUNNING_THRESHOLD_SECONDS,
      },
    ];
    mockSubAgentActivityRepository.listSubAgentActivitiesBySessionName.mockResolvedValue(
      new Map([[sessionName, subAgents]]),
    );

    await useCase.run(runParams());

    expect(mockMessageComposer.composeSubAgentSection).toHaveBeenCalledWith(
      subAgents,
    );
  });

  it('does not include sub-agents that are below both thresholds', async () => {
    const sessionName = setupLiveMonitoredSession();
    mockSubAgentActivityRepository.listSubAgentActivitiesBySessionName.mockResolvedValue(
      new Map([
        [
          sessionName,
          [{ label: 'sub-process-1', silentSeconds: 10, runningSeconds: 60 }],
        ],
      ]),
    );

    await useCase.run(runParams());

    expect(mockMessageComposer.composeSubAgentSection).not.toHaveBeenCalled();
    expect(
      mockNotificationRepository.sendSelfCheckNotification,
    ).not.toHaveBeenCalled();
  });

  it('combines both sections into a single notification when both classifications apply', async () => {
    const sessionName = setupLiveMonitoredSession();
    mockSessionOutputActivityRepository.listSessionOutputActivities.mockResolvedValue(
      [
        {
          sessionName,
          lastOutputEpochSeconds:
            nowEpochSeconds - DEFAULT_MAIN_SILENT_THRESHOLD_SECONDS,
        },
      ],
    );
    mockSubAgentActivityRepository.listSubAgentActivitiesBySessionName.mockResolvedValue(
      new Map([
        [
          sessionName,
          [
            {
              label: 'sub-process-1',
              silentSeconds: DEFAULT_SUBAGENT_SILENT_THRESHOLD_SECONDS,
              runningSeconds: 60,
            },
          ],
        ],
      ]),
    );

    await useCase.run(runParams());

    const sendCall =
      mockNotificationRepository.sendSelfCheckNotification.mock.calls[0];
    expect(sendCall[0]).toBe(sessionName);
    expect(sendCall[1]).toContain(MAIN_STALLED_SECTION);
    expect(sendCall[1]).toContain(SUBAGENT_SECTION);
  });

  it('still sends the sub-agent section even when an owner call is pending', async () => {
    const sessionName = setupLiveMonitoredSession();
    mockSessionOutputActivityRepository.listSessionOutputActivities.mockResolvedValue(
      [
        {
          sessionName,
          lastOutputEpochSeconds:
            nowEpochSeconds - DEFAULT_MAIN_SILENT_THRESHOLD_SECONDS,
        },
      ],
    );
    mockOwnerCallStatusProvider.listSessionNamesWithUnansweredOwnerCall.mockResolvedValue(
      new Set([sessionName]),
    );
    mockSubAgentActivityRepository.listSubAgentActivitiesBySessionName.mockResolvedValue(
      new Map([
        [
          sessionName,
          [
            {
              label: 'sub-process-1',
              silentSeconds: DEFAULT_SUBAGENT_SILENT_THRESHOLD_SECONDS,
              runningSeconds: 60,
            },
          ],
        ],
      ]),
    );

    await useCase.run(runParams());

    const sendCall =
      mockNotificationRepository.sendSelfCheckNotification.mock.calls[0];
    expect(sendCall[1]).not.toContain(MAIN_STALLED_SECTION);
    expect(sendCall[1]).toContain(SUBAGENT_SECTION);
  });

  it('passes the monitored session names to every data provider', async () => {
    const sessionName = setupLiveMonitoredSession();

    await useCase.run(runParams());

    expect(
      mockSessionOutputActivityRepository.listSessionOutputActivities,
    ).toHaveBeenCalledWith([sessionName]);
    expect(
      mockSubAgentActivityRepository.listSubAgentActivitiesBySessionName,
    ).toHaveBeenCalledWith([sessionName]);
    expect(
      mockOwnerCallStatusProvider.listSessionNamesWithUnansweredOwnerCall,
    ).toHaveBeenCalledWith([sessionName]);
    expect(mockIssueRepository.getAllOpened).toHaveBeenCalledWith(
      mockProject,
      allowCacheMinutes,
    );
  });

  it('does not notify a live session that maps to no monitored issue', async () => {
    mockIssueRepository.getAllOpened.mockResolvedValue([]);
    mockTmuxSessionRepository.listLiveSessionNames.mockResolvedValue([
      'orphan_session',
    ]);

    await useCase.run(runParams());

    expect(
      mockSessionOutputActivityRepository.listSessionOutputActivities,
    ).toHaveBeenCalledWith([]);
    expect(
      mockNotificationRepository.sendSelfCheckNotification,
    ).not.toHaveBeenCalled();
  });

  it('does not notify a monitored issue whose session is not live', async () => {
    const issue = createMockIssue({ status: IN_TMUX_STATUS_NAME });
    mockIssueRepository.getAllOpened.mockResolvedValue([issue]);
    mockTmuxSessionRepository.listLiveSessionNames.mockResolvedValue([]);

    await useCase.run(runParams());

    expect(
      mockSessionOutputActivityRepository.listSessionOutputActivities,
    ).toHaveBeenCalledWith([]);
    expect(
      mockNotificationRepository.sendSelfCheckNotification,
    ).not.toHaveBeenCalled();
  });

  it('does not notify a live session whose issue status is not the monitored status', async () => {
    const issue = createMockIssue({ status: 'In Progress' });
    const sessionName = toTmuxSessionName(issue.url);
    mockIssueRepository.getAllOpened.mockResolvedValue([issue]);
    mockTmuxSessionRepository.listLiveSessionNames.mockResolvedValue([
      sessionName,
    ]);
    mockSessionOutputActivityRepository.listSessionOutputActivities.mockResolvedValue(
      [
        {
          sessionName,
          lastOutputEpochSeconds:
            nowEpochSeconds - DEFAULT_MAIN_SILENT_THRESHOLD_SECONDS,
        },
      ],
    );

    await useCase.run(runParams());

    expect(
      mockSessionOutputActivityRepository.listSessionOutputActivities,
    ).toHaveBeenCalledWith([]);
    expect(
      mockNotificationRepository.sendSelfCheckNotification,
    ).not.toHaveBeenCalled();
  });

  it('does not re-notify a session within the cooldown window', async () => {
    const sessionName = setupLiveMonitoredSession();
    mockSessionOutputActivityRepository.listSessionOutputActivities.mockResolvedValue(
      [
        {
          sessionName,
          lastOutputEpochSeconds:
            nowEpochSeconds - DEFAULT_MAIN_SILENT_THRESHOLD_SECONDS,
        },
      ],
    );
    mockNotificationRepository.getLastNotifiedEpochSeconds.mockResolvedValue(
      nowEpochSeconds - DEFAULT_NOTIFICATION_COOLDOWN_SECONDS + 1,
    );

    await useCase.run(runParams());

    expect(
      mockNotificationRepository.sendSelfCheckNotification,
    ).not.toHaveBeenCalled();
    expect(
      mockNotificationRepository.setLastNotifiedEpochSeconds,
    ).not.toHaveBeenCalled();
  });

  it('re-notifies a session once the cooldown window has elapsed', async () => {
    const sessionName = setupLiveMonitoredSession();
    mockSessionOutputActivityRepository.listSessionOutputActivities.mockResolvedValue(
      [
        {
          sessionName,
          lastOutputEpochSeconds:
            nowEpochSeconds - DEFAULT_MAIN_SILENT_THRESHOLD_SECONDS,
        },
      ],
    );
    mockNotificationRepository.getLastNotifiedEpochSeconds.mockResolvedValue(
      nowEpochSeconds - DEFAULT_NOTIFICATION_COOLDOWN_SECONDS,
    );

    await useCase.run(runParams());

    expect(
      mockNotificationRepository.sendSelfCheckNotification,
    ).toHaveBeenCalledWith(sessionName, MAIN_STALLED_SECTION);
    expect(
      mockNotificationRepository.setLastNotifiedEpochSeconds,
    ).toHaveBeenCalledWith(sessionName, nowEpochSeconds);
  });

  it('does not notify a session that has no recorded output activity and no sub-agents', async () => {
    setupLiveMonitoredSession();
    mockSessionOutputActivityRepository.listSessionOutputActivities.mockResolvedValue(
      [],
    );

    await useCase.run(runParams());

    expect(
      mockNotificationRepository.sendSelfCheckNotification,
    ).not.toHaveBeenCalled();
  });

  it('sends to multiple sessions sequentially with a stagger delay between sends, not before the first or after the last', async () => {
    const issueA = createMockIssue({ status: IN_TMUX_STATUS_NAME });
    const issueB = createMockIssue({ status: IN_TMUX_STATUS_NAME });
    const sessionA = toTmuxSessionName(issueA.url);
    const sessionB = toTmuxSessionName(issueB.url);
    mockIssueRepository.getAllOpened.mockResolvedValue([issueA, issueB]);
    mockTmuxSessionRepository.listLiveSessionNames.mockResolvedValue([
      sessionA,
      sessionB,
    ]);
    mockSessionOutputActivityRepository.listSessionOutputActivities.mockResolvedValue(
      [
        {
          sessionName: sessionA,
          lastOutputEpochSeconds:
            nowEpochSeconds - DEFAULT_MAIN_SILENT_THRESHOLD_SECONDS,
        },
        {
          sessionName: sessionB,
          lastOutputEpochSeconds:
            nowEpochSeconds - DEFAULT_MAIN_SILENT_THRESHOLD_SECONDS,
        },
      ],
    );

    const callOrder: string[] = [];
    mockNotificationRepository.sendSelfCheckNotification.mockImplementation(
      async (sessionName) => {
        callOrder.push(`send:${sessionName}`);
      },
    );
    mockSleeper.sleep.mockImplementation(async () => {
      callOrder.push('sleep');
    });

    await useCase.run(runParams());

    const sortedFirst = [sessionA, sessionB].sort()[0];
    const sortedSecond = [sessionA, sessionB].sort()[1];
    expect(callOrder).toEqual([
      `send:${sortedFirst}`,
      'sleep',
      `send:${sortedSecond}`,
    ]);
    expect(mockSleeper.sleep).toHaveBeenCalledTimes(1);
    expect(mockSleeper.sleep).toHaveBeenCalledWith(
      DEFAULT_NOTIFICATION_STAGGER_SECONDS * 1000,
    );
  });

  it('does not suppress errors raised while sending a notification', async () => {
    const sessionName = setupLiveMonitoredSession();
    mockSessionOutputActivityRepository.listSessionOutputActivities.mockResolvedValue(
      [
        {
          sessionName,
          lastOutputEpochSeconds:
            nowEpochSeconds - DEFAULT_MAIN_SILENT_THRESHOLD_SECONDS,
        },
      ],
    );
    mockNotificationRepository.sendSelfCheckNotification.mockRejectedValue(
      new Error('send-keys failed'),
    );

    await expect(useCase.run(runParams())).rejects.toThrow('send-keys failed');
  });
});
