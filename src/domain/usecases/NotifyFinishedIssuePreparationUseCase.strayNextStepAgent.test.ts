import { NotifyFinishedIssuePreparationUseCase } from './NotifyFinishedIssuePreparationUseCase';
import { Issue } from '../entities/Issue';
import { Project } from '../entities/Project';
import { Comment } from '../entities/Comment';

const issueUrl = 'https://github.com/user/repo/issues/1';
const projectUrl = 'https://github.com/users/user/projects/1';
const reportCreatedAt = new Date('2026-01-01T00:00:00Z');

const createMockProject = (overrides: Partial<Project> = {}): Project => ({
  id: 'project-1',
  url: projectUrl,
  databaseId: 1,
  name: 'Test Project',
  status: {
    name: 'Status',
    fieldId: 'field-1',
    statuses: [
      {
        id: 'preparation-id',
        name: 'Preparation',
        color: 'YELLOW',
        description: '',
      },
      {
        id: 'awaiting-workspace-id',
        name: 'Awaiting Workspace',
        color: 'BLUE',
        description: '',
      },
      {
        id: 'failed-preparation-id',
        name: 'Failed Preparation',
        color: 'RED',
        description: '',
      },
      {
        id: 'awaiting-owner-id',
        name: 'Awaiting Owner',
        color: 'GREEN',
        description: '',
      },
      {
        id: 'done-id',
        name: 'Done',
        color: 'PURPLE',
        description: '',
      },
    ],
  },
  nextActionDate: null,
  nextActionHour: null,
  story: null,
  remainingEstimationMinutes: null,
  dependedIssueUrlSeparatedByComma: {
    name: 'Depended Issue URL',
    fieldId: 'depended-field-id',
  },
  completionDate50PercentConfidence: null,
  agent: {
    name: 'Agent',
    fieldId: 'agent-field-id',
    options: [
      {
        id: 'opt-developer',
        name: 'developer',
        color: 'GRAY',
        description: '',
      },
      {
        id: 'opt-chore',
        name: 'chore',
        color: 'GRAY',
        description: '',
      },
    ],
  },
  ...overrides,
});

const createMockIssue = (overrides: Partial<Issue> = {}): Issue => ({
  nameWithOwner: 'user/repo',
  number: 1,
  title: 'Test Issue',
  state: 'OPEN',
  status: 'Preparation',
  story: 'regular / some story',
  nextActionDate: null,
  nextActionHour: null,
  estimationMinutes: null,
  dependedIssueUrls: [],
  completionDate50PercentConfidence: null,
  url: issueUrl,
  assignees: [],
  labels: [],
  org: 'user',
  repo: 'repo',
  body: 'Test issue body content',
  itemId: 'item-1',
  isPr: false,
  isInProgress: false,
  isClosed: false,
  createdAt: reportCreatedAt,
  author: '',
  closingIssueReferenceUrls: [],
  plainCrossRepoIssueReferenceUrls: [],
  agent: null,
  stateReason: null,
  ...overrides,
});

const createAgentReport = (result: Record<string, string>): Comment => ({
  author: 'test-user',
  content: `From: :robot: chore (model)\n\nThe deliverable is finished and verified against every acceptance criterion.\n\n\`\`\`json\n${JSON.stringify(result)}\n\`\`\``,
  createdAt: reportCreatedAt,
  updatedAt: reportCreatedAt,
});

