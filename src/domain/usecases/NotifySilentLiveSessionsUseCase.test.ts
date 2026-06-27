import {
  NotifySilentLiveSessionsUseCase,
  DEFAULT_EXCLUDED_STATUS,
  DEFAULT_SILENT_THRESHOLD_SECONDS,
  DEFAULT_NOTIFICATION_COOLDOWN_SECONDS,
  SELF_CHECK_NOTIFICATION_MESSAGE,
} from './NotifySilentLiveSessionsUseCase';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { TmuxSessionRepository } from './adapter-interfaces/TmuxSessionRepository';
import { SessionOutputActivityRepository } from './adapter-interfaces/SessionOutputActivityRepository';
import { SilentSessionNotificationRepository } from './adapter-interfaces/SilentSessionNotificationRepository';
import { toTmuxSessionName } from './intmux/InTmuxByHumanSessionReconcileUseCase';
import { Issue } from '../entities/Issue';
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

describe('NotifySilentLiveSessionsUseCase', () => {
  let useCase: NotifySilentLiveSessionsUseCase;
  let mockIssueRepository: Mocked<Pick<IssueRepository, 'getAllOpened'>>;
  let mockTmuxSessionRepository: Mocked<
    Pick<TmuxSessionRepository, 'listLiveSessionNames'>
  >;
  let mockSessionOutputActivityRepository: Mocked<SessionOutputActivityRepository>;
  let mockNotificationRepository: Mocked<SilentSessionNotificationRepository>;
  let mockProject: Project;
  const now = new Date('2026-06-26T00:00:00Z');
  const nowEpochSeconds = Math.floor(now.getTime() / 1000);
  const allowCacheMinutes = 10;

  const runParams = (): {
    project: Project;
    allowCacheMinutes: number;
    excludedStatus: string;
    silentThresholdSeconds: number;
    cooldownSeconds: number;
    now: Date;
  } => ({
    project: mockProject,
    allowCacheMinutes,
    excludedStatus: DEFAULT_EXCLUDED_STATUS,
    silentThresholdSeconds: DEFAULT_SILENT_THRESHOLD_SECONDS,
    cooldownSeconds: DEFAULT_NOTIFICATION_COOLDOWN_SECONDS,
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
    mockNotificationRepository = {
      getLastNotifiedEpochSeconds: jest.fn().mockResolvedValue(null),
      setLastNotifiedEpochSeconds: jest.fn().mockResolvedValue(undefined),
      sendSelfCheckNotification: jest.fn().mockResolvedValue(undefined),
    };
    useCase = new NotifySilentLiveSessionsUseCase(
      mockIssueRepository,
      mockTmuxSessionRepository,
      mockSessionOutputActivityRepository,
      mockNotificationRepository,
    );
  });

  it('exposes the excluded status, default threshold and cooldown as named constants', () => {
    expect(DEFAULT_EXCLUDED_STATUS).toBe('In Tmux by human');
    expect(DEFAULT_EXCLUDED_STATUS).toBe(IN_TMUX_STATUS_NAME);
    expect(DEFAULT_SILENT_THRESHOLD_SECONDS).toBe(600);
    expect(DEFAULT_NOTIFICATION_COOLDOWN_SECONDS).toBe(30 * 60);
  });

  it('notifies a live monitored session that has been silent at least the threshold', async () => {
    const issue = createMockIssue({ status: IN_TMUX_STATUS_NAME });
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
            nowEpochSeconds - DEFAULT_SILENT_THRESHOLD_SECONDS,
        },
      ],
    );

    await useCase.run(runParams());

    expect(
      mockNotificationRepository.sendSelfCheckNotification,
    ).toHaveBeenCalledWith(sessionName, SELF_CHECK_NOTIFICATION_MESSAGE);
    expect(
      mockNotificationRepository.setLastNotifiedEpochSeconds,
    ).toHaveBeenCalledWith(sessionName, nowEpochSeconds);
  });

  it('passes the monitored session names to the output activity repository', async () => {
    const issue = createMockIssue({ status: IN_TMUX_STATUS_NAME });
    const sessionName = toTmuxSessionName(issue.url);
    mockIssueRepository.getAllOpened.mockResolvedValue([issue]);
    mockTmuxSessionRepository.listLiveSessionNames.mockResolvedValue([
      sessionName,
    ]);

    await useCase.run(runParams());

    expect(
      mockSessionOutputActivityRepository.listSessionOutputActivities,
    ).toHaveBeenCalledWith([sessionName]);
    expect(mockIssueRepository.getAllOpened).toHaveBeenCalledWith(
      mockProject,
      allowCacheMinutes,
    );
  });

  it('does not notify a session that produced output within the threshold', async () => {
    const issue = createMockIssue({ status: IN_TMUX_STATUS_NAME });
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
            nowEpochSeconds - DEFAULT_SILENT_THRESHOLD_SECONDS + 1,
        },
      ],
    );

    await useCase.run(runParams());

    expect(
      mockNotificationRepository.sendSelfCheckNotification,
    ).not.toHaveBeenCalled();
  });

  it('does not notify a live session that maps to no monitored issue', async () => {
    mockIssueRepository.getAllOpened.mockResolvedValue([]);
    mockTmuxSessionRepository.listLiveSessionNames.mockResolvedValue([
      'orphan_session',
    ]);
    mockSessionOutputActivityRepository.listSessionOutputActivities.mockResolvedValue(
      [],
    );

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

  it('does not notify a live session whose issue status is not the excluded status', async () => {
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
            nowEpochSeconds - DEFAULT_SILENT_THRESHOLD_SECONDS,
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
    const issue = createMockIssue({ status: IN_TMUX_STATUS_NAME });
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
            nowEpochSeconds - DEFAULT_SILENT_THRESHOLD_SECONDS,
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
    const issue = createMockIssue({ status: IN_TMUX_STATUS_NAME });
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
            nowEpochSeconds - DEFAULT_SILENT_THRESHOLD_SECONDS,
        },
      ],
    );
    mockNotificationRepository.getLastNotifiedEpochSeconds.mockResolvedValue(
      nowEpochSeconds - DEFAULT_NOTIFICATION_COOLDOWN_SECONDS,
    );

    await useCase.run(runParams());

    expect(
      mockNotificationRepository.sendSelfCheckNotification,
    ).toHaveBeenCalledWith(sessionName, SELF_CHECK_NOTIFICATION_MESSAGE);
    expect(
      mockNotificationRepository.setLastNotifiedEpochSeconds,
    ).toHaveBeenCalledWith(sessionName, nowEpochSeconds);
  });

  it('does not notify a session that has no recorded output activity', async () => {
    const issue = createMockIssue({ status: IN_TMUX_STATUS_NAME });
    const sessionName = toTmuxSessionName(issue.url);
    mockIssueRepository.getAllOpened.mockResolvedValue([issue]);
    mockTmuxSessionRepository.listLiveSessionNames.mockResolvedValue([
      sessionName,
    ]);
    mockSessionOutputActivityRepository.listSessionOutputActivities.mockResolvedValue(
      [],
    );

    await useCase.run(runParams());

    expect(
      mockNotificationRepository.sendSelfCheckNotification,
    ).not.toHaveBeenCalled();
  });

  it('contains the three general self-check points in the notification message', () => {
    expect(SELF_CHECK_NOTIFICATION_MESSAGE).toContain('1.');
    expect(SELF_CHECK_NOTIFICATION_MESSAGE).toContain('2.');
    expect(SELF_CHECK_NOTIFICATION_MESSAGE).toContain('3.');
  });

  it('does not suppress errors raised while sending a notification', async () => {
    const issue = createMockIssue({ status: IN_TMUX_STATUS_NAME });
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
            nowEpochSeconds - DEFAULT_SILENT_THRESHOLD_SECONDS,
        },
      ],
    );
    mockNotificationRepository.sendSelfCheckNotification.mockRejectedValue(
      new Error('send-keys failed'),
    );

    await expect(useCase.run(runParams())).rejects.toThrow('send-keys failed');
  });
});
