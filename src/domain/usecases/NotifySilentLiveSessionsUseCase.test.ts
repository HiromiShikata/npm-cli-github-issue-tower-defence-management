import {
  NotifySilentLiveSessionsUseCase,
  HubTaskStatusResolver,
  parseHubTaskIssueUrlFromSessionName,
  DEFAULT_MAIN_SILENT_THRESHOLD_SECONDS,
  DEFAULT_SUBAGENT_SILENT_THRESHOLD_SECONDS,
  DEFAULT_SUBAGENT_RUNNING_THRESHOLD_SECONDS,
  DEFAULT_NOTIFICATION_COOLDOWN_SECONDS,
  DEFAULT_NOTIFICATION_STAGGER_SECONDS,
} from './NotifySilentLiveSessionsUseCase';
import { Issue } from '../entities/Issue';
import { LiveSessionProcessSnapshotProvider } from './adapter-interfaces/LiveSessionProcessSnapshotProvider';
import { InteractiveLiveSessionTranscriptResolver } from './adapter-interfaces/InteractiveLiveSessionTranscriptResolver';
import { SessionOutputActivityRepository } from './adapter-interfaces/SessionOutputActivityRepository';
import { SessionSubAgentActivityRepository } from './adapter-interfaces/SessionSubAgentActivityRepository';
import { OwnerCallStatusProvider } from './adapter-interfaces/OwnerCallStatusProvider';
import { SilentSessionNotificationRepository } from './adapter-interfaces/SilentSessionNotificationRepository';
import { SilentSessionMessageComposer } from './adapter-interfaces/SilentSessionMessageComposer';
import { Sleeper } from './adapter-interfaces/Sleeper';
import { SubAgentActivity } from '../entities/LiveSessionActivitySnapshot';
import { LiveSessionProcessSnapshot } from '../entities/LiveSessionProcessSnapshot';
import { InteractiveLiveSession } from '../entities/InteractiveLiveSession';

type Mocked<T> = jest.Mocked<T> & jest.MockedObject<T>;

const MAIN_STALLED_SECTION = 'MAIN_STALLED_SECTION';
const SUBAGENT_SECTION = 'SUBAGENT_SECTION';

