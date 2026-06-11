import { RevertNotReadyAwaitingQualityCheckUseCase } from './RevertNotReadyAwaitingQualityCheckUseCase';
import { Issue } from '../entities/Issue';
import { Project } from '../entities/Project';

const createMockProject = (overrides: Partial<Project> = {}): Project => ({
  id: 'project-1',
  url: 'https://github.com/users/user/projects/1',
  databaseId: 1,
  name: 'Test Project',
  status: {
    name: 'Status',
    fieldId: 'field-1',
    statuses: [
      {
        id: 'awaiting-workspace-id',
        name: 'Awaiting Workspace',
        color: 'GRAY',
        description: '',
      },
      {
        id: 'awaiting-quality-check-id',
        name: 'Awaiting Quality Check',
        color: 'BLUE',
        description: '',
      },
    ],
  },
  nextActionDate: null,
  nextActionHour: null,
  story: null,
  remainingEstimationMinutes: null,
  dependedIssueUrlSeparatedByComma: null,
  completionDate50PercentConfidence: null,
  ...overrides,
});

const createMockIssue = (overrides: Partial<Issue> = {}): Issue => ({
  nameWithOwner: 'user/repo',
  number: 1,
  title: 'Test Issue',
  state: 'OPEN',
  status: 'Awaiting Quality Check',
  story: null,
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

const createReadyPr = (url = 'https://github.com/user/repo/pull/1') => ({
  url,
  number: 1,
  title: 'Test PR',
  branchName: 'feature-branch',
  createdAt: new Date('2000-01-01T00:00:00Z'),
  isDraft: false,
  isConflicted: false,
  isPassedAllCiJob: true,
  isCiStateSuccess: true,
  isResolvedAllReviewComments: true,
  isBranchOutOfDate: false,
  missingRequiredCheckNames: [],
  additions: 10,
  deletions: 3,
  changedFiles: 2,
});

describe('RevertNotReadyAwaitingQualityCheckUseCase', () => {
  let mockProjectRepository: {
    findProjectIdByUrl: jest.Mock;
    getProject: jest.Mock;
  };
  let mockIssueRepository: {
    getAllIssues: jest.Mock;
    updateStatus: jest.Mock;
    findRelatedOpenPRs: jest.Mock;
    getOpenPullRequest: jest.Mock;
    getPullRequestChangedFilePaths: jest.Mock;
    approvePullRequest: jest.Mock;
    requestChangesWithInlineComment: jest.Mock;
  };
  let mockIssueCommentRepository: {
    createComment: jest.Mock;
  };
  let mockProject: Project;
  let useCase: RevertNotReadyAwaitingQualityCheckUseCase;

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
      getPullRequestChangedFilePaths: jest.fn().mockResolvedValue([]),
      approvePullRequest: jest.fn().mockResolvedValue(undefined),
      requestChangesWithInlineComment: jest.fn().mockResolvedValue(undefined),
    };

    mockIssueCommentRepository = {
      createComment: jest.fn().mockResolvedValue(undefined),
    };

    useCase = new RevertNotReadyAwaitingQualityCheckUseCase(
      mockProjectRepository,
      mockIssueRepository,
      mockIssueCommentRepository,
    );
  });

  it('should do nothing when there are no Awaiting Quality Check issues', async () => {
    mockIssueRepository.getAllIssues.mockResolvedValue({
      issues: [
        createMockIssue({ status: 'Awaiting Workspace' }),
        createMockIssue({ status: 'Preparation' }),
      ],
      cacheUsed: false,
    });

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      allowIssueCacheMinutes: 10,
    });

    expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
    expect(mockIssueCommentRepository.createComment).not.toHaveBeenCalled();
  });

  it('should skip Awaiting Quality Check issue with llm-agent label', async () => {
    const issue = createMockIssue({
      status: 'Awaiting Quality Check',
      labels: ['llm-agent'],
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
      issues: [issue],
      cacheUsed: false,
    });

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      allowIssueCacheMinutes: 10,
    });

    expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
    expect(mockIssueCommentRepository.createComment).not.toHaveBeenCalled();
  });

  it('should revert issue when no linked PR is found', async () => {
    const issue = createMockIssue({
      status: 'Awaiting Quality Check',
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
      issues: [issue],
      cacheUsed: false,
    });
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      allowIssueCacheMinutes: 10,
    });

    expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
      mockProject,
      issue,
      'awaiting-workspace-id',
    );
    expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
      issue,
      expect.stringContaining('Auto Status Check: REJECTED'),
    );
    expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
      issue,
      expect.stringContaining('PULL_REQUEST_NOT_FOUND'),
    );
  });

  it('should not revert a story-labeled issue with no linked PR when story is in labelsAsLlmAgentName', async () => {
    const issue = createMockIssue({
      status: 'Awaiting Quality Check',
      labels: ['story'],
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
      issues: [issue],
      cacheUsed: false,
    });
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      allowIssueCacheMinutes: 10,
      labelsAsLlmAgentName: ['story', 'chore', 'accounting'],
    });

    expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
    expect(mockIssueCommentRepository.createComment).not.toHaveBeenCalled();
  });

  it('should not revert a chore-labeled issue with no linked PR when chore is in labelsAsLlmAgentName', async () => {
    const issue = createMockIssue({
      status: 'Awaiting Quality Check',
      labels: ['chore'],
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
      issues: [issue],
      cacheUsed: false,
    });
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      allowIssueCacheMinutes: 10,
      labelsAsLlmAgentName: ['story', 'chore'],
    });

    expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
    expect(mockIssueCommentRepository.createComment).not.toHaveBeenCalled();
  });

  it('should still revert a story-labeled issue with no linked PR when labelsAsLlmAgentName is not provided', async () => {
    const issue = createMockIssue({
      status: 'Awaiting Quality Check',
      labels: ['story'],
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
      issues: [issue],
      cacheUsed: false,
    });
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      allowIssueCacheMinutes: 10,
    });

    expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
      mockProject,
      issue,
      'awaiting-workspace-id',
    );
    expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
      issue,
      expect.stringContaining('PULL_REQUEST_NOT_FOUND'),
    );
  });

  it('should not revert a story-labeled issue with no linked PR when labelsAsLlmAgentName is null', async () => {
    const issue = createMockIssue({
      status: 'Awaiting Quality Check',
      labels: ['story'],
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
      issues: [issue],
      cacheUsed: false,
    });
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      allowIssueCacheMinutes: 10,
      labelsAsLlmAgentName: null,
    });

    expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
      mockProject,
      issue,
      'awaiting-workspace-id',
    );
  });

  it('should not revert issue when PR is ready', async () => {
    const issue = createMockIssue({
      status: 'Awaiting Quality Check',
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
      issues: [issue],
      cacheUsed: false,
    });
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([createReadyPr()]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      allowIssueCacheMinutes: 10,
    });

    expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
    expect(mockIssueCommentRepository.createComment).not.toHaveBeenCalled();
  });

  it('should revert issue when PR is conflicted', async () => {
    const issue = createMockIssue({
      status: 'Awaiting Quality Check',
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
      issues: [issue],
      cacheUsed: false,
    });
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
      { ...createReadyPr(), isConflicted: true },
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      allowIssueCacheMinutes: 10,
    });

    expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
      mockProject,
      issue,
      'awaiting-workspace-id',
    );
    expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
      issue,
      expect.stringContaining('Auto Status Check: REJECTED'),
    );
    expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
      issue,
      expect.stringContaining('PULL_REQUEST_CONFLICTED'),
    );
  });

  it('should revert issue when CI is failing', async () => {
    const issue = createMockIssue({
      status: 'Awaiting Quality Check',
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
      issues: [issue],
      cacheUsed: false,
    });
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
      {
        ...createReadyPr(),
        isPassedAllCiJob: false,
        isCiStateSuccess: false,
      },
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      allowIssueCacheMinutes: 10,
    });

    expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
      mockProject,
      issue,
      'awaiting-workspace-id',
    );
    expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
      issue,
      expect.stringContaining('Auto Status Check: REJECTED'),
    );
    expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
      issue,
      expect.stringContaining('ANY_CI_JOB_FAILED_OR_IN_PROGRESS'),
    );
  });

  it('should revert issue when review comments are not resolved', async () => {
    const issue = createMockIssue({
      status: 'Awaiting Quality Check',
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
      issues: [issue],
      cacheUsed: false,
    });
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
      { ...createReadyPr(), isResolvedAllReviewComments: false },
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      allowIssueCacheMinutes: 10,
    });

    expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
      mockProject,
      issue,
      'awaiting-workspace-id',
    );
    expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
      issue,
      expect.stringContaining('Auto Status Check: REJECTED'),
    );
    expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
      issue,
      expect.stringContaining('ANY_REVIEW_COMMENT_NOT_RESOLVED'),
    );
  });

  it('should revert issue when linked PR is in draft state', async () => {
    const issue = createMockIssue({
      status: 'Awaiting Quality Check',
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
      issues: [issue],
      cacheUsed: false,
    });
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
      { ...createReadyPr(), isDraft: true },
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      allowIssueCacheMinutes: 10,
    });

    expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
      mockProject,
      issue,
      'awaiting-workspace-id',
    );
    expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
      issue,
      expect.stringContaining('Auto Status Check: REJECTED'),
    );
    expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
      issue,
      expect.stringContaining('PULL_REQUEST_IS_DRAFT'),
    );
  });

  it('should revert issue when multiple linked open PRs are found', async () => {
    const issue = createMockIssue({
      status: 'Awaiting Quality Check',
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
      issues: [issue],
      cacheUsed: false,
    });
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
      createReadyPr('https://github.com/user/repo/pull/1'),
      createReadyPr('https://github.com/user/repo/pull/2'),
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      allowIssueCacheMinutes: 10,
    });

    expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
      mockProject,
      issue,
      'awaiting-workspace-id',
    );
    expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
      issue,
      expect.stringContaining('Auto Status Check: REJECTED'),
    );
    expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
      issue,
      expect.stringContaining('MULTIPLE_PULL_REQUESTS_FOUND'),
    );
  });

  it('should revert issue when CI is SUCCESS but required check never started', async () => {
    const issue = createMockIssue({
      status: 'Awaiting Quality Check',
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
      issues: [issue],
      cacheUsed: false,
    });
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
      {
        ...createReadyPr(),
        isPassedAllCiJob: false,
        isCiStateSuccess: true,
        missingRequiredCheckNames: ['E2E Tests'],
      },
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      allowIssueCacheMinutes: 10,
    });

    expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
      mockProject,
      issue,
      'awaiting-workspace-id',
    );
    expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
      issue,
      expect.stringContaining('Auto Status Check: REJECTED'),
    );
    expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
      issue,
      expect.stringContaining('REQUIRED_CI_JOB_NEVER_STARTED'),
    );
  });

  describe('awaiting quality check viewer JSON output', () => {
    const createProjectWithStory = (): Project =>
      createMockProject({
        story: {
          name: 'Story',
          fieldId: 'story-field-1',
          databaseId: 1,
          stories: [
            {
              id: 'story-1',
              name: 'Story One',
              color: 'BLUE',
              description: '',
            },
          ],
          workflowManagementStory: {
            id: 'wm-story-1',
            name: 'WorkflowManagement',
          },
        },
      });

    it('should return viewer output when path is configured and issue qualifies', async () => {
      const project = createProjectWithStory();
      mockProjectRepository.getProject.mockResolvedValue(project);
      const issue = createMockIssue({
        status: 'Awaiting Quality Check',
        assignees: ['HiromiShikata'],
        nextActionDate: null,
        nextActionHour: null,
        story: 'Story One',
        itemId: 'PVTI_abc123',
        author: 'author1',
        number: 42,
        title: 'My Issue',
        url: 'https://github.com/user/repo/issues/42',
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        issues: [issue],
        cacheUsed: false,
      });
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
        createReadyPr('https://github.com/owner/repo/pull/10'),
      ]);
      mockIssueRepository.getPullRequestChangedFilePaths.mockResolvedValue([
        'src/domain/entities/Foo.ts',
        'src/domain/usecases/Bar.ts',
        'src/adapter/repos/Baz.ts',
      ]);

      const result = await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        allowIssueCacheMinutes: 10,
        awaitingQualityCheckViewerOutputPath: '/tmp/viewer.json',
      });

      expect(result).not.toBeNull();
      expect(result?.stories[0]?.name).toBe('Story One');
      expect(result?.stories[0]?.color).toBe('#0075ca');
      expect(result?.items).toHaveLength(1);
      expect(result?.items[0]?.issue.number).toBe(42);
      expect(result?.items[0]?.issue.title).toBe('My Issue');
      expect(result?.items[0]?.issue.story).toBe('Story One');
      expect(result?.items[0]?.issue.projectItemId).toBe('PVTI_abc123');
      expect(result?.items[0]?.pr.repo).toBe('owner/repo');
      expect(result?.items[0]?.pr.additions).toBe(10);
      expect(result?.items[0]?.pr.deletions).toBe(3);
      expect(result?.items[0]?.pr.changedFiles).toBe(2);
      expect(result?.items[0]?.changedDirectories).toContain(
        'src/domain/entities',
      );
      expect(result?.items[0]?.changedDirectories).toContain(
        'src/domain/usecases',
      );
      expect(result?.items[0]?.changedDirectories).toContain(
        'src/adapter/repos',
      );
    });

    it('should return null when path is not configured', async () => {
      const issue = createMockIssue({
        status: 'Awaiting Quality Check',
        assignees: ['HiromiShikata'],
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        issues: [issue],
        cacheUsed: false,
      });
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
        createReadyPr(),
      ]);

      const result = await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        allowIssueCacheMinutes: 10,
      });

      expect(result).toBeNull();
    });

    it('should return viewer output with empty items when no issue is assigned to HiromiShikata', async () => {
      const issue = createMockIssue({
        status: 'Awaiting Quality Check',
        assignees: ['someone-else'],
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        issues: [issue],
        cacheUsed: false,
      });
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
        createReadyPr(),
      ]);

      const result = await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        allowIssueCacheMinutes: 10,
        awaitingQualityCheckViewerOutputPath: '/tmp/viewer.json',
      });

      expect(result).not.toBeNull();
      expect(result?.items).toHaveLength(0);
    });

    it('should return viewer output with empty items when nextActionDate is set', async () => {
      const issue = createMockIssue({
        status: 'Awaiting Quality Check',
        assignees: ['HiromiShikata'],
        nextActionDate: new Date('2026-06-20'),
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        issues: [issue],
        cacheUsed: false,
      });
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
        createReadyPr(),
      ]);

      const result = await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        allowIssueCacheMinutes: 10,
        awaitingQualityCheckViewerOutputPath: '/tmp/viewer.json',
      });

      expect(result).not.toBeNull();
      expect(result?.items).toHaveLength(0);
    });

    it('should return viewer output with empty items when nextActionHour is set', async () => {
      const issue = createMockIssue({
        status: 'Awaiting Quality Check',
        assignees: ['HiromiShikata'],
        nextActionHour: 14,
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        issues: [issue],
        cacheUsed: false,
      });
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
        createReadyPr(),
      ]);

      const result = await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        allowIssueCacheMinutes: 10,
        awaitingQualityCheckViewerOutputPath: '/tmp/viewer.json',
      });

      expect(result).not.toBeNull();
      expect(result?.items).toHaveLength(0);
    });

    it('should return viewer output with empty items list when no issue qualifies', async () => {
      const issue = createMockIssue({
        status: 'Awaiting Quality Check',
        assignees: [],
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        issues: [issue],
        cacheUsed: false,
      });
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
        createReadyPr(),
      ]);

      const result = await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        allowIssueCacheMinutes: 10,
        awaitingQualityCheckViewerOutputPath: '/tmp/viewer.json',
      });

      expect(result).not.toBeNull();
      expect(result?.items).toHaveLength(0);
    });

    it('should exclude PR from viewer output when its URL is in donePrUrls', async () => {
      const prUrl = 'https://github.com/owner/repo/pull/10';
      const issue = createMockIssue({
        status: 'Awaiting Quality Check',
        assignees: ['HiromiShikata'],
        nextActionDate: null,
        nextActionHour: null,
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        issues: [issue],
        cacheUsed: false,
      });
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
        createReadyPr(prUrl),
      ]);
      mockIssueRepository.getPullRequestChangedFilePaths.mockResolvedValue([]);

      const result = await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        allowIssueCacheMinutes: 10,
        awaitingQualityCheckViewerOutputPath: '/tmp/viewer.json',
        donePrUrls: new Set([prUrl]),
      });

      expect(result).not.toBeNull();
      expect(result?.items).toHaveLength(0);
    });

    it('should include PR in viewer output when its URL is not in donePrUrls', async () => {
      const prUrl = 'https://github.com/owner/repo/pull/10';
      const otherDonePrUrl = 'https://github.com/owner/repo/pull/99';
      const issue = createMockIssue({
        status: 'Awaiting Quality Check',
        assignees: ['HiromiShikata'],
        nextActionDate: null,
        nextActionHour: null,
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        issues: [issue],
        cacheUsed: false,
      });
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
        createReadyPr(prUrl),
      ]);
      mockIssueRepository.getPullRequestChangedFilePaths.mockResolvedValue([]);

      const result = await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        allowIssueCacheMinutes: 10,
        awaitingQualityCheckViewerOutputPath: '/tmp/viewer.json',
        donePrUrls: new Set([otherDonePrUrl]),
      });

      expect(result).not.toBeNull();
      expect(result?.items).toHaveLength(1);
    });
  });

  describe('change-target label auto-approve', () => {
    const setupReadyIssue = (labels: string[]) => {
      const issue = createMockIssue({
        status: 'Awaiting Quality Check',
        labels,
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        issues: [issue],
        cacheUsed: false,
      });
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
        createReadyPr(),
      ]);
      return issue;
    };

    const runCycle = () =>
      useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        allowIssueCacheMinutes: 10,
      });

    it('should not approve PR when issue has no change-target label', async () => {
      setupReadyIssue([]);

      await runCycle();

      expect(
        mockIssueRepository.getPullRequestChangedFilePaths,
      ).not.toHaveBeenCalled();
      expect(mockIssueRepository.approvePullRequest).not.toHaveBeenCalled();
      expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
    });

    it('should approve PR when issue has change-target label and all files are confined', async () => {
      setupReadyIssue(['change-target:src/domain']);
      mockIssueRepository.getPullRequestChangedFilePaths.mockResolvedValue([
        'src/domain/entities/Foo.ts',
        'src/domain/usecases/Bar.ts',
      ]);

      await runCycle();

      expect(
        mockIssueRepository.getPullRequestChangedFilePaths,
      ).toHaveBeenCalledWith('https://github.com/user/repo/pull/1');
      expect(mockIssueRepository.approvePullRequest).toHaveBeenCalledWith(
        'https://github.com/user/repo/pull/1',
      );
      expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
    });

    it('should not approve PR when any changed file is outside the labeled path', async () => {
      setupReadyIssue(['change-target:src/domain']);
      mockIssueRepository.getPullRequestChangedFilePaths.mockResolvedValue([
        'src/domain/entities/Foo.ts',
        'src/adapter/repositories/Outside.ts',
      ]);

      await runCycle();

      expect(
        mockIssueRepository.getPullRequestChangedFilePaths,
      ).toHaveBeenCalledWith('https://github.com/user/repo/pull/1');
      expect(mockIssueRepository.approvePullRequest).not.toHaveBeenCalled();
    });

    it('should approve when files are confined under any of multiple change-target labels', async () => {
      setupReadyIssue(['change-target:src/domain', 'change-target:docs']);
      mockIssueRepository.getPullRequestChangedFilePaths.mockResolvedValue([
        'src/domain/entities/Foo.ts',
        'docs/intro.md',
      ]);

      await runCycle();

      expect(mockIssueRepository.approvePullRequest).toHaveBeenCalledWith(
        'https://github.com/user/repo/pull/1',
      );
    });

    it('should not approve when PR has more than 100 changed files and one file beyond entry 100 is outside the labeled path', async () => {
      setupReadyIssue(['change-target:src/domain']);
      const filePaths: string[] = [];
      for (let i = 0; i < 150; i += 1) {
        filePaths.push(`src/domain/file${i}.ts`);
      }
      filePaths.push('src/adapter/Outside.ts');
      mockIssueRepository.getPullRequestChangedFilePaths.mockResolvedValue(
        filePaths,
      );

      await runCycle();

      expect(mockIssueRepository.approvePullRequest).not.toHaveBeenCalled();
    });

    it('should match boundary-safely (change-target:foo matches foo/bar.ts but not foobar/baz.ts)', async () => {
      setupReadyIssue(['change-target:foo']);
      mockIssueRepository.getPullRequestChangedFilePaths.mockResolvedValue([
        'foo/bar.ts',
        'foobar/baz.ts',
      ]);

      await runCycle();

      expect(mockIssueRepository.approvePullRequest).not.toHaveBeenCalled();
    });

    it('should approve when changed files match exact path or subpath of the labeled path', async () => {
      setupReadyIssue(['change-target:foo']);
      mockIssueRepository.getPullRequestChangedFilePaths.mockResolvedValue([
        'foo/bar.ts',
        'foo/nested/baz.ts',
      ]);

      await runCycle();

      expect(mockIssueRepository.approvePullRequest).toHaveBeenCalledWith(
        'https://github.com/user/repo/pull/1',
      );
    });

    it('should not approve when PR has zero changed files', async () => {
      setupReadyIssue(['change-target:src/domain']);
      mockIssueRepository.getPullRequestChangedFilePaths.mockResolvedValue([]);

      await runCycle();

      expect(
        mockIssueRepository.getPullRequestChangedFilePaths,
      ).toHaveBeenCalledWith('https://github.com/user/repo/pull/1');
      expect(mockIssueRepository.approvePullRequest).not.toHaveBeenCalled();
    });

    it('should not approve when there is no ready PR even if change-target label is present', async () => {
      const issue = createMockIssue({
        status: 'Awaiting Quality Check',
        labels: ['change-target:src/domain'],
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        issues: [issue],
        cacheUsed: false,
      });
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([]);

      await runCycle();

      expect(
        mockIssueRepository.getPullRequestChangedFilePaths,
      ).not.toHaveBeenCalled();
      expect(mockIssueRepository.approvePullRequest).not.toHaveBeenCalled();
      expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
        mockProject,
        issue,
        'awaiting-workspace-id',
      );
    });

    it('should not approve when PR has unresolved rejections even with change-target label', async () => {
      const issue = createMockIssue({
        status: 'Awaiting Quality Check',
        labels: ['change-target:src/domain'],
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        issues: [issue],
        cacheUsed: false,
      });
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
        { ...createReadyPr(), isConflicted: true },
      ]);

      await runCycle();

      expect(
        mockIssueRepository.getPullRequestChangedFilePaths,
      ).not.toHaveBeenCalled();
      expect(mockIssueRepository.approvePullRequest).not.toHaveBeenCalled();
      expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
        mockProject,
        issue,
        'awaiting-workspace-id',
      );
    });

    it('should skip change-target auto-approve for issue with llm-agent label', async () => {
      const issue = createMockIssue({
        status: 'Awaiting Quality Check',
        labels: ['llm-agent', 'change-target:src/domain'],
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        issues: [issue],
        cacheUsed: false,
      });
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
        createReadyPr(),
      ]);

      await runCycle();

      expect(
        mockIssueRepository.getPullRequestChangedFilePaths,
      ).not.toHaveBeenCalled();
      expect(mockIssueRepository.approvePullRequest).not.toHaveBeenCalled();
      expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
    });

    it('should normalize trailing slashes in change-target label paths', async () => {
      setupReadyIssue(['change-target:src/domain/']);
      mockIssueRepository.getPullRequestChangedFilePaths.mockResolvedValue([
        'src/domain/entities/Foo.ts',
      ]);

      await runCycle();

      expect(mockIssueRepository.approvePullRequest).toHaveBeenCalledWith(
        'https://github.com/user/repo/pull/1',
      );
    });
  });
});
