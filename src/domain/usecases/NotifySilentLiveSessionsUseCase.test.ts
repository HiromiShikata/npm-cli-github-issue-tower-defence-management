import {
  NotifySilentLiveSessionsUseCase,
  HubTaskStatusResolver,
  parseHubTaskIssueUrlFromSessionName,
  isGitHubIssueOrPullRequestSessionName,
  DEFAULT_MAIN_SILENT_THRESHOLD_SECONDS,
  DEFAULT_SUBAGENT_SILENT_THRESHOLD_SECONDS,
  DEFAULT_SUBAGENT_RUNNING_THRESHOLD_SECONDS,
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
  const GITHUB_SESSION = 'https_//github_com/HiromiShikata/repo/issues/42';
  const GITHUB_SESSION_ALPHA =
    'https_//github_com/HiromiShikata/repo/issues/100';
  const GITHUB_SESSION_BRAVO =
    'https_//github_com/HiromiShikata/repo/issues/200';

  const runParams = (
    overrides?: Partial<{ activeHubTaskStatus: string | null }>,
  ): {
    mainSilentThresholdSeconds: number;
    subAgentSilentThresholdSeconds: number;
    subAgentRunningThresholdSeconds: number;
    staggerSeconds: number;
    activeHubTaskStatus: string | null;
    now: Date;
  } => ({
    mainSilentThresholdSeconds: DEFAULT_MAIN_SILENT_THRESHOLD_SECONDS,
    subAgentSilentThresholdSeconds: DEFAULT_SUBAGENT_SILENT_THRESHOLD_SECONDS,
    subAgentRunningThresholdSeconds: DEFAULT_SUBAGENT_RUNNING_THRESHOLD_SECONDS,
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
      listSessionNamesWithUnansweredOwnerCall: jest
        .fn()
        .mockResolvedValue(new Set<string>()),
    };
    mockNotificationRepository = {
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
        },
        {
          sessionName: 'orchestrator',
          lastOutputEpochSeconds:
            nowEpochSeconds - DEFAULT_MAIN_SILENT_THRESHOLD_SECONDS,
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
      mockOwnerCallStatusProvider.listSessionNamesWithUnansweredOwnerCall,
    ).toHaveBeenCalledWith(expectedMap);
    expect(
      mockSubAgentActivityRepository.listSubAgentActivitiesBySessionName,
    ).toHaveBeenCalledWith([GITHUB_SESSION], expectedMap);
  });

  it('suppresses the stalled section and sends nothing when an owner call is pending past the threshold', async () => {
    setupLiveInteractiveSession(GITHUB_SESSION);
    mockSessionOutputActivityRepository.listSessionOutputActivities.mockResolvedValue(
      [
        {
          sessionName: GITHUB_SESSION,
          lastOutputEpochSeconds:
            nowEpochSeconds - DEFAULT_MAIN_SILENT_THRESHOLD_SECONDS,
        },
      ],
    );
    mockOwnerCallStatusProvider.listSessionNamesWithUnansweredOwnerCall.mockResolvedValue(
      new Set([GITHUB_SESSION]),
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
    setupLiveInteractiveSession(GITHUB_SESSION);
    mockSessionOutputActivityRepository.listSessionOutputActivities.mockResolvedValue(
      [
        {
          sessionName: GITHUB_SESSION,
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
    ).toHaveBeenCalledWith(GITHUB_SESSION, MAIN_STALLED_SECTION);
  });

  it('does not send the main stalled section when output is within the threshold', async () => {
    setupLiveInteractiveSession(GITHUB_SESSION);
    mockSessionOutputActivityRepository.listSessionOutputActivities.mockResolvedValue(
      [
        {
          sessionName: GITHUB_SESSION,
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
    setupLiveInteractiveSession(GITHUB_SESSION);
    const subAgents: SubAgentActivity[] = [
      {
        label: 'sub-process-1',
        silentSeconds: DEFAULT_SUBAGENT_SILENT_THRESHOLD_SECONDS,
        runningSeconds: 60,
      },
    ];
    mockSubAgentActivityRepository.listSubAgentActivitiesBySessionName.mockResolvedValue(
      new Map([[GITHUB_SESSION, subAgents]]),
    );

    await useCase.run(runParams());

    expect(mockMessageComposer.composeSubAgentSection).toHaveBeenCalledWith(
      subAgents,
    );
    expect(
      mockNotificationRepository.sendSelfCheckNotification,
    ).toHaveBeenCalledWith(GITHUB_SESSION, SUBAGENT_SECTION);
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

  it('re-notifies a session on every consecutive cycle while it remains a valid silent target', async () => {
    setupLiveInteractiveSession(GITHUB_SESSION);
    mockSessionOutputActivityRepository.listSessionOutputActivities.mockResolvedValue(
      [
        {
          sessionName: GITHUB_SESSION,
          lastOutputEpochSeconds:
            nowEpochSeconds - DEFAULT_MAIN_SILENT_THRESHOLD_SECONDS,
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

  it('notifies on every repeated cycle at the same instant without reading any cooldown state', async () => {
    setupLiveInteractiveSession(GITHUB_SESSION);
    mockSessionOutputActivityRepository.listSessionOutputActivities.mockResolvedValue(
      [
        {
          sessionName: GITHUB_SESSION,
          lastOutputEpochSeconds:
            nowEpochSeconds - DEFAULT_MAIN_SILENT_THRESHOLD_SECONDS,
        },
      ],
    );

    await useCase.run(runParams());
    await useCase.run(runParams());
    await useCase.run(runParams());

    expect(
      mockNotificationRepository.sendSelfCheckNotification,
    ).toHaveBeenCalledTimes(3);
    expect(Object.keys(mockNotificationRepository)).toEqual([
      'sendSelfCheckNotification',
    ]);
    expect(runParams()).not.toHaveProperty('cooldownSeconds');
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
        },
        {
          sessionName: GITHUB_SESSION_BRAVO,
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
