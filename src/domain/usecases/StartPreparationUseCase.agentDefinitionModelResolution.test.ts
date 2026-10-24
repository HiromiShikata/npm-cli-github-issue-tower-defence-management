import { mock, MockProxy } from 'jest-mock-extended';
import type { ClaudeTokenUsage } from '../entities/ClaudeTokenUsage';
import type { Issue } from '../entities/Issue';
import type { FieldOption, Project } from '../entities/Project';
import type { StoryObjectMap } from '../entities/StoryObjectMap';
import type { AgentDefinitionRepository } from './adapter-interfaces/AgentDefinitionRepository';
import type { ClaudeTokenUsageRepository } from './adapter-interfaces/ClaudeTokenUsageRepository';
import type { GitHubGraphqlRateLimitRepository } from './adapter-interfaces/GitHubGraphqlRateLimitRepository';
import type { IssueLatestSessionBranchRepository } from './adapter-interfaces/IssueLatestSessionBranchRepository';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import type { LocalCommandRunner } from './adapter-interfaces/LocalCommandRunner';
import type { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import type { TakeOwnershipSpawnRepository } from './adapter-interfaces/TakeOwnershipSpawnRepository';
import { StartPreparationUseCase } from './StartPreparationUseCase';

type Mocked<T> = jest.Mocked<T> & jest.MockedObject<T>;

class InMemoryIssueLatestSessionBranchRepository implements IssueLatestSessionBranchRepository {
  constructor(
    private readonly latestSessionBranchNameByIssueUrl: ReadonlyMap<
      string,
      string
    >,
  ) {}

  findBranchNameByIssue = async (
    issue: Pick<Issue, 'org' | 'repo' | 'number'>,
  ): Promise<string | null> =>
    this.latestSessionBranchNameByIssueUrl.get(
      `https://github.com/${issue.org}/${issue.repo}/issues/${issue.number}`,
    ) ?? null;
}

const createMockStoryObjectMap = (
  issues: Issue[],
  nonGrayDefaultStoryColor: FieldOption['color'] = 'BLUE',
): StoryObjectMap => {
  const map: StoryObjectMap = new Map();
  map.set('Default Story', {
    story: {
      id: 'story-1',
      name: 'Default Story',
      color: nonGrayDefaultStoryColor,
      description: '',
    },
    storyIssue: null,
    issues: issues.map((issue) =>
      issue.story === null ? { ...issue, story: 'Default Story' } : issue,
    ),
  });
  return map;
};

let createdIssuesByUrl = new Map<string, Issue>();

const createMockIssue = (overrides: Partial<Issue> = {}): Issue => {
  const issue = buildMockIssue(overrides);
  createdIssuesByUrl.set(issue.url, issue);
  return issue;
};

const buildMockIssue = (overrides: Partial<Issue> = {}): Issue => ({
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

const createSingleAvailableTokenUsage = (): ClaudeTokenUsage[] => [
  {
    name: 'token-a',
    token: 'token-a',
    fiveHourUtilization: 0,
    sevenDayUtilization: 0,
    blocked: false,
    rejected: false,
    fiveHourRejected: false,
    blockedUntilEpoch: 0,
    modelWeeklyLimits: {},
  },
];

const NO_LLM_MODEL_CONFIGURED_MESSAGE = (issueUrl: string): string =>
  `No LLM model configured for issue ${issueUrl}. Provide --defaultLlmModelName or add an llm-model: label.`;

describe('StartPreparationUseCase agent-definition model resolution', () => {
  let useCase: StartPreparationUseCase;
  let mockProjectRepository: Mocked<
    Pick<ProjectRepository, 'getByUrl' | 'createField' | 'updateAgentList'>
  >;
  let mockIssueRepository: MockProxy<IssueRepository>;
  let mockLocalCommandRunner: Mocked<LocalCommandRunner>;
  let mockClaudeTokenUsageRepository: Mocked<ClaudeTokenUsageRepository>;
  let mockTakeOwnershipSpawnRepository: Mocked<TakeOwnershipSpawnRepository>;
  let mockGitHubGraphqlRateLimitRepository: Mocked<GitHubGraphqlRateLimitRepository>;
  let mockAgentDefinitionRepository: Mocked<AgentDefinitionRepository>;
  let mockProject: Project;

  beforeEach(() => {
    jest.resetAllMocks();
    createdIssuesByUrl = new Map<string, Issue>();
    mockProject = createMockProject();
    mockProjectRepository = {
      getByUrl: jest.fn(),
      createField: jest.fn().mockResolvedValue(undefined),
      updateAgentList: jest.fn().mockResolvedValue([]),
    };
    mockIssueRepository = mock<IssueRepository>();
    mockIssueRepository.getStoryObjectMap.mockResolvedValue(new Map());
    mockIssueRepository.getAllOpened.mockResolvedValue([]);
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([]);
    mockIssueRepository.getOpenPullRequest.mockResolvedValue(null);
    mockIssueRepository.closePullRequest.mockResolvedValue(undefined);
    mockIssueRepository.deletePullRequestBranch.mockResolvedValue(undefined);
    mockIssueRepository.getIssueOrPullRequestComments.mockResolvedValue([]);
    mockIssueRepository.setIssueAgentField.mockResolvedValue(undefined);
    mockIssueRepository.removeLabel.mockResolvedValue(undefined);
    mockIssueRepository.getIssueByUrl.mockResolvedValue(
      createMockIssue({ status: 'Awaiting Workspace', dependedIssueUrls: [] }),
    );
    mockIssueRepository.get.mockImplementation((issueUrl: string) =>
      Promise.resolve(
        createdIssuesByUrl.get(issueUrl) ??
          buildMockIssue({
            url: issueUrl,
            status: 'Awaiting Workspace',
            dependedIssueUrls: [],
          }),
      ),
    );
    mockIssueRepository.removeIssueFromProjectCache.mockResolvedValue(
      undefined,
    );
    mockIssueRepository.appendIssueToProjectCache.mockResolvedValue(undefined);
    mockLocalCommandRunner = {
      runCommand: jest.fn(),
      spawnInteractive: jest.fn(),
    };
    mockClaudeTokenUsageRepository = {
      ensureObservable: jest.fn().mockResolvedValue(undefined),
      getAvailableTokenUsages: jest.fn().mockResolvedValue([]),
      getTokenInFlightCounts: jest.fn().mockResolvedValue({}),
      proxyBaseUrl: jest.fn().mockReturnValue('http://127.0.0.1:8787'),
      reserveTokenLaunchSlot: jest.fn().mockResolvedValue(true),
    };
    mockTakeOwnershipSpawnRepository = {
      listSpawns: jest.fn().mockReturnValue([]),
      listRunningIssueUrls: jest.fn().mockReturnValue([]),
    };
    mockGitHubGraphqlRateLimitRepository = {
      getRemainingRequestCount: jest.fn().mockResolvedValue(null),
    };
    mockAgentDefinitionRepository = {
      getLlmModelName: jest.fn().mockResolvedValue(null),
    };
    useCase = new StartPreparationUseCase(
      mockProjectRepository,
      mockIssueRepository,
      mockLocalCommandRunner,
      mockClaudeTokenUsageRepository,
      mockTakeOwnershipSpawnRepository,
      mockGitHubGraphqlRateLimitRepository,
      new InMemoryIssueLatestSessionBranchRepository(new Map()),
      undefined,
      mockAgentDefinitionRepository,
    );
  });

  it('prioritizes the llm-model: label over routed, agent-definition, and default models', async () => {
    const awaitingIssues: Issue[] = [
      createMockIssue({
        url: 'url1',
        title: 'Issue 1',
        labels: ['category:impl', 'llm-model:claude-opus-5'],
        status: 'Awaiting Workspace',
      }),
    ];
    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.getStoryObjectMap.mockResolvedValue(
      createMockStoryObjectMap(awaitingIssues),
    );
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });
    mockClaudeTokenUsageRepository.getAvailableTokenUsages.mockResolvedValue(
      createSingleAvailableTokenUsage(),
    );
    mockAgentDefinitionRepository.getLlmModelName.mockResolvedValue(
      'claude-haiku-4-5-20251001',
    );

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      defaultAgentName: 'triager',
      defaultLlmModelName: 'claude-opus-4-8',
      defaultLlmAgentName: null,
      configFilePath: '/path/to/config.yml',
      maximumPreparingIssuesCount: null,
      utilizationPercentageThreshold: 90,
      allowedIssueAuthors: ['testuser'],
      manager: 'manager-user',
      codexHomeCandidates: null,
      labelsAsLlmAgentName: null,
    });

    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(1);
    expect(mockLocalCommandRunner.runCommand.mock.calls[0][1][2]).toBe(
      'claude-opus-5',
    );
    expect(mockAgentDefinitionRepository.getLlmModelName).toHaveBeenCalledTimes(
      0,
    );
  });

  it('prioritizes a routed model over the agent-definition and default models when no label is present', async () => {
    const awaitingIssues: Issue[] = [
      createMockIssue({
        url: 'url1',
        title: 'Issue 1',
        labels: ['category:impl'],
        status: 'Awaiting Workspace',
      }),
    ];
    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.getStoryObjectMap.mockResolvedValue(
      createMockStoryObjectMap(awaitingIssues),
    );
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });
    mockClaudeTokenUsageRepository.getAvailableTokenUsages.mockResolvedValue(
      createSingleAvailableTokenUsage(),
    );
    mockAgentDefinitionRepository.getLlmModelName.mockResolvedValue(
      'claude-haiku-4-5-20251001',
    );

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      defaultAgentName: 'triager',
      defaultLlmModelName: 'claude-opus-4-8',
      defaultLlmAgentName: null,
      configFilePath: '/path/to/config.yml',
      maximumPreparingIssuesCount: null,
      utilizationPercentageThreshold: 90,
      allowedIssueAuthors: ['testuser'],
      manager: 'manager-user',
      codexHomeCandidates: null,
      labelsAsLlmAgentName: null,
    });

    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(1);
    expect(mockLocalCommandRunner.runCommand.mock.calls[0][1][2]).toBe(
      'claude-opus-4-8',
    );
    expect(mockAgentDefinitionRepository.getLlmModelName).toHaveBeenCalledTimes(
      0,
    );
  });

  it('resolves the model from the agent-definition repository over defaultLlmModelName when no label and no routed model are available', async () => {
    const awaitingIssues: Issue[] = [
      createMockIssue({
        url: 'url1',
        title: 'Issue 1',
        labels: ['category:impl'],
        status: 'Awaiting Workspace',
      }),
    ];
    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.getStoryObjectMap.mockResolvedValue(
      createMockStoryObjectMap(awaitingIssues),
    );
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });
    mockClaudeTokenUsageRepository.getAvailableTokenUsages.mockResolvedValue(
      [],
    );
    mockAgentDefinitionRepository.getLlmModelName.mockResolvedValue(
      'claude-haiku-4-5-20251001',
    );

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      defaultAgentName: 'triager',
      defaultLlmModelName: 'claude-opus-4-8',
      defaultLlmAgentName: null,
      configFilePath: '/path/to/config.yml',
      maximumPreparingIssuesCount: null,
      utilizationPercentageThreshold: 90,
      allowedIssueAuthors: ['testuser'],
      manager: 'manager-user',
      codexHomeCandidates: null,
      labelsAsLlmAgentName: null,
    });

    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(1);
    expect(mockLocalCommandRunner.runCommand.mock.calls[0][1][2]).toBe(
      'claude-haiku-4-5-20251001',
    );
    expect(mockAgentDefinitionRepository.getLlmModelName).toHaveBeenCalledTimes(
      1,
    );
    expect(mockAgentDefinitionRepository.getLlmModelName).toHaveBeenCalledWith(
      'triager',
    );
  });

  it('falls back to defaultLlmModelName when the agent-definition repository resolves no model', async () => {
    const awaitingIssues: Issue[] = [
      createMockIssue({
        url: 'url1',
        title: 'Issue 1',
        labels: ['category:impl'],
        status: 'Awaiting Workspace',
      }),
    ];
    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.getStoryObjectMap.mockResolvedValue(
      createMockStoryObjectMap(awaitingIssues),
    );
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });
    mockClaudeTokenUsageRepository.getAvailableTokenUsages.mockResolvedValue(
      [],
    );
    mockAgentDefinitionRepository.getLlmModelName.mockResolvedValue(null);

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      defaultAgentName: 'triager',
      defaultLlmModelName: 'claude-opus-4-8',
      defaultLlmAgentName: null,
      configFilePath: '/path/to/config.yml',
      maximumPreparingIssuesCount: null,
      utilizationPercentageThreshold: 90,
      allowedIssueAuthors: ['testuser'],
      manager: 'manager-user',
      codexHomeCandidates: null,
      labelsAsLlmAgentName: null,
    });

    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(1);
    expect(mockLocalCommandRunner.runCommand.mock.calls[0][1][2]).toBe(
      'claude-opus-4-8',
    );
    expect(mockAgentDefinitionRepository.getLlmModelName).toHaveBeenCalledTimes(
      1,
    );
  });

  it('resolves the model from the agent-definition repository and does not skip the issue when no other model source is configured', async () => {
    const awaitingIssues: Issue[] = [
      createMockIssue({
        url: 'url1',
        title: 'Issue 1',
        labels: ['category:impl'],
        status: 'Awaiting Workspace',
      }),
    ];
    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.getStoryObjectMap.mockResolvedValue(
      createMockStoryObjectMap(awaitingIssues),
    );
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });
    mockClaudeTokenUsageRepository.getAvailableTokenUsages.mockResolvedValue(
      [],
    );
    mockAgentDefinitionRepository.getLlmModelName.mockResolvedValue('opus');
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      defaultAgentName: 'spec-creator',
      defaultLlmModelName: null,
      defaultLlmAgentName: null,
      configFilePath: '/path/to/config.yml',
      maximumPreparingIssuesCount: null,
      utilizationPercentageThreshold: 90,
      allowedIssueAuthors: ['testuser'],
      manager: 'manager-user',
      codexHomeCandidates: null,
      labelsAsLlmAgentName: null,
    });

    expect(consoleErrorSpy).not.toHaveBeenCalledWith(
      NO_LLM_MODEL_CONFIGURED_MESSAGE('url1'),
    );
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(1);
    expect(mockLocalCommandRunner.runCommand.mock.calls[0][1][2]).toBe('opus');
    expect(mockAgentDefinitionRepository.getLlmModelName).toHaveBeenCalledTimes(
      1,
    );
    expect(mockAgentDefinitionRepository.getLlmModelName).toHaveBeenCalledWith(
      'spec-creator',
    );
    consoleErrorSpy.mockRestore();
  });

  it('uses the model resolved for the reassigned agent, not the stale pre-reassignment agent, when the staleness recheck changes the agent after the early-exit guard already resolved agentDefinitionModelName', async () => {
    const awaitingIssues: Issue[] = [
      createMockIssue({
        url: 'url1',
        title: 'Issue 1',
        labels: ['category:impl'],
        status: 'Awaiting Workspace',
        agent: 'triager',
      }),
    ];
    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.getStoryObjectMap.mockResolvedValue(
      createMockStoryObjectMap(awaitingIssues),
    );
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });
    mockClaudeTokenUsageRepository.getAvailableTokenUsages.mockResolvedValue(
      [],
    );
    mockIssueRepository.get.mockResolvedValue(
      buildMockIssue({
        url: 'url1',
        title: 'Issue 1',
        labels: ['category:impl'],
        status: 'Awaiting Workspace',
        agent: 'spec-creator',
        dependedIssueUrls: [],
        isClosed: false,
      }),
    );
    mockAgentDefinitionRepository.getLlmModelName.mockImplementation(
      (agentName: string) => {
        if (agentName === 'triager') {
          return Promise.resolve('initial-agent-model');
        }
        if (agentName === 'spec-creator') {
          return Promise.resolve('reassigned-agent-model');
        }
        return Promise.resolve(null);
      },
    );

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      defaultAgentName: 'triager',
      defaultLlmModelName: null,
      defaultLlmAgentName: null,
      configFilePath: '/path/to/config.yml',
      maximumPreparingIssuesCount: null,
      utilizationPercentageThreshold: 90,
      allowedIssueAuthors: ['testuser'],
      manager: 'manager-user',
      codexHomeCandidates: null,
      labelsAsLlmAgentName: null,
    });

    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(1);
    expect(mockLocalCommandRunner.runCommand.mock.calls[0][1][1]).toBe(
      'spec-creator',
    );
    expect(mockLocalCommandRunner.runCommand.mock.calls[0][1][2]).toBe(
      'reassigned-agent-model',
    );
  });
});
