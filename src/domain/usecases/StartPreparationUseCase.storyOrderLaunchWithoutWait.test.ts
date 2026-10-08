import { mock, MockProxy } from 'jest-mock-extended';
import type { ClaudeTokenUsage } from '../entities/ClaudeTokenUsage';
import type { Issue } from '../entities/Issue';
import type { FieldOption, Project } from '../entities/Project';
import { buildStoryObjectMap } from '../entities/StoryObjectMap';
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

const PROJECT_URL = 'https://github.com/users/user/projects/1';
const PROXY_BASE_URL = 'http://127.0.0.1:8787';
const SPAWN_TOKEN = 'spawn-token';

const storiesInStoryOrder: FieldOption[] = [
  {
    id: 'story-top-ranked',
    name: 'Top ranked story',
    color: 'BLUE',
    description: '',
  },
  {
    id: 'story-second-ranked',
    name: 'Second ranked story',
    color: 'GREEN',
    description: '',
  },
  {
    id: 'story-third-ranked',
    name: 'Third ranked story',
    color: 'YELLOW',
    description: '',
  },
];

const createAwaitingWorkspaceIssue = (input: {
  number: number;
  story: FieldOption;
  createdAt: Date;
}): Issue => ({
  nameWithOwner: 'user/repo',
  number: input.number,
  title: `Issue ${input.number}`,
  state: 'OPEN',
  status: 'Awaiting Workspace',
  story: input.story.name,
  storyOptionId: input.story.id,
  nextActionDate: null,
  nextActionHour: null,
  estimationMinutes: null,
  dependedIssueUrls: [],
  completionDate50PercentConfidence: null,
  url: `https://github.com/user/repo/issues/${input.number}`,
  assignees: ['manager-user'],
  labels: ['category:impl'],
  org: 'user',
  repo: 'repo',
  body: '',
  itemId: `item-${input.number}`,
  isPr: false,
  isInProgress: false,
  isClosed: false,
  createdAt: input.createdAt,
  author: 'testuser',
  closingIssueReferenceUrls: [],
  plainCrossRepoIssueReferenceUrls: [],
  agent: null,
  stateReason: null,
});

const topRankedStoryIssue = createAwaitingWorkspaceIssue({
  number: 3,
  story: storiesInStoryOrder[0],
  createdAt: new Date('2020-03-01T00:00:00Z'),
});
const secondRankedStoryIssue = createAwaitingWorkspaceIssue({
  number: 1,
  story: storiesInStoryOrder[1],
  createdAt: new Date('2020-01-01T00:00:00Z'),
});
const thirdRankedStoryIssue = createAwaitingWorkspaceIssue({
  number: 2,
  story: storiesInStoryOrder[2],
  createdAt: new Date('2020-02-01T00:00:00Z'),
});
const awaitingWorkspaceIssues = [
  secondRankedStoryIssue,
  thirdRankedStoryIssue,
  topRankedStoryIssue,
];

const createProjectWithStoryOrder = (): Project => ({
  id: 'project-1',
  url: PROJECT_URL,
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
  story: {
    name: 'Story',
    fieldId: 'story-field-id',
    databaseId: 2,
    stories: storiesInStoryOrder,
    workflowManagementStory: {
      id: 'story-workflow-management',
      name: 'regular / workflow management',
    },
  },
  remainingEstimationMinutes: null,
  dependedIssueUrlSeparatedByComma: null,
  completionDate50PercentConfidence: null,
  agent: null,
});

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