describe('NotifySilentLiveSessionsUseCase', () => {
  let useCase: NotifySilentLiveSessionsUseCase;
  let mockSnapshotProvider: Mocked<LiveSessionProcessSnapshotProvider>;
  let mockTranscriptResolver: Mocked<InteractiveLiveSessionTranscriptResolver>;
  let mockSessionOutputActivityRepository: Mocked<SessionOutputActivityRepository>;
  let mockSubAgentActivityRepository: Mocked<SessionSubAgentActivityRepository>;
  let mockOwnerCallStatusProvider: Mocked<OwnerCallStatusProvider>;
  let mockNotificationRepository: Mocked<SilentSessionNotificationRepository>;
  let mockMessageComposer: Mocked<SilentSessionMessageComposer>;
  let mockSleeper: Mocked<Sleeper>;
  let mockHubTaskStatusResolver: Mocked<HubTaskStatusResolver>;
  const now = new Date('2026-06-26T00:00:00Z');
  const nowEpochSeconds = Math.floor(now.getTime() / 1000);

  const runParams = (
    overrides?: Partial<{ activeHubTaskStatus: string | null }>,
  ): {
    mainSilentThresholdSeconds: number;
    subAgentSilentThresholdSeconds: number;
    subAgentRunningThresholdSeconds: number;
    cooldownSeconds: number;
    staggerSeconds: number;
    activeHubTaskStatus: string | null;
    now: Date;
  } => ({
    mainSilentThresholdSeconds: DEFAULT_MAIN_SILENT_THRESHOLD_SECONDS,
    subAgentSilentThresholdSeconds: DEFAULT_SUBAGENT_SILENT_THRESHOLD_SECONDS,
    subAgentRunningThresholdSeconds: DEFAULT_SUBAGENT_RUNNING_THRESHOLD_SECONDS,
    cooldownSeconds: DEFAULT_NOTIFICATION_COOLDOWN_SECONDS,
    staggerSeconds: DEFAULT_NOTIFICATION_STAGGER_SECONDS,
    activeHubTaskStatus: null,
    now,
    ...overrides,
  });

  const emptySnapshot: LiveSessionProcessSnapshot = {
    sessions: [],
    processes: [],
  };

  const sessionFor = (sessionName: string): InteractiveLiveSession => ({
    sessionName,
    sessionId: `${sessionName}-uuid`,
    configDir: `/config/${sessionName}`,
  });

  // The use case derives interactive sessions from the snapshot via the embedded
  // pure resolver. To keep these tests focused on the orchestration, the
  // snapshot is shaped so that the pure resolver yields exactly the named
  // interactive sessions: one pane with a single claude child carrying a session
  // id and config directory.
  const snapshotWithSessions = (
    sessionNames: string[],
  ): LiveSessionProcessSnapshot => {
    const sessions = sessionNames.map((sessionName, index) => ({
      sessionName,
      panePids: [100 + index * 10],
    }));
    const processes = sessionNames.map((sessionName, index) => ({
      pid: 101 + index * 10,
      ppid: 100 + index * 10,
      commandLine: `claude --name ${sessionName}`,
      sessionId: `${sessionName}-uuid`,
      configDir: `/config/${sessionName}`,
    }));
    return { sessions, processes };
  };

  const transcriptMapFor = (sessionNames: string[]): Map<string, string> =>
    new Map(
      sessionNames.map((sessionName) => [
        sessionName,
        `/config/${sessionName}/projects/-home-user/${sessionName}-uuid.jsonl`,
      ]),
    );

  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    mockSnapshotProvider = {
      getSnapshot: jest.fn().mockResolvedValue(emptySnapshot),
    };
    mockTranscriptResolver = {
      resolveTranscriptPaths: jest.fn().mockReturnValue(new Map()),
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
    mockHubTaskStatusResolver = {
      getIssueByUrl: jest.fn().mockResolvedValue(null),
    };
    useCase = new NotifySilentLiveSessionsUseCase(
      mockSnapshotProvider,
      mockTranscriptResolver,
      mockSessionOutputActivityRepository,
      mockSubAgentActivityRepository,
      mockOwnerCallStatusProvider,
      mockNotificationRepository,
      mockMessageComposer,
      mockSleeper,
      mockHubTaskStatusResolver,
    );
  });

  const issueFor = (overrides: Partial<Issue>): Issue => ({
    nameWithOwner: 'HiromiShikata/repo',
    number: 42,
    title: 'Hub task',
    state: 'OPEN',
    status: 'In tmux',
    story: null,
    nextActionDate: null,
    nextActionHour: null,
    estimationMinutes: null,
    dependedIssueUrls: [],
    completionDate50PercentConfidence: null,
    url: 'https://github.com/HiromiShikata/repo/issues/42',
    assignees: [],
    labels: [],
    org: 'HiromiShikata',
    repo: 'repo',
    body: '',
    itemId: 'item-id',
    isPr: false,
    isInProgress: false,
    isClosed: false,
    createdAt: now,
    author: 'HiromiShikata',
    closingIssueReferenceUrls: [],
    ...overrides,
  });

  const setupSilentMainSession = (sessionName: string): void => {
    setupLiveInteractiveSession(sessionName);
    mockSessionOutputActivityRepository.listSessionOutputActivities.mockResolvedValue(
      [
        {
          sessionName,
          lastOutputEpochSeconds:
            nowEpochSeconds - DEFAULT_MAIN_SILENT_THRESHOLD_SECONDS,
        },
      ],
    );
  };

  const setupLiveInteractiveSession = (sessionName: string): void => {
    mockSnapshotProvider.getSnapshot.mockResolvedValue(
      snapshotWithSessions([sessionName]),
    );
    mockTranscriptResolver.resolveTranscriptPaths.mockReturnValue(
      transcriptMapFor([sessionName]),
    );
  };

  it('exposes the default thresholds as named constants', () => {
    expect(DEFAULT_MAIN_SILENT_THRESHOLD_SECONDS).toBe(600);
    expect(DEFAULT_SUBAGENT_SILENT_THRESHOLD_SECONDS).toBe(300);
    expect(DEFAULT_SUBAGENT_RUNNING_THRESHOLD_SECONDS).toBe(900);
    expect(DEFAULT_NOTIFICATION_COOLDOWN_SECONDS).toBe(30 * 60);
    expect(DEFAULT_NOTIFICATION_STAGGER_SECONDS).toBe(25);
  });

  it('notifies a plain-named live interactive session independently of any issue', async () => {
    setupLiveInteractiveSession('workbench');
    mockSessionOutputActivityRepository.listSessionOutputActivities.mockResolvedValue(
      [
        {
          sessionName: 'workbench',
          lastOutputEpochSeconds:
            nowEpochSeconds - DEFAULT_MAIN_SILENT_THRESHOLD_SECONDS,
        },
      ],
    );

    await useCase.run(runParams());

    expect(mockMessageComposer.composeMainStalledSection).toHaveBeenCalledWith(
      DEFAULT_MAIN_SILENT_THRESHOLD_SECONDS,
    );
    expect(
      mockNotificationRepository.sendSelfCheckNotification,
    ).toHaveBeenCalledWith('workbench', MAIN_STALLED_SECTION);
  });

  it('passes the resolved transcript paths to the output and owner-call providers', async () => {
    setupLiveInteractiveSession('workbench');

    await useCase.run(runParams());

    const expectedMap = transcriptMapFor(['workbench']);
    expect(
      mockSessionOutputActivityRepository.listSessionOutputActivities,
    ).toHaveBeenCalledWith(expectedMap);
    expect(
      mockOwnerCallStatusProvider.listSessionNamesWithUnansweredOwnerCall,
    ).toHaveBeenCalledWith(expectedMap);
    expect(
      mockSubAgentActivityRepository.listSubAgentActivitiesBySessionName,
    ).toHaveBeenCalledWith(['workbench']);
  });

  it('suppresses the stalled section and sends nothing when an owner call is pending past the threshold', async () => {
    setupLiveInteractiveSession('workbench');
    mockSessionOutputActivityRepository.listSessionOutputActivities.mockResolvedValue(
      [
        {
          sessionName: 'workbench',
          lastOutputEpochSeconds:
            nowEpochSeconds - DEFAULT_MAIN_SILENT_THRESHOLD_SECONDS,
        },
      ],
    );
    mockOwnerCallStatusProvider.listSessionNamesWithUnansweredOwnerCall.mockResolvedValue(
      new Set(['workbench']),
    );

    await useCase.run(runParams());

    expect(
      mockMessageComposer.composeMainStalledSection,
    ).not.toHaveBeenCalled();
    expect(
      mockNotificationRepository.sendSelfCheckNotification,
    ).not.toHaveBeenCalled();
  });

  it('sends the main stalled section when the session is silent past the threshold and not waiting on the owner', async () => {
    setupLiveInteractiveSession('workbench');
    mockSessionOutputActivityRepository.listSessionOutputActivities.mockResolvedValue(
      [
        {
          sessionName: 'workbench',
          lastOutputEpochSeconds:
            nowEpochSeconds - DEFAULT_MAIN_SILENT_THRESHOLD_SECONDS,
        },
      ],
    );
    mockOwnerCallStatusProvider.listSessionNamesWithUnansweredOwnerCall.mockResolvedValue(
      new Set<string>(),
    );

    await useCase.run(runParams());

    expect(mockMessageComposer.composeMainStalledSection).toHaveBeenCalledWith(
      DEFAULT_MAIN_SILENT_THRESHOLD_SECONDS,
    );
    expect(
      mockNotificationRepository.sendSelfCheckNotification,
    ).toHaveBeenCalledWith('workbench', MAIN_STALLED_SECTION);
  });

  it('does not send the main stalled section when output is within the threshold', async () => {
    setupLiveInteractiveSession('workbench');
    mockSessionOutputActivityRepository.listSessionOutputActivities.mockResolvedValue(
      [
        {
          sessionName: 'workbench',
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

  it('sends the sub-agent section when a sub-agent exceeds the silent threshold', async () => {
    setupLiveInteractiveSession('workbench');
    const subAgents: SubAgentActivity[] = [
      {
        label: 'sub-process-1',
        silentSeconds: DEFAULT_SUBAGENT_SILENT_THRESHOLD_SECONDS,
        runningSeconds: 60,
      },
    ];
    mockSubAgentActivityRepository.listSubAgentActivitiesBySessionName.mockResolvedValue(
      new Map([['workbench', subAgents]]),
    );

    await useCase.run(runParams());

    expect(mockMessageComposer.composeSubAgentSection).toHaveBeenCalledWith(
      subAgents,
    );
    expect(
      mockNotificationRepository.sendSelfCheckNotification,
    ).toHaveBeenCalledWith('workbench', SUBAGENT_SECTION);
  });

  it('excludes an owner-handover spawn from selection so no notification is sent', async () => {
    mockSnapshotProvider.getSnapshot.mockResolvedValue({
      sessions: [{ sessionName: 'aw-host', panePids: [100] }],
      processes: [
        {
          pid: 101,
          ppid: 100,
          commandLine:
            'claude --verbose -p Take ownership of https://example.com/issues/1 and finish it',
          sessionId: 'aw-uuid',
          configDir: '/config/aw',
        },
      ],
    });

    await useCase.run(runParams());

    expect(mockTranscriptResolver.resolveTranscriptPaths).toHaveBeenCalledWith(
      [],
    );
    expect(
      mockNotificationRepository.sendSelfCheckNotification,
    ).not.toHaveBeenCalled();
  });

  it('does nothing when there are no live interactive sessions', async () => {
    await useCase.run(runParams());

    expect(
      mockNotificationRepository.sendSelfCheckNotification,
    ).not.toHaveBeenCalled();
  });

  it('does not re-notify a session within the cooldown window', async () => {
    setupLiveInteractiveSession('workbench');
    mockSessionOutputActivityRepository.listSessionOutputActivities.mockResolvedValue(
      [
        {
          sessionName: 'workbench',
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
  });

  it('sends to multiple sessions sequentially with a stagger delay between sends', async () => {
    mockSnapshotProvider.getSnapshot.mockResolvedValue(
      snapshotWithSessions(['alpha', 'bravo']),
    );
    mockTranscriptResolver.resolveTranscriptPaths.mockReturnValue(
      transcriptMapFor(['alpha', 'bravo']),
    );
    mockSessionOutputActivityRepository.listSessionOutputActivities.mockResolvedValue(
      [
        {
          sessionName: 'alpha',
          lastOutputEpochSeconds:
            nowEpochSeconds - DEFAULT_MAIN_SILENT_THRESHOLD_SECONDS,
        },
        {
          sessionName: 'bravo',
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

    expect(callOrder).toEqual(['send:alpha', 'sleep', 'send:bravo']);
    expect(mockSleeper.sleep).toHaveBeenCalledTimes(1);
    expect(mockSleeper.sleep).toHaveBeenCalledWith(
      DEFAULT_NOTIFICATION_STAGGER_SECONDS * 1000,
    );
  });

  it('does not suppress errors raised while sending a notification', async () => {
    setupLiveInteractiveSession('workbench');
    mockSessionOutputActivityRepository.listSessionOutputActivities.mockResolvedValue(
      [
        {
          sessionName: 'workbench',
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

  describe('hub-task active-status pre-send gate', () => {
    const HUB_TASK_SESSION = 'https://github.com/HiromiShikata/repo/issues/42';
    const ACTIVE_STATUS = 'In tmux';

    it('sends when the hub task is open and in the active status', async () => {
      setupSilentMainSession(HUB_TASK_SESSION);
      mockHubTaskStatusResolver.getIssueByUrl.mockResolvedValue(
        issueFor({
          url: HUB_TASK_SESSION,
          state: 'OPEN',
          status: ACTIVE_STATUS,
        }),
      );

      await useCase.run(runParams({ activeHubTaskStatus: ACTIVE_STATUS }));

      expect(mockHubTaskStatusResolver.getIssueByUrl).toHaveBeenCalledWith(
        HUB_TASK_SESSION,
      );
      expect(
        mockNotificationRepository.sendSelfCheckNotification,
      ).toHaveBeenCalledWith(HUB_TASK_SESSION, MAIN_STALLED_SECTION);
    });

    it('skips when the hub task status differs from the active status', async () => {
      setupSilentMainSession(HUB_TASK_SESSION);
      mockHubTaskStatusResolver.getIssueByUrl.mockResolvedValue(
        issueFor({ url: HUB_TASK_SESSION, state: 'OPEN', status: 'Todo' }),
      );

      await useCase.run(runParams({ activeHubTaskStatus: ACTIVE_STATUS }));

      expect(
        mockNotificationRepository.sendSelfCheckNotification,
      ).not.toHaveBeenCalled();
    });

    it('skips when the hub task issue is closed', async () => {
      setupSilentMainSession(HUB_TASK_SESSION);
      mockHubTaskStatusResolver.getIssueByUrl.mockResolvedValue(
        issueFor({
          url: HUB_TASK_SESSION,
          state: 'CLOSED',
          status: ACTIVE_STATUS,
          isClosed: true,
        }),
      );

      await useCase.run(runParams({ activeHubTaskStatus: ACTIVE_STATUS }));

      expect(
        mockNotificationRepository.sendSelfCheckNotification,
      ).not.toHaveBeenCalled();
    });

    it('leaves a non-URL session name unchecked and sends as before', async () => {
      setupSilentMainSession('workbench');

      await useCase.run(runParams({ activeHubTaskStatus: ACTIVE_STATUS }));

      expect(mockHubTaskStatusResolver.getIssueByUrl).not.toHaveBeenCalled();
      expect(
        mockNotificationRepository.sendSelfCheckNotification,
      ).toHaveBeenCalledWith('workbench', MAIN_STALLED_SECTION);
    });

    it('does not call the resolver at all when the active status is unconfigured', async () => {
      setupSilentMainSession(HUB_TASK_SESSION);

      await useCase.run(runParams({ activeHubTaskStatus: null }));

      expect(mockHubTaskStatusResolver.getIssueByUrl).not.toHaveBeenCalled();
      expect(
        mockNotificationRepository.sendSelfCheckNotification,
      ).toHaveBeenCalledWith(HUB_TASK_SESSION, MAIN_STALLED_SECTION);
    });

    it('fails open and logs a warning when status resolution throws', async () => {
      setupSilentMainSession(HUB_TASK_SESSION);
      const warnSpy = jest
        .spyOn(console, 'warn')
        .mockImplementation(() => undefined);
      mockHubTaskStatusResolver.getIssueByUrl.mockRejectedValue(
        new Error('GitHub API timeout'),
      );

      await useCase.run(runParams({ activeHubTaskStatus: ACTIVE_STATUS }));

      expect(
        mockNotificationRepository.sendSelfCheckNotification,
      ).toHaveBeenCalledWith(HUB_TASK_SESSION, MAIN_STALLED_SECTION);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('fail-open'),
      );
      warnSpy.mockRestore();
    });

    it('fails open and logs a warning when the hub task cannot be resolved', async () => {
      setupSilentMainSession(HUB_TASK_SESSION);
      const warnSpy = jest
        .spyOn(console, 'warn')
        .mockImplementation(() => undefined);
      mockHubTaskStatusResolver.getIssueByUrl.mockResolvedValue(null);

      await useCase.run(runParams({ activeHubTaskStatus: ACTIVE_STATUS }));

      expect(
        mockNotificationRepository.sendSelfCheckNotification,
      ).toHaveBeenCalledWith(HUB_TASK_SESSION, MAIN_STALLED_SECTION);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('fail-open'),
      );
      warnSpy.mockRestore();
    });

    it('parses a github.com issue URL session name and rejects other names', () => {
      expect(parseHubTaskIssueUrlFromSessionName(HUB_TASK_SESSION)).toBe(
        HUB_TASK_SESSION,
      );
      expect(parseHubTaskIssueUrlFromSessionName('workbench')).toBeNull();
      expect(
        parseHubTaskIssueUrlFromSessionName(
          'https://github.com/HiromiShikata/repo/pull/42',
        ),
      ).toBeNull();
      expect(
        parseHubTaskIssueUrlFromSessionName(
          'https://example.com/HiromiShikata/repo/issues/42',
        ),
      ).toBeNull();
    });
  });

  it('uses the session entity helper for type completeness', () => {
    expect(sessionFor('workbench')).toEqual({
      sessionName: 'workbench',
      sessionId: 'workbench-uuid',
      configDir: '/config/workbench',
    });
  });
});
