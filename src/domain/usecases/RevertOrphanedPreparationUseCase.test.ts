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
});

const createPassingPr = () => ({
  url: 'https://github.com/user/repo/pull/5',
  branchName: 'i1',
  isConflicted: false,
  isPassedAllCiJob: true,
  isCiStateSuccess: true,
  isResolvedAllReviewComments: true,
  isBranchOutOfDate: false,
  missingRequiredCheckNames: [],
});

describe('RevertOrphanedPreparationUseCase', () => {
  let useCase: RevertOrphanedPreparationUseCase;
  let mockProjectRepository: Mocked<
    Pick<ProjectRepository, 'findProjectIdByUrl' | 'getProject'>
  >;
  let mockIssueRepository: Mocked<
    Pick<
      IssueRepository,
      | 'getAllIssues'
      | 'updateStatus'
      | 'findRelatedOpenPRs'
      | 'getOpenPullRequest'
    >
  >;
  let mockIssueCommentRepository: Mocked<
    Pick<IssueCommentRepository, 'getCommentsFromIssue'>
  >;
  let mockLocalCommandRunner: Mocked<LocalCommandRunner>;
  let mockProject: Project;

  beforeEach(() => {
    jest.resetAllMocks();
    mockProject = createMockProject();
    mockProjectRepository = {
      findProjectIdByUrl: jest.fn().mockResolvedValue('project-1'),
      getProject: jest.fn().mockResolvedValue(mockProject),
    };
    mockIssueRepository = {
      getAllIssues: jest
        .fn()
        .mockResolvedValue({ issues: [], cacheUsed: false }),
      updateStatus: jest.fn().mockResolvedValue(undefined),
      findRelatedOpenPRs: jest.fn().mockResolvedValue([]),
      getOpenPullRequest: jest.fn().mockResolvedValue(null),
    };
    mockIssueCommentRepository = {
      getCommentsFromIssue: jest.fn().mockResolvedValue([]),
    };
    mockLocalCommandRunner = {
      runCommand: jest.fn(),
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
      preparationStatus: 'Preparation',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      awaitingQualityCheckStatus: 'Awaiting Quality Check',
      allowIssueCacheMinutes: 60,
      preparationProcessCheckCommand: 'pgrep -fa "claude-agent.*{URL}"',
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

  it('should advance orphaned issue to Awaiting Quality Check when agent report and passing PR are present', async () => {
    const stuckIssue = createMockIssue({
      url: 'https://github.com/user/repo/issues/10',
      status: 'Preparation',
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
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
        content: 'From: agent report',
        createdAt: new Date(),
      },
    ]);
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
      createPassingPr(),
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      preparationStatus: 'Preparation',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      awaitingQualityCheckStatus: 'Awaiting Quality Check',
      allowIssueCacheMinutes: 60,
      preparationProcessCheckCommand: 'pgrep -fa "claude-agent.*{URL}"',
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
        content: 'From: agent report',
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
      preparationStatus: 'Preparation',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      awaitingQualityCheckStatus: 'Awaiting Quality Check',
      allowIssueCacheMinutes: 60,
      preparationProcessCheckCommand: 'pgrep -fa "claude-agent.*{URL}"',
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
        content: 'From: agent report',
        createdAt: new Date(),
      },
    ]);
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([]);

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      preparationStatus: 'Preparation',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      awaitingQualityCheckStatus: 'Awaiting Quality Check',
      allowIssueCacheMinutes: 60,
      preparationProcessCheckCommand: 'pgrep -fa "claude-agent.*{URL}"',
    });

    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(1);
    expect(mockIssueRepository.updateStatus.mock.calls[0][2]).toBe('1');
  });

  it('should revert orphaned issue to Awaiting Workspace when awaitingQualityCheckStatus is not provided', async () => {
    const stuckIssue = createMockIssue({
      url: 'https://github.com/user/repo/issues/10',
      status: 'Preparation',
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
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
        content: 'From: agent report',
        createdAt: new Date(),
      },
    ]);
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
      createPassingPr(),
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      preparationStatus: 'Preparation',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      allowIssueCacheMinutes: 60,
      preparationProcessCheckCommand: 'pgrep -fa "claude-agent.*{URL}"',
    });

    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(1);
    expect(mockIssueRepository.updateStatus.mock.calls[0][2]).toBe('1');
  });

  it('should advance orphaned issue with llm-agent label to Awaiting Quality Check without PR check', async () => {
    const stuckIssue = createMockIssue({
      url: 'https://github.com/user/repo/issues/10',
      status: 'Preparation',
      labels: ['llm-agent'],
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
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
        content: 'From: agent report',
        createdAt: new Date(),
      },
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      preparationStatus: 'Preparation',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      awaitingQualityCheckStatus: 'Awaiting Quality Check',
      allowIssueCacheMinutes: 60,
      preparationProcessCheckCommand: 'pgrep -fa "claude-agent.*{URL}"',
    });

    expect(mockIssueRepository.findRelatedOpenPRs.mock.calls).toHaveLength(0);
    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(1);
    expect(mockIssueRepository.updateStatus.mock.calls[0][2]).toBe('4');
  });

  it('should revert orphaned issue to Awaiting Workspace when report has nextStep set', async () => {
    const stuckIssue = createMockIssue({
      url: 'https://github.com/user/repo/issues/10',
      status: 'Preparation',
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
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
          'From: agent report\n```json\n{"nextStep": "do something"}\n```',
        createdAt: new Date(),
      },
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      preparationStatus: 'Preparation',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      awaitingQualityCheckStatus: 'Awaiting Quality Check',
      allowIssueCacheMinutes: 60,
      preparationProcessCheckCommand: 'pgrep -fa "claude-agent.*{URL}"',
    });

    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(1);
    expect(mockIssueRepository.updateStatus.mock.calls[0][2]).toBe('1');
  });

  it('should never post a comment regardless of orphan outcome', async () => {
    const stuckIssue = createMockIssue({
      url: 'https://github.com/user/repo/issues/10',
      status: 'Preparation',
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
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
      preparationStatus: 'Preparation',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      awaitingQualityCheckStatus: 'Awaiting Quality Check',
      allowIssueCacheMinutes: 60,
      preparationProcessCheckCommand: 'pgrep -fa "claude-agent.*{URL}"',
    });

    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(1);
  });

  it('should leave in-flight Preparation issue untouched when check command exits zero', async () => {
    const inFlightIssue = createMockIssue({
      url: 'https://github.com/user/repo/issues/20',
      status: 'Preparation',
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
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
      preparationStatus: 'Preparation',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      awaitingQualityCheckStatus: 'Awaiting Quality Check',
      allowIssueCacheMinutes: 60,
      preparationProcessCheckCommand: 'pgrep -fa "claude-agent.*{URL}"',
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
      preparationStatus: 'Preparation',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      awaitingQualityCheckStatus: 'Awaiting Quality Check',
      allowIssueCacheMinutes: 60,
      preparationProcessCheckCommand: 'check {URL}',
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
      preparationStatus: 'Preparation',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      awaitingQualityCheckStatus: 'Awaiting Quality Check',
      allowIssueCacheMinutes: 60,
      preparationProcessCheckCommand: 'check {URL}',
    });

    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(1);
    expect(mockIssueRepository.updateStatus.mock.calls[0][1]).toBe(stuckIssue);
  });

  it('should throw when project is not found by URL', async () => {
    mockProjectRepository.findProjectIdByUrl.mockResolvedValue(null);

    await expect(
      useCase.run({
        projectUrl: 'https://github.com/user/repo',
        preparationStatus: 'Preparation',
        awaitingWorkspaceStatus: 'Awaiting Workspace',
        awaitingQualityCheckStatus: 'Awaiting Quality Check',
        allowIssueCacheMinutes: 0,
        preparationProcessCheckCommand: 'check {URL}',
      }),
    ).rejects.toThrow('Project not found');
  });

  it('should throw when getProject returns null after findProjectIdByUrl succeeds', async () => {
    mockProjectRepository.findProjectIdByUrl.mockResolvedValue('project-1');
    mockProjectRepository.getProject.mockResolvedValue(null);

    await expect(
      useCase.run({
        projectUrl: 'https://github.com/user/repo',
        preparationStatus: 'Preparation',
        awaitingWorkspaceStatus: 'Awaiting Workspace',
        awaitingQualityCheckStatus: 'Awaiting Quality Check',
        allowIssueCacheMinutes: 0,
        preparationProcessCheckCommand: 'check {URL}',
      }),
    ).rejects.toThrow('Project not found. projectId: project-1');
  });

  it('should do nothing when awaitingWorkspaceStatus is not found in project statuses', async () => {
    const preparationIssue = createMockIssue({
      url: 'https://github.com/user/repo/issues/10',
      status: 'Preparation',
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
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
      preparationStatus: 'Preparation',
      awaitingWorkspaceStatus: 'NonExistentStatus',
      awaitingQualityCheckStatus: 'Awaiting Quality Check',
      allowIssueCacheMinutes: 0,
      preparationProcessCheckCommand: 'check {URL}',
    });

    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(0);
  });

  it('should do nothing when there are no Preparation issues', async () => {
    mockIssueRepository.getAllIssues.mockResolvedValue({
      issues: [
        createMockIssue({ status: 'Awaiting Workspace' }),
        createMockIssue({ status: 'Done' }),
      ],
      cacheUsed: false,
    });

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      preparationStatus: 'Preparation',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      awaitingQualityCheckStatus: 'Awaiting Quality Check',
      allowIssueCacheMinutes: 60,
      preparationProcessCheckCommand: 'check {URL}',
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
      preparationStatus: 'Preparation',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      awaitingQualityCheckStatus: 'Awaiting Quality Check',
      allowIssueCacheMinutes: 60,
      preparationProcessCheckCommand: 'pgrep -fa "Please handover {URL}"',
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
      preparationStatus: 'Preparation',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      awaitingQualityCheckStatus: 'Awaiting Quality Check',
      allowIssueCacheMinutes: 60,
      preparationProcessCheckCommand: 'pgrep -fa "Please handover {URL}"',
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
      preparationStatus: 'Preparation',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      awaitingQualityCheckStatus: 'Awaiting Quality Check',
      allowIssueCacheMinutes: 60,
      preparationProcessCheckCommand: 'pgrep -fa "Please handover {URL}"',
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
      preparationStatus: 'Preparation',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      awaitingQualityCheckStatus: 'Awaiting Quality Check',
      allowIssueCacheMinutes: 60,
      preparationProcessCheckCommand: 'pgrep -fa "claude-agent.*{URL}"',
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
      preparationStatus: 'Preparation',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      awaitingQualityCheckStatus: 'Awaiting Quality Check',
      allowIssueCacheMinutes: 60,
      preparationProcessCheckCommand: 'pgrep -fa "Please handover {URL}"',
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
      preparationStatus: 'Preparation',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      awaitingQualityCheckStatus: 'Awaiting Quality Check',
      allowIssueCacheMinutes: 0,
      preparationProcessCheckCommand: 'pgrep -fa "claude-agent.*{URL}"',
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
      preparationStatus: 'Preparation',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      awaitingQualityCheckStatus: 'Awaiting Quality Check',
      allowIssueCacheMinutes: 60,
      preparationProcessCheckCommand: 'pgrep -fa "claude-agent.*{URL}"',
    });

    expect(
      mockIssueCommentRepository.getCommentsFromIssue.mock.calls,
    ).toHaveLength(0);
    expect(mockIssueRepository.findRelatedOpenPRs.mock.calls).toHaveLength(0);
    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(1);
    expect(mockIssueRepository.updateStatus.mock.calls[0][2]).toBe('4');
  });
});
