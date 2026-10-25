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

type RunInput = Parameters<StartPreparationUseCase['run']>[0] & {
  llmModelNameByAgentName?: Record<string, string> | null;
};

type LaunchSetup = {
  labels?: string[];
  firstReadAgent?: string | null;
  reReadAgent?: string;
  tokens?: ClaudeTokenUsage[];
  definitionModels?: Record<string, string>;
  defaultLlmModelName?: string | null;
  map?: Record<string, string> | null;
  reserveSlotGranted?: boolean;
};

type AwCall = {
  args: string[];
  env: Record<string, string> | undefined;
};

type LaunchSummary = {
  awCalls: AwCall[];
  reserveCalls: unknown[];
  updateStatusCount: number;
  lines: string[];
};

const DEFAULT_LLM_MODEL_NAME = 'claude-sonnet-5-5[1m]';
const NO_LLM_MODEL_PREFIX = 'No LLM model configured for issue url1';
const INVALID_MODEL_MESSAGE_FOR_URL1 =
  'Invalid model id for issue url1: model ids must contain only letters, numbers, dots, underscores, colons, slashes, hyphens, or square brackets and start with a letter or number.';
const ALL_TOKENS_UNAVAILABLE_PREFIX =
  'All 2 configured Claude OAuth token(s) are unavailable';
const AC31_VALUES = [
  'gpt-5.5',
  'model-not-in-any-list-xyz',
  'claude-haiku-5-5',
  'http://example.com',
  'https://example.com',
];

let createdIssuesByUrl = new Map<string, Issue>();

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

const buildTokenUsage = (
  name: string,
  overrides: Partial<ClaudeTokenUsage> = {},
): ClaudeTokenUsage => ({
  name,
  token: name,
  fiveHourUtilization: 0,
  sevenDayUtilization: 0,
  blocked: false,
  rejected: false,
  fiveHourRejected: false,
  blockedUntilEpoch: 0,
  modelWeeklyLimits: {},
  ...overrides,
});

const usableTokens = (): ClaudeTokenUsage[] => [buildTokenUsage('token-a')];

const blockedTokens = (): ClaudeTokenUsage[] => [
  buildTokenUsage('token-a', { blocked: true }),
  buildTokenUsage('token-b', { blocked: true }),
];

const withoutDispatchTimestamp = (args: string[]): string[] => {
  const flagIndex = args.indexOf('--dispatchStartedAt');
  if (flagIndex === -1) {
    return args;
  }
  return args.filter(
    (_, position) => position !== flagIndex && position !== flagIndex + 1,
  );
};

const expectSingleLaunchWithModel = (
  summary: LaunchSummary,
  model: string,
): void => {
  expect(summary.awCalls).toHaveLength(1);
  expect(summary.awCalls[0]?.args[2]).toBe(model);
};

const expectSameLaunch = (
  actual: LaunchSummary,
  expected: LaunchSummary,
): void => {
  expect(actual.awCalls).toHaveLength(expected.awCalls.length);
  expect(
    actual.awCalls.map((call) => withoutDispatchTimestamp(call.args)),
  ).toEqual(
    expected.awCalls.map((call) => withoutDispatchTimestamp(call.args)),
  );
  expect(actual.awCalls.map((call) => call.args[2])).toEqual(
    expected.awCalls.map((call) => call.args[2]),
  );
  expect(actual.awCalls.map((call) => call.env)).toEqual(
    expected.awCalls.map((call) => call.env),
  );
  expect(actual.reserveCalls).toEqual(expected.reserveCalls);
};

const linesStartingWith = (lines: string[], prefix: string): string[] =>
  lines.filter((line) => line.startsWith(prefix));

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

