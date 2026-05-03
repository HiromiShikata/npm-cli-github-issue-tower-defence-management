import { RevertOrphanedPreparationUseCase } from './RevertOrphanedPreparationUseCase';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
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

describe('RevertOrphanedPreparationUseCase', () => {
  let useCase: RevertOrphanedPreparationUseCase;
  let mockProjectRepository: Mocked<
    Pick<ProjectRepository, 'findProjectIdByUrl' | 'getProject'>
  >;
  let mockIssueRepository: Mocked<
    Pick<IssueRepository, 'getAllIssues' | 'updateStatus' | 'createComment'>
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
      createComment: jest.fn().mockResolvedValue(undefined),
    };
    mockLocalCommandRunner = {
      runCommand: jest.fn(),
    };
    useCase = new RevertOrphanedPreparationUseCase(
      mockProjectRepository,
      mockIssueRepository,
      mockLocalCommandRunner,
    );
  });

  it('should revert stuck-Preparation issue to Awaiting Workspace when check command exits non-zero', async () => {
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

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      preparationStatus: 'Preparation',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      allowIssueCacheMinutes: 60,
      preparationProcessCheckCommand: 'pgrep -fa "claude-agent.*{URL}"',
    });

    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(1);
    expect(mockIssueRepository.updateStatus.mock.calls[0][0]).toBe(mockProject);
    expect(mockIssueRepository.updateStatus.mock.calls[0][1]).toBe(stuckIssue);
    expect(mockIssueRepository.updateStatus.mock.calls[0][2]).toBe('1');
    expect(mockIssueRepository.createComment.mock.calls).toHaveLength(1);
    expect(mockIssueRepository.createComment.mock.calls[0][0]).toBe(stuckIssue);
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(1);
    expect(mockLocalCommandRunner.runCommand.mock.calls[0][0]).toBe(
      'pgrep -fa "claude-agent.*https://github.com/user/repo/issues/10"',
    );
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
      allowIssueCacheMinutes: 60,
      preparationProcessCheckCommand: 'pgrep -fa "claude-agent.*{URL}"',
    });

    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(0);
    expect(mockIssueRepository.createComment.mock.calls).toHaveLength(0);
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

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      preparationStatus: 'Preparation',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      allowIssueCacheMinutes: 60,
      preparationProcessCheckCommand: 'check {URL}',
    });

    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(1);
    expect(mockLocalCommandRunner.runCommand.mock.calls[0][0]).toBe(
      'check https://github.com/user/repo/issues/10',
    );
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

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      preparationStatus: 'Preparation',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      allowIssueCacheMinutes: 60,
      preparationProcessCheckCommand: 'check {URL}',
    });

    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(1);
    expect(mockIssueRepository.updateStatus.mock.calls[0][1]).toBe(stuckIssue);
    expect(mockIssueRepository.createComment.mock.calls).toHaveLength(1);
  });

  it('should throw when project is not found by URL', async () => {
    mockProjectRepository.findProjectIdByUrl.mockResolvedValue(null);

    await expect(
      useCase.run({
        projectUrl: 'https://github.com/user/repo',
        preparationStatus: 'Preparation',
        awaitingWorkspaceStatus: 'Awaiting Workspace',
        allowIssueCacheMinutes: 0,
        preparationProcessCheckCommand: 'check {URL}',
      }),
    ).rejects.toThrow('Project not found');
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
      allowIssueCacheMinutes: 60,
      preparationProcessCheckCommand: 'check {URL}',
    });

    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(0);
    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(0);
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
      allowIssueCacheMinutes: 0,
      preparationProcessCheckCommand: 'pgrep -fa "claude-agent.*{URL}"',
    });

    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(1);
    expect(mockLocalCommandRunner.runCommand.mock.calls[0][0]).toBe(
      'pgrep -fa "claude-agent.*https://github.com/org/project/issues/99"',
    );
  });
});
