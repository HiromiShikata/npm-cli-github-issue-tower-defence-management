import {
  RevertOrphanedWaitConditionUseCase,
  ORPHANED_WAIT_CONDITION_REJECTION_DETAIL,
} from './RevertOrphanedWaitConditionUseCase';
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
  plainCrossRepoIssueReferenceUrls: [],
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
        name: 'Awaiting Owner',
        color: 'GREEN',
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

describe('RevertOrphanedWaitConditionUseCase', () => {
  let useCase: RevertOrphanedWaitConditionUseCase;
  let mockProjectRepository: Mocked<
    Pick<ProjectRepository, 'findProjectIdByUrl' | 'getProject'>
  >;
  let mockIssueRepository: Mocked<Pick<IssueRepository, 'getAllIssues'>>;
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
    };
    mockIssueRepository = {
      getAllIssues: jest.fn().mockResolvedValue({
        project: mockProject,
        issues: [],
        cacheUsed: false,
      }),
    };
    mockIssueCommentRepository = {
      getCommentsFromIssue: jest.fn().mockResolvedValue([]),
      createComment: jest.fn().mockResolvedValue(undefined),
    };
    mockLocalCommandRunner = {
      runCommand: jest.fn(),
      spawnInteractive: jest.fn(),
    };
    useCase = new RevertOrphanedWaitConditionUseCase(
      mockProjectRepository,
      mockIssueRepository,
      mockIssueCommentRepository,
      mockLocalCommandRunner,
    );
  });

  const waitConditionCases: { name: string; overrides: Partial<Issue> }[] = [
    {
      name: 'a Depended Issue URL is set',
      overrides: {
        dependedIssueUrls: ['https://github.com/user/repo/issues/99'],
      },
    },
    {
      name: 'a Next Action Date is set',
      overrides: { nextActionDate: new Date('2026-10-05T00:00:00Z') },
    },
    {
      name: 'a Next Action Hour is set',
      overrides: { nextActionHour: 9 },
    },
  ];

  it.each(waitConditionCases)(
    'posts the orphaned wait-condition rejection comment when status is not Preparation, the host process is confirmed not running, and $name',
    async ({ overrides }) => {
      const waitingIssue = createMockIssue({
        url: 'https://github.com/user/repo/issues/10',
        status: 'Awaiting Workspace',
        ...overrides,
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: mockProject,
        issues: [waitingIssue],
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
      });

      expect(mockIssueCommentRepository.createComment.mock.calls).toHaveLength(
        1,
      );
      expect(mockIssueCommentRepository.createComment.mock.calls[0][0]).toBe(
        waitingIssue,
      );
      expect(mockIssueCommentRepository.createComment.mock.calls[0][1]).toBe(
        `Auto Status Check: REJECTED\n- ${ORPHANED_WAIT_CONDITION_REJECTION_DETAIL}`,
      );
      expect(mockLocalCommandRunner.runCommand.mock.calls[0]).toEqual([
        'sh',
        ['-c', 'pgrep -fa "claude-agent.*$1"', '--', waitingIssue.url],
      ]);
    },
  );

  it('includes a task whose host process is running but whose aw log file is stale, and uses the exact process-check and find commands to decide it', async () => {
    const waitingIssue = createMockIssue({
      url: 'https://github.com/myorg/myrepo/issues/42',
      org: 'myorg',
      repo: 'myrepo',
      number: 42,
      status: 'Awaiting Workspace',
      dependedIssueUrls: ['https://github.com/user/repo/issues/99'],
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
      project: mockProject,
      issues: [waitingIssue],
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
      awLogDirectoryPath: '/home/user/logs-aw',
      awLogStaleThresholdMinutes: 15,
    });

    expect(mockIssueCommentRepository.createComment.mock.calls).toHaveLength(1);
    expect(mockIssueCommentRepository.createComment.mock.calls[0][1]).toBe(
      `Auto Status Check: REJECTED\n- ${ORPHANED_WAIT_CONDITION_REJECTION_DETAIL}`,
    );
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(3);
    expect(mockLocalCommandRunner.runCommand.mock.calls[0]).toEqual([
      'sh',
      ['-c', 'pgrep -fa "Please handover $1"', '--', waitingIssue.url],
    ]);
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

  it('exposes only getAllIssues on its issue repository dependency and calls no other repository method while posting the rejection comment', async () => {
    expect(Object.keys(mockIssueRepository)).toEqual(['getAllIssues']);
    expect(typeof mockIssueRepository.getAllIssues).toBe('function');

    const waitingIssue = createMockIssue({
      url: 'https://github.com/user/repo/issues/10',
      status: 'Awaiting Workspace',
      nextActionHour: 9,
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
      project: mockProject,
      issues: [waitingIssue],
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
    });

    expect(mockIssueRepository.getAllIssues.mock.calls).toHaveLength(1);
    expect(mockIssueCommentRepository.createComment.mock.calls).toHaveLength(1);
    expect(Object.keys(mockIssueRepository)).toEqual(['getAllIssues']);
  });

  it('does not post a comment when the host process is running and a recently modified aw log file exists within the staleness threshold', async () => {
    const activeIssue = createMockIssue({
      url: 'https://github.com/myorg/myrepo/issues/42',
      org: 'myorg',
      repo: 'myrepo',
      number: 42,
      status: 'Awaiting Workspace',
      nextActionHour: 9,
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
      awLogDirectoryPath: '/home/user/logs-aw',
      awLogStaleThresholdMinutes: 15,
    });

    expect(mockIssueCommentRepository.createComment).not.toHaveBeenCalled();
  });

  it('does not post a comment when the process is confirmed orphaned but the most recent comment is already a recognizable agent report', async () => {
    const waitingIssue = createMockIssue({
      url: 'https://github.com/user/repo/issues/10',
      status: 'Awaiting Owner',
      dependedIssueUrls: ['https://github.com/user/repo/issues/99'],
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
      project: mockProject,
      issues: [waitingIssue],
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
          'From: :robot: liaison (model)\n\n```json\n{ "needOwnerConfirmationOrApproval": true }\n```\n',
        createdAt: new Date('2024-01-02T00:00:00Z'),
        updatedAt: new Date('2024-01-02T00:00:00Z'),
      },
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      preparationProcessCheckCommand: 'pgrep -fa "claude-agent.*{URL}"',
    });

    expect(mockIssueCommentRepository.createComment).not.toHaveBeenCalled();
  });

  it('does not repost the rejection comment on a later periodic run while the same wait condition remains, even though the prior rejection comment was posted 17 hours ago (proving the dedup check is unwindowed)', async () => {
    const waitingIssue = createMockIssue({
      url: 'https://github.com/user/repo/issues/10',
      status: 'Awaiting Workspace',
      dependedIssueUrls: ['https://github.com/user/repo/issues/99'],
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
      project: mockProject,
      issues: [waitingIssue],
      cacheUsed: false,
    });
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 1,
    });
    const seventeenHoursAgo = new Date(Date.now() - 17 * 60 * 60 * 1000);
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      {
        author: 'bot',
        content: `Auto Status Check: REJECTED\n- ${ORPHANED_WAIT_CONDITION_REJECTION_DETAIL}`,
        createdAt: seventeenHoursAgo,
        updatedAt: seventeenHoursAgo,
      },
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      preparationProcessCheckCommand: 'pgrep -fa "claude-agent.*{URL}"',
    });

    expect(mockIssueCommentRepository.createComment).not.toHaveBeenCalled();
  });
});
