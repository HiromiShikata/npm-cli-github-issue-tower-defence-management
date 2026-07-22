import {
  NotifySilentLiveSessionsUseCase,
  HubTaskStatusResolver,
  parseHubTaskIssueUrlFromSessionName,
  isGitHubIssueOrPullRequestSessionName,
  DEFAULT_MAIN_SILENT_THRESHOLD_SECONDS,
  DEFAULT_UNANSWERED_OWNER_CALL_GRACE_SECONDS,
  DEFAULT_SUBAGENT_SILENT_THRESHOLD_SECONDS,
  DEFAULT_SUBAGENT_RUNNING_THRESHOLD_SECONDS,
  DEFAULT_NOTIFICATION_STAGGER_SECONDS,
  DEFAULT_CANDIDATE_DEBOUNCE_RECENCY_WINDOW_SECONDS,
  DEFAULT_HUB_TASK_STATUS_CACHE_TTL_SECONDS,
} from './NotifySilentLiveSessionsUseCase';
import { Issue } from '../entities/Issue';
import { LiveSessionProcessSnapshotProvider } from './adapter-interfaces/LiveSessionProcessSnapshotProvider';
import { InteractiveLiveSessionTranscriptResolver } from './adapter-interfaces/InteractiveLiveSessionTranscriptResolver';
import { SessionOutputActivityRepository } from './adapter-interfaces/SessionOutputActivityRepository';
import { SessionSubAgentActivityRepository } from './adapter-interfaces/SessionSubAgentActivityRepository';
import { OwnerCallStatusProvider } from './adapter-interfaces/OwnerCallStatusProvider';
import { RefusalTailStatusProvider } from './adapter-interfaces/RefusalTailStatusProvider';
import { SilentSessionNotificationRepository } from './adapter-interfaces/SilentSessionNotificationRepository';
import { SilentSessionCandidateStateRepository } from './adapter-interfaces/SilentSessionCandidateStateRepository';
import { SilentSessionHubTaskStatusCacheRepository } from './adapter-interfaces/SilentSessionHubTaskStatusCacheRepository';
import { SilentSessionMessageComposer } from './adapter-interfaces/SilentSessionMessageComposer';
import { Sleeper } from './adapter-interfaces/Sleeper';
import { SubAgentActivity } from '../entities/LiveSessionActivitySnapshot';
import { LiveSessionProcessSnapshot } from '../entities/LiveSessionProcessSnapshot';
import { InteractiveLiveSession } from '../entities/InteractiveLiveSession';

type Mocked<T> = jest.Mocked<T> & jest.MockedObject<T>;

const MAIN_STALLED_SECTION = 'MAIN_STALLED_SECTION';
const MAIN_STALLED_STALE_OWNER_CALL_SECTION =
  'MAIN_STALLED_STALE_OWNER_CALL_SECTION';
const SUBAGENT_SECTION = 'SUBAGENT_SECTION';

class EveryNameRecentSet extends Set<string> {
  override has = (): boolean => true;
}

const everyNameRecentSet = (): Set<string> => new EveryNameRecentSet();

