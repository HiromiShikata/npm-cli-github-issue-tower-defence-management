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

class InMemoryIssueLatestSessionBranchRepository
  implements IssueLatestSessionBranchRepository
{
  findBranchNameByIssue = async (): Promise<string | null> => null;
}

const createMockStoryObjectMap = (issues: Issue[]): StoryObjectMap => {
  const map: StoryObjectMap = new Map();
  map.set('Default Story', {
    story: {
      id: 'story-1',
      name: 'Default Story',
      color: 'GRAY',
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
  createdAt: new Date(),
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
    const mockIssueRepository: Mocked<
      Pick<
        IssueRepository,
        | 'getStoryObjectMap'
        | 'getAllOpened'
        | 'updateStatus'
        | 'findRelatedOpenPRs'
        | 'getOpenPullRequest'
        | 'closePullRequest'
        | 'deletePullRequestBranch'
        | 'createCommentByUrl'
        | 'getIssueOrPullRequestComments'
        | 'setIssueAgentField'
        | 'removeLabel'
        | 'getIssueByUrl'
        | 'get'
        | 'removeIssueFromProjectCache'
        | 'appendIssueToProjectCache'
      >
    > = {
      getStoryObjectMap: jest
        .fn()
        .mockResolvedValue(createMockStoryObjectMap([awaitingIssue])),
      getAllOpened: jest.fn().mockResolvedValue([]),
      updateStatus: jest.fn(),
      findRelatedOpenPRs: jest.fn().mockResolvedValue([]),
      getOpenPullRequest: jest.fn().mockResolvedValue(null),
      closePullRequest: jest.fn().mockResolvedValue(undefined),
      deletePullRequestBranch: jest.fn().mockResolvedValue(undefined),
      createCommentByUrl: jest.fn().mockResolvedValue(undefined),
      getIssueOrPullRequestComments: jest.fn().mockResolvedValue([]),
      setIssueAgentField: jest.fn().mockResolvedValue(undefined),
      removeLabel: jest.fn().mockResolvedValue(undefined),
      getIssueByUrl: jest
        .fn()
        .mockResolvedValue(
          createMockIssue({ status: 'Awaiting Workspace', dependedIssueUrls: [] }),
        ),
      get: jest
        .fn()
        .mockResolvedValue(
          createMockIssue({ status: 'Awaiting Workspace', dependedIssueUrls: [] }),
        ),
      removeIssueFromProjectCache: jest.fn().mockResolvedValue(undefined),
      appendIssueToProjectCache: jest.fn().mockResolvedValue(undefined),
    };
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
});
