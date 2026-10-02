import { mock, MockProxy } from 'jest-mock-extended';
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
import { StartPreparationUseCase } from './StartPreparationUseCase';

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

describe('StartPreparationUseCase.run per-process launch reservation', () => {
  it('does not spawn for a token whose reserveTokenLaunchSlot call resolves false, even though the in-flight read alone showed room', async () => {
    const mockProject = createMockProject();
    const awaitingIssue = createMockIssue({
      url: 'url1',
      title: 'Issue 1',
      labels: ['category:impl'],
      status: 'Awaiting Workspace',
      number: 1,
      itemId: 'item-1',
    });
    const mockProjectRepository: Mocked<
      Pick<ProjectRepository, 'getByUrl' | 'createField' | 'updateAgentList'>
    > = {
      getByUrl: jest.fn().mockResolvedValue(mockProject),
      createField: jest.fn().mockResolvedValue(undefined),
      updateAgentList: jest.fn().mockResolvedValue([]),
    };
    const mockIssueRepository: MockProxy<IssueRepository> =
      mock<IssueRepository>();
    mockIssueRepository.getStoryObjectMap.mockResolvedValue(
      createMockStoryObjectMap([awaitingIssue]),
    );
    mockIssueRepository.getAllOpened.mockResolvedValue([]);
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([]);
    mockIssueRepository.getOpenPullRequest.mockResolvedValue(null);
    mockIssueRepository.closePullRequest.mockResolvedValue(undefined);
    mockIssueRepository.deletePullRequestBranch.mockResolvedValue(undefined);
    mockIssueRepository.createCommentByUrl.mockResolvedValue({
      author: '',
      body: '',
      createdAt: new Date(0),
    });
    mockIssueRepository.getIssueOrPullRequestComments.mockResolvedValue([]);
    mockIssueRepository.setIssueAgentField.mockResolvedValue(undefined);
    mockIssueRepository.removeLabel.mockResolvedValue(undefined);
    mockIssueRepository.getIssueByUrl.mockResolvedValue(
      createMockIssue({
        status: 'Awaiting Workspace',
        dependedIssueUrls: [],
      }),
    );
    mockIssueRepository.get.mockResolvedValue(
      createMockIssue({
        status: 'Awaiting Workspace',
        dependedIssueUrls: [],
      }),
    );
    mockIssueRepository.removeIssueFromProjectCache.mockResolvedValue(
      undefined,
    );
    mockIssueRepository.appendIssueToProjectCache.mockResolvedValue(undefined);
    const mockLocalCommandRunner: Mocked<LocalCommandRunner> = {
      runCommand: jest.fn().mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0,
      }),
      spawnInteractive: jest.fn(),
    };
    const mockReserveTokenLaunchSlot = jest.fn().mockResolvedValue(false);
    const claudeTokenUsageRepositoryWithReservation: ClaudeTokenUsageRepository =
      {
        ensureObservable: jest.fn().mockResolvedValue(undefined),
        getAvailableTokenUsages: jest.fn().mockResolvedValue([
          {
            name: 'token-a',
            token: 'token-a',
            fiveHourUtilization: 0.1,
            sevenDayUtilization: 0.1,
            blocked: false,
            rejected: false,
            fiveHourRejected: false,
            blockedUntilEpoch: 0,
            modelWeeklyLimits: {},
          },
        ]),
        getTokenInFlightCounts: jest.fn().mockResolvedValue({ 'token-a': 0 }),
        proxyBaseUrl: jest.fn().mockReturnValue('http://127.0.0.1:8787'),
        reserveTokenLaunchSlot: mockReserveTokenLaunchSlot,
      };
    const mockTakeOwnershipSpawnRepository: Mocked<TakeOwnershipSpawnRepository> =
      {
        listSpawns: jest.fn().mockReturnValue([]),
        listRunningIssueUrls: jest.fn().mockReturnValue([]),
      };
    const mockGitHubGraphqlRateLimitRepository: Mocked<GitHubGraphqlRateLimitRepository> =
      {
        getRemainingRequestCount: jest.fn().mockResolvedValue(null),
      };
    const useCase = new StartPreparationUseCase(
      mockProjectRepository,
      mockIssueRepository,
      mockLocalCommandRunner,
      claudeTokenUsageRepositoryWithReservation,
      mockTakeOwnershipSpawnRepository,
      mockGitHubGraphqlRateLimitRepository,
      new InMemoryIssueLatestSessionBranchRepository(),
    );

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
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

    expect(mockReserveTokenLaunchSlot).toHaveBeenCalled();
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(0);
  });

  it('denies the launch reservation for the first candidate token and grants it for the second, spawning the worker with the second token', async () => {
    const mockProject = createMockProject();
    const awaitingIssue = createMockIssue({
      url: 'url1',
      title: 'Issue 1',
      labels: ['category:impl'],
      status: 'Awaiting Workspace',
      number: 1,
      itemId: 'item-1',
    });
    const mockProjectRepository: Mocked<
      Pick<ProjectRepository, 'getByUrl' | 'createField' | 'updateAgentList'>
    > = {
      getByUrl: jest.fn().mockResolvedValue(mockProject),
      createField: jest.fn().mockResolvedValue(undefined),
      updateAgentList: jest.fn().mockResolvedValue([]),
    };
    const mockIssueRepository: MockProxy<IssueRepository> =
      mock<IssueRepository>();
    mockIssueRepository.getStoryObjectMap.mockResolvedValue(
      createMockStoryObjectMap([awaitingIssue]),
    );
    mockIssueRepository.getAllOpened.mockResolvedValue([]);
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([]);
    mockIssueRepository.getOpenPullRequest.mockResolvedValue(null);
    mockIssueRepository.closePullRequest.mockResolvedValue(undefined);
    mockIssueRepository.deletePullRequestBranch.mockResolvedValue(undefined);
    mockIssueRepository.createCommentByUrl.mockResolvedValue({
      author: '',
      body: '',
      createdAt: new Date(0),
    });
    mockIssueRepository.getIssueOrPullRequestComments.mockResolvedValue([]);
    mockIssueRepository.setIssueAgentField.mockResolvedValue(undefined);
    mockIssueRepository.removeLabel.mockResolvedValue(undefined);
    mockIssueRepository.getIssueByUrl.mockResolvedValue(
      createMockIssue({
        status: 'Awaiting Workspace',
        dependedIssueUrls: [],
      }),
    );
    mockIssueRepository.get.mockResolvedValue(
      createMockIssue({
        status: 'Awaiting Workspace',
        dependedIssueUrls: [],
      }),
    );
    mockIssueRepository.removeIssueFromProjectCache.mockResolvedValue(
      undefined,
    );
    mockIssueRepository.appendIssueToProjectCache.mockResolvedValue(undefined);
    const mockLocalCommandRunner: Mocked<LocalCommandRunner> = {
      runCommand: jest.fn().mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0,
      }),
      spawnInteractive: jest.fn(),
    };
    const mockReserveTokenLaunchSlot = jest
      .fn()
      .mockImplementation(
        async (params: { token: string }) => params.token !== 'first-token',
      );
    const claudeTokenUsageRepositoryWithTwoTokens: ClaudeTokenUsageRepository =
      {
        ensureObservable: jest.fn().mockResolvedValue(undefined),
        getAvailableTokenUsages: jest.fn().mockResolvedValue([
          {
            name: 'first-token',
            token: 'first-token',
            fiveHourUtilization: 0.1,
            sevenDayUtilization: 0.1,
            blocked: false,
            rejected: false,
            fiveHourRejected: false,
            blockedUntilEpoch: 0,
            modelWeeklyLimits: {},
          },
          {
            name: 'second-token',
            token: 'second-token',
            fiveHourUtilization: 0.1,
            sevenDayUtilization: 0.1,
            blocked: false,
            rejected: false,
            fiveHourRejected: false,
            blockedUntilEpoch: 0,
            modelWeeklyLimits: {},
          },
        ]),
        getTokenInFlightCounts: jest
          .fn()
          .mockResolvedValue({ 'first-token': 0, 'second-token': 0 }),
        proxyBaseUrl: jest.fn().mockReturnValue('http://127.0.0.1:8787'),
        reserveTokenLaunchSlot: mockReserveTokenLaunchSlot,
      };
    const mockTakeOwnershipSpawnRepository: Mocked<TakeOwnershipSpawnRepository> =
      {
        listSpawns: jest.fn().mockReturnValue([]),
        listRunningIssueUrls: jest.fn().mockReturnValue([]),
      };
    const mockGitHubGraphqlRateLimitRepository: Mocked<GitHubGraphqlRateLimitRepository> =
      {
        getRemainingRequestCount: jest.fn().mockResolvedValue(null),
      };
    const useCase = new StartPreparationUseCase(
      mockProjectRepository,
      mockIssueRepository,
      mockLocalCommandRunner,
      claudeTokenUsageRepositoryWithTwoTokens,
      mockTakeOwnershipSpawnRepository,
      mockGitHubGraphqlRateLimitRepository,
      new InMemoryIssueLatestSessionBranchRepository(),
    );

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
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

    expect(mockReserveTokenLaunchSlot).toHaveBeenCalledWith(
      expect.objectContaining({ token: 'first-token' }),
    );
    expect(mockReserveTokenLaunchSlot).toHaveBeenCalledWith(
      expect.objectContaining({ token: 'second-token' }),
    );
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(1);
    expect(
      mockLocalCommandRunner.runCommand.mock.calls[0]?.[2]?.env
        ?.CLAUDE_CODE_OAUTH_TOKEN,
    ).toBe('second-token');
  });

  it('reverts the first candidate to Awaiting Workspace without spawning it when reserveTokenLaunchSlot rejects, and still spawns the next candidate', async () => {
    const mockProject = createMockProject();
    const firstAwaitingIssue = createMockIssue({
      url: 'url1',
      title: 'Issue 1',
      labels: ['category:impl'],
      status: 'Awaiting Workspace',
      number: 1,
      itemId: 'item-1',
    });
    const secondAwaitingIssue = createMockIssue({
      url: 'url2',
      title: 'Issue 2',
      labels: ['category:impl'],
      status: 'Awaiting Workspace',
      number: 2,
      itemId: 'item-2',
    });
    const mockProjectRepository: Mocked<
      Pick<ProjectRepository, 'getByUrl' | 'createField' | 'updateAgentList'>
    > = {
      getByUrl: jest.fn().mockResolvedValue(mockProject),
      createField: jest.fn().mockResolvedValue(undefined),
      updateAgentList: jest.fn().mockResolvedValue([]),
    };
    const mockIssueRepository: MockProxy<IssueRepository> =
      mock<IssueRepository>();
    mockIssueRepository.getStoryObjectMap.mockResolvedValue(
      createMockStoryObjectMap([firstAwaitingIssue, secondAwaitingIssue]),
    );
    mockIssueRepository.getAllOpened.mockResolvedValue([]);
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([]);
    mockIssueRepository.getOpenPullRequest.mockResolvedValue(null);
    mockIssueRepository.closePullRequest.mockResolvedValue(undefined);
    mockIssueRepository.deletePullRequestBranch.mockResolvedValue(undefined);
    mockIssueRepository.createCommentByUrl.mockResolvedValue({
      author: '',
      body: '',
      createdAt: new Date(0),
    });
    mockIssueRepository.getIssueOrPullRequestComments.mockResolvedValue([]);
    mockIssueRepository.setIssueAgentField.mockResolvedValue(undefined);
    mockIssueRepository.removeLabel.mockResolvedValue(undefined);
    mockIssueRepository.getIssueByUrl.mockResolvedValue(
      createMockIssue({
        status: 'Awaiting Workspace',
        dependedIssueUrls: [],
      }),
    );
    mockIssueRepository.get.mockResolvedValue(
      createMockIssue({
        status: 'Awaiting Workspace',
        dependedIssueUrls: [],
      }),
    );
    mockIssueRepository.removeIssueFromProjectCache.mockResolvedValue(
      undefined,
    );
    mockIssueRepository.appendIssueToProjectCache.mockResolvedValue(undefined);
    const mockLocalCommandRunner: Mocked<LocalCommandRunner> = {
      runCommand: jest.fn().mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0,
      }),
      spawnInteractive: jest.fn(),
    };
    const mockReserveTokenLaunchSlot = jest
      .fn()
      .mockRejectedValueOnce(
        new Error('Timed out waiting for project cache lock'),
      )
      .mockResolvedValueOnce(true);
    const claudeTokenUsageRepositoryWithReservation: ClaudeTokenUsageRepository =
      {
        ensureObservable: jest.fn().mockResolvedValue(undefined),
        getAvailableTokenUsages: jest.fn().mockResolvedValue([
          {
            name: 'token-a',
            token: 'token-a',
            fiveHourUtilization: 0.1,
            sevenDayUtilization: 0.1,
            blocked: false,
            rejected: false,
            fiveHourRejected: false,
            blockedUntilEpoch: 0,
            modelWeeklyLimits: {},
          },
        ]),
        getTokenInFlightCounts: jest.fn().mockResolvedValue({ 'token-a': 0 }),
        proxyBaseUrl: jest.fn().mockReturnValue('http://127.0.0.1:8787'),
        reserveTokenLaunchSlot: mockReserveTokenLaunchSlot,
      };
    const mockTakeOwnershipSpawnRepository: Mocked<TakeOwnershipSpawnRepository> =
      {
        listSpawns: jest.fn().mockReturnValue([]),
        listRunningIssueUrls: jest.fn().mockReturnValue([]),
      };
    const mockGitHubGraphqlRateLimitRepository: Mocked<GitHubGraphqlRateLimitRepository> =
      {
        getRemainingRequestCount: jest.fn().mockResolvedValue(null),
      };
    const useCase = new StartPreparationUseCase(
      mockProjectRepository,
      mockIssueRepository,
      mockLocalCommandRunner,
      claudeTokenUsageRepositoryWithReservation,
      mockTakeOwnershipSpawnRepository,
      mockGitHubGraphqlRateLimitRepository,
      new InMemoryIssueLatestSessionBranchRepository(),
    );

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
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

    expect(mockReserveTokenLaunchSlot.mock.calls).toHaveLength(2);
    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(3);
    expect(mockIssueRepository.updateStatus.mock.calls[0]?.[1]).toMatchObject({
      url: 'url1',
    });
    expect(mockIssueRepository.updateStatus.mock.calls[0]?.[2]).toBe('2');
    expect(mockIssueRepository.updateStatus.mock.calls[1]?.[1]).toMatchObject({
      url: 'url1',
    });
    expect(mockIssueRepository.updateStatus.mock.calls[1]?.[2]).toBe('1');
    expect(mockIssueRepository.updateStatus.mock.calls[2]?.[1]).toMatchObject({
      url: 'url2',
    });
    expect(mockIssueRepository.updateStatus.mock.calls[2]?.[2]).toBe('2');
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(1);
    expect(mockLocalCommandRunner.runCommand.mock.calls[0]?.[1]).toContain(
      'url2',
    );
  });
});
