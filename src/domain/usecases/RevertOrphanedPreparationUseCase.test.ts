import { RevertOrphanedPreparationUseCase } from './RevertOrphanedPreparationUseCase';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { IssueCommentRepository } from './adapter-interfaces/IssueCommentRepository';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { LocalCommandRunner } from './adapter-interfaces/LocalCommandRunner';
import { Issue } from '../entities/Issue';
import { Project } from '../entities/Project';

type Mocked<T> = jest.Mocked<T> & jest.MockedObject<T>;

const createMockIssue = (overrides: Partial<Issue> = {}): Issue => ({
  nameWithOwner: 'user/repo',
  number: 1,
  title: 'Test Issue',
  state: 'OPEN',
  status: 'Backlog',
  story: 'Default Story',
  nextActionDate: null,
  nextActionHour: null,
  estimationMinutes: null,
  dependedIssueUrls: [],
  completionDate50PercentConfidence: null,
  url: 'https://github.com/user/repo/issues/1',
  assignees: [],
  labels: [],
  org: 'user',
  repo: 'repo',
  body: '',
  itemId: 'item-1',
  isPr: false,
  isInProgress: false,
  isClosed: false,
  createdAt: new Date(),
  author: '',
  closingIssueReferenceUrls: [],
  agent: null,
  stateReason: null,
  ...overrides,
});

const createMockProject = (): Project => ({
  id: 'project-1',
  url: 'https://github.com/orgs/user/projects/1',
  databaseId: 1,
  name: 'Test Project',
  status: {
    name: 'Status',
    fieldId: 'status-field-id',
    statuses: [
      { id: '1', name: 'Awaiting Workspace', color: 'GRAY', description: '' },
      { id: '2', name: 'Preparation', color: 'YELLOW', description: '' },
      { id: '3', name: 'Done', color: 'GREEN', description: '' },
      {
        id: '4',
        name: 'Awaiting Quality Check',
        color: 'BLUE',
        description: '',
      },
      {
        id: '5',
        name: 'Failed Preparation',
        color: 'RED',
        description: '',
      },
      {
        id: '6',
        name: 'Todo by human',
        color: 'GREEN',
        description: '',
      },
    ],
  },
  nextActionDate: null,
  nextActionHour: null,
  story: {
    name: 'Story',
    fieldId: 'story-field-id',
    databaseId: 1,
    stories: [
      {
        id: 'story-1',
        name: 'Default Story',
        color: 'GRAY',
        description: '',
      },
    ],
    workflowManagementStory: {
      id: 'wf-1',
      name: 'Workflow Management',
    },
  },
  remainingEstimationMinutes: null,
  dependedIssueUrlSeparatedByComma: null,
  completionDate50PercentConfidence: null,
  agent: null,
});

const createPassingPr = () => ({
  url: 'https://github.com/user/repo/pull/5',
  branchName: 'i1',
  createdAt: new Date('2024-01-01T00:00:00Z'),
  isDraft: false,
  isConflicted: false,
  mergeable: null,
  isPassedAllCiJob: true,
  isCiStateSuccess: true,
  isResolvedAllReviewComments: true,
  isBranchOutOfDate: false,
  missingRequiredCheckNames: [],
});

