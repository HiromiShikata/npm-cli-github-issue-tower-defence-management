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
import type { TakeOwnershipSpawnRepository } from './adapter-interfaces/TakeOwnershipSpawnRepository';
import {
  NORMAL_CONCURRENT_LIMIT,
  StartPreparationUseCase,
} from './StartPreparationUseCase';

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
const PROXY_BASE_URL = 'http://127.0.0.1:8787';
const SPAWN_TOKEN = 'spawn-token';

const spawnTokenUsage: ClaudeTokenUsage = {
  name: SPAWN_TOKEN,
  token: SPAWN_TOKEN,
  fiveHourUtilization: 0.1,
  sevenDayUtilization: 0.1,
  blocked: false,
  rejected: false,
  fiveHourRejected: false,
  blockedUntilEpoch: 0,
  modelWeeklyLimits: {},
};

const harnessCreate = (
  candidateLabels = ['category:impl'],
  availableTokenUsages = [spawnTokenUsage],
  additionalCandidateIssues: Issue[] = [],
) => {
  const candidateIssue = createMockIssue({
    url: CANDIDATE_ISSUE_URL,
    title: 'Issue 1',
    labels: candidateLabels,
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
    createMockStoryObjectMap([candidateIssue, ...additionalCandidateIssues]),
  );
  issueRepository.getAllOpened.mockResolvedValue([]);
  issueRepository.findRelatedOpenPRs.mockResolvedValue([]);
  issueRepository.getOpenPullRequest.mockResolvedValue(null);
  issueRepository.closePullRequest.mockResolvedValue(undefined);
  issueRepository.deletePullRequestBranch.mockResolvedValue(undefined);
  issueRepository.createCommentByUrl.mockResolvedValue({
    id: 1,
    author: '',
    body: '',
    createdAt: new Date(0),
  });
  issueRepository.getIssueOrPullRequestComments.mockResolvedValue([]);
  issueRepository.setIssueAgentField.mockResolvedValue('applied');
  issueRepository.removeLabel.mockResolvedValue(undefined);
  issueRepository.getIssueByUrl.mockResolvedValue(
    createMockIssue({
      status: 'Awaiting Workspace',
      dependedIssueUrls: [],
    }),
  );
  issueRepository.get.mockImplementation(
    async (url) =>
      [candidateIssue, ...additionalCandidateIssues].find(
        (issue) => issue.url === url,
      ) ?? null,
  );
  issueRepository.removeIssueFromProjectCache.mockResolvedValue(undefined);
  issueRepository.appendIssueToProjectCache.mockResolvedValue(undefined);
  const localCommandRunner: Mocked<LocalCommandRunner> = {
    runCommand: jest
      .fn()
      .mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 }),
    spawnInteractive: jest.fn(),
  };
  const reserveTokenLaunchSlot = jest.fn().mockResolvedValue(true);
  const ensureObservable = jest.fn().mockResolvedValue(undefined);
  const claudeTokenUsageRepository: ClaudeTokenUsageRepository = {
    ensureObservable,
    getAvailableTokenUsages: jest.fn().mockResolvedValue(availableTokenUsages),
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
  const useCase = new StartPreparationUseCase(
    projectRepository,
    issueRepository,
    localCommandRunner,
    claudeTokenUsageRepository,
    takeOwnershipSpawnRepository,
    gitHubGraphqlRateLimitRepository,
    new InMemoryIssueLatestSessionBranchRepository(),
  );
  return {
    useCase,
    issueRepository,
    localCommandRunner,
    claudeTokenUsageRepository,
    reserveTokenLaunchSlot,
    ensureObservable,
  };
};