describe('NotifySilentLiveSessionsUseCase', () => {
  let useCase: NotifySilentLiveSessionsUseCase;
  let mockSnapshotProvider: Mocked<LiveSessionProcessSnapshotProvider>;
  let mockTranscriptResolver: Mocked<InteractiveLiveSessionTranscriptResolver>;
  let mockSessionOutputActivityRepository: Mocked<SessionOutputActivityRepository>;
  let mockSubAgentActivityRepository: Mocked<SessionSubAgentActivityRepository>;
  let mockOwnerCallStatusProvider: Mocked<OwnerCallStatusProvider>;
  let mockNotificationRepository: Mocked<SilentSessionNotificationRepository>;
  let mockCandidateStateRepository: Mocked<SilentSessionCandidateStateRepository>;
  let mockMessageComposer: Mocked<SilentSessionMessageComposer>;
  let mockSleeper: Mocked<Sleeper>;
  let mockHubTaskStatusResolver: Mocked<HubTaskStatusResolver>;
  let mockHubTaskStatusCacheRepository: Mocked<SilentSessionHubTaskStatusCacheRepository>;
  let mockRefusalTailStatusProvider: Mocked<RefusalTailStatusProvider>;
  const now = new Date('2026-06-26T00:00:00Z');
  const nowEpochSeconds = Math.floor(now.getTime() / 1000);
  const GITHUB_SESSION = 'https_//github_com/HiromiShikata/repo/issues/42';
  const GITHUB_SESSION_ALPHA =
    'https_//github_com/HiromiShikata/repo/issues/100';
  const GITHUB_SESSION_BRAVO =
    'https_//github_com/HiromiShikata/repo/issues/200';

  const runParams = (
    overrides?: Partial<{
      activeHubTaskStatus: string | null;
      candidateDebounceRecencyWindowSeconds: number;
      hubTaskStatusCacheTtlSeconds: number;
      now: Date;
    }>,
  ): {
    mainSilentThresholdSeconds: number;
    unansweredOwnerCallGraceSeconds: number;
    subAgentSilentThresholdSeconds: number;
    subAgentRunningThresholdSeconds: number;
    staggerSeconds: number;
    candidateDebounceRecencyWindowSeconds: number;
    activeHubTaskStatus: string | null;
    hubTaskStatusCacheTtlSeconds: number;
    now: Date;
  } => ({
    mainSilentThresholdSeconds: DEFAULT_MAIN_SILENT_THRESHOLD_SECONDS,
    unansweredOwnerCallGraceSeconds:
      DEFAULT_UNANSWERED_OWNER_CALL_GRACE_SECONDS,
    subAgentSilentThresholdSeconds: DEFAULT_SUBAGENT_SILENT_THRESHOLD_SECONDS,
    subAgentRunningThresholdSeconds: DEFAULT_SUBAGENT_RUNNING_THRESHOLD_SECONDS,
    staggerSeconds: DEFAULT_NOTIFICATION_STAGGER_SECONDS,
    candidateDebounceRecencyWindowSeconds:
      DEFAULT_CANDIDATE_DEBOUNCE_RECENCY_WINDOW_SECONDS,
    activeHubTaskStatus: null,
    hubTaskStatusCacheTtlSeconds: DEFAULT_HUB_TASK_STATUS_CACHE_TTL_SECONDS,
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
    candidateSessionIds: [`${sessionName}-uuid`],
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
      currentSessionId: `${sessionName}-uuid`,
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
      listUnansweredOwnerCallEpochSecondsBySessionName: jest
        .fn()
        .mockResolvedValue(new Map<string, number>()),
    };
    mockNotificationRepository = {
      sendSelfCheckNotification: jest.fn().mockResolvedValue(undefined),
    };
    mockCandidateStateRepository = {
      loadRecentCandidateSessionNames: jest
        .fn()
        .mockResolvedValue(everyNameRecentSet()),
      saveCandidateSessionNames: jest.fn().mockResolvedValue(undefined),
    };
    mockMessageComposer = {
      composeMainStalledSection: jest
        .fn()
        .mockReturnValue(MAIN_STALLED_SECTION),
      composeMainStalledWithStaleOwnerCallSection: jest
        .fn()
        .mockReturnValue(MAIN_STALLED_STALE_OWNER_CALL_SECTION),
      composeSubAgentSection: jest.fn().mockReturnValue(SUBAGENT_SECTION),
    };
    mockSleeper = {
      sleep: jest.fn().mockResolvedValue(undefined),
    };
    mockHubTaskStatusResolver = {
      getIssueByUrl: jest.fn().mockResolvedValue(null),
    };
    mockHubTaskStatusCacheRepository = {
      loadHubTaskStatus: jest.fn().mockResolvedValue(null),
      saveHubTaskStatus: jest.fn().mockResolvedValue(undefined),
    };
    mockRefusalTailStatusProvider = {
      listRefusalTailedSessionNames: jest
        .fn()
        .mockResolvedValue(new Set<string>()),
    };
    useCase = new NotifySilentLiveSessionsUseCase(
      mockSnapshotProvider,
      mockTranscriptResolver,
      mockSessionOutputActivityRepository,
      mockSubAgentActivityRepository,
      mockOwnerCallStatusProvider,
      mockNotificationRepository,
      mockCandidateStateRepository,
      mockMessageComposer,
      mockSleeper,
      mockHubTaskStatusResolver,
      mockHubTaskStatusCacheRepository,
      mockRefusalTailStatusProvider,
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
          hasInProgressToolCall: false,
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
    expect(DEFAULT_UNANSWERED_OWNER_CALL_GRACE_SECONDS).toBe(3600);
    expect(DEFAULT_SUBAGENT_SILENT_THRESHOLD_SECONDS).toBe(300);
    expect(DEFAULT_SUBAGENT_RUNNING_THRESHOLD_SECONDS).toBe(900);
    expect(DEFAULT_NOTIFICATION_STAGGER_SECONDS).toBe(25);
  });

  it('notifies a session whose name encodes a github.com issue URL', async () => {
    setupLiveInteractiveSession(GITHUB_SESSION);
    mockSessionOutputActivityRepository.listSessionOutputActivities.mockResolvedValue(
      [
        {
          sessionName: GITHUB_SESSION,
          lastOutputEpochSeconds:
            nowEpochSeconds - DEFAULT_MAIN_SILENT_THRESHOLD_SECONDS,
          hasInProgressToolCall: false,
        },
      ],
    );

    await useCase.run(runParams());

    expect(mockMessageComposer.composeMainStalledSection).toHaveBeenCalledWith(
      DEFAULT_MAIN_SILENT_THRESHOLD_SECONDS,
    );
    expect(
      mockNotificationRepository.sendSelfCheckNotification,
    ).toHaveBeenCalledWith(GITHUB_SESSION, MAIN_STALLED_SECTION);
  });

  it('notifies a session whose name encodes a github.com pull-request URL', async () => {
    const pullRequestSession = 'https_//github_com/HiromiShikata/repo/pull/77';
    setupLiveInteractiveSession(pullRequestSession);
    mockSessionOutputActivityRepository.listSessionOutputActivities.mockResolvedValue(
      [
        {
          sessionName: pullRequestSession,
          lastOutputEpochSeconds:
            nowEpochSeconds - DEFAULT_MAIN_SILENT_THRESHOLD_SECONDS,
          hasInProgressToolCall: false,
        },
      ],
    );

    await useCase.run(runParams());

    expect(
      mockNotificationRepository.sendSelfCheckNotification,
    ).toHaveBeenCalledWith(pullRequestSession, MAIN_STALLED_SECTION);
  });

  it('excludes a non-github-named session from selection so it is never notified', async () => {
    mockSnapshotProvider.getSnapshot.mockResolvedValue(
      snapshotWithSessions(['workbench']),
    );
    mockSessionOutputActivityRepository.listSessionOutputActivities.mockResolvedValue(
      [
        {
          sessionName: 'workbench',
          lastOutputEpochSeconds:
            nowEpochSeconds - DEFAULT_MAIN_SILENT_THRESHOLD_SECONDS,
          hasInProgressToolCall: false,
        },
      ],
    );

    await useCase.run(runParams());

    expect(mockTranscriptResolver.resolveTranscriptPaths).toHaveBeenCalledWith(
      [],
    );
    expect(
      mockSubAgentActivityRepository.listSubAgentActivitiesBySessionName,
    ).toHaveBeenCalledWith([], new Map());
    expect(
      mockMessageComposer.composeMainStalledSection,
    ).not.toHaveBeenCalled();
    expect(
      mockNotificationRepository.sendSelfCheckNotification,
    ).not.toHaveBeenCalled();
  });

  it('monitors only the github-named session when mixed with a non-github-named session', async () => {
    mockSnapshotProvider.getSnapshot.mockResolvedValue(
      snapshotWithSessions([GITHUB_SESSION, 'orchestrator']),
    );
    mockTranscriptResolver.resolveTranscriptPaths.mockReturnValue(
      transcriptMapFor([GITHUB_SESSION]),
    );
    mockSessionOutputActivityRepository.listSessionOutputActivities.mockResolvedValue(
      [
        {
          sessionName: GITHUB_SESSION,
          lastOutputEpochSeconds:
            nowEpochSeconds - DEFAULT_MAIN_SILENT_THRESHOLD_SECONDS,
          hasInProgressToolCall: false,
        },
        {
          sessionName: 'orchestrator',
          lastOutputEpochSeconds:
            nowEpochSeconds - DEFAULT_MAIN_SILENT_THRESHOLD_SECONDS,
          hasInProgressToolCall: false,
        },
      ],
    );

    await useCase.run(runParams());

    expect(mockTranscriptResolver.resolveTranscriptPaths).toHaveBeenCalledWith([
      sessionFor(GITHUB_SESSION),
    ]);
    expect(
      mockNotificationRepository.sendSelfCheckNotification,
    ).toHaveBeenCalledTimes(1);
    expect(
      mockNotificationRepository.sendSelfCheckNotification,
    ).toHaveBeenCalledWith(GITHUB_SESSION, MAIN_STALLED_SECTION);
  });

  it('passes the resolved transcript paths to the output and owner-call providers', async () => {
    setupLiveInteractiveSession(GITHUB_SESSION);

    await useCase.run(runParams());

    const expectedMap = transcriptMapFor([GITHUB_SESSION]);
    expect(
      mockSessionOutputActivityRepository.listSessionOutputActivities,
    ).toHaveBeenCalledWith(expectedMap);
    expect(
      mockOwnerCallStatusProvider.listUnansweredOwnerCallEpochSecondsBySessionName,
    ).toHaveBeenCalledWith(expectedMap);
    expect(
      mockSubAgentActivityRepository.listSubAgentActivitiesBySessionName,
    ).toHaveBeenCalledWith([GITHUB_SESSION], expectedMap);
  });

  it('suppresses the stalled section and sends nothing while the latest owner call is unanswered', async () => {
    setupSilentMainSession(GITHUB_SESSION);
    mockOwnerCallStatusProvider.listUnansweredOwnerCallEpochSecondsBySessionName.mockResolvedValue(
      new Map([
        [
          GITHUB_SESSION,
          nowEpochSeconds - DEFAULT_UNANSWERED_OWNER_CALL_GRACE_SECONDS + 1,
        ],
      ]),
    );

    await useCase.run(runParams());

    expect(
      mockMessageComposer.composeMainStalledSection,
    ).not.toHaveBeenCalled();
    expect(
      mockMessageComposer.composeMainStalledWithStaleOwnerCallSection,
    ).not.toHaveBeenCalled();
    expect(
      mockNotificationRepository.sendSelfCheckNotification,
    ).not.toHaveBeenCalled();
  });

  it('suppresses the reminder even when the unanswered owner call is far older than the former grace period (10 hours)', async () => {
    setupSilentMainSession(GITHUB_SESSION);
    mockOwnerCallStatusProvider.listUnansweredOwnerCallEpochSecondsBySessionName.mockResolvedValue(
      new Map([[GITHUB_SESSION, nowEpochSeconds - 10 * 60 * 60]]),
    );

    await useCase.run(runParams());

    expect(
      mockMessageComposer.composeMainStalledWithStaleOwnerCallSection,
    ).not.toHaveBeenCalled();
    expect(
      mockMessageComposer.composeMainStalledSection,
    ).not.toHaveBeenCalled();
    expect(
      mockNotificationRepository.sendSelfCheckNotification,
    ).not.toHaveBeenCalled();
    expect(
      mockCandidateStateRepository.saveCandidateSessionNames,
    ).toHaveBeenCalledWith({
      sessionNames: [],
      now,
    });
  });

  it('suppresses the reminder at exactly the former grace-period age instead of firing the stale-owner-call section', async () => {
    setupSilentMainSession(GITHUB_SESSION);
    mockOwnerCallStatusProvider.listUnansweredOwnerCallEpochSecondsBySessionName.mockResolvedValue(
      new Map([
        [
          GITHUB_SESSION,
          nowEpochSeconds - DEFAULT_UNANSWERED_OWNER_CALL_GRACE_SECONDS,
        ],
      ]),
    );

    await useCase.run(runParams());

    expect(
      mockMessageComposer.composeMainStalledWithStaleOwnerCallSection,
    ).not.toHaveBeenCalled();
    expect(
      mockMessageComposer.composeMainStalledSection,
    ).not.toHaveBeenCalled();
    expect(
      mockNotificationRepository.sendSelfCheckNotification,
    ).not.toHaveBeenCalled();
  });

  it('does not send anything when the owner call is old and the main output is not silent past the threshold', async () => {
    setupLiveInteractiveSession(GITHUB_SESSION);
    mockSessionOutputActivityRepository.listSessionOutputActivities.mockResolvedValue(
      [
        {
          sessionName: GITHUB_SESSION,
          lastOutputEpochSeconds:
            nowEpochSeconds - DEFAULT_MAIN_SILENT_THRESHOLD_SECONDS + 1,
          hasInProgressToolCall: false,
        },
      ],
    );
    mockOwnerCallStatusProvider.listUnansweredOwnerCallEpochSecondsBySessionName.mockResolvedValue(
      new Map([
        [
          GITHUB_SESSION,
          nowEpochSeconds - DEFAULT_UNANSWERED_OWNER_CALL_GRACE_SECONDS,
        ],
      ]),
    );

    await useCase.run(runParams());

    expect(
      mockNotificationRepository.sendSelfCheckNotification,
    ).not.toHaveBeenCalled();
  });

  it('sends the main stalled section when the session is silent past the threshold and not waiting on the owner', async () => {
    setupLiveInteractiveSession(GITHUB_SESSION);
    mockSessionOutputActivityRepository.listSessionOutputActivities.mockResolvedValue(
      [
        {
          sessionName: GITHUB_SESSION,
          lastOutputEpochSeconds:
            nowEpochSeconds - DEFAULT_MAIN_SILENT_THRESHOLD_SECONDS,
          hasInProgressToolCall: false,
        },
      ],
    );
    mockOwnerCallStatusProvider.listUnansweredOwnerCallEpochSecondsBySessionName.mockResolvedValue(
      new Map<string, number>(),
    );

    await useCase.run(runParams());

    expect(mockMessageComposer.composeMainStalledSection).toHaveBeenCalledWith(
      DEFAULT_MAIN_SILENT_THRESHOLD_SECONDS,
    );
    expect(
      mockMessageComposer.composeMainStalledWithStaleOwnerCallSection,
    ).not.toHaveBeenCalled();
    expect(
      mockNotificationRepository.sendSelfCheckNotification,
    ).toHaveBeenCalledWith(GITHUB_SESSION, MAIN_STALLED_SECTION);
  });

  it('does not send the main stalled section when the session is silent past the threshold but is waiting on a running tool call', async () => {
    setupLiveInteractiveSession(GITHUB_SESSION);
    mockSessionOutputActivityRepository.listSessionOutputActivities.mockResolvedValue(
      [
        {
          sessionName: GITHUB_SESSION,
          lastOutputEpochSeconds:
            nowEpochSeconds - DEFAULT_MAIN_SILENT_THRESHOLD_SECONDS,
          hasInProgressToolCall: true,
        },
      ],
    );
    mockOwnerCallStatusProvider.listUnansweredOwnerCallEpochSecondsBySessionName.mockResolvedValue(
      new Map<string, number>(),
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
    setupLiveInteractiveSession(GITHUB_SESSION);
    mockSessionOutputActivityRepository.listSessionOutputActivities.mockResolvedValue(
      [
        {
          sessionName: GITHUB_SESSION,
          lastOutputEpochSeconds:
            nowEpochSeconds - DEFAULT_MAIN_SILENT_THRESHOLD_SECONDS + 1,
          hasInProgressToolCall: false,
        },
      ],
    );

    await useCase.run(runParams());

    expect(
      mockNotificationRepository.sendSelfCheckNotification,
    ).not.toHaveBeenCalled();
  });

  it('sends the sub-agent section when a sub-agent exceeds the silent threshold', async () => {
    setupLiveInteractiveSession(GITHUB_SESSION);
    const subAgents: SubAgentActivity[] = [
      {
        label: 'sub-process-1',
        silentSeconds: DEFAULT_SUBAGENT_SILENT_THRESHOLD_SECONDS,
        runningSeconds: 60,
        waitingOnExternalProcess: false,
      },
    ];
    mockSubAgentActivityRepository.listSubAgentActivitiesBySessionName.mockResolvedValue(
      new Map([[GITHUB_SESSION, subAgents]]),
    );

    await useCase.run(runParams());

    expect(mockMessageComposer.composeSubAgentSection).toHaveBeenCalledWith({
      idleSubAgents: subAgents,
      longRunningSubAgents: [],
    });
    expect(
      mockNotificationRepository.sendSelfCheckNotification,
    ).toHaveBeenCalledWith(GITHUB_SESSION, SUBAGENT_SECTION);
  });

  it('applies a configured running threshold when selecting long-running sub-agents', async () => {
    setupLiveInteractiveSession(GITHUB_SESSION);
    const subAgents: SubAgentActivity[] = [
      {
        label: 'sub-process-1',
        silentSeconds: DEFAULT_SUBAGENT_SILENT_THRESHOLD_SECONDS,
        runningSeconds: 600,
        waitingOnExternalProcess: false,
      },
    ];
    mockSubAgentActivityRepository.listSubAgentActivitiesBySessionName.mockResolvedValue(
      new Map([[GITHUB_SESSION, subAgents]]),
    );

    await useCase.run({
      ...runParams(),
      subAgentRunningThresholdSeconds: 600,
    });

    expect(mockMessageComposer.composeSubAgentSection).toHaveBeenCalledWith({
      idleSubAgents: subAgents,
      longRunningSubAgents: subAgents,
    });
  });

  it('suppresses the long-running section for a sub-agent that produced output recently even past the running threshold', async () => {
    setupLiveInteractiveSession(GITHUB_SESSION);
    const subAgents: SubAgentActivity[] = [
      {
        label: 'sub-process-1',
        silentSeconds: 10,
        runningSeconds: DEFAULT_SUBAGENT_RUNNING_THRESHOLD_SECONDS,
        waitingOnExternalProcess: false,
      },
    ];
    mockSubAgentActivityRepository.listSubAgentActivitiesBySessionName.mockResolvedValue(
      new Map([[GITHUB_SESSION, subAgents]]),
    );

    await useCase.run(runParams());

    expect(mockMessageComposer.composeSubAgentSection).not.toHaveBeenCalled();
    expect(
      mockNotificationRepository.sendSelfCheckNotification,
    ).not.toHaveBeenCalled();
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
          currentSessionId: 'aw-uuid',
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

  it('re-notifies a persistent stall on every cycle once it has been a candidate in the previous cycle', async () => {
    setupLiveInteractiveSession(GITHUB_SESSION);
    mockSessionOutputActivityRepository.listSessionOutputActivities.mockResolvedValue(
      [
        {
          sessionName: GITHUB_SESSION,
          lastOutputEpochSeconds:
            nowEpochSeconds - DEFAULT_MAIN_SILENT_THRESHOLD_SECONDS,
          hasInProgressToolCall: false,
        },
      ],
    );

    await useCase.run(runParams());
    await useCase.run(runParams());

    expect(
      mockNotificationRepository.sendSelfCheckNotification,
    ).toHaveBeenCalledTimes(2);
    expect(
      mockNotificationRepository.sendSelfCheckNotification,
    ).toHaveBeenNthCalledWith(1, GITHUB_SESSION, MAIN_STALLED_SECTION);
    expect(
      mockNotificationRepository.sendSelfCheckNotification,
    ).toHaveBeenNthCalledWith(2, GITHUB_SESSION, MAIN_STALLED_SECTION);
  });

  describe('two-consecutive-cycle debounce', () => {
    const setupSilentGithubSession = (): void => {
      setupLiveInteractiveSession(GITHUB_SESSION);
      mockSessionOutputActivityRepository.listSessionOutputActivities.mockResolvedValue(
        [
          {
            sessionName: GITHUB_SESSION,
            lastOutputEpochSeconds:
              nowEpochSeconds - DEFAULT_MAIN_SILENT_THRESHOLD_SECONDS,
            hasInProgressToolCall: false,
          },
        ],
      );
    };

    it('does not notify a session that is a candidate in only one cycle', async () => {
      setupSilentGithubSession();
      mockCandidateStateRepository.loadRecentCandidateSessionNames.mockResolvedValue(
        new Set<string>(),
      );

      await useCase.run(runParams());

      expect(
        mockNotificationRepository.sendSelfCheckNotification,
      ).not.toHaveBeenCalled();
    });

    it('records the current candidate set so a first-cycle candidate is remembered for the next cycle', async () => {
      setupSilentGithubSession();
      mockCandidateStateRepository.loadRecentCandidateSessionNames.mockResolvedValue(
        new Set<string>(),
      );

      await useCase.run(runParams());

      expect(
        mockCandidateStateRepository.saveCandidateSessionNames,
      ).toHaveBeenCalledWith({ sessionNames: [GITHUB_SESSION], now });
    });

    it('notifies a session that is a candidate in two consecutive cycles on the second cycle', async () => {
      setupSilentGithubSession();
      const previousCandidates = new Set<string>();
      mockCandidateStateRepository.loadRecentCandidateSessionNames.mockImplementation(
        async () => new Set(previousCandidates),
      );
      mockCandidateStateRepository.saveCandidateSessionNames.mockImplementation(
        async ({ sessionNames }) => {
          previousCandidates.clear();
          for (const sessionName of sessionNames) {
            previousCandidates.add(sessionName);
          }
        },
      );

      await useCase.run(runParams());
      expect(
        mockNotificationRepository.sendSelfCheckNotification,
      ).not.toHaveBeenCalled();

      await useCase.run(runParams());
      expect(
        mockNotificationRepository.sendSelfCheckNotification,
      ).toHaveBeenCalledTimes(1);
      expect(
        mockNotificationRepository.sendSelfCheckNotification,
      ).toHaveBeenCalledWith(GITHUB_SESSION, MAIN_STALLED_SECTION);
    });

    it('suppresses the owner-reply-race candidate that was not a candidate in the previous cycle', async () => {
      setupSilentGithubSession();
      mockCandidateStateRepository.loadRecentCandidateSessionNames.mockResolvedValue(
        new Set<string>(),
      );

      await useCase.run(runParams());

      expect(
        mockNotificationRepository.sendSelfCheckNotification,
      ).not.toHaveBeenCalled();
      expect(
        mockMessageComposer.composeMainStalledSection,
      ).toHaveBeenCalledWith(DEFAULT_MAIN_SILENT_THRESHOLD_SECONDS);
    });

    it('loads the previous candidate set using the configured recency window', async () => {
      setupSilentGithubSession();

      await useCase.run(
        runParams({ candidateDebounceRecencyWindowSeconds: 900 }),
      );

      expect(
        mockCandidateStateRepository.loadRecentCandidateSessionNames,
      ).toHaveBeenCalledWith({ now, recencyWindowSeconds: 900 });
    });
  });

  describe('sub-agent state-based reminder judgment', () => {
    const hungSubAgent = (label: string): SubAgentActivity => ({
      label,
      silentSeconds: DEFAULT_SUBAGENT_SILENT_THRESHOLD_SECONDS,
      runningSeconds: 60,
      waitingOnExternalProcess: false,
    });
    const waitingSubAgent = (label: string): SubAgentActivity => ({
      label,
      silentSeconds: DEFAULT_SUBAGENT_SILENT_THRESHOLD_SECONDS,
      runningSeconds: 60,
      waitingOnExternalProcess: true,
    });
    const quietLongRunningSubAgent = (
      label: string,
      waitingOnExternalProcess: boolean,
    ): SubAgentActivity => ({
      label,
      silentSeconds: DEFAULT_SUBAGENT_SILENT_THRESHOLD_SECONDS,
      runningSeconds: DEFAULT_SUBAGENT_RUNNING_THRESHOLD_SECONDS,
      waitingOnExternalProcess,
    });
    const producingLongRunningSubAgent = (label: string): SubAgentActivity => ({
      label,
      silentSeconds: 30,
      runningSeconds: DEFAULT_SUBAGENT_RUNNING_THRESHOLD_SECONDS,
      waitingOnExternalProcess: false,
    });

    const setupSubAgents = (subAgents: SubAgentActivity[]): void => {
      setupLiveInteractiveSession(GITHUB_SESSION);
      mockSubAgentActivityRepository.listSubAgentActivitiesBySessionName.mockResolvedValue(
        new Map([[GITHUB_SESSION, subAgents]]),
      );
    };

    it('never selects a waiting sub-agent as a silent-reminder candidate', async () => {
      setupSubAgents([waitingSubAgent('sub-process-1')]);

      await useCase.run(runParams());

      expect(mockMessageComposer.composeSubAgentSection).not.toHaveBeenCalled();
      expect(
        mockNotificationRepository.sendSelfCheckNotification,
      ).not.toHaveBeenCalled();
    });

    it('notifies a hung sub-agent whose in-flight tool has no live process', async () => {
      setupSubAgents([hungSubAgent('sub-process-1')]);

      await useCase.run(runParams());

      expect(mockMessageComposer.composeSubAgentSection).toHaveBeenCalledWith({
        idleSubAgents: [hungSubAgent('sub-process-1')],
        longRunningSubAgents: [],
      });
      expect(
        mockNotificationRepository.sendSelfCheckNotification,
      ).toHaveBeenCalledWith(GITHUB_SESSION, SUBAGENT_SECTION);
    });

    it('keeps notifying a hung sub-agent on every cycle while the condition holds', async () => {
      setupSubAgents([hungSubAgent('sub-process-1')]);

      await useCase.run(runParams());
      await useCase.run(runParams());

      expect(
        mockNotificationRepository.sendSelfCheckNotification,
      ).toHaveBeenCalledTimes(2);
    });

    it('never selects a waiting sub-agent for the long-running section even when quiet past both thresholds', async () => {
      setupSubAgents([quietLongRunningSubAgent('sub-process-1', true)]);

      await useCase.run(runParams());

      expect(mockMessageComposer.composeSubAgentSection).not.toHaveBeenCalled();
      expect(
        mockNotificationRepository.sendSelfCheckNotification,
      ).not.toHaveBeenCalled();
    });

    it('never selects a long-running sub-agent that produced output within the silent threshold', async () => {
      setupSubAgents([producingLongRunningSubAgent('sub-process-1')]);

      await useCase.run(runParams());

      expect(mockMessageComposer.composeSubAgentSection).not.toHaveBeenCalled();
      expect(
        mockNotificationRepository.sendSelfCheckNotification,
      ).not.toHaveBeenCalled();
    });

    it('includes a quiet long-running sub-agent in both the idle and long-running sections', async () => {
      setupSubAgents([quietLongRunningSubAgent('sub-process-1', false)]);

      await useCase.run(runParams());

      expect(mockMessageComposer.composeSubAgentSection).toHaveBeenCalledWith({
        idleSubAgents: [quietLongRunningSubAgent('sub-process-1', false)],
        longRunningSubAgents: [
          quietLongRunningSubAgent('sub-process-1', false),
        ],
      });
      expect(
        mockNotificationRepository.sendSelfCheckNotification,
      ).toHaveBeenCalledWith(GITHUB_SESSION, SUBAGENT_SECTION);
    });

    it('keeps notifying a quiet long-running sub-agent on every cycle while the condition holds', async () => {
      setupSubAgents([quietLongRunningSubAgent('sub-process-1', false)]);

      await useCase.run(runParams());
      await useCase.run(runParams());

      expect(
        mockNotificationRepository.sendSelfCheckNotification,
      ).toHaveBeenCalledTimes(2);
      expect(
        mockMessageComposer.composeSubAgentSection,
      ).toHaveBeenNthCalledWith(2, {
        idleSubAgents: [quietLongRunningSubAgent('sub-process-1', false)],
        longRunningSubAgents: [
          quietLongRunningSubAgent('sub-process-1', false),
        ],
      });
    });

    it('defers a first-cycle long-running candidate until it persists into the next cycle', async () => {
      setupSubAgents([quietLongRunningSubAgent('sub-process-1', false)]);
      mockCandidateStateRepository.loadRecentCandidateSessionNames.mockResolvedValue(
        new Set<string>(),
      );

      await useCase.run(runParams());

      expect(
        mockNotificationRepository.sendSelfCheckNotification,
      ).not.toHaveBeenCalled();
      expect(
        mockCandidateStateRepository.saveCandidateSessionNames,
      ).toHaveBeenCalledWith({ sessionNames: [GITHUB_SESSION], now });
    });

    it('stops notifying once the long-running sub-agent drops out of the activity snapshot', async () => {
      setupSubAgents([quietLongRunningSubAgent('sub-process-1', false)]);

      await useCase.run(runParams());
      expect(
        mockNotificationRepository.sendSelfCheckNotification,
      ).toHaveBeenCalledTimes(1);

      mockSubAgentActivityRepository.listSubAgentActivitiesBySessionName.mockResolvedValue(
        new Map<string, SubAgentActivity[]>(),
      );
      await useCase.run(runParams());

      expect(
        mockNotificationRepository.sendSelfCheckNotification,
      ).toHaveBeenCalledTimes(1);
    });
  });

  it('sends to multiple sessions sequentially with a stagger delay between sends', async () => {
    mockSnapshotProvider.getSnapshot.mockResolvedValue(
      snapshotWithSessions([GITHUB_SESSION_ALPHA, GITHUB_SESSION_BRAVO]),
    );
    mockTranscriptResolver.resolveTranscriptPaths.mockReturnValue(
      transcriptMapFor([GITHUB_SESSION_ALPHA, GITHUB_SESSION_BRAVO]),
    );
    mockSessionOutputActivityRepository.listSessionOutputActivities.mockResolvedValue(
      [
        {
          sessionName: GITHUB_SESSION_ALPHA,
          lastOutputEpochSeconds:
            nowEpochSeconds - DEFAULT_MAIN_SILENT_THRESHOLD_SECONDS,
          hasInProgressToolCall: false,
        },
        {
          sessionName: GITHUB_SESSION_BRAVO,
          lastOutputEpochSeconds:
            nowEpochSeconds - DEFAULT_MAIN_SILENT_THRESHOLD_SECONDS,
          hasInProgressToolCall: false,
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

    expect(callOrder).toEqual([
      `send:${GITHUB_SESSION_ALPHA}`,
      'sleep',
      `send:${GITHUB_SESSION_BRAVO}`,
    ]);
    expect(mockSleeper.sleep).toHaveBeenCalledTimes(1);
    expect(mockSleeper.sleep).toHaveBeenCalledWith(
      DEFAULT_NOTIFICATION_STAGGER_SECONDS * 1000,
    );
  });

  it('does not suppress errors raised while sending a notification', async () => {
    setupLiveInteractiveSession(GITHUB_SESSION);
    mockSessionOutputActivityRepository.listSessionOutputActivities.mockResolvedValue(
      [
        {
          sessionName: GITHUB_SESSION,
          lastOutputEpochSeconds:
            nowEpochSeconds - DEFAULT_MAIN_SILENT_THRESHOLD_SECONDS,
          hasInProgressToolCall: false,
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

    it('excludes a non-github-named session before the hub-task gate so the resolver is never consulted', async () => {
      setupSilentMainSession('workbench');

      await useCase.run(runParams({ activeHubTaskStatus: ACTIVE_STATUS }));

      expect(mockHubTaskStatusResolver.getIssueByUrl).not.toHaveBeenCalled();
      expect(
        mockNotificationRepository.sendSelfCheckNotification,
      ).not.toHaveBeenCalled();
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

    it('fails open with a distinct no-cache warning when the hub task is not a resolvable tracked task and no cached status exists', async () => {
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
        expect.stringContaining('no cached status'),
      );
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('fail-open'),
      );
      warnSpy.mockRestore();
    });

    it('gates on the real tmux session-name form by resolving its canonical issue URL', async () => {
      const REAL_TMUX_SESSION =
        'https_//github_com/HiromiShikata/repo/issues/2355';
      const CANONICAL_ISSUE_URL =
        'https://github.com/HiromiShikata/repo/issues/2355';
      setupSilentMainSession(REAL_TMUX_SESSION);
      mockHubTaskStatusResolver.getIssueByUrl.mockResolvedValue(
        issueFor({
          url: CANONICAL_ISSUE_URL,
          state: 'OPEN',
          status: ACTIVE_STATUS,
        }),
      );

      await useCase.run(runParams({ activeHubTaskStatus: ACTIVE_STATUS }));

      expect(mockHubTaskStatusResolver.getIssueByUrl).toHaveBeenCalledWith(
        CANONICAL_ISSUE_URL,
      );
      expect(
        mockNotificationRepository.sendSelfCheckNotification,
      ).toHaveBeenCalledWith(REAL_TMUX_SESSION, MAIN_STALLED_SECTION);
    });

    it('skips the real tmux session-name form when its canonical hub task is no longer active', async () => {
      const REAL_TMUX_SESSION =
        'https_//github_com/HiromiShikata/repo/issues/2355';
      const CANONICAL_ISSUE_URL =
        'https://github.com/HiromiShikata/repo/issues/2355';
      setupSilentMainSession(REAL_TMUX_SESSION);
      mockHubTaskStatusResolver.getIssueByUrl.mockResolvedValue(
        issueFor({
          url: CANONICAL_ISSUE_URL,
          state: 'OPEN',
          status: 'Todo',
        }),
      );

      await useCase.run(runParams({ activeHubTaskStatus: ACTIVE_STATUS }));

      expect(mockHubTaskStatusResolver.getIssueByUrl).toHaveBeenCalledWith(
        CANONICAL_ISSUE_URL,
      );
      expect(
        mockNotificationRepository.sendSelfCheckNotification,
      ).not.toHaveBeenCalled();
    });

    it('fails open without throwing for a real tmux session-name form whose repository is unresolvable and has no cached status', async () => {
      const REAL_TMUX_SESSION =
        'https_//github_com/example-org/example-repo/issues/2350';
      const CANONICAL_ISSUE_URL =
        'https://github.com/example-org/example-repo/issues/2350';
      setupSilentMainSession(REAL_TMUX_SESSION);
      const warnSpy = jest
        .spyOn(console, 'warn')
        .mockImplementation(() => undefined);
      mockHubTaskStatusResolver.getIssueByUrl.mockResolvedValue(null);

      await expect(
        useCase.run(runParams({ activeHubTaskStatus: ACTIVE_STATUS })),
      ).resolves.toBeUndefined();

      expect(mockHubTaskStatusResolver.getIssueByUrl).toHaveBeenCalledWith(
        CANONICAL_ISSUE_URL,
      );
      expect(
        mockNotificationRepository.sendSelfCheckNotification,
      ).toHaveBeenCalledWith(REAL_TMUX_SESSION, MAIN_STALLED_SECTION);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('no cached status'),
      );
      warnSpy.mockRestore();
    });

    it('suppresses a resolved CLOSED hub task and writes the resolved status to the cache', async () => {
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
      expect(
        mockHubTaskStatusCacheRepository.saveHubTaskStatus,
      ).toHaveBeenCalledWith({
        url: HUB_TASK_SESSION,
        state: 'CLOSED',
        status: ACTIVE_STATUS,
        now,
      });
    });

    it('suppresses a resolved Done (non-active project status) hub task', async () => {
      setupSilentMainSession(HUB_TASK_SESSION);
      mockHubTaskStatusResolver.getIssueByUrl.mockResolvedValue(
        issueFor({ url: HUB_TASK_SESSION, state: 'OPEN', status: 'Done' }),
      );

      await useCase.run(runParams({ activeHubTaskStatus: ACTIVE_STATUS }));

      expect(
        mockNotificationRepository.sendSelfCheckNotification,
      ).not.toHaveBeenCalled();
    });

    it('sends a resolved active hub task and writes its status to the cache', async () => {
      setupSilentMainSession(HUB_TASK_SESSION);
      mockHubTaskStatusResolver.getIssueByUrl.mockResolvedValue(
        issueFor({
          url: HUB_TASK_SESSION,
          state: 'OPEN',
          status: ACTIVE_STATUS,
        }),
      );

      await useCase.run(runParams({ activeHubTaskStatus: ACTIVE_STATUS }));

      expect(
        mockNotificationRepository.sendSelfCheckNotification,
      ).toHaveBeenCalledWith(HUB_TASK_SESSION, MAIN_STALLED_SECTION);
      expect(
        mockHubTaskStatusCacheRepository.saveHubTaskStatus,
      ).toHaveBeenCalledWith({
        url: HUB_TASK_SESSION,
        state: 'OPEN',
        status: ACTIVE_STATUS,
        now,
      });
    });

    it('decides from a fresh cached entry without consulting the resolver', async () => {
      setupSilentMainSession(HUB_TASK_SESSION);
      mockHubTaskStatusCacheRepository.loadHubTaskStatus.mockResolvedValue({
        url: HUB_TASK_SESSION,
        state: 'OPEN',
        status: ACTIVE_STATUS,
        recordedEpochSeconds: nowEpochSeconds - 60,
      });

      await useCase.run(
        runParams({
          activeHubTaskStatus: ACTIVE_STATUS,
          hubTaskStatusCacheTtlSeconds: 300,
        }),
      );

      expect(mockHubTaskStatusResolver.getIssueByUrl).not.toHaveBeenCalled();
      expect(
        mockHubTaskStatusCacheRepository.saveHubTaskStatus,
      ).not.toHaveBeenCalled();
      expect(
        mockNotificationRepository.sendSelfCheckNotification,
      ).toHaveBeenCalledWith(HUB_TASK_SESSION, MAIN_STALLED_SECTION);
    });

    it('suppresses from a fresh cached closed entry without consulting the resolver', async () => {
      setupSilentMainSession(HUB_TASK_SESSION);
      mockHubTaskStatusCacheRepository.loadHubTaskStatus.mockResolvedValue({
        url: HUB_TASK_SESSION,
        state: 'CLOSED',
        status: ACTIVE_STATUS,
        recordedEpochSeconds: nowEpochSeconds - 60,
      });

      await useCase.run(
        runParams({
          activeHubTaskStatus: ACTIVE_STATUS,
          hubTaskStatusCacheTtlSeconds: 300,
        }),
      );

      expect(mockHubTaskStatusResolver.getIssueByUrl).not.toHaveBeenCalled();
      expect(
        mockNotificationRepository.sendSelfCheckNotification,
      ).not.toHaveBeenCalled();
    });

    it('re-resolves when the cached entry is older than the configured time-to-live', async () => {
      setupSilentMainSession(HUB_TASK_SESSION);
      mockHubTaskStatusCacheRepository.loadHubTaskStatus.mockResolvedValue({
        url: HUB_TASK_SESSION,
        state: 'OPEN',
        status: ACTIVE_STATUS,
        recordedEpochSeconds: nowEpochSeconds - 600,
      });
      mockHubTaskStatusResolver.getIssueByUrl.mockResolvedValue(
        issueFor({
          url: HUB_TASK_SESSION,
          state: 'OPEN',
          status: ACTIVE_STATUS,
        }),
      );

      await useCase.run(
        runParams({
          activeHubTaskStatus: ACTIVE_STATUS,
          hubTaskStatusCacheTtlSeconds: 300,
        }),
      );

      expect(mockHubTaskStatusResolver.getIssueByUrl).toHaveBeenCalledWith(
        HUB_TASK_SESSION,
      );
      expect(
        mockNotificationRepository.sendSelfCheckNotification,
      ).toHaveBeenCalledWith(HUB_TASK_SESSION, MAIN_STALLED_SECTION);
    });

    it('falls back to an expired cached active entry and still sends when live resolution returns null', async () => {
      setupSilentMainSession(HUB_TASK_SESSION);
      mockHubTaskStatusCacheRepository.loadHubTaskStatus.mockResolvedValue({
        url: HUB_TASK_SESSION,
        state: 'OPEN',
        status: ACTIVE_STATUS,
        recordedEpochSeconds: nowEpochSeconds - 600,
      });
      mockHubTaskStatusResolver.getIssueByUrl.mockResolvedValue(null);

      await useCase.run(
        runParams({
          activeHubTaskStatus: ACTIVE_STATUS,
          hubTaskStatusCacheTtlSeconds: 300,
        }),
      );

      expect(
        mockNotificationRepository.sendSelfCheckNotification,
      ).toHaveBeenCalledWith(HUB_TASK_SESSION, MAIN_STALLED_SECTION);
    });

    it('falls back to an expired cached closed entry and suppresses when live resolution throws', async () => {
      setupSilentMainSession(HUB_TASK_SESSION);
      const warnSpy = jest
        .spyOn(console, 'warn')
        .mockImplementation(() => undefined);
      mockHubTaskStatusCacheRepository.loadHubTaskStatus.mockResolvedValue({
        url: HUB_TASK_SESSION,
        state: 'CLOSED',
        status: ACTIVE_STATUS,
        recordedEpochSeconds: nowEpochSeconds - 600,
      });
      mockHubTaskStatusResolver.getIssueByUrl.mockRejectedValue(
        new Error('GraphQL rate limit'),
      );

      await useCase.run(
        runParams({
          activeHubTaskStatus: ACTIVE_STATUS,
          hubTaskStatusCacheTtlSeconds: 300,
        }),
      );

      expect(
        mockNotificationRepository.sendSelfCheckNotification,
      ).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('expired cached status'),
      );
      warnSpy.mockRestore();
    });

    it('parses a clean github.com issue URL session name and rejects non-github names', () => {
      expect(parseHubTaskIssueUrlFromSessionName(HUB_TASK_SESSION)).toBe(
        HUB_TASK_SESSION,
      );
      expect(parseHubTaskIssueUrlFromSessionName('workbench')).toBeNull();
      expect(
        parseHubTaskIssueUrlFromSessionName(
          'https://example.com/HiromiShikata/repo/issues/42',
        ),
      ).toBeNull();
    });

    it('parses the real tmux session-name form produced by toTmuxSessionName for an issue', () => {
      expect(
        parseHubTaskIssueUrlFromSessionName(
          'https_//github_com/HiromiShikata/repo/issues/2355',
        ),
      ).toBe('https://github.com/HiromiShikata/repo/issues/2355');
    });

    it('parses the real tmux session-name form for a pull request', () => {
      expect(
        parseHubTaskIssueUrlFromSessionName(
          'https_//github_com/HiromiShikata/repo/pull/2474',
        ),
      ).toBe('https://github.com/HiromiShikata/repo/pull/2474');
    });

    it('accepts a clean github.com pull URL session name', () => {
      expect(
        parseHubTaskIssueUrlFromSessionName(
          'https://github.com/HiromiShikata/repo/pull/42',
        ),
      ).toBe('https://github.com/HiromiShikata/repo/pull/42');
    });

    it('rejects an encoded non-github host or a non-issue/pull path', () => {
      expect(
        parseHubTaskIssueUrlFromSessionName(
          'https_//example_com/HiromiShikata/repo/issues/42',
        ),
      ).toBeNull();
      expect(
        parseHubTaskIssueUrlFromSessionName(
          'https_//github_com/HiromiShikata/repo/discussions/42',
        ),
      ).toBeNull();
    });
  });

  describe('refusal-tailed session gating', () => {
    it('excludes a main-stalled session whose last assistant turn is a refusal and logs one skip line', async () => {
      setupSilentMainSession(GITHUB_SESSION);
      mockRefusalTailStatusProvider.listRefusalTailedSessionNames.mockResolvedValue(
        new Set([GITHUB_SESSION]),
      );

      await useCase.run(runParams());

      expect(
        mockMessageComposer.composeMainStalledSection,
      ).not.toHaveBeenCalled();
      expect(
        mockNotificationRepository.sendSelfCheckNotification,
      ).not.toHaveBeenCalled();
      const skipLines = jest
        .mocked(console.log)
        .mock.calls.filter(
          (call) =>
            typeof call[0] === 'string' &&
            call[0].includes('last assistant turn was a model refusal'),
        );
      expect(skipLines).toEqual([
        [
          `Skipping ${GITHUB_SESSION}: last assistant turn was a model refusal; suppressing reminders until a non-refusal turn appears.`,
        ],
      ]);
    });

    it('excludes a refusal-tailed session from the sub-agent reminder branch as well', async () => {
      setupLiveInteractiveSession(GITHUB_SESSION);
      const subAgents: SubAgentActivity[] = [
        {
          label: 'sub-process-1',
          silentSeconds: DEFAULT_SUBAGENT_SILENT_THRESHOLD_SECONDS,
          runningSeconds: 60,
          waitingOnExternalProcess: false,
        },
      ];
      mockSubAgentActivityRepository.listSubAgentActivitiesBySessionName.mockResolvedValue(
        new Map([[GITHUB_SESSION, subAgents]]),
      );
      mockRefusalTailStatusProvider.listRefusalTailedSessionNames.mockResolvedValue(
        new Set([GITHUB_SESSION]),
      );

      await useCase.run(runParams());

      expect(mockMessageComposer.composeSubAgentSection).not.toHaveBeenCalled();
      expect(
        mockNotificationRepository.sendSelfCheckNotification,
      ).not.toHaveBeenCalled();
      expect(
        mockSubAgentActivityRepository.listSubAgentActivitiesBySessionName,
      ).toHaveBeenCalledWith([], transcriptMapFor([GITHUB_SESSION]));
    });

    it('passes the resolved transcript paths to the refusal-tail provider', async () => {
      setupSilentMainSession(GITHUB_SESSION);

      await useCase.run(runParams());

      expect(
        mockRefusalTailStatusProvider.listRefusalTailedSessionNames,
      ).toHaveBeenCalledWith(transcriptMapFor([GITHUB_SESSION]));
    });

    it('notifies a session again once the provider stops reporting it (a non-refusal turn followed the refusal)', async () => {
      setupSilentMainSession(GITHUB_SESSION);
      mockRefusalTailStatusProvider.listRefusalTailedSessionNames.mockResolvedValue(
        new Set<string>(),
      );

      await useCase.run(runParams());

      expect(
        mockNotificationRepository.sendSelfCheckNotification,
      ).toHaveBeenCalledWith(GITHUB_SESSION, MAIN_STALLED_SECTION);
    });

    it('excludes only the refusal-tailed session when mixed with a healthy stalled session', async () => {
      mockSnapshotProvider.getSnapshot.mockResolvedValue(
        snapshotWithSessions([GITHUB_SESSION_ALPHA, GITHUB_SESSION_BRAVO]),
      );
      mockTranscriptResolver.resolveTranscriptPaths.mockReturnValue(
        transcriptMapFor([GITHUB_SESSION_ALPHA, GITHUB_SESSION_BRAVO]),
      );
      mockSessionOutputActivityRepository.listSessionOutputActivities.mockResolvedValue(
        [
          {
            sessionName: GITHUB_SESSION_ALPHA,
            lastOutputEpochSeconds:
              nowEpochSeconds - DEFAULT_MAIN_SILENT_THRESHOLD_SECONDS,
            hasInProgressToolCall: false,
          },
          {
            sessionName: GITHUB_SESSION_BRAVO,
            lastOutputEpochSeconds:
              nowEpochSeconds - DEFAULT_MAIN_SILENT_THRESHOLD_SECONDS,
            hasInProgressToolCall: false,
          },
        ],
      );
      mockRefusalTailStatusProvider.listRefusalTailedSessionNames.mockResolvedValue(
        new Set([GITHUB_SESSION_ALPHA]),
      );

      await useCase.run(runParams());

      expect(
        mockNotificationRepository.sendSelfCheckNotification,
      ).toHaveBeenCalledTimes(1);
      expect(
        mockNotificationRepository.sendSelfCheckNotification,
      ).toHaveBeenCalledWith(GITHUB_SESSION_BRAVO, MAIN_STALLED_SECTION);
    });

    it('keeps the existing behavior when no refusal-tail provider is configured', async () => {
      const useCaseWithoutProvider = new NotifySilentLiveSessionsUseCase(
        mockSnapshotProvider,
        mockTranscriptResolver,
        mockSessionOutputActivityRepository,
        mockSubAgentActivityRepository,
        mockOwnerCallStatusProvider,
        mockNotificationRepository,
        mockCandidateStateRepository,
        mockMessageComposer,
        mockSleeper,
        mockHubTaskStatusResolver,
        mockHubTaskStatusCacheRepository,
      );
      setupSilentMainSession(GITHUB_SESSION);

      await useCaseWithoutProvider.run(runParams());

      expect(
        mockNotificationRepository.sendSelfCheckNotification,
      ).toHaveBeenCalledWith(GITHUB_SESSION, MAIN_STALLED_SECTION);
    });
  });

  describe('per-send observability log line', () => {
    const notifiedLogLines = (): string[] =>
      jest
        .mocked(console.log)
        .mock.calls.map((call): unknown => call[0])
        .filter(
          (line): line is string =>
            typeof line === 'string' && line.startsWith('Notified '),
        );

    it('logs the timestamp and the main-stalled section type on a main-stall send', async () => {
      setupSilentMainSession(GITHUB_SESSION);

      await useCase.run(runParams());

      expect(notifiedLogLines()).toEqual([
        `Notified ${GITHUB_SESSION} at=${now.toISOString()} sections=[main-stalled]`,
      ]);
    });

    it('logs sub-agent section types with their sub-agent labels', async () => {
      setupLiveInteractiveSession(GITHUB_SESSION);
      const idleOnlySubAgent: SubAgentActivity = {
        label: 'agent-idle-1',
        silentSeconds: DEFAULT_SUBAGENT_SILENT_THRESHOLD_SECONDS,
        runningSeconds: 60,
        waitingOnExternalProcess: false,
      };
      const quietLongRunningSubAgent: SubAgentActivity = {
        label: 'agent-long-1',
        silentSeconds: DEFAULT_SUBAGENT_SILENT_THRESHOLD_SECONDS,
        runningSeconds: DEFAULT_SUBAGENT_RUNNING_THRESHOLD_SECONDS,
        waitingOnExternalProcess: false,
      };
      mockSubAgentActivityRepository.listSubAgentActivitiesBySessionName.mockResolvedValue(
        new Map([
          [GITHUB_SESSION, [idleOnlySubAgent, quietLongRunningSubAgent]],
        ]),
      );

      await useCase.run(runParams());

      expect(notifiedLogLines()).toEqual([
        `Notified ${GITHUB_SESSION} at=${now.toISOString()} sections=[sub-agent-idle:agent-idle-1,sub-agent-idle:agent-long-1,sub-agent-long-running:agent-long-1]`,
      ]);
    });

    it('logs both the main-stalled and sub-agent section types on a combined send', async () => {
      setupSilentMainSession(GITHUB_SESSION);
      mockSubAgentActivityRepository.listSubAgentActivitiesBySessionName.mockResolvedValue(
        new Map([
          [
            GITHUB_SESSION,
            [
              {
                label: 'agent-idle-1',
                silentSeconds: DEFAULT_SUBAGENT_SILENT_THRESHOLD_SECONDS,
                runningSeconds: 60,
                waitingOnExternalProcess: false,
              },
            ],
          ],
        ]),
      );

      await useCase.run(runParams());

      expect(notifiedLogLines()).toEqual([
        `Notified ${GITHUB_SESSION} at=${now.toISOString()} sections=[main-stalled,sub-agent-idle:agent-idle-1]`,
      ]);
    });
  });

  describe('isGitHubIssueOrPullRequestSessionName', () => {
    it('accepts the encoded form of a github.com issue URL session name', () => {
      expect(
        isGitHubIssueOrPullRequestSessionName(
          'https_//github_com/HiromiShikata/repo/issues/42',
        ),
      ).toBe(true);
    });

    it('accepts the encoded form of a github.com pull-request URL session name', () => {
      expect(
        isGitHubIssueOrPullRequestSessionName(
          'https_//github_com/HiromiShikata/repo/pull/77',
        ),
      ).toBe(true);
    });

    it('accepts the raw form of a github.com issue and pull-request URL session name', () => {
      expect(
        isGitHubIssueOrPullRequestSessionName(
          'https://github.com/HiromiShikata/repo/issues/42',
        ),
      ).toBe(true);
      expect(
        isGitHubIssueOrPullRequestSessionName(
          'https://github.com/HiromiShikata/repo/pull/77',
        ),
      ).toBe(true);
    });

    it('rejects a plain orchestrator-style session name', () => {
      expect(isGitHubIssueOrPullRequestSessionName('workbench')).toBe(false);
      expect(isGitHubIssueOrPullRequestSessionName('orchestrator')).toBe(false);
      expect(isGitHubIssueOrPullRequestSessionName('aw-host')).toBe(false);
    });

    it('rejects a non-github host even in the encoded form', () => {
      expect(
        isGitHubIssueOrPullRequestSessionName(
          'https_//example_com/HiromiShikata/repo/issues/42',
        ),
      ).toBe(false);
    });

    it('rejects a github.com session name that is neither an issue nor a pull request', () => {
      expect(
        isGitHubIssueOrPullRequestSessionName(
          'https_//github_com/HiromiShikata/repo',
        ),
      ).toBe(false);
      expect(
        isGitHubIssueOrPullRequestSessionName(
          'https_//github_com/HiromiShikata/repo/discussions/42',
        ),
      ).toBe(false);
    });

    it('rejects a github.com issue URL whose trailing segment is not a number', () => {
      expect(
        isGitHubIssueOrPullRequestSessionName(
          'https_//github_com/HiromiShikata/repo/issues/new',
        ),
      ).toBe(false);
    });
  });

  it('uses the session entity helper for type completeness', () => {
    expect(sessionFor('workbench')).toEqual({
      sessionName: 'workbench',
      sessionId: 'workbench-uuid',
      candidateSessionIds: ['workbench-uuid'],
      configDir: '/config/workbench',
    });
  });
});
