import { StartPreparationUseCase } from './StartPreparationUseCase';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { LocalCommandRunner } from './adapter-interfaces/LocalCommandRunner';
import { ClaudeRepository } from './adapter-interfaces/ClaudeRepository';
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

describe('StartPreparationUseCase', () => {
  let useCase: StartPreparationUseCase;
  let mockProjectRepository: Mocked<
    Pick<ProjectRepository, 'findProjectIdByUrl' | 'getProject'>
  >;
  let mockIssueRepository: Mocked<
    Pick<IssueRepository, 'getAllIssues' | 'updateStatus'>
  >;
  let mockClaudeRepository: Mocked<Pick<ClaudeRepository, 'getUsage'>>;
  let mockLocalCommandRunner: Mocked<LocalCommandRunner>;
  let mockProject: Project;
  beforeEach(() => {
    jest.resetAllMocks();
    mockProject = createMockProject();
    mockProjectRepository = {
      findProjectIdByUrl: jest.fn().mockResolvedValue('project-1'),
      getProject: jest.fn(),
    };
    mockIssueRepository = {
      getAllIssues: jest
        .fn()
        .mockResolvedValue({ issues: [], cacheUsed: false }),
      updateStatus: jest.fn(),
    };
    mockClaudeRepository = {
      getUsage: jest.fn().mockResolvedValue([]),
    };
    mockLocalCommandRunner = {
      runCommand: jest.fn(),
    };
    useCase = new StartPreparationUseCase(
      mockProjectRepository,
      mockIssueRepository,
      mockClaudeRepository,
      mockLocalCommandRunner,
    );
  });
  it('should run aw command for awaiting workspace issues', async () => {
    const awaitingIssues: Issue[] = [
      createMockIssue({
        url: 'url1',
        title: 'Issue 1',
        labels: ['category:impl'],
        status: 'Awaiting Workspace',
      }),
    ];
    mockProjectRepository.getProject.mockResolvedValue(mockProject);
    mockIssueRepository.getAllIssues.mockResolvedValue({
      issues: awaitingIssues,
      cacheUsed: false,
    });
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });
    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      preparationStatus: 'Preparation',
      defaultAgentName: 'agent1',
      maximumPreparingIssuesCount: null,
      allowIssueCacheMinutes: 60,
    });
    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(1);
    expect(mockIssueRepository.updateStatus.mock.calls[0][1]).toMatchObject({
      url: 'url1',
    });
    expect(mockIssueRepository.updateStatus.mock.calls[0][2]).toBe('2');
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(1);
    expect(mockLocalCommandRunner.runCommand.mock.calls[0][0]).toBe(
      'aw url1 impl https://github.com/user/repo',
    );
  });
  it('should assign workspace to awaiting issues', async () => {
    const awaitingIssues: Issue[] = [
      createMockIssue({
        url: 'url1',
        title: 'Issue 1',
        labels: [],
        status: 'Awaiting Workspace',
      }),
      createMockIssue({
        url: 'url2',
        title: 'Issue 2',
        labels: [],
        status: 'Awaiting Workspace',
      }),
    ];
    mockProjectRepository.getProject.mockResolvedValue(mockProject);
    mockIssueRepository.getAllIssues.mockResolvedValue({
      issues: awaitingIssues,
      cacheUsed: false,
    });
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });
    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      preparationStatus: 'Preparation',
      defaultAgentName: 'agent1',
      maximumPreparingIssuesCount: null,
      allowIssueCacheMinutes: 60,
    });
    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(2);
    expect(mockIssueRepository.updateStatus.mock.calls[0][1]).toMatchObject({
      url: 'url1',
    });
    expect(mockIssueRepository.updateStatus.mock.calls[1][1]).toMatchObject({
      url: 'url2',
    });
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(2);
  });
  it('should stop assigning after maximum preparing issues count is reached', async () => {
    const preparationIssues: Issue[] = Array.from({ length: 6 }, (_, i) =>
      createMockIssue({
        url: `url${i + 1}`,
        title: `Issue ${i + 1}`,
        labels: [],
        status: 'Preparation',
      }),
    );
    const awaitingIssues: Issue[] = [
      createMockIssue({
        url: 'url7',
        title: 'Issue 7',
        labels: [],
        status: 'Awaiting Workspace',
      }),
    ];
    mockProjectRepository.getProject.mockResolvedValue(mockProject);
    mockIssueRepository.getAllIssues.mockResolvedValue({
      issues: [...preparationIssues, ...awaitingIssues],
      cacheUsed: false,
    });
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });
    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      preparationStatus: 'Preparation',
      defaultAgentName: 'agent1',
      maximumPreparingIssuesCount: null,
      allowIssueCacheMinutes: 60,
    });
    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(0);
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(0);
  });
  it('should append logFilePath to aw command when provided', async () => {
    const awaitingIssues: Issue[] = [
      createMockIssue({
        url: 'url1',
        title: 'Issue 1',
        labels: ['category:impl'],
        status: 'Awaiting Workspace',
      }),
    ];
    mockProjectRepository.getProject.mockResolvedValue(mockProject);
    mockIssueRepository.getAllIssues.mockResolvedValue({
      issues: awaitingIssues,
      cacheUsed: false,
    });
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });
    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      preparationStatus: 'Preparation',
      defaultAgentName: 'agent1',
      logFilePath: '/path/to/log.txt',
      maximumPreparingIssuesCount: null,
      allowIssueCacheMinutes: 60,
    });
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(1);
    expect(mockLocalCommandRunner.runCommand.mock.calls[0][0]).toBe(
      'aw url1 impl https://github.com/user/repo --logFilePath /path/to/log.txt',
    );
  });
  it('should not append logFilePath to aw command when not provided', async () => {
    const awaitingIssues: Issue[] = [
      createMockIssue({
        url: 'url1',
        title: 'Issue 1',
        labels: ['category:impl'],
        status: 'Awaiting Workspace',
      }),
    ];
    mockProjectRepository.getProject.mockResolvedValue(mockProject);
    mockIssueRepository.getAllIssues.mockResolvedValue({
      issues: awaitingIssues,
      cacheUsed: false,
    });
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });
    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      preparationStatus: 'Preparation',
      defaultAgentName: 'agent1',
      maximumPreparingIssuesCount: null,
      allowIssueCacheMinutes: 60,
    });
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(1);
    expect(mockLocalCommandRunner.runCommand.mock.calls[0][0]).toBe(
      'aw url1 impl https://github.com/user/repo',
    );
  });
  it('should handle no awaiting workspace issues gracefully', async () => {
    const preparationIssues: Issue[] = [
      createMockIssue({
        url: 'url1',
        title: 'Issue 1',
        labels: [],
        status: 'Preparation',
      }),
    ];
    mockProjectRepository.getProject.mockResolvedValue(mockProject);
    mockIssueRepository.getAllIssues.mockResolvedValue({
      issues: preparationIssues,
      cacheUsed: false,
    });
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });
    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      preparationStatus: 'Preparation',
      defaultAgentName: 'agent1',
      maximumPreparingIssuesCount: null,
      allowIssueCacheMinutes: 60,
    });
    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(0);
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(0);
  });
  it('should use custom maximumPreparingIssuesCount when provided', async () => {
    const awaitingIssues: Issue[] = Array.from({ length: 10 }, (_, i) =>
      createMockIssue({
        url: `url${i + 1}`,
        title: `Issue ${i + 1}`,
        labels: [],
        status: 'Awaiting Workspace',
      }),
    );
    mockProjectRepository.getProject.mockResolvedValue(mockProject);
    mockIssueRepository.getAllIssues.mockResolvedValue({
      issues: awaitingIssues,
      cacheUsed: false,
    });
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });
    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      preparationStatus: 'Preparation',
      defaultAgentName: 'agent1',
      maximumPreparingIssuesCount: 3,
      allowIssueCacheMinutes: 60,
    });
    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(3);
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(3);
  });
  it('should use default maximumPreparingIssuesCount of 6 when null is provided', async () => {
    const awaitingIssues: Issue[] = Array.from({ length: 12 }, (_, i) =>
      createMockIssue({
        url: `url${i + 1}`,
        title: `Issue ${i + 1}`,
        labels: [],
        status: 'Awaiting Workspace',
      }),
    );
    mockProjectRepository.getProject.mockResolvedValue(mockProject);
    mockIssueRepository.getAllIssues.mockResolvedValue({
      issues: awaitingIssues,
      cacheUsed: false,
    });
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });
    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      preparationStatus: 'Preparation',
      defaultAgentName: 'agent1',
      maximumPreparingIssuesCount: null,
      allowIssueCacheMinutes: 60,
    });
    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(6);
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(6);
  });

  it('should skip issues from blocked repositories (not the blocker issue itself)', async () => {
    const blockerIssue = createMockIssue({
      url: 'https://github.com/user/repo/issues/100',
      title: 'Blocker Issue',
      labels: [],
      status: 'Awaiting Workspace',
      state: 'OPEN',
      story: 'Workflow blocker',
    });

    const blockedIssue = createMockIssue({
      url: 'https://github.com/user/repo/issues/101',
      title: 'Blocked Issue',
      labels: [],
      status: 'Awaiting Workspace',
      state: 'OPEN',
    });

    const projectWithBlocker = {
      ...createMockProject(),
      story: {
        name: 'Story',
        fieldId: 'story-field-id',
        databaseId: 1,
        stories: [
          {
            id: 'story-blocker',
            name: 'Workflow blocker',
            color: 'RED' as const,
            description: '',
          },
          {
            id: 'story-1',
            name: 'Default Story',
            color: 'GRAY' as const,
            description: '',
          },
        ],
        workflowManagementStory: {
          id: 'wf-1',
          name: 'Workflow Management',
        },
      },
    };

    mockProjectRepository.getProject.mockResolvedValue(projectWithBlocker);
    mockIssueRepository.getAllIssues.mockResolvedValue({
      issues: [blockerIssue, blockedIssue],
      cacheUsed: false,
    });
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      preparationStatus: 'Preparation',
      defaultAgentName: 'agent1',
      maximumPreparingIssuesCount: null,
      allowIssueCacheMinutes: 60,
    });

    const blockerUpdateCalls =
      mockIssueRepository.updateStatus.mock.calls.filter(
        (call) => call[1].url === 'https://github.com/user/repo/issues/100',
      );
    expect(blockerUpdateCalls).toHaveLength(1);

    const blockedUpdateCalls =
      mockIssueRepository.updateStatus.mock.calls.filter(
        (call) => call[1].url === blockedIssue.url,
      );
    expect(blockedUpdateCalls).toHaveLength(0);

    const blockedRunCommandCalls =
      mockLocalCommandRunner.runCommand.mock.calls.filter((call) =>
        call.some(
          (arg) => typeof arg === 'string' && arg.includes(blockedIssue.url),
        ),
      );
    expect(blockedRunCommandCalls).toHaveLength(0);
  });

  it('should process the blocker issue even when repository is blocked', async () => {
    const blockerIssue = createMockIssue({
      url: 'https://github.com/user/repo/issues/100',
      title: 'Blocker Issue',
      labels: [],
      status: 'Awaiting Workspace',
      state: 'OPEN',
      story: 'Workflow blocker',
    });

    const projectWithBlocker = {
      ...createMockProject(),
      story: {
        name: 'Story',
        fieldId: 'story-field-id',
        databaseId: 1,
        stories: [
          {
            id: 'story-blocker',
            name: 'Workflow blocker',
            color: 'RED' as const,
            description: '',
          },
        ],
        workflowManagementStory: {
          id: 'wf-1',
          name: 'Workflow Management',
        },
      },
    };

    mockProjectRepository.getProject.mockResolvedValue(projectWithBlocker);
    mockIssueRepository.getAllIssues.mockResolvedValue({
      issues: [blockerIssue],
      cacheUsed: false,
    });
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      preparationStatus: 'Preparation',
      defaultAgentName: 'agent1',
      maximumPreparingIssuesCount: null,
      allowIssueCacheMinutes: 60,
    });

    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(1);
    expect(mockIssueRepository.updateStatus.mock.calls[0][1].url).toBe(
      'https://github.com/user/repo/issues/100',
    );
  });

  it('should process awaiting issue when workflow blocker story has no open blocker issues', async () => {
    const awaitingIssue = createMockIssue({
      url: 'https://github.com/user/repo/issues/101',
      title: 'Awaiting Issue',
      labels: [],
      status: 'Awaiting Workspace',
      state: 'OPEN',
    });

    const projectWithBlocker = {
      ...createMockProject(),
      story: {
        name: 'Story',
        fieldId: 'story-field-id',
        databaseId: 1,
        stories: [
          {
            id: 'story-1',
            name: 'Default Story',
            color: 'GRAY' as const,
            description: '',
          },
          {
            id: 'story-blocker',
            name: 'Workflow blocker',
            color: 'RED' as const,
            description: '',
          },
        ],
        workflowManagementStory: {
          id: 'wf-1',
          name: 'Workflow Management',
        },
      },
    };

    mockProjectRepository.getProject.mockResolvedValue(projectWithBlocker);
    mockIssueRepository.getAllIssues.mockResolvedValue({
      issues: [awaitingIssue],
      cacheUsed: false,
    });
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      preparationStatus: 'Preparation',
      defaultAgentName: 'agent1',
      maximumPreparingIssuesCount: null,
      allowIssueCacheMinutes: 60,
    });

    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(1);
    expect(mockIssueRepository.updateStatus.mock.calls[0][1].url).toBe(
      'https://github.com/user/repo/issues/101',
    );
  });

  it('should skip preparation when Claude usage is over 90%', async () => {
    mockClaudeRepository.getUsage.mockResolvedValue([
      { hour: 5, utilizationPercentage: 95, resetsAt: new Date() },
    ]);

    const awaitingIssues: Issue[] = [
      createMockIssue({
        url: 'url1',
        title: 'Issue 1',
        labels: [],
        status: 'Awaiting Workspace',
      }),
    ];
    mockProjectRepository.getProject.mockResolvedValue(mockProject);
    mockIssueRepository.getAllIssues.mockResolvedValue({
      issues: awaitingIssues,
      cacheUsed: false,
    });

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      preparationStatus: 'Preparation',
      defaultAgentName: 'agent1',
      maximumPreparingIssuesCount: null,
      allowIssueCacheMinutes: 60,
    });

    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(0);
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(0);
    expect(mockProjectRepository.findProjectIdByUrl).not.toHaveBeenCalled();
  });

  it('should proceed with preparation when Claude usage is under 90%', async () => {
    mockClaudeRepository.getUsage.mockResolvedValue([
      { hour: 5, utilizationPercentage: 50, resetsAt: new Date() },
      { hour: 168, utilizationPercentage: 30, resetsAt: new Date() },
    ]);

    const awaitingIssues: Issue[] = [
      createMockIssue({
        url: 'url1',
        title: 'Issue 1',
        labels: ['category:impl'],
        status: 'Awaiting Workspace',
      }),
    ];
    mockProjectRepository.getProject.mockResolvedValue(mockProject);
    mockIssueRepository.getAllIssues.mockResolvedValue({
      issues: awaitingIssues,
      cacheUsed: false,
    });
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      preparationStatus: 'Preparation',
      defaultAgentName: 'agent1',
      maximumPreparingIssuesCount: null,
      allowIssueCacheMinutes: 60,
    });

    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(1);
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(1);
  });

  it('should skip preparation when any Claude usage window exceeds 90%', async () => {
    mockClaudeRepository.getUsage.mockResolvedValue([
      { hour: 5, utilizationPercentage: 50, resetsAt: new Date() },
      { hour: 168, utilizationPercentage: 91, resetsAt: new Date() },
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      preparationStatus: 'Preparation',
      defaultAgentName: 'agent1',
      maximumPreparingIssuesCount: null,
      allowIssueCacheMinutes: 60,
    });

    expect(mockProjectRepository.findProjectIdByUrl).not.toHaveBeenCalled();
    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(0);
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(0);
  });

  it('should proceed with preparation when Claude usage check fails', async () => {
    mockClaudeRepository.getUsage.mockRejectedValue(
      new Error('Claude credentials file not found'),
    );

    const awaitingIssues: Issue[] = [
      createMockIssue({
        url: 'url1',
        title: 'Issue 1',
        labels: ['category:impl'],
        status: 'Awaiting Workspace',
      }),
    ];
    mockProjectRepository.getProject.mockResolvedValue(mockProject);
    mockIssueRepository.getAllIssues.mockResolvedValue({
      issues: awaitingIssues,
      cacheUsed: false,
    });
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      awaitingWorkspaceStatus: 'Awaiting Workspace',
      preparationStatus: 'Preparation',
      defaultAgentName: 'agent1',
      maximumPreparingIssuesCount: null,
      allowIssueCacheMinutes: 60,
    });

    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(1);
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(1);
  });
});
