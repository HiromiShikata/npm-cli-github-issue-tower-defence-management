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
import { StartPreparationUseCase } from './StartPreparationUseCase';

type Mocked<T> = jest.Mocked<T> & jest.MockedObject<T>;

class InMemoryIssueLatestSessionBranchRepository implements IssueLatestSessionBranchRepository {
  findBranchNameByIssue = async (): Promise<string | null> => null;
}

const ORGANIZATION_BOARD_URL = 'https://github.com/orgs/example-org/projects/1';
const USER_BOARD_URL = 'https://github.com/users/example-user/projects/1';
const DEFAULT_AGENT_NAME = 'default-agent';
const LISTED_AGENT_NAME = 'impl';
const UNLISTED_AGENT_NAME = 'rogue-agent';
const ACCEPTED_ISSUE_URL =
  'https://github.com/example-org/example-repo/issues/1';
const REJECTED_ISSUE_URL =
  'https://github.com/example-org/example-repo/issues/2';
const USER_BOARD_ISSUE_URL =
  'https://github.com/example-user/example-repo/issues/1';
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

const createIssue = (overrides: Partial<Issue> = {}): Issue => ({
  nameWithOwner: 'example-org/example-repo',
  number: 1,
  title: 'Example Issue',
  state: 'OPEN',
  status: 'Awaiting Workspace',
  story: null,
  nextActionDate: null,
  nextActionHour: null,
  estimationMinutes: null,
  dependedIssueUrls: [],
  completionDate50PercentConfidence: null,
  url: ACCEPTED_ISSUE_URL,
  assignees: ['manager-user'],
  labels: ['category:impl'],
  org: 'example-org',
  repo: 'example-repo',
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

const createProject = (projectUrl: string): Project => ({
  id: 'project-1',
  url: projectUrl,
  databaseId: 1,
  name: 'Example Project',
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

const createStoryObjectMap = (issues: Issue[]): StoryObjectMap => {
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

const createHarness = (projectUrl: string, issues: Issue[]) => {
  const projectRepository: Mocked<
    Pick<ProjectRepository, 'getByUrl' | 'createField' | 'updateAgentList'>
  > = {
    getByUrl: jest.fn().mockResolvedValue(createProject(projectUrl)),
    createField: jest.fn().mockResolvedValue(undefined),
    updateAgentList: jest.fn().mockResolvedValue([]),
  };
  const issueRepository: MockProxy<IssueRepository> = mock<IssueRepository>();
  issueRepository.getStoryObjectMap.mockResolvedValue(
    createStoryObjectMap(issues),
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
    createIssue({ dependedIssueUrls: [] }),
  );
  issueRepository.get.mockImplementation(
    async (url) => issues.find((issue) => issue.url === url) ?? null,
  );
  issueRepository.removeIssueFromProjectCache.mockResolvedValue(undefined);
  issueRepository.appendIssueToProjectCache.mockResolvedValue(undefined);
  const localCommandRunner: Mocked<LocalCommandRunner> = {
    runCommand: jest
      .fn()
      .mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 }),
    spawnInteractive: jest.fn(),
  };
  const claudeTokenUsageRepository: ClaudeTokenUsageRepository = {
    ensureObservable: jest.fn().mockResolvedValue(undefined),
    getAvailableTokenUsages: jest.fn().mockResolvedValue([spawnTokenUsage]),
    getTokenInFlightCounts: jest.fn().mockResolvedValue({ [SPAWN_TOKEN]: 0 }),
    proxyBaseUrl: jest.fn().mockReturnValue('http://127.0.0.1:8787'),
    reserveTokenLaunchSlot: jest.fn().mockResolvedValue(true),
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
  return { useCase, localCommandRunner };
};

const runParams = (
  projectUrl: string,
  agents: string[] | null,
): Parameters<StartPreparationUseCase['run']>[0] => ({
  projectUrl,
  defaultAgentName: DEFAULT_AGENT_NAME,
  defaultLlmModelName: 'claude-opus',
  defaultLlmAgentName: null,
  configFilePath: '/path/to/config.yml',
  maximumPreparingIssuesCount: null,
  allowedIssueAuthors: ['testuser'],
  manager: 'manager-user',
  codexHomeCandidates: null,
  labelsAsLlmAgentName: null,
  agents,
  normalConcurrentLimit: 6,
});

const launchedAgentNameByIssueUrl = (
  localCommandRunner: Mocked<LocalCommandRunner>,
): Map<string, string> =>
  new Map(
    localCommandRunner.runCommand.mock.calls
      .filter(([command]) => command === 'aw')
      .map(([, awArguments]) => [awArguments[0], awArguments[1]] as const),
  );

const errorMessages = (spy: jest.SpyInstance): string[] =>
  spy.mock.calls.map((callArguments: unknown[]) =>
    callArguments.map((argument) => String(argument)).join(' '),
  );

const rejectedAgentErrorMessage = (
  rejectedAgentName: string,
  agentsAllowedOnBoard: string[],
): string =>
  `Not launching ${REJECTED_ISSUE_URL}: agent "${rejectedAgentName}" is neither in the agents list (${JSON.stringify(agentsAllowedOnBoard)}) nor the defaultAgentName "${DEFAULT_AGENT_NAME}" for the organization-owned board ${ORGANIZATION_BOARD_URL}.`;

describe('StartPreparationUseCase.run organization board agent allowlist', () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('organization board: agents that are allowed are launched', () => {
    const allowedCases: ReadonlyArray<{
      name: string;
      issueAgent: string | null;
      agents: string[];
      expectedAgentName: string;
    }> = [
      {
        name: 'an agent listed in agents',
        issueAgent: LISTED_AGENT_NAME,
        agents: [LISTED_AGENT_NAME],
        expectedAgentName: LISTED_AGENT_NAME,
      },
      {
        name: 'the defaultAgentName when it is not listed in agents',
        issueAgent: DEFAULT_AGENT_NAME,
        agents: [LISTED_AGENT_NAME],
        expectedAgentName: DEFAULT_AGENT_NAME,
      },
      {
        name: 'an issue with no agent, which resolves to defaultAgentName',
        issueAgent: null,
        agents: [LISTED_AGENT_NAME],
        expectedAgentName: DEFAULT_AGENT_NAME,
      },
    ];

    it('launches a worker with the resolved agent for each allowed case', async () => {
      for (const allowedCase of allowedCases) {
        const issue = createIssue({
          url: ACCEPTED_ISSUE_URL,
          agent: allowedCase.issueAgent,
        });
        const harness = createHarness(ORGANIZATION_BOARD_URL, [issue]);
        consoleErrorSpy.mockClear();

        await harness.useCase.run(
          runParams(ORGANIZATION_BOARD_URL, allowedCase.agents),
        );

        expect({
          case: allowedCase.name,
          launched: launchedAgentNameByIssueUrl(harness.localCommandRunner),
        }).toEqual({
          case: allowedCase.name,
          launched: new Map([
            [ACCEPTED_ISSUE_URL, allowedCase.expectedAgentName],
          ]),
        });
        expect(errorMessages(consoleErrorSpy)).not.toContainEqual(
          expect.stringContaining(ACCEPTED_ISSUE_URL),
        );
      }
    });
  });

  describe('organization board: agents that are not allowed are rejected', () => {
    const rejectedCases: ReadonlyArray<{
      name: string;
      issueAgent: string;
      agents: string[];
    }> = [
      {
        name: 'an agent neither listed in agents nor equal to defaultAgentName',
        issueAgent: UNLISTED_AGENT_NAME,
        agents: [LISTED_AGENT_NAME],
      },
      {
        name: 'an agent when agents is an empty list',
        issueAgent: LISTED_AGENT_NAME,
        agents: [],
      },
    ];

    it('does not launch a worker and logs the issue URL and the rejected agent name as an error for each rejected case', async () => {
      for (const rejectedCase of rejectedCases) {
        const issue = createIssue({
          url: REJECTED_ISSUE_URL,
          number: 2,
          agent: rejectedCase.issueAgent,
        });
        const harness = createHarness(ORGANIZATION_BOARD_URL, [issue]);
        consoleErrorSpy.mockClear();

        await harness.useCase.run(
          runParams(ORGANIZATION_BOARD_URL, rejectedCase.agents),
        );

        expect({
          case: rejectedCase.name,
          launched: launchedAgentNameByIssueUrl(harness.localCommandRunner),
        }).toEqual({ case: rejectedCase.name, launched: new Map() });
        expect(errorMessages(consoleErrorSpy)).toContainEqual(
          rejectedAgentErrorMessage(
            rejectedCase.issueAgent,
            rejectedCase.agents,
          ),
        );
      }
    });

    it('skips only the rejected issue and still launches the other allowed issue in the same run', async () => {
      const acceptedIssue = createIssue({
        url: ACCEPTED_ISSUE_URL,
        number: 1,
        agent: LISTED_AGENT_NAME,
      });
      const rejectedIssue = createIssue({
        url: REJECTED_ISSUE_URL,
        number: 2,
        agent: UNLISTED_AGENT_NAME,
      });
      const harness = createHarness(ORGANIZATION_BOARD_URL, [
        acceptedIssue,
        rejectedIssue,
      ]);

      await harness.useCase.run(
        runParams(ORGANIZATION_BOARD_URL, [LISTED_AGENT_NAME]),
      );

      expect(launchedAgentNameByIssueUrl(harness.localCommandRunner)).toEqual(
        new Map([[ACCEPTED_ISSUE_URL, LISTED_AGENT_NAME]]),
      );
      expect(errorMessages(consoleErrorSpy)).toContainEqual(
        rejectedAgentErrorMessage(UNLISTED_AGENT_NAME, [LISTED_AGENT_NAME]),
      );
    });
  });

  describe('user-owned board: agent allowlist does not apply (pinned current behaviour)', () => {
    const userBoardCases: ReadonlyArray<{
      name: string;
      issueAgent: string;
      agents: string[];
    }> = [
      {
        name: 'an agent not listed in agents is launched',
        issueAgent: UNLISTED_AGENT_NAME,
        agents: [LISTED_AGENT_NAME],
      },
      {
        name: 'an agent listed in agents is launched',
        issueAgent: LISTED_AGENT_NAME,
        agents: [LISTED_AGENT_NAME],
      },
    ];

    it('launches a worker with the issue agent for each user-owned board case', async () => {
      for (const userBoardCase of userBoardCases) {
        const issue = createIssue({
          url: USER_BOARD_ISSUE_URL,
          nameWithOwner: 'example-user/example-repo',
          org: 'example-user',
          agent: userBoardCase.issueAgent,
        });
        const harness = createHarness(USER_BOARD_URL, [issue]);

        await harness.useCase.run(
          runParams(USER_BOARD_URL, userBoardCase.agents),
        );

        expect({
          case: userBoardCase.name,
          launched: launchedAgentNameByIssueUrl(harness.localCommandRunner),
        }).toEqual({
          case: userBoardCase.name,
          launched: new Map([[USER_BOARD_ISSUE_URL, userBoardCase.issueAgent]]),
        });
      }
    });
  });
});