describe('StartPreparationUseCase.run aw launch with the seven constructor arguments', () => {
  let consoleSpies: jest.SpyInstance[];

  beforeEach(() => {
    consoleSpies = [
      jest.spyOn(console, 'log').mockImplementation(() => undefined),
      jest.spyOn(console, 'warn').mockImplementation(() => undefined),
      jest.spyOn(console, 'error').mockImplementation(() => undefined),
    ];
  });

  afterEach(() => {
    consoleSpies.forEach((spy) => spy.mockRestore());
  });

  it('moves the candidate to Preparation, reserves its token slot and then runs aw with the issue, agent, model, config path, branch, dispatch start time and token environment', async () => {
    const harness = harnessCreate();
    const runStartedAtMilliseconds = Date.now();

    await harness.useCase.run({
      projectUrl: PROJECT_URL,
      defaultAgentName: 'agent1',
      defaultLlmModelName: 'claude-opus',
      fallbackLlmModelName: null,
      defaultLlmAgentName: null,
      configFilePath: '/path/to/config.yml',
      maximumPreparingIssuesCount: null,
      utilizationPercentageThreshold: 90,
      allowedIssueAuthors: ['testuser'],
      manager: 'manager-user',
      codexHomeCandidates: null,
      labelsAsLlmAgentName: null,
    });
    const runFinishedAtMilliseconds = Date.now();

    expect(harness.localCommandRunner.runCommand.mock.calls).toEqual([
      [
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
          expect.stringMatching(
            /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
          ),
        ],
        {
          env: {
            CLAUDE_CODE_OAUTH_TOKEN: SPAWN_TOKEN,
            ANTHROPIC_BASE_URL: PROXY_BASE_URL,
          },
        },
      ],
    ]);
    const dispatchStartedAtMilliseconds =
      harness.localCommandRunner.runCommand.mock.calls.map(([, awArguments]) =>
        new Date(
          awArguments[awArguments.indexOf('--dispatchStartedAt') + 1],
        ).getTime(),
      );
    expect(dispatchStartedAtMilliseconds).toHaveLength(1);
    expect(dispatchStartedAtMilliseconds[0]).toBeGreaterThanOrEqual(
      runStartedAtMilliseconds,
    );
    expect(dispatchStartedAtMilliseconds[0]).toBeLessThanOrEqual(
      runFinishedAtMilliseconds,
    );
    expect(
      harness.issueRepository.updateStatus.mock.calls.map((call) => call[2]),
    ).toEqual(['2']);
    expect(harness.reserveTokenLaunchSlot.mock.calls).toEqual([
      [
        {
          token: SPAWN_TOKEN,
          concurrentLimit: harness.useCase.getTokenConcurrentLimit(
            spawnTokenUsage.fiveHourUtilization,
            spawnTokenUsage.sevenDayUtilization,
            spawnTokenUsage.selectionWeight,
            NORMAL_CONCURRENT_LIMIT,
          ),
          issueUrl: CANDIDATE_ISSUE_URL,
        },
      ],
    ]);
    const updateStatusOrder =
      harness.issueRepository.updateStatus.mock.invocationCallOrder[0];
    const reserveOrder =
      harness.reserveTokenLaunchSlot.mock.invocationCallOrder[0];
    const awOrder =
      harness.localCommandRunner.runCommand.mock.invocationCallOrder[0];
    expect(updateStatusOrder).toBeLessThan(awOrder);
    expect(reserveOrder).toBeLessThan(awOrder);
  });

  it('does not reserve a Claude token launch slot for a future Codex model name', async () => {
    const harness = harnessCreate([
      'category:impl',
      'llm-model:zz-future-model-1',
    ]);

    await harness.useCase.run({
      projectUrl: PROJECT_URL,
      defaultAgentName: 'agent1',
      defaultLlmModelName: 'claude-opus',
      fallbackLlmModelName: null,
      defaultLlmAgentName: null,
      configFilePath: '/path/to/config.yml',
      maximumPreparingIssuesCount: null,
      utilizationPercentageThreshold: 90,
      allowedIssueAuthors: ['testuser'],
      manager: 'manager-user',
      codexHomeCandidates: null,
      labelsAsLlmAgentName: null,
    });

    expect(harness.reserveTokenLaunchSlot).not.toHaveBeenCalled();
    expect(harness.ensureObservable).not.toHaveBeenCalled();
    expect(harness.localCommandRunner.runCommand.mock.calls).toEqual([
      [
        'aw',
        expect.arrayContaining([
          CANDIDATE_ISSUE_URL,
          'agent1',
          'zz-future-model-1',
        ]),
        undefined,
      ],
    ]);
  });

  it('launches the bracketed default Claude model with one reserved slot and one Preparation write', async () => {
    const harness = harnessCreate();

    await harness.useCase.run({
      projectUrl: PROJECT_URL,
      defaultAgentName: 'agent1',
      defaultLlmModelName: 'claude-sonnet-5-5[1m]',
      fallbackLlmModelName: null,
      defaultLlmAgentName: null,
      configFilePath: '/path/to/config.yml',
      maximumPreparingIssuesCount: null,
      utilizationPercentageThreshold: 90,
      allowedIssueAuthors: ['testuser'],
      manager: 'manager-user',
      codexHomeCandidates: null,
      labelsAsLlmAgentName: null,
    });

    expect(harness.localCommandRunner.runCommand.mock.calls).toEqual([
      [
        'aw',
        expect.arrayContaining([
          CANDIDATE_ISSUE_URL,
          'agent1',
          'claude-sonnet-5-5[1m]',
        ]),
        {
          env: {
            CLAUDE_CODE_OAUTH_TOKEN: SPAWN_TOKEN,
            ANTHROPIC_BASE_URL: PROXY_BASE_URL,
          },
        },
      ],
    ]);
    expect(harness.localCommandRunner.runCommand.mock.calls[0][1][2]).toBe(
      'claude-sonnet-5-5[1m]',
    );
    expect(harness.reserveTokenLaunchSlot).toHaveBeenCalledTimes(1);
    expect(
      harness.issueRepository.updateStatus.mock.calls.map((call) => call[2]),
    ).toEqual(['2']);
  });

  it('starts a future Codex model when Claude tokens are unavailable', async () => {
    const harness = harnessCreate(['category:impl'], []);

    await harness.useCase.run({
      projectUrl: PROJECT_URL,
      defaultAgentName: 'agent1',
      defaultLlmModelName: 'zz-future-model-1',
      fallbackLlmModelName: null,
      defaultLlmAgentName: null,
      configFilePath: '/path/to/config.yml',
      maximumPreparingIssuesCount: null,
      utilizationPercentageThreshold: 90,
      allowedIssueAuthors: ['testuser'],
      manager: 'manager-user',
      codexHomeCandidates: null,
      labelsAsLlmAgentName: null,
    });

    expect(harness.reserveTokenLaunchSlot).not.toHaveBeenCalled();
    expect(harness.ensureObservable).not.toHaveBeenCalled();
    expect(harness.localCommandRunner.runCommand.mock.calls).toEqual([
      [
        'aw',
        expect.arrayContaining([
          CANDIDATE_ISSUE_URL,
          'agent1',
          'zz-future-model-1',
        ]),
        undefined,
      ],
    ]);
  });

  it('skips later Claude candidates after every token is at its concurrent limit and launches a Codex candidate', async () => {
    const candidate = (number: number, model: string): Issue =>
      createMockIssue({
        number,
        itemId: `item-${number}`,
        url: `https://github.com/user/repo/issues/${number}`,
        title: `Issue ${number}`,
        labels: ['category:impl', `llm-model:${model}`],
        status: 'Awaiting Workspace',
      });
    const harness = harnessCreate(
      ['category:impl', 'llm-model:claude-opus'],
      [spawnTokenUsage],
      [
        candidate(2, 'claude-opus'),
        candidate(3, 'claude-opus'),
        candidate(4, 'zz-future-model-1'),
      ],
    );
    jest
      .spyOn(harness.claudeTokenUsageRepository, 'getTokenInFlightCounts')
      .mockResolvedValue({ [SPAWN_TOKEN]: 100 });

    await harness.useCase.run({
      projectUrl: PROJECT_URL,
      defaultAgentName: 'agent1',
      defaultLlmModelName: 'claude-opus',
      fallbackLlmModelName: null,
      defaultLlmAgentName: null,
      configFilePath: '/path/to/config.yml',
      maximumPreparingIssuesCount: 4,
      utilizationPercentageThreshold: 90,
      allowedIssueAuthors: ['testuser'],
      manager: 'manager-user',
      codexHomeCandidates: null,
      labelsAsLlmAgentName: null,
    });

    expect(
      harness.issueRepository.updateStatus.mock.calls.map(
        ([, issue, status]) => [issue.url, status],
      ),
    ).toEqual([
      [CANDIDATE_ISSUE_URL, '2'],
      [CANDIDATE_ISSUE_URL, '1'],
      ['https://github.com/user/repo/issues/4', '2'],
    ]);
    expect(harness.reserveTokenLaunchSlot).not.toHaveBeenCalled();
    expect(harness.localCommandRunner.runCommand.mock.calls).toEqual([
      [
        'aw',
        expect.arrayContaining([
          'https://github.com/user/repo/issues/4',
          'zz-future-model-1',
        ]),
        undefined,
      ],
    ]);
  });

  it('skips Claude without a status write when configured tokens are filtered out and launches Codex', async () => {
    const codexIssue = createMockIssue({
      number: 2,
      itemId: 'item-2',
      url: 'https://github.com/user/repo/issues/2',
      title: 'Issue 2',
      labels: ['category:impl', 'llm-model:zz-future-model-1'],
      status: 'Awaiting Workspace',
    });
    const harness = harnessCreate(
      ['category:impl', 'llm-model:claude-opus'],
      [{ ...spawnTokenUsage, blocked: true }],
      [codexIssue],
    );

    await harness.useCase.run({
      projectUrl: PROJECT_URL,
      defaultAgentName: 'agent1',
      defaultLlmModelName: 'claude-opus',
      fallbackLlmModelName: null,
      defaultLlmAgentName: null,
      configFilePath: '/path/to/config.yml',
      maximumPreparingIssuesCount: 2,
      utilizationPercentageThreshold: 90,
      allowedIssueAuthors: ['testuser'],
      manager: 'manager-user',
      codexHomeCandidates: null,
      labelsAsLlmAgentName: null,
    });

    expect(
      harness.issueRepository.updateStatus.mock.calls.map(
        ([, issue, status]) => [issue.url, status],
      ),
    ).toEqual([[codexIssue.url, '2']]);
    expect(harness.reserveTokenLaunchSlot).not.toHaveBeenCalled();
    expect(harness.localCommandRunner.runCommand.mock.calls).toEqual([
      [
        'aw',
        expect.arrayContaining([codexIssue.url, 'zz-future-model-1']),
        undefined,
      ],
    ]);
  });

  it('does not launch when the resolved model id has invalid syntax', async () => {
    const harness = harnessCreate(['category:impl', 'llm-model:bad model']);

    await harness.useCase.run({
      projectUrl: PROJECT_URL,
      defaultAgentName: 'agent1',
      defaultLlmModelName: 'claude-opus',
      fallbackLlmModelName: null,
      defaultLlmAgentName: null,
      configFilePath: '/path/to/config.yml',
      maximumPreparingIssuesCount: null,
      utilizationPercentageThreshold: 90,
      allowedIssueAuthors: ['testuser'],
      manager: 'manager-user',
      codexHomeCandidates: null,
      labelsAsLlmAgentName: null,
    });

    expect(harness.localCommandRunner.runCommand.mock.calls).toHaveLength(0);
  });
});