describe('StartPreparationUseCase llm model name by agent name', () => {
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
  let consoleLines: string[];

  const summarizeLaunch = async (
    setup: LaunchSetup = {},
  ): Promise<LaunchSummary> => {
    createdIssuesByUrl = new Map<string, Issue>();
    consoleLines.length = 0;
    const labels = setup.labels ?? [];
    const reReadAgent = setup.reReadAgent;
    const issue = createMockIssue({
      url: 'url1',
      title: 'Issue 1',
      labels,
      status: 'Awaiting Workspace',
      agent: setup.firstReadAgent === undefined ? null : setup.firstReadAgent,
    });
    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.getStoryObjectMap.mockResolvedValue(
      createMockStoryObjectMap([issue]),
    );
    mockIssueRepository.get.mockImplementation((issueUrl: string) =>
      Promise.resolve(
        reReadAgent === undefined
          ? (createdIssuesByUrl.get(issueUrl) ??
              buildMockIssue({
                url: issueUrl,
                status: 'Awaiting Workspace',
                dependedIssueUrls: [],
              }))
          : buildMockIssue({
              url: 'url1',
              title: 'Issue 1',
              labels,
              status: 'Awaiting Workspace',
              agent: reReadAgent,
              dependedIssueUrls: [],
              isClosed: false,
            }),
      ),
    );
    mockLocalCommandRunner.runCommand.mockReset();
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });
    mockClaudeTokenUsageRepository.getAvailableTokenUsages.mockResolvedValue(
      setup.tokens ?? usableTokens(),
    );
    mockClaudeTokenUsageRepository.reserveTokenLaunchSlot.mockReset();
    mockClaudeTokenUsageRepository.reserveTokenLaunchSlot.mockResolvedValue(
      setup.reserveSlotGranted ?? true,
    );
    mockAgentDefinitionRepository.getLlmModelName.mockImplementation(
      (agentName: string) =>
        Promise.resolve(setup.definitionModels?.[agentName] ?? null),
    );
    mockIssueRepository.updateStatus.mockClear();

    const input: RunInput = {
      projectUrl: 'https://github.com/user/repo',
      defaultAgentName: 'triager',
      defaultLlmModelName:
        setup.defaultLlmModelName === undefined
          ? DEFAULT_LLM_MODEL_NAME
          : setup.defaultLlmModelName,
      defaultLlmAgentName: null,
      configFilePath: '/path/to/config.yml',
      maximumPreparingIssuesCount: null,
      utilizationPercentageThreshold: 90,
      allowedIssueAuthors: ['testuser'],
      manager: 'manager-user',
      codexHomeCandidates: null,
      labelsAsLlmAgentName: null,
      llmModelNameByAgentName:
        setup.map === undefined ? { triager: 'claude-haiku-5-5' } : setup.map,
    };
    await useCase.run(input);

    const awCalls = mockLocalCommandRunner.runCommand.mock.calls
      .filter((call) => call[0] === 'aw')
      .map((call) => ({
        args: [...call[1]],
        env: call[2]?.env,
      }));
    return {
      awCalls,
      reserveCalls: [
        ...mockClaudeTokenUsageRepository.reserveTokenLaunchSlot.mock.calls,
      ],
      updateStatusCount: mockIssueRepository.updateStatus.mock.calls.length,
      lines: [...consoleLines],
    };
  };

  beforeEach(() => {
    jest.resetAllMocks();
    createdIssuesByUrl = new Map<string, Issue>();
    consoleLines = [];
    jest.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      consoleLines.push(args.map((arg) => String(arg)).join(' '));
    });
    jest.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
      consoleLines.push(args.map((arg) => String(arg)).join(' '));
    });
    jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      consoleLines.push(args.map((arg) => String(arg)).join(' '));
    });
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
    mockIssueRepository.setIssueAgentField.mockResolvedValue('applied');
    mockIssueRepository.removeLabel.mockResolvedValue(undefined);
    mockIssueRepository.getIssueByUrl.mockResolvedValue(
      createMockIssue({ status: 'Awaiting Workspace', dependedIssueUrls: [] }),
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

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    { name: 'claude-haiku-5-5', value: 'claude-haiku-5-5' },
    { name: 'gpt-5.5', value: 'gpt-5.5' },
    { name: 'claude-sonnet-5-5[1m]', value: 'claude-sonnet-5-5[1m]' },
  ])(
    'passes the mapped value $name unchanged to aw when the issue has no llm-model: label (AC-02)',
    async ({ value }) => {
      const summary = await summarizeLaunch({
        map: { triager: value },
        defaultLlmModelName: 'claude-sonnet-5-5',
      });
      expectSingleLaunchWithModel(summary, value);
    },
  );

  it.each([
    { state: 'empty', label: 'llm-model:' },
    { state: 'whitespace-only', label: 'llm-model: ' },
  ])(
    'treats an llm-model: label whose value is $state as no label, so the map applies (AC-02)',
    async ({ label }) => {
      const summary = await summarizeLaunch({
        labels: [label],
        map: { triager: 'claude-haiku-5-5' },
        defaultLlmModelName: 'claude-sonnet-5-5',
      });
      expectSingleLaunchWithModel(summary, 'claude-haiku-5-5');
    },
  );

  it('passes the llm-model: label value over the mapped value, and the mapped value when the label is absent (AC-03)', async () => {
    const labelled = await summarizeLaunch({
      labels: ['category:impl', 'llm-model:claude-sonnet-5'],
      map: { triager: 'claude-haiku-5-5' },
    });
    expectSingleLaunchWithModel(labelled, 'claude-sonnet-5');

    const unlabelled = await summarizeLaunch({
      labels: ['category:impl'],
      map: { triager: 'claude-haiku-5-5' },
    });
    expectSingleLaunchWithModel(unlabelled, 'claude-haiku-5-5');
  });

  it('passes the mapped value over the token-routed, agent-definition and default models (AC-04)', async () => {
    const summary = await summarizeLaunch({
      labels: ['category:impl'],
      definitionModels: { triager: 'claude-sonnet-5-5' },
      map: { triager: 'claude-haiku-5-5' },
    });
    expectSingleLaunchWithModel(summary, 'claude-haiku-5-5');
  });

  it('passes the mapped value of the re-read agent name when the agent changes after the re-read (AC-05)', async () => {
    const summary = await summarizeLaunch({
      labels: [],
      firstReadAgent: 'triager',
      reReadAgent: 'spec-creator',
      map: {
        triager: 'claude-sonnet-5-5',
        'spec-creator': 'claude-haiku-5-5',
      },
    });
    expect(summary.awCalls).toHaveLength(1);
    expect(summary.awCalls[0]?.args[1]).toBe('spec-creator');
    expect(summary.awCalls[0]?.args[2]).toBe('claude-haiku-5-5');
  });

  it('launches with the mapped value and prints no No LLM model configured line when no other model source exists (AC-06)', async () => {
    const summary = await summarizeLaunch({
      tokens: [],
      defaultLlmModelName: null,
      map: { triager: 'claude-haiku-5-5' },
    });
    expectSingleLaunchWithModel(summary, 'claude-haiku-5-5');
    expect(linesStartingWith(summary.lines, NO_LLM_MODEL_PREFIX)).toEqual([]);
  });

  it('keeps the token-routed model over the agent-definition model when the map is null (AC-07)(AC-08)(AC-09)', async () => {
    const summary = await summarizeLaunch({
      definitionModels: { triager: 'claude-haiku-5-5' },
      map: null,
    });
    expectSingleLaunchWithModel(summary, 'claude-sonnet-5-5[1m]');
  });

  it('uses the agent-definition model when the map is null, no token is usable and the default model is null (AC-07)(AC-08)(AC-09)', async () => {
    const summary = await summarizeLaunch({
      tokens: [],
      defaultLlmModelName: null,
      definitionModels: { triager: 'claude-haiku-5-5' },
      map: null,
    });
    expectSingleLaunchWithModel(summary, 'claude-haiku-5-5');
  });

  it('passes the same CLAUDE_CODE_OAUTH_TOKEN to aw with a mapped Claude model and with a null map (AC-11)', async () => {
    const mapped = await summarizeLaunch({
      map: { triager: 'claude-haiku-5-5' },
    });
    expectSingleLaunchWithModel(mapped, 'claude-haiku-5-5');
    const unmapped = await summarizeLaunch({ map: null });
    expect(unmapped.awCalls).toHaveLength(1);
    expect(mapped.awCalls[0]?.env?.CLAUDE_CODE_OAUTH_TOKEN).toBe('token-a');
    expect(unmapped.awCalls[0]?.env?.CLAUDE_CODE_OAUTH_TOKEN).toBe('token-a');
  });

  it('keeps the token-routed model for triager when the map has only a spec-creator entry (AC-15)', async () => {
    const summary = await summarizeLaunch({
      map: { 'spec-creator': 'claude-haiku-5-5' },
    });
    expectSingleLaunchWithModel(summary, 'claude-sonnet-5-5[1m]');
  });

  it('writes no line containing no-such-agent during a launch, and applies the entry of a key that matches the agent (AC-16)', async () => {
    const unmatched = await summarizeLaunch({
      map: { 'no-such-agent': 'claude-haiku-5-5' },
    });
    expectSingleLaunchWithModel(unmatched, 'claude-sonnet-5-5[1m]');
    expect(
      unmatched.lines.filter((line) => line.includes('no-such-agent')),
    ).toEqual([]);

    const matched = await summarizeLaunch({
      map: {
        'no-such-agent': 'claude-haiku-5-5',
        triager: 'claude-haiku-5-5',
      },
    });
    expectSingleLaunchWithModel(matched, 'claude-haiku-5-5');
    expect(
      matched.lines.filter((line) => line.includes('no-such-agent')),
    ).toEqual([]);
  });

  it('starts no launch for a mapped Claude model while every token is at its concurrency limit (AC-24)', async () => {
    const atLimit = await summarizeLaunch({
      reserveSlotGranted: false,
      map: { triager: 'claude-haiku-5-5' },
    });
    expect(atLimit.awCalls).toHaveLength(0);

    const slotFree = await summarizeLaunch({
      reserveSlotGranted: true,
      map: { triager: 'claude-haiku-5-5' },
    });
    expectSingleLaunchWithModel(slotFree, 'claude-haiku-5-5');
  });

  it('prints No LLM model configured, keeps Status and makes no aw call when the re-read agent is not a map key (AC-27)', async () => {
    const summary = await summarizeLaunch({
      firstReadAgent: 'triager',
      reReadAgent: 'spec-creator',
      tokens: [],
      defaultLlmModelName: null,
      map: { triager: 'claude-haiku-5-5' },
    });
    expect(linesStartingWith(summary.lines, NO_LLM_MODEL_PREFIX)).toHaveLength(
      1,
    );
    expect(summary.updateStatusCount).toBe(0);
    expect(summary.awCalls).toHaveLength(0);
    expect(mockAgentDefinitionRepository.getLlmModelName).toHaveBeenCalledWith(
      'spec-creator',
    );
  });

  it('prints No LLM model configured and makes no aw call when the first-read agent is in neither the map nor a definition, even if the re-read agent is a map key (AC-28)', async () => {
    const summary = await summarizeLaunch({
      firstReadAgent: 'triager',
      reReadAgent: 'spec-creator',
      tokens: [],
      defaultLlmModelName: null,
      map: { 'spec-creator': 'claude-haiku-5-5' },
    });
    expect(linesStartingWith(summary.lines, NO_LLM_MODEL_PREFIX)).toHaveLength(
      1,
    );
    expect(summary.updateStatusCount).toBe(0);
    expect(summary.awCalls).toHaveLength(0);
  });

  it('prints the all-tokens-unavailable line and makes no aw call for a mapped Claude model, but still launches a mapped Codex model (AC-29)', async () => {
    const blocked = await summarizeLaunch({
      tokens: blockedTokens(),
      map: { triager: 'claude-haiku-5-5' },
    });
    expect(
      linesStartingWith(blocked.lines, ALL_TOKENS_UNAVAILABLE_PREFIX),
    ).not.toEqual([]);
    expect(blocked.updateStatusCount).toBe(0);
    expect(blocked.awCalls).toHaveLength(0);

    const codexModel = await summarizeLaunch({
      firstReadAgent: 'developer',
      tokens: blockedTokens(),
      map: { triager: 'claude-haiku-5-5', developer: 'gpt-5.5' },
    });
    expectSingleLaunchWithModel(codexModel, 'gpt-5.5');
  });

  it('does not pass a token whose 7-day window is rejected, even with a mapped model (AC-30)', async () => {
    const summary = await summarizeLaunch({
      tokens: [
        buildTokenUsage('token-a', {
          modelWeeklyLimits: {
            seven_day: { rejected: true, resetsAt: 0 },
          },
        }),
        buildTokenUsage('token-b'),
      ],
      map: { triager: 'claude-haiku-5-5' },
    });
    expectSingleLaunchWithModel(summary, 'claude-haiku-5-5');
    expect(summary.awCalls[0]?.env?.CLAUDE_CODE_OAUTH_TOKEN).toBe('token-b');
  });

  it.each(
    AC31_VALUES.flatMap((value) => [
      { value, tokenState: 'usable' as const },
      { value, tokenState: 'blocked' as const },
    ]),
  )(
    'launches a mapped value $value the same way as the same value in an llm-model: label, with $tokenState tokens (AC-31)',
    async ({ value, tokenState }) => {
      const tokens =
        tokenState === 'blocked' ? blockedTokens() : usableTokens();
      const mapped = await summarizeLaunch({
        tokens,
        map: { triager: value },
      });
      const labelled = await summarizeLaunch({
        tokens,
        labels: [`llm-model:${value}`],
        map: null,
      });
      expectSameLaunch(mapped, labelled);
    },
  );

  it('launches a mapped Claude model with token-a when the default model is gpt-5.5, the same way as the label (AC-31)', async () => {
    const mapped = await summarizeLaunch({
      defaultLlmModelName: 'gpt-5.5',
      tokens: usableTokens(),
      map: { triager: 'claude-haiku-5-5' },
    });
    const labelled = await summarizeLaunch({
      defaultLlmModelName: 'gpt-5.5',
      tokens: usableTokens(),
      labels: ['llm-model:claude-haiku-5-5'],
      map: null,
    });
    expect(mapped.awCalls[0]?.env?.CLAUDE_CODE_OAUTH_TOKEN).toBe('token-a');
    expectSameLaunch(mapped, labelled);
  });

  it.each([
    { name: 'surrounding spaces', value: ' claude-haiku-5-5 ' },
    { name: 'leading dot', value: '.claude-haiku-5-5' },
    { name: 'single space', value: ' ' },
  ])(
    'rejects a mapped model name with $name at launch with the invalid model id message, without a Status change or an aw call (AC-34)',
    async ({ value }) => {
      const summary = await summarizeLaunch({ map: { triager: value } });
      expect(summary.lines).toContain(INVALID_MODEL_MESSAGE_FOR_URL1);
      expect(summary.updateStatusCount).toBe(0);
      expect(summary.awCalls).toHaveLength(0);
    },
  );

  it.each([{ value: 'gpt-5.5' }, { value: 'claude-haiku-5-5' }])(
    'launches a mapped value $value for a re-read agent the same way as the label, with no No LLM model configured line (AC-35)',
    async ({ value }) => {
      const tokens = blockedTokens();
      const mapped = await summarizeLaunch({
        firstReadAgent: 'triager',
        reReadAgent: 'spec-creator',
        tokens,
        defaultLlmModelName: null,
        map: { triager: value, 'spec-creator': value },
      });
      const labelled = await summarizeLaunch({
        firstReadAgent: 'triager',
        reReadAgent: 'spec-creator',
        tokens,
        defaultLlmModelName: null,
        labels: [`llm-model:${value}`],
        map: null,
      });
      expect(linesStartingWith(mapped.lines, NO_LLM_MODEL_PREFIX)).toEqual([]);
      expect(mapped.updateStatusCount).toBe(labelled.updateStatusCount);
      expectSameLaunch(mapped, labelled);
    },
  );

  it('passes the agent definition model of the re-read agent when the first-read name is a map key and the re-read name is not (AC-37)', async () => {
    const summary = await summarizeLaunch({
      firstReadAgent: 'triager',
      reReadAgent: 'spec-creator',
      tokens: [],
      defaultLlmModelName: null,
      definitionModels: { 'spec-creator': 'claude-sonnet-5-5' },
      map: { triager: 'claude-haiku-5-5' },
    });
    expect(summary.awCalls).toHaveLength(1);
    expect(summary.awCalls[0]?.args[1]).toBe('spec-creator');
    expect(summary.awCalls[0]?.args[2]).toBe('claude-sonnet-5-5');
  });

  it('does not use a map key that differs from the agent name by case or a leading space (AC-39)', async () => {
    const mismatched = await summarizeLaunch({
      map: {
        Triager: 'claude-haiku-5-5',
        ' triager': 'claude-haiku-5-5',
      },
    });
    expectSingleLaunchWithModel(mismatched, 'claude-sonnet-5-5[1m]');

    const exact = await summarizeLaunch({
      map: {
        Triager: 'claude-sonnet-5-5',
        ' triager': 'claude-sonnet-5-5',
        triager: 'claude-haiku-5-5',
      },
    });
    expectSingleLaunchWithModel(exact, 'claude-haiku-5-5');
  });
});
