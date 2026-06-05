import { RevertNotReadyUnreadPullRequestUseCase } from './RevertNotReadyUnreadPullRequestUseCase';
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
        id: 'unread-id',
        name: 'Unread',
        color: 'ORANGE',
        description: '',
      },
      {
        id: 'awaiting-workspace-id',
        name: 'Awaiting Workspace',
        color: 'GRAY',
        description: '',
      },
    ],
  },
  nextActionDate: null,
  nextActionHour: null,
  story: {
    name: 'Story',
    fieldId: 'story-field-1',
    databaseId: 2,
    stories: [
      {
        id: 'workflow-management-story-id',
        name: 'workflow management',
        color: 'GRAY',
        description: '',
      },
    ],
    workflowManagementStory: {
      id: 'workflow-management-story-id',
      name: 'workflow management',
    },
  },
  remainingEstimationMinutes: null,
  dependedIssueUrlSeparatedByComma: null,
  completionDate50PercentConfidence: null,
  ...overrides,
});

const createMockPullRequest = (overrides: Partial<Issue> = {}): Issue => ({
  nameWithOwner: 'user/repo',
  number: 1,
  title: 'Test PR',
  state: 'OPEN',
  status: 'Unread',
  story: null,
  nextActionDate: null,
  nextActionHour: null,
  estimationMinutes: null,
  dependedIssueUrls: [],
  completionDate50PercentConfidence: null,
  url: 'https://github.com/user/repo/pull/1',
  assignees: [],
  labels: [],
  org: 'user',
  repo: 'repo',
  body: '',
  itemId: 'item-1',
  isPr: true,
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

describe('RevertNotReadyUnreadPullRequestUseCase', () => {
  let mockProjectRepository: {
    findProjectIdByUrl: jest.Mock;
    getProject: jest.Mock;
  };
  let mockIssueRepository: {
    getAllIssues: jest.Mock;
    updateStatus: jest.Mock;
    updateStory: jest.Mock;
    findRelatedOpenPRs: jest.Mock;
    getOpenPullRequest: jest.Mock;
  };
  let mockIssueCommentRepository: {
    createComment: jest.Mock;
  };
  let mockProject: Project;
  let useCase: RevertNotReadyUnreadPullRequestUseCase;

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
      updateStory: jest.fn().mockResolvedValue(undefined),
      findRelatedOpenPRs: jest.fn().mockResolvedValue([]),
      getOpenPullRequest: jest.fn().mockResolvedValue(null),
    };

    mockIssueCommentRepository = {
      createComment: jest.fn().mockResolvedValue(undefined),
    };

    useCase = new RevertNotReadyUnreadPullRequestUseCase(
      mockProjectRepository,
      mockIssueRepository,
      mockIssueCommentRepository,
    );
  });

  it('should do nothing when there are no Unread pull requests', async () => {
    mockIssueRepository.getAllIssues.mockResolvedValue({
      issues: [
        createMockPullRequest({ status: 'Awaiting Workspace' }),
        createMockPullRequest({ status: 'Preparation' }),
      ],
      cacheUsed: false,
    });

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      allowIssueCacheMinutes: 10,
    });

    expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
    expect(mockIssueRepository.updateStory).not.toHaveBeenCalled();
    expect(mockIssueCommentRepository.createComment).not.toHaveBeenCalled();
  });

  it('should skip Unread issue that is not a pull request', async () => {
    const issue = createMockPullRequest({
      status: 'Unread',
      isPr: false,
      url: 'https://github.com/user/repo/issues/1',
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
    expect(mockIssueRepository.updateStory).not.toHaveBeenCalled();
    expect(mockIssueCommentRepository.createComment).not.toHaveBeenCalled();
  });

  it('should skip Unread pull request with llm-agent label', async () => {
    const pullRequest = createMockPullRequest({
      status: 'Unread',
      labels: ['llm-agent'],
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
      issues: [pullRequest],
      cacheUsed: false,
    });

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      allowIssueCacheMinutes: 10,
    });

    expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
    expect(mockIssueRepository.updateStory).not.toHaveBeenCalled();
    expect(mockIssueCommentRepository.createComment).not.toHaveBeenCalled();
  });

  it('should not move Unread pull request when it is review-ready', async () => {
    const pullRequest = createMockPullRequest({
      status: 'Unread',
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
      issues: [pullRequest],
      cacheUsed: false,
    });
    mockIssueRepository.getOpenPullRequest.mockResolvedValue(createReadyPr());

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      allowIssueCacheMinutes: 10,
    });

    expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
    expect(mockIssueRepository.updateStory).not.toHaveBeenCalled();
    expect(mockIssueCommentRepository.createComment).not.toHaveBeenCalled();
  });

  it('should move Unread pull request to Awaiting Workspace and set Story to workflow management when PR is conflicted', async () => {
    const pullRequest = createMockPullRequest({
      status: 'Unread',
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
      issues: [pullRequest],
      cacheUsed: false,
    });
    mockIssueRepository.getOpenPullRequest.mockResolvedValue({
      ...createReadyPr(),
      isConflicted: true,
    });

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      allowIssueCacheMinutes: 10,
    });

    expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
      mockProject,
      pullRequest,
      'awaiting-workspace-id',
    );
    expect(mockIssueRepository.updateStory).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'project-1' }),
      pullRequest,
      'workflow-management-story-id',
    );
    expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
      pullRequest,
      expect.stringContaining('Auto Status Check: REJECTED'),
    );
    expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
      pullRequest,
      expect.stringContaining('PULL_REQUEST_CONFLICTED'),
    );
  });

  it('should move Unread pull request when CI is failing', async () => {
    const pullRequest = createMockPullRequest({
      status: 'Unread',
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
      issues: [pullRequest],
      cacheUsed: false,
    });
    mockIssueRepository.getOpenPullRequest.mockResolvedValue({
      ...createReadyPr(),
      isPassedAllCiJob: false,
      isCiStateSuccess: false,
    });

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      allowIssueCacheMinutes: 10,
    });

    expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
      mockProject,
      pullRequest,
      'awaiting-workspace-id',
    );
    expect(mockIssueRepository.updateStory).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'project-1' }),
      pullRequest,
      'workflow-management-story-id',
    );
    expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
      pullRequest,
      expect.stringContaining('ANY_CI_JOB_FAILED_OR_IN_PROGRESS'),
    );
  });

  it('should move Unread pull request when it is in draft state', async () => {
    const pullRequest = createMockPullRequest({
      status: 'Unread',
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
      issues: [pullRequest],
      cacheUsed: false,
    });
    mockIssueRepository.getOpenPullRequest.mockResolvedValue({
      ...createReadyPr(),
      isDraft: true,
    });

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      allowIssueCacheMinutes: 10,
    });

    expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
      mockProject,
      pullRequest,
      'awaiting-workspace-id',
    );
    expect(mockIssueRepository.updateStory).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'project-1' }),
      pullRequest,
      'workflow-management-story-id',
    );
    expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
      pullRequest,
      expect.stringContaining('PULL_REQUEST_IS_DRAFT'),
    );
  });

  it('should move Unread pull request when CI is SUCCESS but required check never started', async () => {
    const pullRequest = createMockPullRequest({
      status: 'Unread',
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
      issues: [pullRequest],
      cacheUsed: false,
    });
    mockIssueRepository.getOpenPullRequest.mockResolvedValue({
      ...createReadyPr(),
      isPassedAllCiJob: false,
      isCiStateSuccess: true,
      missingRequiredCheckNames: ['E2E Tests'],
    });

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      allowIssueCacheMinutes: 10,
    });

    expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
      mockProject,
      pullRequest,
      'awaiting-workspace-id',
    );
    expect(mockIssueRepository.updateStory).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'project-1' }),
      pullRequest,
      'workflow-management-story-id',
    );
    expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
      pullRequest,
      expect.stringContaining('REQUIRED_CI_JOB_NEVER_STARTED'),
    );
  });

  it('should move Unread pull request when review comments are not resolved', async () => {
    const pullRequest = createMockPullRequest({
      status: 'Unread',
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
      issues: [pullRequest],
      cacheUsed: false,
    });
    mockIssueRepository.getOpenPullRequest.mockResolvedValue({
      ...createReadyPr(),
      isResolvedAllReviewComments: false,
    });

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      allowIssueCacheMinutes: 10,
    });

    expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
      mockProject,
      pullRequest,
      'awaiting-workspace-id',
    );
    expect(mockIssueRepository.updateStory).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'project-1' }),
      pullRequest,
      'workflow-management-story-id',
    );
    expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
      pullRequest,
      expect.stringContaining('ANY_REVIEW_COMMENT_NOT_RESOLVED'),
    );
  });

  it('should move Unread pull request when no open PR is found at the PR URL', async () => {
    const pullRequest = createMockPullRequest({
      status: 'Unread',
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
      issues: [pullRequest],
      cacheUsed: false,
    });
    mockIssueRepository.getOpenPullRequest.mockResolvedValue(null);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      allowIssueCacheMinutes: 10,
    });

    expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
      mockProject,
      pullRequest,
      'awaiting-workspace-id',
    );
    expect(mockIssueRepository.updateStory).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'project-1' }),
      pullRequest,
      'workflow-management-story-id',
    );
    expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
      pullRequest,
      expect.stringContaining('PULL_REQUEST_NOT_FOUND'),
    );
  });

  it('should skip updateStory when project has no story field configured', async () => {
    const projectWithoutStory = createMockProject({ story: null });
    mockProjectRepository.getProject.mockResolvedValue(projectWithoutStory);

    const pullRequest = createMockPullRequest({
      status: 'Unread',
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
      issues: [pullRequest],
      cacheUsed: false,
    });
    mockIssueRepository.getOpenPullRequest.mockResolvedValue({
      ...createReadyPr(),
      isConflicted: true,
    });

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      allowIssueCacheMinutes: 10,
    });

    expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
      projectWithoutStory,
      pullRequest,
      'awaiting-workspace-id',
    );
    expect(mockIssueRepository.updateStory).not.toHaveBeenCalled();
    expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
      pullRequest,
      expect.stringContaining('Auto Status Check: REJECTED'),
    );
  });

  it('should return early when Awaiting Workspace status option does not exist', async () => {
    const projectWithoutAwaitingWorkspace = createMockProject({
      status: {
        name: 'Status',
        fieldId: 'field-1',
        statuses: [
          {
            id: 'unread-id',
            name: 'Unread',
            color: 'ORANGE',
            description: '',
          },
        ],
      },
    });
    mockProjectRepository.getProject.mockResolvedValue(
      projectWithoutAwaitingWorkspace,
    );

    const pullRequest = createMockPullRequest({
      status: 'Unread',
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
      issues: [pullRequest],
      cacheUsed: false,
    });

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      allowIssueCacheMinutes: 10,
    });

    expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
    expect(mockIssueRepository.updateStory).not.toHaveBeenCalled();
    expect(mockIssueCommentRepository.createComment).not.toHaveBeenCalled();
  });
});