const harnessCreate = () => {
  const project = createProjectWithStoryOrder();
  const issueByUrl = new Map(
    awaitingWorkspaceIssues.map((issue) => [issue.url, issue]),
  );
  const projectRepository: Mocked<
    Pick<ProjectRepository, 'getByUrl' | 'createField' | 'updateAgentList'>
  > = {
    getByUrl: jest.fn().mockResolvedValue(project),
    createField: jest.fn().mockResolvedValue(undefined),
    updateAgentList: jest.fn().mockResolvedValue([]),
  };
  const issueRepository: MockProxy<IssueRepository> = mock<IssueRepository>();
  issueRepository.getStoryObjectMap.mockResolvedValue(
    buildStoryObjectMap({ project, issues: awaitingWorkspaceIssues }),
  );
  issueRepository.getAllOpened.mockResolvedValue([]);
  issueRepository.findRelatedOpenPRs.mockResolvedValue([]);
  issueRepository.getOpenPullRequest.mockResolvedValue(null);
  issueRepository.createCommentByUrl.mockResolvedValue({
    id: 1,
    author: '',
    body: '',
    createdAt: new Date(0),
  });
  issueRepository.getIssueOrPullRequestComments.mockResolvedValue([]);
  issueRepository.setIssueAgentField.mockResolvedValue(undefined);
  issueRepository.removeLabel.mockResolvedValue(undefined);
  issueRepository.getIssueByUrl.mockImplementation(
    async (issueUrl) => issueByUrl.get(issueUrl) ?? null,
  );
  issueRepository.get.mockImplementation(
    async (issueUrl) => issueByUrl.get(issueUrl) ?? null,
  );
  issueRepository.removeIssueFromProjectCache.mockResolvedValue(undefined);
  issueRepository.appendIssueToProjectCache.mockResolvedValue(undefined);
  const localCommandRunner: Mocked<LocalCommandRunner> = {
    runCommand: jest
      .fn()
      .mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 }),
    spawnInteractive: jest.fn(),
  };
  const claudeTokenUsageRepository: MockProxy<ClaudeTokenUsageRepository> =
    mock<ClaudeTokenUsageRepository>();
  claudeTokenUsageRepository.ensureObservable.mockResolvedValue(undefined);
  claudeTokenUsageRepository.getAvailableTokenUsages.mockResolvedValue([
    spawnTokenUsage,
  ]);
  claudeTokenUsageRepository.getTokenInFlightCounts.mockResolvedValue({
    [SPAWN_TOKEN]: 0,
  });
  claudeTokenUsageRepository.proxyBaseUrl.mockReturnValue(PROXY_BASE_URL);
  claudeTokenUsageRepository.reserveTokenLaunchSlot.mockResolvedValue(true);
  const takeOwnershipSpawnRepository: Mocked<TakeOwnershipSpawnRepository> = {
    listSpawns: jest.fn().mockReturnValue([]),
    listRunningIssueUrls: jest.fn().mockReturnValue([]),
  };
  const gitHubGraphqlRateLimitRepository: Mocked<GitHubGraphqlRateLimitRepository> =
    {
      getRemainingRequestCount: jest.fn().mockResolvedValue(null),
    };
  const sleep = jest.fn<Promise<void>, [number]>().mockResolvedValue(undefined);
  const useCase = new StartPreparationUseCase(
    projectRepository,
    issueRepository,
    localCommandRunner,
    claudeTokenUsageRepository,
    takeOwnershipSpawnRepository,
    gitHubGraphqlRateLimitRepository,
    new InMemoryIssueLatestSessionBranchRepository(),
    sleep,
  );
  return {
    useCase,
    localCommandRunner,
    claudeTokenUsageRepository,
    sleep,
  };
};

describe('StartPreparationUseCase.run launch across several stories with the sleep function as the eighth constructor argument', () => {
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

  it('reserves a token launch slot and runs aw for the issue whose Story ranks first in Story order in one run without calling the injected sleep function', async () => {
    const harness = harnessCreate();

    await harness.useCase.run({
      projectUrl: PROJECT_URL,
      defaultAgentName: 'agent1',
      defaultLlmModelName: 'claude-opus',
      fallbackLlmModelName: null,
      defaultLlmAgentName: null,
      configFilePath: '/path/to/config.yml',
      maximumPreparingIssuesCount: 1,
      utilizationPercentageThreshold: 90,
      allowedIssueAuthors: ['testuser'],
      manager: 'manager-user',
      codexHomeCandidates: null,
      labelsAsLlmAgentName: null,
    });

    expect(
      harness.localCommandRunner.runCommand.mock.calls.map(
        ([command, awArguments, options]) => ({
          command,
          launchedIssueUrl: awArguments[0],
          branchArgument: awArguments[awArguments.indexOf('--branch') + 1],
          options,
        }),
      ),
    ).toEqual([
      {
        command: 'aw',
        launchedIssueUrl: topRankedStoryIssue.url,
        branchArgument: `i${topRankedStoryIssue.number}`,
        options: {
          env: {
            CLAUDE_CODE_OAUTH_TOKEN: SPAWN_TOKEN,
            ANTHROPIC_BASE_URL: PROXY_BASE_URL,
          },
        },
      },
    ]);
    expect(
      harness.claudeTokenUsageRepository.reserveTokenLaunchSlot.mock.calls.map(
        ([reservation]) => reservation.issueUrl,
      ),
    ).toEqual([topRankedStoryIssue.url]);
    expect(
      harness.claudeTokenUsageRepository.reserveTokenLaunchSlot.mock
        .invocationCallOrder[0],
    ).toBeLessThan(
      harness.localCommandRunner.runCommand.mock.invocationCallOrder[0],
    );
    expect(harness.sleep).not.toHaveBeenCalled();
  });
});
