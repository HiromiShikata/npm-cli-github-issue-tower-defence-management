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
  isConflicted: false,
  isPassedAllCiJob: true,
  isCiStateSuccess: true,
  isResolvedAllReviewComments: true,
  isBranchOutOfDate: false,
  missingRequiredCheckNames: [],
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
      getAllIssues: jest.fn().mockResolvedValue({ issues: [], cacheUsed: false }),
      updateStatus: jest.fn().mockResolvedValue(undefined),
      findRelatedOpenPRs: jest.fn().mockResolvedValue([]),
      getOpenPullRequest: jest.fn().mockResolvedValue(null),
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
});