type MockIssueRepository = {
  get: jest.Mock;
  update: jest.Mock;
  updateStatus: jest.Mock;
  updateLabels: jest.Mock;
  getOrCreateLabel: jest.Mock;
  findRelatedOpenPRs: jest.Mock;
  getStoryObjectMap: jest.Mock;
  getOpenPullRequest: jest.Mock;
  getPullRequestChangedFilePaths: jest.Mock;
  approvePullRequest: jest.Mock;
  requestChangesWithInlineComment: jest.Mock;
  setDependedIssueUrl: jest.Mock;
  setIssueAgentField: jest.Mock;
  searchIssue: jest.Mock;
  createNewIssue: jest.Mock;
  createCommentByUrl: jest.Mock;
  getIssueOrPullRequestComments: jest.Mock;
  updateNextActionDate: jest.Mock;
  updateStory: jest.Mock;
  addIssueToProject: jest.Mock;
  getIssueByUrl: jest.Mock;
  updateStoryByProjectItemId: jest.Mock;
  getLatestReopenedEventAt: jest.Mock;
  closeIssueByUrl: jest.Mock;
  getIssueBodyEditHistory: jest.Mock;
};

type Harness = {
  useCase: NotifyFinishedIssuePreparationUseCase;
  project: Project;
  projectRepository: {
    getByUrl: jest.Mock;
  };
  issueRepository: MockIssueRepository;
  issueCommentRepository: {
    getCommentsFromIssue: jest.Mock;
    createComment: jest.Mock;
    updateComment: jest.Mock;
  };
};

const createHarness = (): Harness => {
  const projectRepository = {
    getByUrl: jest.fn(),
    updateAgentList: jest.fn().mockResolvedValue([]),
    updateStoryList: jest.fn().mockResolvedValue([]),
    createField: jest.fn().mockResolvedValue(undefined),
  };
  const issueRepository: MockIssueRepository = {
    get: jest.fn(),
    update: jest.fn(),
    updateStatus: jest.fn(),
    updateLabels: jest.fn().mockResolvedValue(undefined),
    getOrCreateLabel: jest.fn().mockResolvedValue(undefined),
    findRelatedOpenPRs: jest.fn().mockResolvedValue([]),
    getStoryObjectMap: jest.fn().mockResolvedValue(new Map()),
    getOpenPullRequest: jest.fn(),
    getPullRequestChangedFilePaths: jest.fn().mockResolvedValue([]),
    approvePullRequest: jest.fn().mockResolvedValue(undefined),
    requestChangesWithInlineComment: jest.fn().mockResolvedValue(undefined),
    setDependedIssueUrl: jest.fn(),
    setIssueAgentField: jest.fn().mockResolvedValue(undefined),
    searchIssue: jest.fn().mockResolvedValue([]),
    createNewIssue: jest.fn().mockResolvedValue(42),
    createCommentByUrl: jest.fn().mockResolvedValue(undefined),
    getIssueOrPullRequestComments: jest.fn().mockResolvedValue([]),
    updateNextActionDate: jest.fn().mockResolvedValue(undefined),
    updateStory: jest.fn().mockResolvedValue(undefined),
    addIssueToProject: jest.fn().mockResolvedValue(''),
    getIssueByUrl: jest.fn().mockResolvedValue(null),
    updateStoryByProjectItemId: jest.fn().mockResolvedValue(undefined),
    getLatestReopenedEventAt: jest.fn().mockResolvedValue(null),
    closeIssueByUrl: jest.fn().mockResolvedValue(undefined),
    getIssueBodyEditHistory: jest.fn().mockResolvedValue([]),
  };
  const issueCommentRepository = {
    getCommentsFromIssue: jest.fn().mockResolvedValue([]),
    createComment: jest.fn(),
    updateComment: jest.fn(),
  };
  const webhookRepository = {
    sendGetRequest: jest.fn(),
  };
  const project = createMockProject();

  return {
    useCase: new NotifyFinishedIssuePreparationUseCase(
      projectRepository,
      issueRepository,
      issueCommentRepository,
      webhookRepository,
    ),
    project,
    projectRepository,
    issueRepository,
    issueCommentRepository,
  };
};

type Scenario = {
  report: Record<string, string>;
  issueAgent?: string;
  agents: string[];
};

type Effects = {
  issueUpdates: unknown[][];
  statusUpdates: unknown[][];
  agentFieldWrites: unknown[][];
  createdIssues: unknown[][];
  createdComments: unknown[][];
  createdCommentsByUrl: unknown[][];
  closedIssues: unknown[][];
};