describe('RevertOrphanedPreparationUseCase', () => {
  let useCase: RevertOrphanedPreparationUseCase;
  let mockProjectRepository: Mocked<
    Pick<
      ProjectRepository,
      | 'findProjectIdByUrl'
      | 'getProject'
      | 'createField'
      | 'getByUrl'
      | 'updateAgentList'
    >
  >;
  let mockIssueRepository: Mocked<
    Pick<
      IssueRepository,
      | 'getAllIssues'
      | 'updateStatus'
      | 'findRelatedOpenPRs'
      | 'getOpenPullRequest'
      | 'get'
      | 'setIssueAgentField'
    >
  >;
  let mockIssueCommentRepository: Mocked<
    Pick<IssueCommentRepository, 'getCommentsFromIssue' | 'createComment'>
  >;
  let mockLocalCommandRunner: Mocked<LocalCommandRunner>;
  let mockProject: Project;

  beforeEach(() => {
    jest.resetAllMocks();
    mockProject = createMockProject();
    mockProjectRepository = {
      findProjectIdByUrl: jest.fn().mockResolvedValue('project-1'),
      getProject: jest.fn().mockResolvedValue(mockProject),
      createField: jest.fn().mockResolvedValue(undefined),
      getByUrl: jest.fn().mockResolvedValue(mockProject),
      updateAgentList: jest.fn().mockResolvedValue([]),
    };
    mockIssueRepository = {
      getAllIssues: jest.fn().mockResolvedValue({
        project: mockProject,
        issues: [],
        cacheUsed: false,
      }),
      updateStatus: jest.fn().mockResolvedValue(undefined),
      findRelatedOpenPRs: jest.fn().mockResolvedValue([]),
      getOpenPullRequest: jest.fn().mockResolvedValue(null),
      get: jest
        .fn()
        .mockImplementation(async (issueUrl: string) =>
          createMockIssue({ url: issueUrl, status: 'Preparation' }),
        ),
      setIssueAgentField: jest.fn().mockResolvedValue(undefined),
    };
    mockIssueCommentRepository = {
      getCommentsFromIssue: jest.fn().mockResolvedValue([]),
      createComment: jest.fn().mockResolvedValue(undefined),
    };
    mockLocalCommandRunner = {
      runCommand: jest.fn(),
      spawnInteractive: jest.fn(),
    };
    useCase = new RevertOrphanedPreparationUseCase(
      mockProjectRepository,
      mockIssueRepository,
      mockIssueCommentRepository,
      mockLocalCommandRunner,
    );
  });

  it('should revert stuck-Preparation issue to Awaiting Workspace when check command exits non-zero and no agent report present', async () => {
    const stuckIssue = createMockIssue({
      url: 'https://github.com/user/repo/issues/10',
      status: 'Preparation',
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
      project: mockProject,
      issues: [stuckIssue],
      cacheUsed: false,
    });
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 1,
    });
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([]);

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      preparationProcessCheckCommand: 'pgrep -fa "claude-agent.*{URL}"',
      thresholdForAutoReject: 3,
    });

    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(1);
    expect(mockIssueRepository.updateStatus.mock.calls[0][0]).toBe(mockProject);
    expect(mockIssueRepository.updateStatus.mock.calls[0][1]).toBe(stuckIssue);
    expect(mockIssueRepository.updateStatus.mock.calls[0][2]).toBe('1');
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(1);
    expect(mockLocalCommandRunner.runCommand.mock.calls[0][0]).toBe('sh');
    expect(mockLocalCommandRunner.runCommand.mock.calls[0][1]).toEqual([
      '-c',
      'pgrep -fa "claude-agent.*$1"',
      '--',
      'https://github.com/user/repo/issues/10',
    ]);
  });

  it('should set the designated next step agent and return the orphaned issue to Awaiting Workspace', async () => {
    mockProject.agent = {
      name: 'agent',
      fieldId: 'agent-field-id',
      options: [
        {
          id: 'agent-option-developer',
          name: 'developer',
          color: 'GRAY',
          description: '',
        },
      ],
    };
    const stuckIssue = createMockIssue({
      url: 'https://github.com/user/repo/issues/10',
      status: 'Preparation',
      agent: 'triager',
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
      project: mockProject,
      issues: [stuckIssue],
      cacheUsed: false,
    });
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 1,
    });
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      {
        author: 'bot',
        content:
          'From: :robot: triager\n\n```json\n{"nextStep":null,"nextStepAgent":"developer"}\n```',
        createdAt: new Date('2024-01-02T00:00:00Z'),
      },
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      preparationProcessCheckCommand: 'pgrep -fa "claude-agent.*{URL}"',
      thresholdForAutoReject: 3,
      allowedIssueAuthors: ['bot'],
    });

    expect(mockIssueRepository.setIssueAgentField.mock.calls).toEqual([
      [stuckIssue.url, mockProject, 'agent-option-developer'],
    ]);
    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(1);
    expect(mockIssueRepository.updateStatus.mock.calls[0][2]).toBe('1');
  });

  it('should transition to Failed Preparation when the declared next step agent is already assigned and the repetition threshold is met', async () => {
    mockProject.agent = {
      name: 'agent',
      fieldId: 'agent-field-id',
      options: [
        {
          id: 'agent-option-developer',
          name: 'developer',
          color: 'GRAY',
          description: '',
        },
      ],
    };
    const stuckIssue = createMockIssue({
      url: 'https://github.com/user/repo/issues/10',
      status: 'Preparation',
      agent: 'developer',
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
      project: mockProject,
      issues: [stuckIssue],
      cacheUsed: false,
    });
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 1,
    });
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      {
        author: 'bot',
        content:
          'From: :robot: triager\n\n```json\n{"nextStep":null,"nextStepAgent":"developer"}\n```',
        createdAt: new Date('2024-01-02T00:00:00Z'),
      },
      {
        author: 'bot',
        content: 'Next step agent dispatch repeated: developer',
        createdAt: new Date('2024-01-02T01:00:00Z'),
      },
      {
        author: 'bot',
        content: 'Next step agent dispatch repeated: developer',
        createdAt: new Date('2024-01-02T02:00:00Z'),
      },
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      preparationProcessCheckCommand: 'pgrep -fa "claude-agent.*{URL}"',
      thresholdForAutoReject: 3,
      allowedIssueAuthors: ['bot'],
    });

    expect(mockIssueRepository.setIssueAgentField.mock.calls).toEqual([]);
    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(1);
    expect(mockIssueRepository.updateStatus.mock.calls[0][2]).toBe('5');
    expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
      stuckIssue,
      expect.stringContaining(
        'Failed to receive a report from the dispatched agent for 3 times',
      ),
    );
  });

  it('should record the repeated dispatch even when the project has no Failed Preparation status', async () => {
    mockProject.status.statuses = mockProject.status.statuses.filter(
      (status) => status.name !== 'Failed Preparation',
    );
    mockProject.agent = {
      name: 'agent',
      fieldId: 'agent-field-id',
      options: [
        {
          id: 'agent-option-developer',
          name: 'developer',
          color: 'GRAY',
          description: '',
        },
      ],
    };
    const stuckIssue = createMockIssue({
      url: 'https://github.com/user/repo/issues/10',
      status: 'Preparation',
      agent: 'developer',
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
      project: mockProject,
      issues: [stuckIssue],
      cacheUsed: false,
    });
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 1,
    });
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      {
        author: 'bot',
        content:
          'From: :robot: triager\n\n```json\n{"nextStep":null,"nextStepAgent":"developer"}\n```',
        createdAt: new Date('2024-01-02T00:00:00Z'),
      },
      {
        author: 'bot',
        content: 'Next step agent dispatch repeated: developer',
        createdAt: new Date('2024-01-02T01:00:00Z'),
      },
      {
        author: 'bot',
        content: 'Next step agent dispatch repeated: developer',
        createdAt: new Date('2024-01-02T02:00:00Z'),
      },
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      preparationProcessCheckCommand: 'pgrep -fa "claude-agent.*{URL}"',
      thresholdForAutoReject: 3,
      allowedIssueAuthors: ['bot'],
    });

    expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
      stuckIssue,
      expect.stringContaining('Next step agent dispatch repeated: developer'),
    );
  });

  it('should ignore a next step agent designated by an author outside the allowed issue authors', async () => {
    mockProject.agent = {
      name: 'agent',
      fieldId: 'agent-field-id',
      options: [
        {
          id: 'agent-option-developer',
          name: 'developer',
          color: 'GRAY',
          description: '',
        },
      ],
    };
    const stuckIssue = createMockIssue({
      url: 'https://github.com/user/repo/issues/10',
      status: 'Preparation',
      agent: 'triager',
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
      project: mockProject,
      issues: [stuckIssue],
      cacheUsed: false,
    });
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 1,
    });
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      {
        author: 'outsider',
        content:
          'From: :robot: triager\n\n```json\n{"nextStep":null,"nextStepAgent":"developer"}\n```',
        createdAt: new Date('2024-01-02T00:00:00Z'),
      },
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      preparationProcessCheckCommand: 'pgrep -fa "claude-agent.*{URL}"',
      thresholdForAutoReject: 3,
      allowedIssueAuthors: ['bot'],
    });

    expect(mockIssueRepository.setIssueAgentField.mock.calls).toEqual([]);
  });

  it('should advance orphaned issue to Awaiting Quality Check when agent report and passing PR are present', async () => {
    const stuckIssue = createMockIssue({
      url: 'https://github.com/user/repo/issues/10',
      status: 'Preparation',
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
      project: mockProject,
      issues: [stuckIssue],
      cacheUsed: false,
    });
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 1,
    });
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      {
        author: 'bot',
        content: 'From: :robot: agent report',
        createdAt: new Date(),
      },
    ]);
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
      createPassingPr(),
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      preparationProcessCheckCommand: 'pgrep -fa "claude-agent.*{URL}"',
      thresholdForAutoReject: 3,
    });

    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(1);
    expect(mockIssueRepository.updateStatus.mock.calls[0][2]).toBe('4');
  });

  it('should revert orphaned issue to Awaiting Workspace when agent report present but PR CI is failing', async () => {
    const stuckIssue = createMockIssue({
      url: 'https://github.com/user/repo/issues/10',
      status: 'Preparation',
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
      project: mockProject,
      issues: [stuckIssue],
      cacheUsed: false,
    });
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 1,
    });
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      {
        author: 'bot',
        content: 'From: :robot: agent report',
        createdAt: new Date(),
      },
    ]);
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
      {
        ...createPassingPr(),
        isPassedAllCiJob: false,
      },
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      preparationProcessCheckCommand: 'pgrep -fa "claude-agent.*{URL}"',
      thresholdForAutoReject: 3,
    });

    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(1);
    expect(mockIssueRepository.updateStatus.mock.calls[0][2]).toBe('1');
  });

  it('should revert orphaned issue to Awaiting Workspace when agent report present but no PR found', async () => {
    const stuckIssue = createMockIssue({
      url: 'https://github.com/user/repo/issues/10',
      status: 'Preparation',
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
      project: mockProject,
      issues: [stuckIssue],
      cacheUsed: false,
    });
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 1,
    });
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      {
        author: 'bot',
        content: 'From: :robot: agent report',
        createdAt: new Date(),
      },
    ]);
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([]);

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      preparationProcessCheckCommand: 'pgrep -fa "claude-agent.*{URL}"',
      thresholdForAutoReject: 3,
    });

    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(1);
    expect(mockIssueRepository.updateStatus.mock.calls[0][2]).toBe('1');
  });

  it('should return an orphaned issue to Awaiting Workspace without a rejection when the last report first declares that no pull request is required', async () => {
    const stuckIssue = createMockIssue({
      url: 'https://github.com/user/repo/issues/10',
      status: 'Preparation',
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
      project: mockProject,
      issues: [stuckIssue],
      cacheUsed: false,
    });
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 1,
    });
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      {
        author: 'agent-bot',
        content:
          'From: :robot: agent report\n\n```json\n{ "pullRequestRequired": false, "nextStep": null }\n```\n',
        createdAt: new Date(),
      },
    ]);
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([]);

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      preparationProcessCheckCommand: 'pgrep -fa "claude-agent.*{URL}"',
      thresholdForAutoReject: 3,
      allowedIssueAuthors: ['agent-bot'],
    });

    expect(mockIssueRepository.findRelatedOpenPRs.mock.calls).toHaveLength(0);
    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(1);
    expect(mockIssueRepository.updateStatus.mock.calls[0][2]).toBe('1');
    expect(mockIssueCommentRepository.createComment.mock.calls).toHaveLength(1);
    expect(mockIssueCommentRepository.createComment.mock.calls[0][1]).toContain(
      'Auto Status Check: RETURNED_TO_AWAITING_WORKSPACE',
    );
  });

  it('should advance an orphaned issue to Awaiting Quality Check when it was already returned to the workspace once for the same declaration', async () => {
    const stuckIssue = createMockIssue({
      url: 'https://github.com/user/repo/issues/10',
      status: 'Preparation',
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
      project: mockProject,
      issues: [stuckIssue],
      cacheUsed: false,
    });
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 1,
    });
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      {
        author: 'agent-bot',
        content:
          'Auto Status Check: RETURNED_TO_AWAITING_WORKSPACE\nThe last report declared that this task needs no pull request.',
        createdAt: new Date(),
      },
      {
        author: 'agent-bot',
        content:
          'From: :robot: agent report\n\n```json\n{ "pullRequestRequired": false, "nextStep": null }\n```\n',
        createdAt: new Date(),
      },
    ]);
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([]);

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      preparationProcessCheckCommand: 'pgrep -fa "claude-agent.*{URL}"',
      thresholdForAutoReject: 3,
      allowedIssueAuthors: ['agent-bot'],
    });

    expect(mockIssueRepository.findRelatedOpenPRs.mock.calls).toHaveLength(0);
    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(1);
    expect(mockIssueRepository.updateStatus.mock.calls[0][2]).toBe('4');
    expect(mockIssueCommentRepository.createComment.mock.calls).toHaveLength(0);
  });

  it('should not re-dispatch the declared agent when a later report omits the next step agent an earlier report declared', async () => {
    const stuckIssue = createMockIssue({
      url: 'https://github.com/user/repo/issues/10',
      status: 'Preparation',
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
      project: mockProject,
      issues: [stuckIssue],
      cacheUsed: false,
    });
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 1,
    });
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      {
        author: 'agent-bot',
        content:
          'From: :robot: agent report\n\n```json\n{ "nextStepAgent": "pr-reviewer" }\n```\n',
        createdAt: new Date(),
      },
      {
        author: 'agent-bot',
        content:
          'Auto Status Check: RETURNED_TO_AWAITING_WORKSPACE\nThe last report declared that this task needs no pull request.',
        createdAt: new Date(),
      },
      {
        author: 'agent-bot',
        content:
          'From: :robot: agent report\n\n```json\n{ "pullRequestRequired": false, "reviewResult": "PASS", "nextStep": null }\n```\n',
        createdAt: new Date(),
      },
    ]);
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([]);

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      preparationProcessCheckCommand: 'pgrep -fa "claude-agent.*{URL}"',
      thresholdForAutoReject: 3,
      allowedIssueAuthors: ['agent-bot'],
    });

    expect(mockIssueRepository.setIssueAgentField.mock.calls).toHaveLength(0);
    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(1);
    expect(mockIssueRepository.updateStatus.mock.calls[0][2]).toBe('4');
  });

  it('should revert an orphaned issue to Awaiting Workspace when the no pull request declaration comes from an author outside allowedIssueAuthors', async () => {
    const stuckIssue = createMockIssue({
      url: 'https://github.com/user/repo/issues/10',
      status: 'Preparation',
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
      project: mockProject,
      issues: [stuckIssue],
      cacheUsed: false,
    });
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 1,
    });
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      {
        author: 'stranger',
        content:
          'From: :robot: agent report\n\n```json\n{ "pullRequestRequired": false, "nextStep": null }\n```\n',
        createdAt: new Date(),
      },
    ]);
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([]);

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      preparationProcessCheckCommand: 'pgrep -fa "claude-agent.*{URL}"',
      thresholdForAutoReject: 3,
      allowedIssueAuthors: ['agent-bot'],
    });

    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(1);
    expect(mockIssueRepository.updateStatus.mock.calls[0][2]).toBe('1');
    expect(mockIssueCommentRepository.createComment.mock.calls).toHaveLength(1);
  });

  it('should advance an orphaned issue to Awaiting Quality Check when its own status comments were written after the report declaring no pull request is required', async () => {
    const stuckIssue = createMockIssue({
      url: 'https://github.com/user/repo/issues/10',
      status: 'Preparation',
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
      project: mockProject,
      issues: [stuckIssue],
      cacheUsed: false,
    });
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 1,
    });
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      {
        author: 'agent-bot',
        content:
          'From: :robot: agent report\n\n```json\n{ "pullRequestRequired": false, "nextStep": null }\n```\n',
        createdAt: new Date(),
      },
      {
        author: 'agent-bot',
        content:
          'Auto Status Check: RETURNED_TO_AWAITING_WORKSPACE\nThe last report declared that this task needs no pull request.',
        createdAt: new Date(),
      },
      {
        author: 'agent-bot',
        content: 'Auto Status Check: REJECTED\n- ORPHANED_PREPARATION',
        createdAt: new Date(),
      },
    ]);
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([]);

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      preparationProcessCheckCommand: 'pgrep -fa "claude-agent.*{URL}"',
      thresholdForAutoReject: 3,
      allowedIssueAuthors: ['agent-bot'],
    });

    expect(mockIssueRepository.findRelatedOpenPRs.mock.calls).toHaveLength(0);
    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(1);
    expect(mockIssueRepository.updateStatus.mock.calls[0][2]).toBe('4');
    expect(mockIssueCommentRepository.createComment.mock.calls).toHaveLength(0);
  });

  it('should keep rejecting an orphaned issue whose own status comments follow a report that declares nothing', async () => {
    const stuckIssue = createMockIssue({
      url: 'https://github.com/user/repo/issues/10',
      status: 'Preparation',
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
      project: mockProject,
      issues: [stuckIssue],
      cacheUsed: false,
    });
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 1,
    });
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      {
        author: 'agent-bot',
        content: 'From: :robot: agent report of an earlier session',
        createdAt: new Date(),
      },
      {
        author: 'agent-bot',
        content: 'Auto Status Check: REJECTED\n- ORPHANED_PREPARATION',
        createdAt: new Date(),
      },
    ]);
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([]);

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      preparationProcessCheckCommand: 'pgrep -fa "claude-agent.*{URL}"',
      thresholdForAutoReject: 3,
      allowedIssueAuthors: ['agent-bot'],
    });

    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(1);
    expect(mockIssueRepository.updateStatus.mock.calls[0][2]).toBe('1');
    expect(mockIssueCommentRepository.createComment.mock.calls).toHaveLength(1);
    expect(mockIssueCommentRepository.createComment.mock.calls[0][1]).toContain(
      'Auto Status Check: REJECTED',
    );
  });

  it('should advance orphaned issue with non-developer agent field to Awaiting Quality Check when no linked PRs exist', async () => {
    const stuckIssue = createMockIssue({
      url: 'https://github.com/user/repo/issues/10',
      status: 'Preparation',
      labels: [],
      agent: 'chore',
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
      project: mockProject,
      issues: [stuckIssue],
      cacheUsed: false,
    });
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 1,
    });
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      {
        author: 'bot',
        content: 'From: :robot: agent report',
        createdAt: new Date(),
      },
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      preparationProcessCheckCommand: 'pgrep -fa "claude-agent.*{URL}"',
      thresholdForAutoReject: 3,
    });

    expect(mockIssueRepository.findRelatedOpenPRs.mock.calls).toHaveLength(1);
    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(1);
    expect(mockIssueRepository.updateStatus.mock.calls[0][2]).toBe('4');
  });

  it('should reject orphaned issue with non-developer agent field to Awaiting Workspace when PR is conflicted', async () => {
    const stuckIssue = createMockIssue({
      url: 'https://github.com/user/repo/issues/10',
      status: 'Preparation',
      labels: [],
      agent: 'chore',
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
      project: mockProject,
      issues: [stuckIssue],
      cacheUsed: false,
    });
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 1,
    });
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      {
        author: 'bot',
        content: 'From: :robot: agent report',
        createdAt: new Date(),
      },
    ]);
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
      { ...createPassingPr(), isConflicted: true },
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      preparationProcessCheckCommand: 'pgrep -fa "claude-agent.*{URL}"',
      thresholdForAutoReject: 3,
    });

    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(1);
    expect(mockIssueRepository.updateStatus.mock.calls[0][2]).toBe('1');
    expect(mockIssueCommentRepository.createComment.mock.calls).toHaveLength(1);
    expect(mockIssueCommentRepository.createComment.mock.calls[0][1]).toContain(
      'Auto Status Check: REJECTED',
    );
  });

  it('should check PR for orphaned issue with developer agent field', async () => {
    const stuckIssue = createMockIssue({
      url: 'https://github.com/user/repo/issues/10',
      status: 'Preparation',
      labels: ['llm-agent:developer'],
      agent: 'developer',
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
      project: mockProject,
      issues: [stuckIssue],
      cacheUsed: false,
    });
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 1,
    });
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      {
        author: 'bot',
        content: 'From: :robot: agent report',
        createdAt: new Date(),
      },
    ]);
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([]);

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      preparationProcessCheckCommand: 'pgrep -fa "claude-agent.*{URL}"',
      thresholdForAutoReject: 3,
    });

    expect(mockIssueRepository.findRelatedOpenPRs.mock.calls).toHaveLength(1);
    expect(mockIssueRepository.updateStatus.mock.calls[0][2]).toBe('1');
  });

  it('should advance orphaned issue with a labelsAsLlmAgentName label (story) to Awaiting Quality Check when no conflicting PR exists', async () => {
    const stuckIssue = createMockIssue({
      url: 'https://github.com/user/repo/issues/10',
      status: 'Preparation',
      labels: ['story'],
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
      project: mockProject,
      issues: [stuckIssue],
      cacheUsed: false,
    });
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 1,
    });
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      {
        author: 'bot',
        content: 'From: :robot: agent report',
        createdAt: new Date(),
      },
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      preparationProcessCheckCommand: 'pgrep -fa "claude-agent.*{URL}"',
      thresholdForAutoReject: 3,
      labelsAsLlmAgentName: ['story'],
    });

    expect(mockIssueRepository.findRelatedOpenPRs.mock.calls).toHaveLength(1);
    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(1);
    expect(mockIssueRepository.updateStatus.mock.calls[0][2]).toBe('4');
  });

  it('should advance an orphaned issue whose label is only in labelsNotRequiringPullRequest to Awaiting Quality Check when no conflicting PR exists', async () => {
    const stuckIssue = createMockIssue({
      url: 'https://github.com/user/repo/issues/10',
      status: 'Preparation',
      labels: ['story'],
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
      project: mockProject,
      issues: [stuckIssue],
      cacheUsed: false,
    });
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 1,
    });
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      {
        author: 'bot',
        content: 'From: :robot: agent report',
        createdAt: new Date(),
      },
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      preparationProcessCheckCommand: 'pgrep -fa "claude-agent.*{URL}"',
      thresholdForAutoReject: 3,
      labelsAsLlmAgentName: ['chore'],
      labelsNotRequiringPullRequest: ['story'],
    });

    expect(mockIssueRepository.findRelatedOpenPRs.mock.calls).toHaveLength(1);
    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(1);
    expect(mockIssueRepository.updateStatus.mock.calls[0][2]).toBe('4');
  });

  it('should reject orphaned issue with labelsNotRequiringPullRequest label to Awaiting Workspace when PR is conflicted', async () => {
    const stuckIssue = createMockIssue({
      url: 'https://github.com/user/repo/issues/10',
      status: 'Preparation',
      labels: ['story'],
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
      project: mockProject,
      issues: [stuckIssue],
      cacheUsed: false,
    });
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 1,
    });
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      {
        author: 'bot',
        content: 'From: :robot: agent report',
        createdAt: new Date(),
      },
    ]);
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
      { ...createPassingPr(), isConflicted: true },
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      preparationProcessCheckCommand: 'pgrep -fa "claude-agent.*{URL}"',
      thresholdForAutoReject: 3,
      labelsAsLlmAgentName: ['chore'],
      labelsNotRequiringPullRequest: ['story'],
    });

    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(1);
    expect(mockIssueRepository.updateStatus.mock.calls[0][2]).toBe('1');
    expect(mockIssueCommentRepository.createComment.mock.calls).toHaveLength(1);
    expect(mockIssueCommentRepository.createComment.mock.calls[0][1]).toContain(
      'Auto Status Check: REJECTED',
    );
  });

  it('should advance orphaned issue with non-e2e category label to Awaiting Quality Check when no conflicting PR exists', async () => {
    const stuckIssue = createMockIssue({
      url: 'https://github.com/user/repo/issues/10',
      status: 'Preparation',
      labels: ['category:bug'],
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
      project: mockProject,
      issues: [stuckIssue],
      cacheUsed: false,
    });
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 1,
    });
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      {
        author: 'bot',
        content: 'From: :robot: agent report',
        createdAt: new Date(),
      },
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      preparationProcessCheckCommand: 'pgrep -fa "claude-agent.*{URL}"',
      thresholdForAutoReject: 3,
    });

    expect(mockIssueRepository.findRelatedOpenPRs.mock.calls).toHaveLength(1);
    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(1);
    expect(mockIssueRepository.updateStatus.mock.calls[0][2]).toBe('4');
  });

  it('should reject orphaned issue with non-e2e category label to Awaiting Workspace when PR is conflicted', async () => {
    const stuckIssue = createMockIssue({
      url: 'https://github.com/user/repo/issues/10',
      status: 'Preparation',
      labels: ['category:bug'],
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
      project: mockProject,
      issues: [stuckIssue],
      cacheUsed: false,
    });
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 1,
    });
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      {
        author: 'bot',
        content: 'From: :robot: agent report',
        createdAt: new Date(),
      },
    ]);
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
      { ...createPassingPr(), isConflicted: true },
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      preparationProcessCheckCommand: 'pgrep -fa "claude-agent.*{URL}"',
      thresholdForAutoReject: 3,
    });

    expect(mockIssueRepository.findRelatedOpenPRs.mock.calls).toHaveLength(1);
    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(1);
    expect(mockIssueRepository.updateStatus.mock.calls[0][2]).toBe('1');
    expect(mockIssueCommentRepository.createComment.mock.calls).toHaveLength(1);
    expect(mockIssueCommentRepository.createComment.mock.calls[0][1]).toContain(
      'Auto Status Check: REJECTED',
    );
  });

  it('should revert orphaned issue to Awaiting Workspace when its label is not in labelsAsLlmAgentName and no PR is found', async () => {
    const stuckIssue = createMockIssue({
      url: 'https://github.com/user/repo/issues/10',
      status: 'Preparation',
      labels: ['story'],
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
      project: mockProject,
      issues: [stuckIssue],
      cacheUsed: false,
    });
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 1,
    });
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      {
        author: 'bot',
        content: 'From: :robot: agent report',
        createdAt: new Date(),
      },
    ]);
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([]);

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      preparationProcessCheckCommand: 'pgrep -fa "claude-agent.*{URL}"',
      thresholdForAutoReject: 3,
      labelsAsLlmAgentName: ['bug'],
    });

    expect(mockIssueRepository.findRelatedOpenPRs.mock.calls).toHaveLength(1);
    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(1);
    expect(mockIssueRepository.updateStatus.mock.calls[0][2]).toBe('1');
  });

  it('should revert orphaned issue to Awaiting Workspace when report has nextStep set', async () => {
    const stuckIssue = createMockIssue({
      url: 'https://github.com/user/repo/issues/10',
      status: 'Preparation',
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
      project: mockProject,
      issues: [stuckIssue],
      cacheUsed: false,
    });
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 1,
    });
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      {
        author: 'bot',
        content:
          'From: :robot: agent report\n```json\n{"nextStep": "do something"}\n```',
        createdAt: new Date(),
      },
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      preparationProcessCheckCommand: 'pgrep -fa "claude-agent.*{URL}"',
      thresholdForAutoReject: 3,
    });

    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(1);
    expect(mockIssueRepository.updateStatus.mock.calls[0][2]).toBe('1');
  });

  it('should revert orphaned issue to Awaiting Workspace when last comment is a cross-issue notification starting with From: :warning:', async () => {
    const stuckIssue = createMockIssue({
      url: 'https://github.com/user/repo/issues/10',
      status: 'Preparation',
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
      project: mockProject,
      issues: [stuckIssue],
      cacheUsed: false,
    });
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 1,
    });
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      {
        author: 'bot',
        content:
          'From: :warning: This message is from https://github.com/user/repo/tree/i999 AI HS Implement AI Agent (claude-sonnet-4-6)',
        createdAt: new Date(),
      },
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      preparationProcessCheckCommand: 'pgrep -fa "claude-agent.*{URL}"',
      thresholdForAutoReject: 3,
    });

    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(1);
    expect(mockIssueRepository.updateStatus.mock.calls[0][2]).toBe('1');
  });

  it('should post Auto Status Check: REJECTED comment when orphan path reverts to Awaiting Workspace', async () => {
    const stuckIssue = createMockIssue({
      url: 'https://github.com/user/repo/issues/10',
      status: 'Preparation',
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
      project: mockProject,
      issues: [stuckIssue],
      cacheUsed: false,
    });
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 1,
    });
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([]);

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      preparationProcessCheckCommand: 'pgrep -fa "claude-agent.*{URL}"',
      thresholdForAutoReject: 3,
    });

    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(1);
    expect(mockIssueRepository.updateStatus.mock.calls[0][2]).toBe('1');
    expect(mockIssueCommentRepository.createComment.mock.calls).toHaveLength(1);
    expect(mockIssueCommentRepository.createComment.mock.calls[0][0]).toBe(
      stuckIssue,
    );
    expect(mockIssueCommentRepository.createComment.mock.calls[0][1]).toBe(
      'Auto Status Check: REJECTED\n- ORPHANED_PREPARATION',
    );
  });

  it('should leave in-flight Preparation issue untouched when check command exits zero', async () => {
    const inFlightIssue = createMockIssue({
      url: 'https://github.com/user/repo/issues/20',
      status: 'Preparation',
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
      project: mockProject,
      issues: [inFlightIssue],
      cacheUsed: false,
    });
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: 'claude-agent process found',
      stderr: '',
      exitCode: 0,
    });

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      preparationProcessCheckCommand: 'pgrep -fa "claude-agent.*{URL}"',
      thresholdForAutoReject: 3,
    });

    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(0);
    expect(
      mockIssueCommentRepository.getCommentsFromIssue.mock.calls,
    ).toHaveLength(0);
  });

  it('should only process issues in Preparation status and skip others', async () => {
    const preparationIssue = createMockIssue({
      url: 'https://github.com/user/repo/issues/10',
      status: 'Preparation',
    });
    const awaitingIssue = createMockIssue({
      url: 'https://github.com/user/repo/issues/11',
      status: 'Awaiting Workspace',
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
      project: mockProject,
      issues: [preparationIssue, awaitingIssue],
      cacheUsed: false,
    });
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 1,
    });
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([]);

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      preparationProcessCheckCommand: 'check {URL}',
      thresholdForAutoReject: 3,
    });

    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(1);
    expect(mockLocalCommandRunner.runCommand.mock.calls[0][0]).toBe('sh');
    expect(mockLocalCommandRunner.runCommand.mock.calls[0][1]).toEqual([
      '-c',
      'check $1',
      '--',
      'https://github.com/user/repo/issues/10',
    ]);
    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(1);
  });

  it('should handle mixed in-flight and stuck Preparation issues correctly', async () => {
    const stuckIssue = createMockIssue({
      url: 'https://github.com/user/repo/issues/10',
      status: 'Preparation',
    });
    const inFlightIssue = createMockIssue({
      url: 'https://github.com/user/repo/issues/20',
      status: 'Preparation',
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
      project: mockProject,
      issues: [stuckIssue, inFlightIssue],
      cacheUsed: false,
    });
    mockLocalCommandRunner.runCommand
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 1 })
      .mockResolvedValueOnce({
        stdout: 'found',
        stderr: '',
        exitCode: 0,
      });
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([]);

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      preparationProcessCheckCommand: 'check {URL}',
      thresholdForAutoReject: 3,
    });

    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(1);
    expect(mockIssueRepository.updateStatus.mock.calls[0][1]).toBe(stuckIssue);
  });

  it('should throw when project is not found by URL', async () => {
    mockProjectRepository.findProjectIdByUrl.mockResolvedValue(null);

    await expect(
      useCase.run({
        projectUrl: 'https://github.com/user/repo',
        preparationProcessCheckCommand: 'check {URL}',
        thresholdForAutoReject: 3,
      }),
    ).rejects.toThrow('Project not found');
  });

  it('should throw when getProject returns null after findProjectIdByUrl succeeds', async () => {
    mockProjectRepository.findProjectIdByUrl.mockResolvedValue('project-1');
    mockProjectRepository.getProject.mockResolvedValue(null);

    await expect(
      useCase.run({
        projectUrl: 'https://github.com/user/repo',
        preparationProcessCheckCommand: 'check {URL}',
        thresholdForAutoReject: 3,
      }),
    ).rejects.toThrow('Project not found. projectId: project-1');
  });

  it('should do nothing when Awaiting Workspace status is not found in project statuses', async () => {
    const preparationIssue = createMockIssue({
      url: 'https://github.com/user/repo/issues/10',
      status: 'Preparation',
    });
    const projectWithoutAwaitingWorkspace = {
      ...mockProject,
      status: {
        ...mockProject.status,
        statuses: mockProject.status.statuses.filter(
          (s) => s.name !== 'Awaiting Workspace',
        ),
      },
    };
    mockProjectRepository.getProject.mockResolvedValue(
      projectWithoutAwaitingWorkspace,
    );
    mockIssueRepository.getAllIssues.mockResolvedValue({
      project: mockProject,
      issues: [preparationIssue],
      cacheUsed: false,
    });
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 1,
    });

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      preparationProcessCheckCommand: 'check {URL}',
      thresholdForAutoReject: 3,
    });

    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(0);
  });

  it('should do nothing when there are no Preparation issues', async () => {
    mockIssueRepository.getAllIssues.mockResolvedValue({
      project: mockProject,
      issues: [
        createMockIssue({ status: 'Awaiting Workspace' }),
        createMockIssue({ status: 'Done' }),
      ],
      cacheUsed: false,
    });

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      preparationProcessCheckCommand: 'check {URL}',
      thresholdForAutoReject: 3,
    });

    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(0);
    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(0);
  });

  it('should revert zombie-wrapper issue when pgrep exits zero but aw log file is stale', async () => {
    const zombieIssue = createMockIssue({
      url: 'https://github.com/myorg/myrepo/issues/42',
      org: 'myorg',
      repo: 'myrepo',
      number: 42,
      status: 'Preparation',
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
      project: mockProject,
      issues: [zombieIssue],
      cacheUsed: false,
    });
    mockLocalCommandRunner.runCommand
      .mockResolvedValueOnce({
        stdout: 'xfce4-terminal found',
        stderr: '',
        exitCode: 0,
      })
      .mockResolvedValueOnce({
        stdout: '/home/user/logs-aw/myorg_myrepo_42_2024.log\n',
        stderr: '',
        exitCode: 0,
      })
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 });
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([]);

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      preparationProcessCheckCommand: 'pgrep -fa "Please handover {URL}"',
      thresholdForAutoReject: 3,
      awLogDirectoryPath: '/home/user/logs-aw',
      awLogStaleThresholdMinutes: 15,
    });

    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(1);
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(3);
    expect(mockLocalCommandRunner.runCommand.mock.calls[1]).toEqual([
      'sh',
      [
        '-c',
        'find "$1" -name "$2"',
        '--',
        '/home/user/logs-aw',
        'myorg_myrepo_42_*',
      ],
    ]);
    expect(mockLocalCommandRunner.runCommand.mock.calls[2]).toEqual([
      'sh',
      [
        '-c',
        'find "$1" -name "$2" -mmin -$3',
        '--',
        '/home/user/logs-aw',
        'myorg_myrepo_42_*',
        '15',
      ],
    ]);
  });

  it('should leave issue untouched when pgrep exits zero and aw log file is recent', async () => {
    const activeIssue = createMockIssue({
      url: 'https://github.com/myorg/myrepo/issues/42',
      org: 'myorg',
      repo: 'myrepo',
      number: 42,
      status: 'Preparation',
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
      project: mockProject,
      issues: [activeIssue],
      cacheUsed: false,
    });
    mockLocalCommandRunner.runCommand
      .mockResolvedValueOnce({
        stdout: 'xfce4-terminal found',
        stderr: '',
        exitCode: 0,
      })
      .mockResolvedValueOnce({
        stdout: '/home/user/logs-aw/myorg_myrepo_42_2024.log\n',
        stderr: '',
        exitCode: 0,
      })
      .mockResolvedValueOnce({
        stdout: '/home/user/logs-aw/myorg_myrepo_42_2024.log\n',
        stderr: '',
        exitCode: 0,
      });

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      preparationProcessCheckCommand: 'pgrep -fa "Please handover {URL}"',
      thresholdForAutoReject: 3,
      awLogDirectoryPath: '/home/user/logs-aw',
      awLogStaleThresholdMinutes: 15,
    });

    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(0);
    expect(
      mockIssueCommentRepository.getCommentsFromIssue.mock.calls,
    ).toHaveLength(0);
  });

  it('should leave issue untouched when pgrep exits zero and no aw log files exist yet', async () => {
    const newIssue = createMockIssue({
      url: 'https://github.com/myorg/myrepo/issues/42',
      org: 'myorg',
      repo: 'myrepo',
      number: 42,
      status: 'Preparation',
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
      project: mockProject,
      issues: [newIssue],
      cacheUsed: false,
    });
    mockLocalCommandRunner.runCommand
      .mockResolvedValueOnce({
        stdout: 'xfce4-terminal found',
        stderr: '',
        exitCode: 0,
      })
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 });

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      preparationProcessCheckCommand: 'pgrep -fa "Please handover {URL}"',
      thresholdForAutoReject: 3,
      awLogDirectoryPath: '/home/user/logs-aw',
      awLogStaleThresholdMinutes: 15,
    });

    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(0);
    expect(
      mockIssueCommentRepository.getCommentsFromIssue.mock.calls,
    ).toHaveLength(0);
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(2);
  });

  it('should skip aw log check when awLogDirectoryPath is not configured', async () => {
    const inFlightIssue = createMockIssue({
      url: 'https://github.com/user/repo/issues/20',
      status: 'Preparation',
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
      project: mockProject,
      issues: [inFlightIssue],
      cacheUsed: false,
    });
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: 'claude-agent process found',
      stderr: '',
      exitCode: 0,
    });

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      preparationProcessCheckCommand: 'pgrep -fa "claude-agent.*{URL}"',
      thresholdForAutoReject: 3,
    });

    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(0);
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(1);
  });

  it('should revert issue when pgrep exits non-zero even when awLogDirectoryPath is configured', async () => {
    const stuckIssue = createMockIssue({
      url: 'https://github.com/myorg/myrepo/issues/42',
      org: 'myorg',
      repo: 'myrepo',
      number: 42,
      status: 'Preparation',
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
      project: mockProject,
      issues: [stuckIssue],
      cacheUsed: false,
    });
    mockLocalCommandRunner.runCommand.mockResolvedValueOnce({
      stdout: '',
      stderr: '',
      exitCode: 1,
    });
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([]);

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      preparationProcessCheckCommand: 'pgrep -fa "Please handover {URL}"',
      thresholdForAutoReject: 3,
      awLogDirectoryPath: '/home/user/logs-aw',
      awLogStaleThresholdMinutes: 15,
    });

    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(1);
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(1);
  });

  it('should substitute {URL} placeholder with the issue URL in the check command', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/org/project/issues/99',
      status: 'Preparation',
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
      project: mockProject,
      issues: [issue],
      cacheUsed: false,
    });
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      preparationProcessCheckCommand: 'pgrep -fa "claude-agent.*{URL}"',
      thresholdForAutoReject: 3,
    });

    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(1);
    expect(mockLocalCommandRunner.runCommand.mock.calls[0][0]).toBe('sh');
    expect(mockLocalCommandRunner.runCommand.mock.calls[0][1]).toEqual([
      '-c',
      'pgrep -fa "claude-agent.*$1"',
      '--',
      'https://github.com/org/project/issues/99',
    ]);
  });

  it('should advance closed orphaned issue to Awaiting Quality Check without checking comments or PRs', async () => {
    const closedIssue = createMockIssue({
      url: 'https://github.com/user/repo/issues/10',
      status: 'Preparation',
      isClosed: true,
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
      project: mockProject,
      issues: [closedIssue],
      cacheUsed: false,
    });
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 1,
    });

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      preparationProcessCheckCommand: 'pgrep -fa "claude-agent.*{URL}"',
      thresholdForAutoReject: 3,
    });

    expect(
      mockIssueCommentRepository.getCommentsFromIssue.mock.calls,
    ).toHaveLength(0);
    expect(mockIssueRepository.findRelatedOpenPRs.mock.calls).toHaveLength(0);
    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(1);
    expect(mockIssueRepository.updateStatus.mock.calls[0][2]).toBe('4');
  });

  it('should transition orphaned issue to Failed Preparation when rejection threshold is met', async () => {
    const stuckIssue = createMockIssue({
      url: 'https://github.com/user/repo/issues/10',
      status: 'Preparation',
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
      project: mockProject,
      issues: [stuckIssue],
      cacheUsed: false,
    });
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 1,
    });
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      {
        author: 'bot',
        content: 'Auto Status Check: REJECTED\n- ORPHANED_PREPARATION',
        createdAt: new Date(),
      },
      {
        author: 'bot',
        content: 'Auto Status Check: REJECTED\n- ORPHANED_PREPARATION',
        createdAt: new Date(),
      },
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      preparationProcessCheckCommand: 'pgrep -fa "claude-agent.*{URL}"',
      thresholdForAutoReject: 3,
    });

    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(1);
    expect(mockIssueRepository.updateStatus.mock.calls[0][0]).toBe(mockProject);
    expect(mockIssueRepository.updateStatus.mock.calls[0][1]).toBe(stuckIssue);
    expect(mockIssueRepository.updateStatus.mock.calls[0][2]).toBe('5');
    expect(mockIssueCommentRepository.createComment.mock.calls).toHaveLength(1);
    expect(mockIssueCommentRepository.createComment.mock.calls[0][0]).toBe(
      stuckIssue,
    );
    expect(mockIssueCommentRepository.createComment.mock.calls[0][1]).toBe(
      'Auto Status Check: REJECTED\n- ORPHANED_PREPARATION\n\nFailed to pass the check automatically for 3 times',
    );
  });

  it('should revert orphaned issue to Awaiting Workspace when rejection threshold is not yet met', async () => {
    const stuckIssue = createMockIssue({
      url: 'https://github.com/user/repo/issues/10',
      status: 'Preparation',
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
      project: mockProject,
      issues: [stuckIssue],
      cacheUsed: false,
    });
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 1,
    });
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      {
        author: 'bot',
        content: 'Auto Status Check: REJECTED\n- ORPHANED_PREPARATION',
        createdAt: new Date(),
      },
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      preparationProcessCheckCommand: 'pgrep -fa "claude-agent.*{URL}"',
      thresholdForAutoReject: 3,
    });

    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(1);
    expect(mockIssueRepository.updateStatus.mock.calls[0][2]).toBe('1');
    expect(mockIssueCommentRepository.createComment.mock.calls).toHaveLength(1);
    expect(mockIssueCommentRepository.createComment.mock.calls[0][1]).toBe(
      'Auto Status Check: REJECTED\n- ORPHANED_PREPARATION',
    );
  });

  it('should not transition to Failed Preparation when an earlier escalation comment is already in the recent window', async () => {
    const stuckIssue = createMockIssue({
      url: 'https://github.com/user/repo/issues/10',
      status: 'Preparation',
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
      project: mockProject,
      issues: [stuckIssue],
      cacheUsed: false,
    });
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 1,
    });
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      {
        author: 'bot',
        content:
          'Auto Status Check: REJECTED\n- ORPHANED_PREPARATION\n\nFailed to pass the check automatically for 3 times',
        createdAt: new Date(),
      },
      {
        author: 'bot',
        content: 'Auto Status Check: REJECTED\n- ORPHANED_PREPARATION',
        createdAt: new Date(),
      },
      {
        author: 'bot',
        content: 'Auto Status Check: REJECTED\n- ORPHANED_PREPARATION',
        createdAt: new Date(),
      },
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      preparationProcessCheckCommand: 'pgrep -fa "claude-agent.*{URL}"',
      thresholdForAutoReject: 3,
    });

    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(1);
    expect(mockIssueRepository.updateStatus.mock.calls[0][2]).toBe('1');
    expect(mockIssueCommentRepository.createComment.mock.calls).toHaveLength(1);
    expect(mockIssueCommentRepository.createComment.mock.calls[0][1]).toBe(
      'Auto Status Check: REJECTED\n- ORPHANED_PREPARATION',
    );
  });

  it('should not post a rejection comment when orphaned issue advances to Awaiting Quality Check', async () => {
    const stuckIssue = createMockIssue({
      url: 'https://github.com/user/repo/issues/10',
      status: 'Preparation',
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
      project: mockProject,
      issues: [stuckIssue],
      cacheUsed: false,
    });
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 1,
    });
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      {
        author: 'bot',
        content: 'From: :robot: agent report',
        createdAt: new Date(),
      },
    ]);
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
      createPassingPr(),
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      preparationProcessCheckCommand: 'pgrep -fa "claude-agent.*{URL}"',
      thresholdForAutoReject: 3,
    });

    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(1);
    expect(mockIssueRepository.updateStatus.mock.calls[0][2]).toBe('4');
    expect(mockIssueCommentRepository.createComment.mock.calls).toHaveLength(0);
  });

  it('should revert to Awaiting Workspace when Failed Preparation status option is not present even at threshold', async () => {
    const projectWithoutFailedPreparation = {
      ...mockProject,
      status: {
        ...mockProject.status,
        statuses: mockProject.status.statuses.filter(
          (s) => s.name !== 'Failed Preparation',
        ),
      },
    };
    mockProjectRepository.getProject.mockResolvedValue(
      projectWithoutFailedPreparation,
    );
    const stuckIssue = createMockIssue({
      url: 'https://github.com/user/repo/issues/10',
      status: 'Preparation',
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
      project: mockProject,
      issues: [stuckIssue],
      cacheUsed: false,
    });
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 1,
    });
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      {
        author: 'bot',
        content: 'Auto Status Check: REJECTED\n- ORPHANED_PREPARATION',
        createdAt: new Date(),
      },
      {
        author: 'bot',
        content: 'Auto Status Check: REJECTED\n- ORPHANED_PREPARATION',
        createdAt: new Date(),
      },
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      preparationProcessCheckCommand: 'pgrep -fa "claude-agent.*{URL}"',
      thresholdForAutoReject: 3,
    });

    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(1);
    expect(mockIssueRepository.updateStatus.mock.calls[0][2]).toBe('1');
    expect(mockIssueCommentRepository.createComment.mock.calls).toHaveLength(1);
    expect(mockIssueCommentRepository.createComment.mock.calls[0][1]).toBe(
      'Auto Status Check: REJECTED\n- ORPHANED_PREPARATION',
    );
  });

  describe('live status re-read before writing', () => {
    const arrangeSnapshotSaysPreparation = (
      liveStatus: string | null,
      comments: { author: string; content: string; createdAt: Date }[],
    ): Issue => {
      const snapshotIssue = createMockIssue({
        url: 'https://github.com/user/repo/issues/10',
        status: 'Preparation',
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: mockProject,
        issues: [snapshotIssue],
        cacheUsed: false,
      });
      mockIssueRepository.get.mockResolvedValue(
        liveStatus === null
          ? null
          : createMockIssue({
              url: snapshotIssue.url,
              status: liveStatus,
            }),
      );
      mockLocalCommandRunner.runCommand.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 1,
      });
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue(
        comments,
      );
      return snapshotIssue;
    };

    it('does not write Failed Preparation when the live status has already moved to Awaiting Workspace', async () => {
      arrangeSnapshotSaysPreparation('Awaiting Workspace', [
        {
          author: 'bot',
          content: 'Auto Status Check: REJECTED\n- ORPHANED_PREPARATION',
          createdAt: new Date(),
        },
        {
          author: 'bot',
          content: 'Auto Status Check: REJECTED\n- ORPHANED_PREPARATION',
          createdAt: new Date(),
        },
        {
          author: 'bot',
          content:
            'Issue has next action date or hour set: nextActionDate=null, nextActionHour=null',
          createdAt: new Date(),
        },
      ]);

      await useCase.run({
        projectUrl: 'https://github.com/user/repo',
        preparationProcessCheckCommand: 'pgrep -fa "claude-agent.*{URL}"',
        thresholdForAutoReject: 3,
      });

      expect(
        mockIssueRepository.updateStatus.mock.calls.map((call) => call[2]),
      ).toEqual([]);
      expect(mockIssueCommentRepository.createComment.mock.calls).toHaveLength(
        0,
      );
      expect(mockIssueRepository.get.mock.calls).toHaveLength(1);
      expect(mockIssueRepository.get.mock.calls[0][0]).toBe(
        'https://github.com/user/repo/issues/10',
      );
      expect(mockIssueRepository.get.mock.calls[0][1]).toBe(mockProject);
    });

    it('does not write Awaiting Quality Check when the live status has already moved to Awaiting Workspace', async () => {
      arrangeSnapshotSaysPreparation('Awaiting Workspace', [
        {
          author: 'bot',
          content: 'From: :robot: agent',
          createdAt: new Date(),
        },
      ]);
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
        createPassingPr(),
      ]);

      await useCase.run({
        projectUrl: 'https://github.com/user/repo',
        preparationProcessCheckCommand: 'pgrep -fa "claude-agent.*{URL}"',
        thresholdForAutoReject: 3,
      });

      expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(0);
      expect(mockIssueCommentRepository.createComment.mock.calls).toHaveLength(
        0,
      );
    });

    it('does not write any status when the live read finds no issue', async () => {
      arrangeSnapshotSaysPreparation(null, []);

      await useCase.run({
        projectUrl: 'https://github.com/user/repo',
        preparationProcessCheckCommand: 'pgrep -fa "claude-agent.*{URL}"',
        thresholdForAutoReject: 3,
      });

      expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(0);
      expect(mockIssueCommentRepository.createComment.mock.calls).toHaveLength(
        0,
      );
    });

    it('still writes Failed Preparation when the live status is confirmed as Preparation', async () => {
      const snapshotIssue = arrangeSnapshotSaysPreparation('Preparation', [
        {
          author: 'bot',
          content: 'Auto Status Check: REJECTED\n- ORPHANED_PREPARATION',
          createdAt: new Date(),
        },
        {
          author: 'bot',
          content: 'Auto Status Check: REJECTED\n- ORPHANED_PREPARATION',
          createdAt: new Date(),
        },
      ]);

      await useCase.run({
        projectUrl: 'https://github.com/user/repo',
        preparationProcessCheckCommand: 'pgrep -fa "claude-agent.*{URL}"',
        thresholdForAutoReject: 3,
      });

      expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(1);
      expect(mockIssueRepository.updateStatus.mock.calls[0][1]).toBe(
        snapshotIssue,
      );
      expect(mockIssueRepository.updateStatus.mock.calls[0][2]).toBe('5');
    });

    it('logs the error, skips the candidate and keeps processing the next candidate when the live read rejects', async () => {
      const failingIssue = createMockIssue({
        url: 'https://github.com/user/repo/issues/10',
        status: 'Preparation',
      });
      const followingIssue = createMockIssue({
        url: 'https://github.com/user/repo/issues/11',
        number: 11,
        itemId: 'item-11',
        status: 'Preparation',
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: mockProject,
        issues: [failingIssue, followingIssue],
        cacheUsed: false,
      });
      const liveReadError = new Error(
        'GitHub GraphQL API returned no data for a single project item read',
      );
      mockIssueRepository.get.mockImplementation(async (issueUrl: string) => {
        if (issueUrl === failingIssue.url) {
          throw liveReadError;
        }
        return createMockIssue({ url: issueUrl, status: 'Preparation' });
      });
      mockLocalCommandRunner.runCommand.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 1,
      });
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([]);
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);

      try {
        await useCase.run({
          projectUrl: 'https://github.com/user/repo',
          preparationProcessCheckCommand: 'pgrep -fa "claude-agent.*{URL}"',
          thresholdForAutoReject: 3,
        });

        expect(
          consoleErrorSpy.mock.calls.filter(
            (call) =>
              typeof call[0] === 'string' &&
              call[0].includes(failingIssue.url) &&
              call[1] === liveReadError,
          ),
        ).toHaveLength(1);
      } finally {
        consoleErrorSpy.mockRestore();
      }

      expect(
        mockIssueRepository.updateStatus.mock.calls.map((call) => [
          call[1].url,
          call[2],
        ]),
      ).toEqual([[followingIssue.url, '1']]);
      expect(
        mockIssueCommentRepository.createComment.mock.calls.map(
          (call) => call[0].url,
        ),
      ).toEqual([followingIssue.url]);
    });
  });

  describe('non-developer agent CI failure reassignment', () => {
    const makeProjectWithDeveloper = (developerName = 'developer') => {
      const project = createMockProject();
      project.agent = {
        name: 'Agent',
        fieldId: 'agent-field-id',
        options: [
          {
            id: 'opt-developer',
            name: developerName,
            color: 'GRAY',
            description: '',
          },
        ],
      };
      return project;
    };

    it('should return to Awaiting Workspace and reassign to developer when chore agent has exactly one linked PR with failing CI', async () => {
      const projectWithDeveloper = makeProjectWithDeveloper();
      mockProjectRepository.findProjectIdByUrl.mockResolvedValue('project-1');
      mockProjectRepository.getProject.mockResolvedValue(projectWithDeveloper);
      mockProjectRepository.getByUrl.mockResolvedValue(projectWithDeveloper);
      const stuckIssue = createMockIssue({
        url: 'https://github.com/user/repo/issues/10',
        status: 'Preparation',
        labels: [],
        agent: 'chore',
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: projectWithDeveloper,
        issues: [stuckIssue],
        cacheUsed: false,
      });
      mockIssueRepository.get.mockImplementation(async (issueUrl: string) =>
        createMockIssue({
          url: issueUrl,
          status: 'Preparation',
          agent: 'chore',
        }),
      );
      mockLocalCommandRunner.runCommand.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 1,
      });
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        {
          author: 'bot',
          content: 'From: :robot: agent report',
          createdAt: new Date(),
        },
      ]);
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
        {
          ...createPassingPr(),
          url: 'https://github.com/user/repo/pull/99',
          isPassedAllCiJob: false,
          isCiStateSuccess: false,
        },
      ]);

      await useCase.run({
        projectUrl: 'https://github.com/user/repo',
        preparationProcessCheckCommand: 'pgrep -fa "claude-agent.*{URL}"',
        thresholdForAutoReject: 3,
      });

      expect(mockIssueRepository.setIssueAgentField.mock.calls).toEqual([
        [stuckIssue.url, projectWithDeveloper, 'opt-developer'],
      ]);
      expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(1);
      expect(mockIssueRepository.updateStatus.mock.calls[0][2]).toBe('1');
      expect(mockIssueCommentRepository.createComment.mock.calls).toHaveLength(
        1,
      );
      expect(
        mockIssueCommentRepository.createComment.mock.calls[0][1],
      ).toContain('ANY_CI_JOB_FAILED_OR_IN_PROGRESS');
      expect(
        mockIssueCommentRepository.createComment.mock.calls[0][1],
      ).toContain('https://github.com/user/repo/pull/99');
    });

    it('should advance to Awaiting Quality Check when chore agent has exactly one linked PR where all CI passes', async () => {
      const stuckIssue = createMockIssue({
        url: 'https://github.com/user/repo/issues/10',
        status: 'Preparation',
        labels: [],
        agent: 'chore',
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: mockProject,
        issues: [stuckIssue],
        cacheUsed: false,
      });
      mockLocalCommandRunner.runCommand.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 1,
      });
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        {
          author: 'bot',
          content: 'From: :robot: agent report',
          createdAt: new Date(),
        },
      ]);
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
        createPassingPr(),
      ]);

      await useCase.run({
        projectUrl: 'https://github.com/user/repo',
        preparationProcessCheckCommand: 'pgrep -fa "claude-agent.*{URL}"',
        thresholdForAutoReject: 3,
      });

      expect(mockIssueRepository.setIssueAgentField.mock.calls).toHaveLength(0);
      expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(1);
      expect(mockIssueRepository.updateStatus.mock.calls[0][2]).toBe('4');
    });

    it('should advance to Awaiting Quality Check when chore agent has no linked PRs', async () => {
      const stuckIssue = createMockIssue({
        url: 'https://github.com/user/repo/issues/10',
        status: 'Preparation',
        labels: [],
        agent: 'chore',
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: mockProject,
        issues: [stuckIssue],
        cacheUsed: false,
      });
      mockLocalCommandRunner.runCommand.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 1,
      });
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        {
          author: 'bot',
          content: 'From: :robot: agent report',
          createdAt: new Date(),
        },
      ]);
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([]);

      await useCase.run({
        projectUrl: 'https://github.com/user/repo',
        preparationProcessCheckCommand: 'pgrep -fa "claude-agent.*{URL}"',
        thresholdForAutoReject: 3,
      });

      expect(mockIssueRepository.setIssueAgentField.mock.calls).toHaveLength(0);
      expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(1);
      expect(mockIssueRepository.updateStatus.mock.calls[0][2]).toBe('4');
    });

    it('should not trigger the new path when developer agent has a failing CI PR', async () => {
      const stuckIssue = createMockIssue({
        url: 'https://github.com/user/repo/issues/10',
        status: 'Preparation',
        labels: ['llm-agent:developer'],
        agent: 'developer',
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: mockProject,
        issues: [stuckIssue],
        cacheUsed: false,
      });
      mockLocalCommandRunner.runCommand.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 1,
      });
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        {
          author: 'bot',
          content: 'From: :robot: agent report',
          createdAt: new Date(),
        },
      ]);
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
        {
          ...createPassingPr(),
          isPassedAllCiJob: false,
          isCiStateSuccess: false,
        },
      ]);

      await useCase.run({
        projectUrl: 'https://github.com/user/repo',
        preparationProcessCheckCommand: 'pgrep -fa "claude-agent.*{URL}"',
        thresholdForAutoReject: 3,
      });

      expect(mockIssueRepository.setIssueAgentField.mock.calls).toHaveLength(0);
      expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(1);
      expect(mockIssueRepository.updateStatus.mock.calls[0][2]).toBe('1');
    });

    it('should not trigger the new path when agent is pr-reviewer and PR has failing CI', async () => {
      const stuckIssue = createMockIssue({
        url: 'https://github.com/user/repo/issues/10',
        status: 'Preparation',
        labels: [],
        agent: 'pr-reviewer',
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: mockProject,
        issues: [stuckIssue],
        cacheUsed: false,
      });
      mockLocalCommandRunner.runCommand.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 1,
      });
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        {
          author: 'bot',
          content: 'From: :robot: agent report',
          createdAt: new Date(),
        },
      ]);
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
        {
          ...createPassingPr(),
          isPassedAllCiJob: false,
          isCiStateSuccess: false,
        },
      ]);

      await useCase.run({
        projectUrl: 'https://github.com/user/repo',
        preparationProcessCheckCommand: 'pgrep -fa "claude-agent.*{URL}"',
        thresholdForAutoReject: 3,
      });

      expect(mockIssueRepository.setIssueAgentField.mock.calls).toHaveLength(0);
      expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(1);
      expect(mockIssueRepository.updateStatus.mock.calls[0][2]).toBe('4');
    });

    it('should not trigger the new path when agent is null and PR has failing CI', async () => {
      const stuckIssue = createMockIssue({
        url: 'https://github.com/user/repo/issues/10',
        status: 'Preparation',
        labels: [],
        agent: null,
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: mockProject,
        issues: [stuckIssue],
        cacheUsed: false,
      });
      mockLocalCommandRunner.runCommand.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 1,
      });
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        {
          author: 'bot',
          content: 'From: :robot: agent report',
          createdAt: new Date(),
        },
      ]);
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
        {
          ...createPassingPr(),
          isPassedAllCiJob: false,
          isCiStateSuccess: false,
        },
      ]);

      await useCase.run({
        projectUrl: 'https://github.com/user/repo',
        preparationProcessCheckCommand: 'pgrep -fa "claude-agent.*{URL}"',
        thresholdForAutoReject: 3,
      });

      expect(mockIssueRepository.setIssueAgentField.mock.calls).toHaveLength(0);
      expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(1);
      expect(mockIssueRepository.updateStatus.mock.calls[0][2]).toBe('1');
    });

    it('should not trigger the new path when chore agent has two linked PRs both with failing CI', async () => {
      const stuckIssue = createMockIssue({
        url: 'https://github.com/user/repo/issues/10',
        status: 'Preparation',
        labels: [],
        agent: 'chore',
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: mockProject,
        issues: [stuckIssue],
        cacheUsed: false,
      });
      mockLocalCommandRunner.runCommand.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 1,
      });
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        {
          author: 'bot',
          content: 'From: :robot: agent report',
          createdAt: new Date(),
        },
      ]);
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
        {
          ...createPassingPr(),
          url: 'https://github.com/user/repo/pull/99',
          isPassedAllCiJob: false,
        },
        {
          ...createPassingPr(),
          url: 'https://github.com/user/repo/pull/100',
          isPassedAllCiJob: false,
        },
      ]);

      await useCase.run({
        projectUrl: 'https://github.com/user/repo',
        preparationProcessCheckCommand: 'pgrep -fa "claude-agent.*{URL}"',
        thresholdForAutoReject: 3,
      });

      expect(mockIssueRepository.setIssueAgentField.mock.calls).toHaveLength(0);
      expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(1);
      expect(mockIssueRepository.updateStatus.mock.calls[0][2]).toBe('4');
    });

    it('should reassign to the configured developerAgentName when chore agent has a failing CI PR', async () => {
      const projectWithCustomDeveloper =
        makeProjectWithDeveloper('custom-developer');
      mockProjectRepository.findProjectIdByUrl.mockResolvedValue('project-1');
      mockProjectRepository.getProject.mockResolvedValue(
        projectWithCustomDeveloper,
      );
      mockProjectRepository.getByUrl.mockResolvedValue(
        projectWithCustomDeveloper,
      );
      const stuckIssue = createMockIssue({
        url: 'https://github.com/user/repo/issues/10',
        status: 'Preparation',
        labels: [],
        agent: 'chore',
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: projectWithCustomDeveloper,
        issues: [stuckIssue],
        cacheUsed: false,
      });
      mockIssueRepository.get.mockImplementation(async (issueUrl: string) =>
        createMockIssue({
          url: issueUrl,
          status: 'Preparation',
          agent: 'chore',
        }),
      );
      mockLocalCommandRunner.runCommand.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 1,
      });
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        {
          author: 'bot',
          content: 'From: :robot: agent report',
          createdAt: new Date(),
        },
      ]);
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
        {
          ...createPassingPr(),
          url: 'https://github.com/user/repo/pull/99',
          isPassedAllCiJob: false,
          isCiStateSuccess: false,
        },
      ]);

      await useCase.run({
        projectUrl: 'https://github.com/user/repo',
        preparationProcessCheckCommand: 'pgrep -fa "claude-agent.*{URL}"',
        thresholdForAutoReject: 3,
        developerAgentName: 'custom-developer',
      });

      expect(mockIssueRepository.setIssueAgentField.mock.calls).toEqual([
        [stuckIssue.url, projectWithCustomDeveloper, 'opt-developer'],
      ]);
    });
  });

  it('should revert orphaned issue to Awaiting Workspace and not throw when getCommentsFromIssue returns 404', async () => {
    const stuckIssue = createMockIssue({
      url: 'https://github.com/user/repo/issues/10',
      status: 'Preparation',
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
      project: mockProject,
      issues: [stuckIssue],
      cacheUsed: false,
    });
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 1,
    });
    mockIssueCommentRepository.getCommentsFromIssue.mockRejectedValue(
      new Error('Failed to fetch comments from GitHub REST API: 404 Not Found'),
    );

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      preparationProcessCheckCommand: 'pgrep -fa "claude-agent.*{URL}"',
      thresholdForAutoReject: 3,
    });

    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(1);
    expect(mockIssueRepository.updateStatus.mock.calls[0][2]).toBe('1');
    expect(mockIssueCommentRepository.createComment.mock.calls).toHaveLength(1);
    expect(mockIssueCommentRepository.createComment.mock.calls[0][1]).toContain(
      'Auto Status Check: REJECTED',
    );
  });

  it('should move an orphaned issue to Todo by human with AWAITING_OWNER_APPROVAL when last report declares waitingForOwnerApproval', async () => {
    const stuckIssue = createMockIssue({
      url: 'https://github.com/user/repo/issues/10',
      status: 'Preparation',
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
      project: mockProject,
      issues: [stuckIssue],
      cacheUsed: false,
    });
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 1,
    });
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      {
        author: 'agent-bot',
        content:
          'From: :robot: systems-analyst (model)\n```json\n{"pullRequestRequired": false, "waitingForOwnerApproval": true}\n```',
        createdAt: new Date(),
      },
    ]);
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([]);

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      preparationProcessCheckCommand: 'pgrep -fa "claude-agent.*{URL}"',
      thresholdForAutoReject: 3,
      allowedIssueAuthors: ['agent-bot'],
    });

    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(1);
    expect(mockIssueRepository.updateStatus.mock.calls[0][2]).toBe('6');
    expect(mockIssueCommentRepository.createComment.mock.calls).toHaveLength(1);
    expect(mockIssueCommentRepository.createComment.mock.calls[0][1]).toContain(
      'Auto Status Check: AWAITING_OWNER_APPROVAL',
    );
  });

  it('should escalate to Failed Preparation after ownerApprovalTimeoutCycles AWAITING_OWNER_APPROVAL messages in RevertOrphaned', async () => {
    const stuckIssue = createMockIssue({
      url: 'https://github.com/user/repo/issues/10',
      status: 'Preparation',
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
      project: mockProject,
      issues: [stuckIssue],
      cacheUsed: false,
    });
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 1,
    });
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      {
        author: 'agent-bot',
        content:
          'From: :robot: systems-analyst (model)\n```json\n{"pullRequestRequired": false, "waitingForOwnerApproval": true}\n```',
        createdAt: new Date(),
      },
      {
        author: 'agent-bot',
        content:
          'Auto Status Check: AWAITING_OWNER_APPROVAL\nThe last report declared that this task is waiting for owner approval. Returning to Awaiting Workspace for the next cycle.',
        createdAt: new Date(),
      },
      {
        author: 'agent-bot',
        content:
          'Auto Status Check: AWAITING_OWNER_APPROVAL\nThe last report declared that this task is waiting for owner approval. Returning to Awaiting Workspace for the next cycle.',
        createdAt: new Date(),
      },
    ]);
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([]);

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      preparationProcessCheckCommand: 'pgrep -fa "claude-agent.*{URL}"',
      thresholdForAutoReject: 3,
      allowedIssueAuthors: ['agent-bot'],
      ownerApprovalTimeoutCycles: 2,
    });

    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(1);
    expect(mockIssueRepository.updateStatus.mock.calls[0][2]).toBe('5');
    expect(mockIssueCommentRepository.createComment.mock.calls).toHaveLength(1);
    expect(mockIssueCommentRepository.createComment.mock.calls[0][1]).toContain(
      'Owner approval was not received after 2 cycles. Moving to Failed Preparation.',
    );
  });
});
