import { mock, MockProxy } from 'jest-mock-extended';
import type { ClaudeTokenUsage } from '../entities/ClaudeTokenUsage';
import type { Issue } from '../entities/Issue';
import type { Project } from '../entities/Project';
import type { StoryObjectMap } from '../entities/StoryObjectMap';
import type { ClaudeTokenUsageRepository } from './adapter-interfaces/ClaudeTokenUsageRepository';
import type { GitHubGraphqlRateLimitRepository } from './adapter-interfaces/GitHubGraphqlRateLimitRepository';
import type { IssueLatestSessionBranchRepository } from './adapter-interfaces/IssueLatestSessionBranchRepository';
import type { IssueRepository } from './adapter-interfaces/IssueRepository';
import type { LocalCommandRunner } from './adapter-interfaces/LocalCommandRunner';
import type { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import type { Sleeper } from './adapter-interfaces/Sleeper';
import type { TakeOwnershipSpawnRepository } from './adapter-interfaces/TakeOwnershipSpawnRepository';
import type { UrgentStoryLaunchHoldRepository } from './adapter-interfaces/UrgentStoryLaunchHoldRepository';
import {
  NORMAL_CONCURRENT_LIMIT,
  StartPreparationUseCase,
} from './StartPreparationUseCase';
import type {
  UrgentStoryLaunchHoldBoardIssue,
  UrgentStoryLaunchHoldBoardState,
} from './urgentStoryLaunchHoldDecide';

type Mocked<T> = jest.Mocked<T> & jest.MockedObject<T>;

class InMemoryIssueLatestSessionBranchRepository implements IssueLatestSessionBranchRepository {
  findBranchNameByIssue = async (): Promise<string | null> => null;
}

const createMockStoryObjectMap = (issues: Issue[]): StoryObjectMap => {
  const map: StoryObjectMap = new Map();
  map.set('Default Story', {
    story: {
      id: 'story-1',
      name: 'Default Story',
      color: 'BLUE',
      description: '',
    },
    storyIssue: null,
    issues: issues.map((issue) =>
      issue.story === null ? { ...issue, story: 'Default Story' } : issue,
    ),
  });
  return map;
};

const createMockIssue = (overrides: Partial<Issue> = {}): Issue => ({
  nameWithOwner: 'user/repo',
  number: 1,
  title: 'Test Issue',
  state: 'OPEN',
  status: 'Backlog',
  story: null,
  nextActionDate: null,
  nextActionHour: null,
  estimationMinutes: null,
  dependedIssueUrls: [],
  completionDate50PercentConfidence: null,
  url: 'https://github.com/user/repo/issues/1',
  assignees: ['manager-user'],
  labels: [],
  org: 'user',
  repo: 'repo',
  body: '',
  itemId: 'item-1',
  isPr: false,
  isInProgress: false,
  isClosed: false,
  createdAt: new Date('2020-01-01T00:00:00Z'),
  author: 'testuser',
  closingIssueReferenceUrls: [],
  plainCrossRepoIssueReferenceUrls: [],
  agent: null,
  stateReason: null,
  ...overrides,
});

const createMockProject = (): Project => ({
  id: 'project-1',
  url: 'https://github.com/users/user/projects/1',
  databaseId: 1,
  name: 'Test Project',
  status: {
    name: 'Status',
    fieldId: 'status-field-id',
    statuses: [
      { id: '1', name: 'Awaiting Workspace', color: 'GRAY', description: '' },
      { id: '2', name: 'Preparation', color: 'YELLOW', description: '' },
      { id: '3', name: 'Done', color: 'GREEN', description: '' },
    ],
  },
  nextActionDate: null,
  nextActionHour: null,
  story: null,
  remainingEstimationMinutes: null,
  dependedIssueUrlSeparatedByComma: null,
  completionDate50PercentConfidence: null,
  agent: null,
});

const CANDIDATE_ISSUE_URL = 'https://github.com/user/repo/issues/1';
const PROJECT_URL = 'https://github.com/users/user/projects/1';
const OTHER_PROJECT_URL = 'https://github.com/orgs/other-org/projects/2';
const URGENT_STORY_NAME = 'urgent / production incident';
const CALLER_STORY_NAME = 'regular / maintenance';
const MANAGER = 'manager-user';
const LOG_PREFIX = 'urgentStoryLaunchHold: ';
const PROXY_BASE_URL = 'http://127.0.0.1:8787';
const SPAWN_TOKEN = 'spawn-token';
const HOLD_TOKEN = 'hold-token';
const HOLD_START = new Date('2026-10-01T03:00:00Z');
const HOLD_START_MILLISECONDS = HOLD_START.getTime();

const waitingUrgentIssueUrl = (issueNumber: number): string =>
  `https://github.com/other-org/other-repo/issues/${issueNumber}`;

const waitingUrgentIssueUrls = (count: number): string[] =>
  Array.from({ length: count }, (_, index) => waitingUrgentIssueUrl(index + 1));

const boardIssueCreate = (
  overrides: Partial<UrgentStoryLaunchHoldBoardIssue> &
    Pick<UrgentStoryLaunchHoldBoardIssue, 'url'>,
): UrgentStoryLaunchHoldBoardIssue => ({
  story: URGENT_STORY_NAME,
  status: 'Awaiting Workspace',
  isClosed: false,
  dependedIssueUrls: [],
  nextActionDate: null,
  nextActionHour: null,
  assignees: [MANAGER],
  ...overrides,
});

const boardStateCreate = ({
  waitingUrgentIssueCount,
  callerStory = CALLER_STORY_NAME,
  otherProjectExtraIssues = [],
}: {
  waitingUrgentIssueCount: number;
  callerStory?: string;
  otherProjectExtraIssues?: UrgentStoryLaunchHoldBoardIssue[];
}): UrgentStoryLaunchHoldBoardState => ({
  projects: [
    {
      projectUrl: PROJECT_URL,
      readmeMaximumPreparingIssuesCount: null,
      issues: [
        boardIssueCreate({ url: CANDIDATE_ISSUE_URL, story: callerStory }),
      ],
    },
    {
      projectUrl: OTHER_PROJECT_URL,
      readmeMaximumPreparingIssuesCount: null,
      issues: [
        ...waitingUrgentIssueUrls(waitingUrgentIssueCount).map((url) =>
          boardIssueCreate({ url }),
        ),
        ...otherProjectExtraIssues,
      ],
    },
  ],
  runningIssueUrls: [],
  heldProjectUrls: [],
  timedOutIssueUrls: [],
});

const tokenUsageCreate = (
  overrides: Partial<ClaudeTokenUsage> & Pick<ClaudeTokenUsage, 'token'>,
): ClaudeTokenUsage => ({
  name: overrides.token,
  fiveHourUtilization: 0.1,
  sevenDayUtilization: 0.1,
  blocked: false,
  rejected: false,
  fiveHourRejected: false,
  blockedUntilEpoch: 0,
  modelWeeklyLimits: {},
  ...overrides,
});

const expectedAwCall = [
  'aw',
  [
    CANDIDATE_ISSUE_URL,
    'agent1',
    'claude-opus',
    '--configFilePath',
    '/path/to/config.yml',
    '--branch',
    'i1',
    '--dispatchStartedAt',
    HOLD_START.toISOString(),
  ],
  {
    env: {
      CLAUDE_CODE_OAUTH_TOKEN: SPAWN_TOKEN,
      ANTHROPIC_BASE_URL: PROXY_BASE_URL,
    },
  },
];

const dispatchStartedAtOf = (awArguments: string[]): string | null => {
  const flagIndex = awArguments.indexOf('--dispatchStartedAt');
  return flagIndex === -1 ? null : (awArguments[flagIndex + 1] ?? null);
};

type RunParams = Parameters<StartPreparationUseCase['run']>[0];

const runParamsWithoutUrgentStoryNames = (): RunParams => ({
  projectUrl: PROJECT_URL,
  defaultAgentName: 'agent1',
  defaultLlmModelName: 'claude-opus',
  fallbackLlmModelName: null,
  defaultLlmAgentName: null,
  configFilePath: '/path/to/config.yml',
  maximumPreparingIssuesCount: null,
  utilizationPercentageThreshold: 90,
  allowedIssueAuthors: ['testuser'],
  manager: MANAGER,
  codexHomeCandidates: null,
  labelsAsLlmAgentName: null,
});

const runParamsCreate = (overrides: Partial<RunParams> = {}): RunParams => ({
  ...runParamsWithoutUrgentStoryNames(),
  urgentStoryNames: [URGENT_STORY_NAME],
  ...overrides,
});

const harnessCreate = (
  { holdRepositoryInjected }: { holdRepositoryInjected: boolean } = {
    holdRepositoryInjected: true,
  },
) => {
  const awStartedAtMilliseconds: number[] = [];
  const candidateIssue = createMockIssue({
    url: CANDIDATE_ISSUE_URL,
    title: 'Issue 1',
    labels: ['category:impl'],
    status: 'Awaiting Workspace',
    number: 1,
    itemId: 'item-1',
  });
  const projectRepository: Mocked<
    Pick<ProjectRepository, 'getByUrl' | 'createField' | 'updateAgentList'>
  > = {
    getByUrl: jest.fn().mockResolvedValue(createMockProject()),
    createField: jest.fn().mockResolvedValue(undefined),
    updateAgentList: jest.fn().mockResolvedValue([]),
  };
  const issueRepository: MockProxy<IssueRepository> = mock<IssueRepository>();
  issueRepository.getStoryObjectMap.mockResolvedValue(
    createMockStoryObjectMap([candidateIssue]),
  );
  issueRepository.getAllOpened.mockResolvedValue([]);
  issueRepository.findRelatedOpenPRs.mockResolvedValue([]);
  issueRepository.getOpenPullRequest.mockResolvedValue(null);
  issueRepository.closePullRequest.mockResolvedValue(undefined);
  issueRepository.deletePullRequestBranch.mockResolvedValue(undefined);
  issueRepository.createCommentByUrl.mockResolvedValue({
    author: '',
    body: '',
    createdAt: new Date(0),
  });
  issueRepository.getIssueOrPullRequestComments.mockResolvedValue([]);
  issueRepository.setIssueAgentField.mockResolvedValue(undefined);
  issueRepository.removeLabel.mockResolvedValue(undefined);
  issueRepository.getIssueByUrl.mockResolvedValue(
    createMockIssue({
      status: 'Awaiting Workspace',
      dependedIssueUrls: [],
    }),
  );
  issueRepository.get.mockResolvedValue(
    createMockIssue({
      status: 'Awaiting Workspace',
      dependedIssueUrls: [],
    }),
  );
  issueRepository.removeIssueFromProjectCache.mockResolvedValue(undefined);
  issueRepository.appendIssueToProjectCache.mockResolvedValue(undefined);
  const localCommandRunner: Mocked<LocalCommandRunner> = {
    runCommand: jest.fn().mockImplementation(async (command: string) => {
      if (command === 'aw') {
        awStartedAtMilliseconds.push(Date.now());
      }
      return { stdout: '', stderr: '', exitCode: 0 };
    }),
    spawnInteractive: jest.fn(),
  };
  const reserveTokenLaunchSlot = jest.fn().mockResolvedValue(true);
  const claudeTokenUsageRepository: ClaudeTokenUsageRepository = {
    ensureObservable: jest.fn().mockResolvedValue(undefined),
    getAvailableTokenUsages: jest
      .fn()
      .mockResolvedValue([tokenUsageCreate({ token: SPAWN_TOKEN })]),
    getTokenInFlightCounts: jest.fn().mockResolvedValue({ [SPAWN_TOKEN]: 0 }),
    proxyBaseUrl: jest.fn().mockReturnValue(PROXY_BASE_URL),
    reserveTokenLaunchSlot,
  };
  const takeOwnershipSpawnRepository: Mocked<TakeOwnershipSpawnRepository> = {
    listSpawns: jest.fn().mockReturnValue([]),
    listRunningIssueUrls: jest.fn().mockReturnValue([]),
  };
  const gitHubGraphqlRateLimitRepository: Mocked<GitHubGraphqlRateLimitRepository> =
    {
      getRemainingRequestCount: jest.fn().mockResolvedValue(null),
    };
  const holdTokenUsage = tokenUsageCreate({ token: HOLD_TOKEN });
  const holdRepository: Mocked<UrgentStoryLaunchHoldRepository> = {
    readBoardState: jest.fn(),
    getAvailableTokenUsages: jest.fn().mockResolvedValue([holdTokenUsage]),
    getTokenInFlightCounts: jest.fn(),
    createHoldingRecord: jest.fn().mockResolvedValue(undefined),
    deleteHoldingRecord: jest.fn().mockResolvedValue(undefined),
    recordTimedOutIssueUrls: jest.fn().mockResolvedValue(undefined),
  };
  const sleeper: Mocked<Sleeper> = {
    sleep: jest.fn().mockImplementation(
      (milliseconds: number) =>
        new Promise<void>((resolve) => {
          setTimeout(resolve, milliseconds);
        }),
    ),
  };
  const useCase = new StartPreparationUseCase(
    projectRepository,
    issueRepository,
    localCommandRunner,
    claudeTokenUsageRepository,
    takeOwnershipSpawnRepository,
    gitHubGraphqlRateLimitRepository,
    new InMemoryIssueLatestSessionBranchRepository(),
    holdRepositoryInjected ? holdRepository : null,
    sleeper,
  );
  const tokenConcurrentLimitOf = (usage: ClaudeTokenUsage): number =>
    useCase.getTokenConcurrentLimit(
      usage.fiveHourUtilization,
      usage.sevenDayUtilization,
      usage.selectionWeight,
      NORMAL_CONCURRENT_LIMIT,
    );
  const holdTokenInFlightCountsLeaving = (
    freeSlotCount: number,
  ): Record<string, number> => ({
    [HOLD_TOKEN]: tokenConcurrentLimitOf(holdTokenUsage) - freeSlotCount,
  });
  holdRepository.getTokenInFlightCounts.mockResolvedValue(
    holdTokenInFlightCountsLeaving(1),
  );
  return {
    useCase,
    issueRepository,
    localCommandRunner,
    reserveTokenLaunchSlot,
    holdRepository,
    sleeper,
    awStartedAtMilliseconds,
    tokenConcurrentLimitOf,
    holdTokenInFlightCountsLeaving,
  };
};

type Harness = ReturnType<typeof harnessCreate>;

const runWithFakeClock = async (
  harness: Harness,
  params: RunParams,
): Promise<void> => {
  const runPromise = harness.useCase.run(params);
  await jest.runAllTimersAsync();
  await runPromise;
};

const evaluationOffsetsMilliseconds = (harness: Harness): number[] =>
  harness.holdRepository.readBoardState.mock.calls.map(
    ([evaluatedAt]) => evaluatedAt.getTime() - HOLD_START_MILLISECONDS,
  );

const tenSecondSleepCount = (harness: Harness): number =>
  harness.sleeper.sleep.mock.calls.filter(
    ([milliseconds]) => milliseconds === 10000,
  ).length;

describe('StartPreparationUseCase.run urgent-story launch hold', () => {
  let consoleLines: string[];
  let consoleSpies: jest.SpyInstance[];

  const holdLogLines = (): string[] =>
    consoleLines.filter((line) => line.startsWith(LOG_PREFIX));

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(HOLD_START);
    consoleLines = [];
    const recordLine = (message?: unknown): void => {
      consoleLines.push(String(message));
    };
    consoleSpies = [
      jest.spyOn(console, 'log').mockImplementation(recordLine),
      jest.spyOn(console, 'warn').mockImplementation(recordLine),
      jest.spyOn(console, 'error').mockImplementation(recordLine),
    ];
  });

  afterEach(() => {
    consoleSpies.forEach((spy) => spy.mockRestore());
    jest.useRealTimers();
  });

  it.each<{
    label: string;
    holdRepositoryInjected: boolean;
    params: RunParams;
  }>([
    {
      label: 'urgentStoryNames is absent',
      holdRepositoryInjected: true,
      params: runParamsWithoutUrgentStoryNames(),
    },
    {
      label: 'urgentStoryNames is empty',
      holdRepositoryInjected: true,
      params: runParamsCreate({ urgentStoryNames: [] }),
    },
    {
      label: 'no hold repository is injected',
      holdRepositoryInjected: false,
      params: runParamsCreate(),
    },
  ])(
    'never consults the hold repository or the sleeper and runs aw as before when $label',
    async ({ holdRepositoryInjected, params }) => {
      const harness = harnessCreate({ holdRepositoryInjected });
      harness.holdRepository.readBoardState.mockResolvedValue(
        boardStateCreate({ waitingUrgentIssueCount: 2 }),
      );

      await runWithFakeClock(harness, params);

      expect(harness.holdRepository.readBoardState.mock.calls).toEqual([]);
      expect(harness.holdRepository.getAvailableTokenUsages.mock.calls).toEqual(
        [],
      );
      expect(harness.holdRepository.getTokenInFlightCounts.mock.calls).toEqual(
        [],
      );
      expect(harness.holdRepository.createHoldingRecord.mock.calls).toEqual([]);
      expect(harness.holdRepository.deleteHoldingRecord.mock.calls).toEqual([]);
      expect(harness.holdRepository.recordTimedOutIssueUrls.mock.calls).toEqual(
        [],
      );
      expect(harness.sleeper.sleep.mock.calls).toEqual([]);
      expect(harness.localCommandRunner.runCommand.mock.calls).toEqual([
        expectedAwCall,
      ]);
      expect(holdLogLines()).toEqual([]);
    },
  );

  it('holds after the Preparation status change and the token slot reservation, polls every 10 seconds, and runs aw once no urgent task of another project is waiting', async () => {
    const harness = harnessCreate();
    harness.holdRepository.readBoardState
      .mockResolvedValueOnce(boardStateCreate({ waitingUrgentIssueCount: 2 }))
      .mockResolvedValueOnce(boardStateCreate({ waitingUrgentIssueCount: 2 }))
      .mockResolvedValue(boardStateCreate({ waitingUrgentIssueCount: 0 }));

    await runWithFakeClock(harness, runParamsCreate());

    expect(evaluationOffsetsMilliseconds(harness)).toEqual([0, 10000, 20000]);
    expect(tenSecondSleepCount(harness)).toBe(2);
    expect(harness.holdRepository.createHoldingRecord.mock.calls).toEqual([
      [PROJECT_URL],
    ]);
    const holdingLines = holdLogLines().filter((line) =>
      line.startsWith(`${LOG_PREFIX}holding `),
    );
    expect(holdingLines).toHaveLength(1);
    expect(holdingLines[0]).toEqual(
      expect.stringContaining(
        `${LOG_PREFIX}holding ${CANDIDATE_ISSUE_URL} (story ${CALLER_STORY_NAME}) because 2 urgent-story task(s) wait for 1 free slot(s): `,
      ),
    );
    expect(holdingLines[0]).toEqual(
      expect.stringContaining(waitingUrgentIssueUrl(1)),
    );
    expect(holdingLines[0]).toEqual(
      expect.stringContaining(waitingUrgentIssueUrl(2)),
    );
    expect(holdLogLines()).toContain(
      `${LOG_PREFIX}released ${CANDIDATE_ISSUE_URL} after 20s: no urgent-story task of another project is waiting`,
    );
    expect(
      harness.holdRepository.deleteHoldingRecord.mock.calls.length,
    ).toBeGreaterThan(0);
    expect(harness.holdRepository.recordTimedOutIssueUrls.mock.calls).toEqual(
      [],
    );
    expect(harness.localCommandRunner.runCommand.mock.calls).toEqual([
      expectedAwCall,
    ]);
    expect(harness.awStartedAtMilliseconds).toEqual([
      HOLD_START_MILLISECONDS + 20000,
    ]);
    expect(
      harness.localCommandRunner.runCommand.mock.calls.map(([, awArguments]) =>
        dispatchStartedAtOf(awArguments),
      ),
    ).toEqual([HOLD_START.toISOString()]);
    expect(
      harness.localCommandRunner.runCommand.mock.calls.map(([, awArguments]) =>
        dispatchStartedAtOf(awArguments),
      ),
    ).not.toEqual([new Date(HOLD_START_MILLISECONDS + 20000).toISOString()]);
    expect(
      harness.issueRepository.updateStatus.mock.calls.map(
        ([, , statusOptionId]) => statusOptionId,
      ),
    ).toEqual(['2']);

    const statusChangeOrder =
      harness.issueRepository.updateStatus.mock.invocationCallOrder[0];
    const reservationOrder =
      harness.reserveTokenLaunchSlot.mock.invocationCallOrder[0];
    const holdCallOrders = [
      ...harness.holdRepository.readBoardState.mock.invocationCallOrder,
      ...harness.holdRepository.getAvailableTokenUsages.mock
        .invocationCallOrder,
      ...harness.holdRepository.getTokenInFlightCounts.mock.invocationCallOrder,
      ...harness.holdRepository.createHoldingRecord.mock.invocationCallOrder,
      ...harness.sleeper.sleep.mock.invocationCallOrder,
    ];
    const awOrder =
      harness.localCommandRunner.runCommand.mock.invocationCallOrder[0];
    expect(Math.min(...holdCallOrders)).toBeGreaterThan(statusChangeOrder);
    expect(Math.min(...holdCallOrders)).toBeGreaterThan(reservationOrder);
    expect(Math.max(...holdCallOrders)).toBeLessThan(awOrder);
    expect(
      Math.max(
        ...harness.holdRepository.deleteHoldingRecord.mock.invocationCallOrder,
      ),
    ).toBeLessThan(awOrder);
  });

  it('releases the hold when a later evaluation finds more free slots than waiting urgent tasks', async () => {
    const harness = harnessCreate();
    harness.holdRepository.readBoardState.mockResolvedValue(
      boardStateCreate({ waitingUrgentIssueCount: 2 }),
    );
    harness.holdRepository.getTokenInFlightCounts
      .mockResolvedValueOnce(harness.holdTokenInFlightCountsLeaving(1))
      .mockResolvedValue(harness.holdTokenInFlightCountsLeaving(3));

    await runWithFakeClock(harness, runParamsCreate());

    expect(evaluationOffsetsMilliseconds(harness)).toEqual([0, 10000]);
    expect(harness.holdRepository.createHoldingRecord.mock.calls).toEqual([
      [PROJECT_URL],
    ]);
    expect(holdLogLines()).toContain(
      `${LOG_PREFIX}released ${CANDIDATE_ISSUE_URL} after 10s: 3 free slot(s) exceed the 2 waiting urgent-story task(s)`,
    );
    expect(
      harness.holdRepository.deleteHoldingRecord.mock.calls.length,
    ).toBeGreaterThan(0);
    expect(harness.localCommandRunner.runCommand.mock.calls).toEqual([
      expectedAwCall,
    ]);
    expect(harness.awStartedAtMilliseconds).toEqual([
      HOLD_START_MILLISECONDS + 10000,
    ]);
  });

  it('stops holding at the evaluation at 300 seconds, records the waiting urgent tasks as timed out at that time, and runs aw', async () => {
    const harness = harnessCreate();
    harness.holdRepository.readBoardState.mockResolvedValue(
      boardStateCreate({ waitingUrgentIssueCount: 2 }),
    );

    await runWithFakeClock(harness, runParamsCreate());

    expect(evaluationOffsetsMilliseconds(harness)).toEqual(
      Array.from({ length: 31 }, (_, index) => index * 10000),
    );
    expect(tenSecondSleepCount(harness)).toBe(30);
    expect(
      harness.holdRepository.recordTimedOutIssueUrls.mock.calls,
    ).toHaveLength(1);
    const [timedOutIssueUrls, recordedAt] =
      harness.holdRepository.recordTimedOutIssueUrls.mock.calls[0];
    expect([...timedOutIssueUrls].sort()).toEqual(waitingUrgentIssueUrls(2));
    expect(recordedAt.getTime()).toBe(HOLD_START_MILLISECONDS + 300000);
    const stoppedLines = holdLogLines().filter((line) =>
      line.startsWith(`${LOG_PREFIX}stopped holding `),
    );
    expect(stoppedLines).toHaveLength(1);
    expect(stoppedLines[0]).toEqual(
      expect.stringContaining(
        `${LOG_PREFIX}stopped holding ${CANDIDATE_ISSUE_URL} after 300s; urgent-story task(s) still not spawned and not waited for during the next 1800s: `,
      ),
    );
    expect(stoppedLines[0]).toEqual(
      expect.stringContaining(waitingUrgentIssueUrl(1)),
    );
    expect(stoppedLines[0]).toEqual(
      expect.stringContaining(waitingUrgentIssueUrl(2)),
    );
    expect(harness.holdRepository.createHoldingRecord.mock.calls).toEqual([
      [PROJECT_URL],
    ]);
    expect(
      harness.holdRepository.deleteHoldingRecord.mock.calls.length,
    ).toBeGreaterThan(0);
    expect(harness.localCommandRunner.runCommand.mock.calls).toEqual([
      expectedAwCall,
    ]);
    expect(harness.awStartedAtMilliseconds).toEqual([
      HOLD_START_MILLISECONDS + 300000,
    ]);
  });

  it.each<{
    label: string;
    errorMessage: string;
    holdRepositoryConfigure: (harness: Harness, error: Error) => void;
    expectedAwOffsetMilliseconds: number;
  }>([
    {
      label: 'the first board read rejects',
      errorMessage: 'board cache directory is unreadable',
      holdRepositoryConfigure: (harness, error) => {
        harness.holdRepository.readBoardState.mockRejectedValue(error);
      },
      expectedAwOffsetMilliseconds: 0,
    },
    {
      label: 'writing the holding record rejects',
      errorMessage: 'holding directory is read-only',
      holdRepositoryConfigure: (harness, error) => {
        harness.holdRepository.readBoardState.mockResolvedValue(
          boardStateCreate({ waitingUrgentIssueCount: 2 }),
        );
        harness.holdRepository.createHoldingRecord.mockRejectedValue(error);
      },
      expectedAwOffsetMilliseconds: 0,
    },
    {
      label: 'a board read after the hold began rejects',
      errorMessage: 'board cache file vanished',
      holdRepositoryConfigure: (harness, error) => {
        harness.holdRepository.readBoardState
          .mockResolvedValueOnce(
            boardStateCreate({ waitingUrgentIssueCount: 2 }),
          )
          .mockRejectedValue(error);
      },
      expectedAwOffsetMilliseconds: 10000,
    },
    {
      label: 'reading the token in-flight counts rejects',
      errorMessage: 'token proxy is unreachable',
      holdRepositoryConfigure: (harness, error) => {
        harness.holdRepository.readBoardState.mockResolvedValue(
          boardStateCreate({ waitingUrgentIssueCount: 2 }),
        );
        harness.holdRepository.getTokenInFlightCounts.mockRejectedValue(error);
      },
      expectedAwOffsetMilliseconds: 0,
    },
    {
      label: 'recording the timed-out urgent tasks rejects',
      errorMessage: 'timed-out record is not writable',
      holdRepositoryConfigure: (harness, error) => {
        harness.holdRepository.readBoardState.mockResolvedValue(
          boardStateCreate({ waitingUrgentIssueCount: 2 }),
        );
        harness.holdRepository.recordTimedOutIssueUrls.mockRejectedValue(error);
      },
      expectedAwOffsetMilliseconds: 300000,
    },
  ])(
    'logs the failure, deletes the holding record and runs aw when $label',
    async ({
      errorMessage,
      holdRepositoryConfigure,
      expectedAwOffsetMilliseconds,
    }) => {
      const harness = harnessCreate();
      holdRepositoryConfigure(harness, new Error(errorMessage));

      await runWithFakeClock(harness, runParamsCreate());

      expect(holdLogLines()).toContain(
        `${LOG_PREFIX}failed (${errorMessage}); the spawn goes ahead`,
      );
      expect(
        harness.holdRepository.deleteHoldingRecord.mock.calls.length,
      ).toBeGreaterThan(0);
      expect(harness.localCommandRunner.runCommand.mock.calls).toEqual([
        expectedAwCall,
      ]);
      expect(harness.awStartedAtMilliseconds).toEqual([
        HOLD_START_MILLISECONDS + expectedAwOffsetMilliseconds,
      ]);
    },
  );

  it('runs aw when the whole hold reaches 420 seconds while a board read never settles', async () => {
    const harness = harnessCreate();
    harness.holdRepository.readBoardState
      .mockResolvedValueOnce(boardStateCreate({ waitingUrgentIssueCount: 2 }))
      .mockReturnValue(
        new Promise<UrgentStoryLaunchHoldBoardState>(() => undefined),
      );

    const runPromise = harness.useCase.run(runParamsCreate());
    await jest.runAllTimersAsync();

    expect(harness.localCommandRunner.runCommand.mock.calls).toEqual([
      expectedAwCall,
    ]);
    expect(harness.awStartedAtMilliseconds).toEqual([
      HOLD_START_MILLISECONDS + 420000,
    ]);
    expect(
      harness.holdRepository.deleteHoldingRecord.mock.calls.length,
    ).toBeGreaterThan(0);
    await runPromise;
  });

  it.each<{
    label: string;
    boardState: UrgentStoryLaunchHoldBoardState;
    holdFreeSlotCount: number;
    holdTokenUsages: 'holdToken' | 'none';
    expectedLogLineStart: string;
  }>([
    {
      label:
        'the caller story is urgent even though urgent tasks wait and no slot is free',
      boardState: boardStateCreate({
        waitingUrgentIssueCount: 2,
        callerStory: URGENT_STORY_NAME,
      }),
      holdFreeSlotCount: 0,
      holdTokenUsages: 'holdToken',
      expectedLogLineStart: `${LOG_PREFIX}urgent-story task ${CANDIDATE_ISSUE_URL} (story ${URGENT_STORY_NAME}) proceeds to spawn`,
    },
    {
      label:
        'an urgent task waiting in Awaiting Workspace depends on the caller',
      boardState: boardStateCreate({
        waitingUrgentIssueCount: 2,
        otherProjectExtraIssues: [
          boardIssueCreate({
            url: waitingUrgentIssueUrl(9),
            dependedIssueUrls: [CANDIDATE_ISSUE_URL],
          }),
        ],
      }),
      holdFreeSlotCount: 0,
      holdTokenUsages: 'holdToken',
      expectedLogLineStart: `${LOG_PREFIX}${CANDIDATE_ISSUE_URL} proceeds to spawn because urgent-story task ${waitingUrgentIssueUrl(9)} depends on it and is waiting in Awaiting Workspace`,
    },
    {
      label: 'no urgent task of another project is waiting',
      boardState: boardStateCreate({ waitingUrgentIssueCount: 0 }),
      holdFreeSlotCount: 0,
      holdTokenUsages: 'holdToken',
      expectedLogLineStart: `${LOG_PREFIX}${CANDIDATE_ISSUE_URL} proceeds to spawn: `,
    },
    {
      label: 'the free slots already outnumber the waiting urgent tasks',
      boardState: boardStateCreate({ waitingUrgentIssueCount: 2 }),
      holdFreeSlotCount: 3,
      holdTokenUsages: 'holdToken',
      expectedLogLineStart: `${LOG_PREFIX}${CANDIDATE_ISSUE_URL} proceeds to spawn: `,
    },
    {
      label: 'the hold repository reports no token usages',
      boardState: boardStateCreate({ waitingUrgentIssueCount: 2 }),
      holdFreeSlotCount: 0,
      holdTokenUsages: 'none',
      expectedLogLineStart: `${LOG_PREFIX}cannot count free token slots; ${CANDIDATE_ISSUE_URL} spawns without the urgent-story hold`,
    },
  ])(
    'runs aw at the first evaluation without a holding record when $label',
    async ({
      boardState,
      holdFreeSlotCount,
      holdTokenUsages,
      expectedLogLineStart,
    }) => {
      const harness = harnessCreate();
      harness.holdRepository.readBoardState.mockResolvedValue(boardState);
      harness.holdRepository.getTokenInFlightCounts.mockResolvedValue(
        harness.holdTokenInFlightCountsLeaving(holdFreeSlotCount),
      );
      if (holdTokenUsages === 'none') {
        harness.holdRepository.getAvailableTokenUsages.mockResolvedValue([]);
      }

      await runWithFakeClock(harness, runParamsCreate());

      expect(holdLogLines()).toEqual(
        expect.arrayContaining([expect.stringContaining(expectedLogLineStart)]),
      );
      expect(harness.holdRepository.readBoardState.mock.calls).toHaveLength(1);
      expect(harness.holdRepository.createHoldingRecord.mock.calls).toEqual([]);
      expect(harness.sleeper.sleep.mock.calls).toEqual([]);
      expect(harness.localCommandRunner.runCommand.mock.calls).toEqual([
        expectedAwCall,
      ]);
      expect(harness.awStartedAtMilliseconds).toEqual([
        HOLD_START_MILLISECONDS,
      ]);
    },
  );

  it.each<{
    label: string;
    runParamOverrides: Partial<RunParams>;
    holdTokenUsages: ClaudeTokenUsage[];
    holdTokenInFlightCounts: Record<string, number>;
    expectedCountedTokens: string[];
  }>([
    {
      label:
        'sums each eligible token limit minus its in-flight count, including tokens tapered by five-hour or seven-day utilization',
      runParamOverrides: {},
      holdTokenUsages: [
        tokenUsageCreate({ token: 'token-a' }),
        tokenUsageCreate({ token: 'token-b', fiveHourUtilization: 0.85 }),
        tokenUsageCreate({ token: 'token-c', sevenDayUtilization: 0.9 }),
      ],
      holdTokenInFlightCounts: { 'token-a': 2, 'token-b': 1, 'token-c': 0 },
      expectedCountedTokens: ['token-a', 'token-b', 'token-c'],
    },
    {
      label: 'counts zero for a token whose in-flight count exceeds its limit',
      runParamOverrides: {},
      holdTokenUsages: [
        tokenUsageCreate({ token: 'token-a' }),
        tokenUsageCreate({ token: 'token-b' }),
      ],
      holdTokenInFlightCounts: { 'token-a': 9, 'token-b': 5 },
      expectedCountedTokens: ['token-a', 'token-b'],
    },
    {
      label:
        'leaves out a token at 90 percent five-hour utilization or more even when the run threshold is higher',
      runParamOverrides: { utilizationPercentageThreshold: 95 },
      holdTokenUsages: [
        tokenUsageCreate({ token: 'token-a', fiveHourUtilization: 0.92 }),
        tokenUsageCreate({ token: 'token-b' }),
      ],
      holdTokenInFlightCounts: { 'token-a': 0, 'token-b': 0 },
      expectedCountedTokens: ['token-b'],
    },
    {
      label:
        'keeps a token below 90 percent five-hour utilization even when the run threshold is lower',
      runParamOverrides: { utilizationPercentageThreshold: 50 },
      holdTokenUsages: [
        tokenUsageCreate({ token: 'token-a', fiveHourUtilization: 0.7 }),
      ],
      holdTokenInFlightCounts: { 'token-a': 1 },
      expectedCountedTokens: ['token-a'],
    },
    {
      label:
        'leaves out blocked, five-hour rejected, cooling-down and seven-day rejected tokens',
      runParamOverrides: {},
      holdTokenUsages: [
        tokenUsageCreate({ token: 'token-blocked', blocked: true }),
        tokenUsageCreate({ token: 'token-rejected', fiveHourRejected: true }),
        tokenUsageCreate({
          token: 'token-cooling-down',
          blockedUntilEpoch: HOLD_START_MILLISECONDS / 1000 + 3600,
        }),
        tokenUsageCreate({
          token: 'token-weekly-rejected',
          modelWeeklyLimits: {
            seven_day: {
              rejected: true,
              resetsAt: HOLD_START_MILLISECONDS / 1000 + 86400,
            },
          },
        }),
        tokenUsageCreate({ token: 'token-available' }),
      ],
      holdTokenInFlightCounts: {
        'token-blocked': 0,
        'token-rejected': 0,
        'token-cooling-down': 0,
        'token-weekly-rejected': 0,
        'token-available': 2,
      },
      expectedCountedTokens: ['token-available'],
    },
    {
      label:
        'uses the normal concurrent limit constant whatever normalConcurrentLimit the run receives',
      runParamOverrides: { normalConcurrentLimit: 2 },
      holdTokenUsages: [tokenUsageCreate({ token: 'token-a' })],
      holdTokenInFlightCounts: { 'token-a': 1 },
      expectedCountedTokens: ['token-a'],
    },
    {
      label: 'applies the selection weight of a token to its limit',
      runParamOverrides: {},
      holdTokenUsages: [
        tokenUsageCreate({ token: 'token-a', selectionWeight: 0.5 }),
      ],
      holdTokenInFlightCounts: { 'token-a': 1 },
      expectedCountedTokens: ['token-a'],
    },
    {
      label: 'counts zero free slots when no token is eligible',
      runParamOverrides: {},
      holdTokenUsages: [
        tokenUsageCreate({ token: 'token-blocked', blocked: true }),
      ],
      holdTokenInFlightCounts: { 'token-blocked': 0 },
      expectedCountedTokens: [],
    },
  ])(
    'passes the free slot count of the hold token usages to the decision: $label',
    async ({
      runParamOverrides,
      holdTokenUsages,
      holdTokenInFlightCounts,
      expectedCountedTokens,
    }) => {
      const harness = harnessCreate();
      harness.holdRepository.readBoardState
        .mockResolvedValueOnce(
          boardStateCreate({ waitingUrgentIssueCount: 30 }),
        )
        .mockResolvedValue(boardStateCreate({ waitingUrgentIssueCount: 0 }));
      harness.holdRepository.getAvailableTokenUsages.mockResolvedValue(
        holdTokenUsages,
      );
      harness.holdRepository.getTokenInFlightCounts.mockResolvedValue(
        holdTokenInFlightCounts,
      );
      const expectedFreeSlotCount = holdTokenUsages
        .filter((usage) => expectedCountedTokens.includes(usage.token))
        .reduce(
          (sum, usage) =>
            sum +
            Math.max(
              0,
              harness.tokenConcurrentLimitOf(usage) -
                holdTokenInFlightCounts[usage.token],
            ),
          0,
        );

      await runWithFakeClock(harness, runParamsCreate(runParamOverrides));

      expect(holdLogLines()).toEqual(
        expect.arrayContaining([
          expect.stringContaining(
            `${LOG_PREFIX}holding ${CANDIDATE_ISSUE_URL} (story ${CALLER_STORY_NAME}) because 30 urgent-story task(s) wait for ${expectedFreeSlotCount} free slot(s): `,
          ),
        ]),
      );
      expect(harness.localCommandRunner.runCommand.mock.calls).toEqual([
        expectedAwCall,
      ]);
    },
  );
});