const recordedCalls = (mock: jest.Mock): unknown[][] =>
  mock.mock.calls.map((call: unknown[]) => call);

const runScenario = async (scenario: Scenario): Promise<Effects> => {
  const harness = createHarness();
  const issue = createMockIssue({ agent: scenario.issueAgent ?? null });
  harness.projectRepository.getByUrl.mockResolvedValue(harness.project);
  harness.issueRepository.get.mockResolvedValue(issue);
  harness.issueCommentRepository.getCommentsFromIssue.mockResolvedValue([
    createAgentReport(scenario.report),
  ]);

  await harness.useCase.run({
    projectUrl,
    issueUrl,
    thresholdForAutoReject: 3,
    workflowBlockerResolvedWebhookUrl: null,
    allowedIssueAuthors: ['test-user'],
    agents: scenario.agents,
  });

  return {
    issueUpdates: recordedCalls(harness.issueRepository.update),
    statusUpdates: recordedCalls(harness.issueRepository.updateStatus),
    agentFieldWrites: recordedCalls(harness.issueRepository.setIssueAgentField),
    createdIssues: recordedCalls(harness.issueRepository.createNewIssue),
    createdComments: recordedCalls(
      harness.issueCommentRepository.createComment,
    ),
    createdCommentsByUrl: recordedCalls(
      harness.issueRepository.createCommentByUrl,
    ),
    closedIssues: recordedCalls(harness.issueRepository.closeIssueByUrl),
  };
};

describe('NotifyFinishedIssuePreparationUseCase stray nextStepAgent', () => {
  it.each([
    {
      description: 'a registered agent',
      value: 'developer',
      agents: ['developer'],
    },
    {
      description: 'an agent absent from the configured agents list',
      value: 'not-configured-agent',
      agents: ['developer'],
    },
    {
      description: "the issue's current agent",
      value: 'chore',
      agents: ['chore', 'developer'],
      issueAgent: 'chore',
    },
  ])(
    'routes $description exactly like the same report without nextStepAgent',
    async ({ value, agents, issueAgent }) => {
      const withStrayNextStepAgent = await runScenario({
        report: { nextStepAgent: value },
        agents,
        issueAgent,
      });
      const withoutNextStepAgent = await runScenario({
        report: {},
        agents,
        issueAgent,
      });

      expect(withStrayNextStepAgent).toEqual(withoutNextStepAgent);
      expect(withStrayNextStepAgent.agentFieldWrites).toEqual([]);
      expect(withStrayNextStepAgent.createdIssues).toEqual([]);
      expect(withStrayNextStepAgent.createdComments).not.toEqual(
        expect.arrayContaining([
          expect.arrayContaining([
            expect.anything(),
            expect.stringContaining('excluded from automatic dispatch'),
          ]),
        ]),
      );
      expect(withStrayNextStepAgent.createdCommentsByUrl).not.toEqual(
        expect.arrayContaining([
          expect.arrayContaining([
            expect.anything(),
            expect.stringContaining('excluded from automatic dispatch'),
          ]),
        ]),
      );
    },
  );

  it('applies closeIssueAs completed when nextStepAgent is also present', async () => {
    const withStrayNextStepAgent = await runScenario({
      report: { nextStepAgent: 'x', closeIssueAs: 'completed' },
      agents: ['developer'],
    });
    const withoutNextStepAgent = await runScenario({
      report: { closeIssueAs: 'completed' },
      agents: ['developer'],
    });

    expect(withStrayNextStepAgent).toEqual(withoutNextStepAgent);
    expect(withStrayNextStepAgent.closedIssues).toEqual([
      [issueUrl, 'completed'],
    ]);
    expect(withStrayNextStepAgent.statusUpdates).toEqual([
      [
        expect.objectContaining({ id: 'project-1' }),
        expect.objectContaining({ url: issueUrl, status: 'Done' }),
        'done-id',
      ],
    ]);
  });
});
