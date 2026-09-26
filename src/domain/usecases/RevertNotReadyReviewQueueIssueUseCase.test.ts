import { RevertNotReadyReviewQueueIssueUseCase } from './RevertNotReadyReviewQueueIssueUseCase';
import { Issue } from '../entities/Issue';
import { Project } from '../entities/Project';
import { RelatedPullRequest } from './adapter-interfaces/IssueRepository';

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
        name: 'Awaiting Owner',
        color: 'BLUE',
        description: '',
      },
      {
        id: 'failed-preparation-id',
        name: 'Failed Preparation',
        color: 'RED',
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
  agent: null,
  ...overrides,
});

const createMockIssue = (overrides: Partial<Issue> = {}): Issue => ({
  nameWithOwner: 'user/repo',
  number: 1,
  title: 'Test Issue',
  state: 'OPEN',
  status: 'Awaiting Owner',
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
  createdAt: new Date(),
  author: 'owner',
  closingIssueReferenceUrls: [],
  agent: 'developer',
  stateReason: null,
  ...overrides,
});

const createMockPullRequest = (overrides: Partial<Issue> = {}): Issue =>
  createMockIssue({
    title: 'Test PR',
    status: 'Awaiting Workspace',
    url: 'https://github.com/user/repo/pull/1',
    isPr: true,
    ...overrides,
  });

type RelatedPrLike = {
  url: string;
  isConflicted: boolean;
  isPassedAllCiJob: boolean;
  isCiStateSuccess: boolean;
  isResolvedAllReviewComments: boolean;
  isBranchOutOfDate: boolean;
  missingRequiredCheckNames: string[];
  isDraft?: boolean;
  reviewDecision?: string | null;
};

const createReadyPr = (
  url = 'https://github.com/user/repo/pull/1',
): RelatedPrLike => ({
  url,
  isConflicted: false,
  isPassedAllCiJob: true,
  isCiStateSuccess: true,
  isResolvedAllReviewComments: true,
  isBranchOutOfDate: false,
  missingRequiredCheckNames: [],
  reviewDecision: null,
});

const linkRelatedOpenPrsToIssue = (
  mockIssueRepository: {
    getAllIssues: jest.Mock;
    getOpenPullRequest: jest.Mock;
  },
  issue: Issue,
  relatedPrs: RelatedPrLike[],
): void => {
  const prItems = relatedPrs.map((pr, index) =>
    createMockPullRequest({
      url: pr.url,
      number: 1000 + index,
      closingIssueReferenceUrls: [issue.url],
    }),
  );
  mockIssueRepository.getAllIssues.mockResolvedValue({
    project: createMockProject(),
    issues: [issue, ...prItems],
    cacheUsed: false,
  });
  const prByUrl = new Map(relatedPrs.map((pr) => [pr.url, pr]));
  mockIssueRepository.getOpenPullRequest.mockImplementation((prUrl: string) =>
    Promise.resolve(prByUrl.get(prUrl) ?? null),
  );
};

describe('RevertNotReadyReviewQueueIssueUseCase', () => {
  let mockProjectRepository: {
    findProjectIdByUrl: jest.Mock;
    getProject: jest.Mock;
  };
  let mockIssueRepository: {
    getAllIssues: jest.Mock;
    updateStatus: jest.Mock;
    updateStory: jest.Mock;
    findRelatedOpenPRs: jest.Mock;
    findRelatedOpenPrUrls: jest.Mock;
    getOpenPullRequest: jest.Mock;
    getOpenPullRequests: jest.Mock;
    getPullRequestChangedFilePaths: jest.Mock;
    approvePullRequest: jest.Mock;
    requestChangesWithInlineComment: jest.Mock;
    get: jest.Mock;
  };
  let mockIssueCommentRepository: {
    createComment: jest.Mock<Promise<void>, [Issue, string]>;
    getCommentsFromIssue: jest.Mock;
  };
  let mockProject: Project;
  let useCase: RevertNotReadyReviewQueueIssueUseCase;

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
      updateStatus: jest.fn().mockResolvedValue(undefined),
      updateStory: jest.fn().mockResolvedValue(undefined),
      findRelatedOpenPRs: jest.fn().mockResolvedValue([]),
      findRelatedOpenPrUrls: jest.fn().mockResolvedValue(new Map()),
      getOpenPullRequest: jest.fn().mockResolvedValue(null),
      getOpenPullRequests: jest.fn().mockResolvedValue(new Map()),
      getPullRequestChangedFilePaths: jest.fn().mockResolvedValue([]),
      approvePullRequest: jest.fn().mockResolvedValue(undefined),
      requestChangesWithInlineComment: jest.fn().mockResolvedValue(undefined),
      get: jest
        .fn()
        .mockImplementation((issueUrl: string) =>
          Promise.resolve(
            createMockIssue({ url: issueUrl, status: 'Awaiting Owner' }),
          ),
        ),
    };

    mockIssueCommentRepository = {
      createComment: jest
        .fn<Promise<void>, [Issue, string]>()
        .mockResolvedValue(undefined),
      getCommentsFromIssue: jest.fn().mockResolvedValue([]),
    };

    useCase = new RevertNotReadyReviewQueueIssueUseCase(
      mockProjectRepository,
      mockIssueRepository,
      mockIssueCommentRepository,
    );
  });

  describe('Awaiting Owner processing', () => {
    it('should do nothing when there are no Awaiting Owner issues', async () => {
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: mockProject,
        issues: [
          createMockIssue({ status: 'Awaiting Workspace' }),
          createMockIssue({ status: 'Preparation' }),
        ],
        cacheUsed: false,
      });

      await useCase.run({
        manager: 'manager-user',
        projectUrl: 'https://github.com/users/user/projects/1',
        allowedIssueAuthors: ['owner'],
        developerAgentNames: ['developer'],
      });

      expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
      expect(mockIssueCommentRepository.createComment).not.toHaveBeenCalled();
    });

    it('should skip Awaiting Owner issue with non-developer agent field', async () => {
      const issue = createMockIssue({
        status: 'Awaiting Owner',
        labels: [],
        agent: 'chore',
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: mockProject,
        issues: [issue],
        cacheUsed: false,
      });

      await useCase.run({
        manager: 'manager-user',
        projectUrl: 'https://github.com/users/user/projects/1',
        allowedIssueAuthors: ['owner'],
        developerAgentNames: ['developer'],
      });

      expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
      expect(mockIssueCommentRepository.createComment).not.toHaveBeenCalled();
    });

    it('should revert chore agent issue to Awaiting Workspace when its linked PR is conflicted', async () => {
      const issue = createMockIssue({
        status: 'Awaiting Owner',
        agent: 'chore',
      });
      linkRelatedOpenPrsToIssue(mockIssueRepository, issue, [
        { ...createReadyPr(), isConflicted: true },
      ]);

      await useCase.run({
        manager: 'manager-user',
        projectUrl: 'https://github.com/users/user/projects/1',
        allowedIssueAuthors: ['owner'],
        developerAgentNames: ['developer'],
      });

      expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
        mockProject,
        issue,
        'awaiting-workspace-id',
      );
      expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
        issue,
        expect.stringContaining('PULL_REQUEST_CONFLICTED'),
      );
    });

    it('should not revert chore agent issue when its linked PR is not conflicted', async () => {
      const issue = createMockIssue({
        status: 'Awaiting Owner',
        agent: 'chore',
      });
      linkRelatedOpenPrsToIssue(mockIssueRepository, issue, [createReadyPr()]);

      await useCase.run({
        manager: 'manager-user',
        projectUrl: 'https://github.com/users/user/projects/1',
        allowedIssueAuthors: ['owner'],
        developerAgentNames: ['developer'],
      });

      expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
      expect(mockIssueCommentRepository.createComment).not.toHaveBeenCalled();
    });

    it('should keep sweeping without calling findRelatedOpenPRs or mutating the item when an Awaiting Owner item is itself a pull request', async () => {
      const pullRequestItem = createMockPullRequest({
        status: 'Awaiting Owner',
        url: 'https://github.com/user/repo/pull/9',
        agent: 'chore',
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: mockProject,
        issues: [pullRequestItem],
        cacheUsed: false,
      });
      mockIssueRepository.findRelatedOpenPRs.mockRejectedValue(
        new Error(
          'findRelatedOpenPRs only supports issue URLs, not pull request URLs',
        ),
      );
      mockIssueRepository.getOpenPullRequests.mockResolvedValue(
        new Map([
          [
            'https://github.com/user/repo/pull/9',
            {
              ...createReadyPr('https://github.com/user/repo/pull/9'),
              isConflicted: true,
            },
          ],
        ]),
      );

      await useCase.run({
        manager: 'manager-user',
        projectUrl: 'https://github.com/users/user/projects/1',
        allowedIssueAuthors: ['owner'],
        developerAgentNames: ['developer'],
      });

      expect(mockIssueRepository.findRelatedOpenPRs).not.toHaveBeenCalled();
      expect(mockIssueRepository.getOpenPullRequest).not.toHaveBeenCalled();
      expect(mockIssueRepository.getOpenPullRequests).not.toHaveBeenCalledWith(
        expect.arrayContaining(['https://github.com/user/repo/pull/9']),
      );
      expect(mockIssueRepository.updateStatus).not.toHaveBeenCalledWith(
        mockProject,
        pullRequestItem,
        expect.anything(),
      );
    });

    it('should exclude a PR-type Awaiting Owner item from the review-queue sweep entirely after the fix, while a sibling task issue in the same status is still processed via findRelatedOpenPRs', async () => {
      const pullRequestItem = createMockPullRequest({
        status: 'Awaiting Owner',
        url: 'https://github.com/user/repo/pull/9',
        agent: 'chore',
      });
      const taskIssue = createMockIssue({
        status: 'Awaiting Owner',
        url: 'https://github.com/user/repo/issues/20',
        agent: 'chore',
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: mockProject,
        issues: [pullRequestItem, taskIssue],
        cacheUsed: false,
      });
      mockIssueRepository.getOpenPullRequests.mockResolvedValue(
        new Map([
          [
            'https://github.com/user/repo/pull/9',
            {
              ...createReadyPr('https://github.com/user/repo/pull/9'),
              isConflicted: true,
            },
          ],
        ]),
      );
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
        {
          ...createReadyPr('https://github.com/user/repo/pull/21'),
          isConflicted: true,
        },
      ]);

      await useCase.run({
        manager: 'manager-user',
        projectUrl: 'https://github.com/users/user/projects/1',
        allowedIssueAuthors: ['owner'],
        developerAgentNames: ['developer'],
      });

      expect(
        mockIssueRepository.updateStatus.mock.calls.some(
          (call: [Project, Issue, string]) => call[1] === pullRequestItem,
        ),
      ).toBe(false);
      expect(
        mockIssueRepository.updateStatus.mock.calls.some(
          (call: [Project, Issue, string]) => call[1] === taskIssue,
        ),
      ).toBe(true);
    });

    it('should revert Awaiting Owner issue with developer agent field and no linked PR', async () => {
      const issue = createMockIssue({
        status: 'Awaiting Owner',
        labels: ['llm-agent:developer'],
        agent: 'developer',
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: mockProject,
        issues: [issue],
        cacheUsed: false,
      });

      await useCase.run({
        manager: 'manager-user',
        projectUrl: 'https://github.com/users/user/projects/1',
        allowedIssueAuthors: ['owner'],
        developerAgentNames: ['developer'],
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

    it('should revert issue when no linked PR is found', async () => {
      const issue = createMockIssue({
        status: 'Awaiting Owner',
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: mockProject,
        issues: [issue],
        cacheUsed: false,
      });

      await useCase.run({
        manager: 'manager-user',
        projectUrl: 'https://github.com/users/user/projects/1',
        allowedIssueAuthors: ['owner'],
        developerAgentNames: ['developer'],
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

    it('should revert an issue whose linked PR is conflicted and agent field is null', async () => {
      const issue = createMockIssue({
        status: 'Awaiting Owner',
        agent: null,
      });
      linkRelatedOpenPrsToIssue(mockIssueRepository, issue, [
        { ...createReadyPr(), isConflicted: true },
      ]);

      await useCase.run({
        manager: 'manager-user',
        projectUrl: 'https://github.com/users/user/projects/1',
        allowedIssueAuthors: ['owner'],
        developerAgentNames: ['developer'],
      });

      expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
        mockProject,
        issue,
        'awaiting-workspace-id',
      );
      expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
        issue,
        expect.stringContaining('PULL_REQUEST_CONFLICTED'),
      );
    });

    it('should not revert an issue whose linked PR is ready', async () => {
      const issue = createMockIssue({
        status: 'Awaiting Owner',
      });
      linkRelatedOpenPrsToIssue(mockIssueRepository, issue, [createReadyPr()]);

      await useCase.run({
        manager: 'manager-user',
        projectUrl: 'https://github.com/users/user/projects/1',
        allowedIssueAuthors: ['owner'],
        developerAgentNames: ['developer'],
      });

      expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
    });

    it('should not revert a story-labeled issue with no linked PR when story is in labelsAsLlmAgentName', async () => {
      const issue = createMockIssue({
        status: 'Awaiting Owner',
        labels: ['story'],
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: mockProject,
        issues: [issue],
        cacheUsed: false,
      });

      await useCase.run({
        manager: 'manager-user',
        projectUrl: 'https://github.com/users/user/projects/1',
        labelsAsLlmAgentName: ['story', 'chore', 'accounting'],
        allowedIssueAuthors: ['owner'],
        developerAgentNames: ['developer'],
      });

      expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
      expect(mockIssueCommentRepository.createComment).not.toHaveBeenCalled();
    });

    it('should not revert a story-labeled issue with no linked PR when story is only in labelsNotRequiringPullRequest', async () => {
      const issue = createMockIssue({
        status: 'Awaiting Owner',
        labels: ['story'],
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: mockProject,
        issues: [issue],
        cacheUsed: false,
      });

      await useCase.run({
        manager: 'manager-user',
        projectUrl: 'https://github.com/users/user/projects/1',
        labelsAsLlmAgentName: ['chore', 'accounting'],
        labelsNotRequiringPullRequest: ['story'],
        allowedIssueAuthors: ['owner'],
        developerAgentNames: ['developer'],
      });

      expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
      expect(mockIssueCommentRepository.createComment).not.toHaveBeenCalled();
    });

    it('should not revert a chore-labeled issue with no linked PR when chore is in labelsAsLlmAgentName', async () => {
      const issue = createMockIssue({
        status: 'Awaiting Owner',
        labels: ['chore'],
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: mockProject,
        issues: [issue],
        cacheUsed: false,
      });

      await useCase.run({
        manager: 'manager-user',
        projectUrl: 'https://github.com/users/user/projects/1',
        labelsAsLlmAgentName: ['story', 'chore'],
        allowedIssueAuthors: ['owner'],
        developerAgentNames: ['developer'],
      });

      expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
      expect(mockIssueCommentRepository.createComment).not.toHaveBeenCalled();
    });

    it('should still revert a story-labeled issue with no linked PR when labelsAsLlmAgentName is not provided', async () => {
      const issue = createMockIssue({
        status: 'Awaiting Owner',
        labels: ['story'],
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: mockProject,
        issues: [issue],
        cacheUsed: false,
      });

      await useCase.run({
        manager: 'manager-user',
        projectUrl: 'https://github.com/users/user/projects/1',
        allowedIssueAuthors: ['owner'],
        developerAgentNames: ['developer'],
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
        status: 'Awaiting Owner',
        labels: ['story'],
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: mockProject,
        issues: [issue],
        cacheUsed: false,
      });

      await useCase.run({
        manager: 'manager-user',
        projectUrl: 'https://github.com/users/user/projects/1',
        labelsAsLlmAgentName: null,
        allowedIssueAuthors: ['owner'],
        developerAgentNames: ['developer'],
      });

      expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
        mockProject,
        issue,
        'awaiting-workspace-id',
      );
    });

    it('should not revert issue when PR is ready', async () => {
      const issue = createMockIssue({
        status: 'Awaiting Owner',
      });
      linkRelatedOpenPrsToIssue(mockIssueRepository, issue, [createReadyPr()]);

      await useCase.run({
        manager: 'manager-user',
        projectUrl: 'https://github.com/users/user/projects/1',
        allowedIssueAuthors: ['owner'],
        developerAgentNames: ['developer'],
      });

      expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
      expect(mockIssueCommentRepository.createComment).not.toHaveBeenCalled();
    });

    it('should revert issue when PR is conflicted', async () => {
      const issue = createMockIssue({
        status: 'Awaiting Owner',
      });
      linkRelatedOpenPrsToIssue(mockIssueRepository, issue, [
        { ...createReadyPr(), isConflicted: true },
      ]);

      await useCase.run({
        manager: 'manager-user',
        projectUrl: 'https://github.com/users/user/projects/1',
        allowedIssueAuthors: ['owner'],
        developerAgentNames: ['developer'],
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
        status: 'Awaiting Owner',
      });
      linkRelatedOpenPrsToIssue(mockIssueRepository, issue, [
        {
          ...createReadyPr(),
          isPassedAllCiJob: false,
          isCiStateSuccess: false,
        },
      ]);

      await useCase.run({
        manager: 'manager-user',
        projectUrl: 'https://github.com/users/user/projects/1',
        allowedIssueAuthors: ['owner'],
        developerAgentNames: ['developer'],
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
        status: 'Awaiting Owner',
      });
      linkRelatedOpenPrsToIssue(mockIssueRepository, issue, [
        { ...createReadyPr(), isResolvedAllReviewComments: false },
      ]);

      await useCase.run({
        manager: 'manager-user',
        projectUrl: 'https://github.com/users/user/projects/1',
        allowedIssueAuthors: ['owner'],
        developerAgentNames: ['developer'],
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
        status: 'Awaiting Owner',
      });
      linkRelatedOpenPrsToIssue(mockIssueRepository, issue, [
        { ...createReadyPr(), isDraft: true },
      ]);

      await useCase.run({
        manager: 'manager-user',
        projectUrl: 'https://github.com/users/user/projects/1',
        allowedIssueAuthors: ['owner'],
        developerAgentNames: ['developer'],
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
        status: 'Awaiting Owner',
      });
      linkRelatedOpenPrsToIssue(mockIssueRepository, issue, [
        createReadyPr('https://github.com/user/repo/pull/1'),
        createReadyPr('https://github.com/user/repo/pull/2'),
      ]);

      await useCase.run({
        manager: 'manager-user',
        projectUrl: 'https://github.com/users/user/projects/1',
        allowedIssueAuthors: ['owner'],
        developerAgentNames: ['developer'],
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
        status: 'Awaiting Owner',
      });
      linkRelatedOpenPrsToIssue(mockIssueRepository, issue, [
        {
          ...createReadyPr(),
          isPassedAllCiJob: false,
          isCiStateSuccess: true,
          missingRequiredCheckNames: ['E2E Tests'],
        },
      ]);

      await useCase.run({
        manager: 'manager-user',
        projectUrl: 'https://github.com/users/user/projects/1',
        allowedIssueAuthors: ['owner'],
        developerAgentNames: ['developer'],
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

    describe('in-memory related-PR derivation (no per-issue timeline call)', () => {
      it('should never call findRelatedOpenPRs while sweeping Awaiting Owner issues', async () => {
        const readyIssue = createMockIssue({
          status: 'Awaiting Owner',
          url: 'https://github.com/user/repo/issues/1',
        });
        const notReadyIssue = createMockIssue({
          status: 'Awaiting Owner',
          number: 2,
          url: 'https://github.com/user/repo/issues/2',
        });
        const readyPrItem = createMockPullRequest({
          status: 'In Progress',
          url: 'https://github.com/user/repo/pull/100',
          number: 100,
          closingIssueReferenceUrls: ['https://github.com/user/repo/issues/1'],
        });
        const conflictedPrItem = createMockPullRequest({
          status: 'In Progress',
          url: 'https://github.com/user/repo/pull/200',
          number: 200,
          closingIssueReferenceUrls: ['https://github.com/user/repo/issues/2'],
        });
        mockIssueRepository.getAllIssues.mockResolvedValue({
          project: mockProject,
          issues: [readyIssue, notReadyIssue, readyPrItem, conflictedPrItem],
          cacheUsed: false,
        });
        mockIssueRepository.getOpenPullRequest.mockImplementation(
          (prUrl: string) => {
            if (prUrl === 'https://github.com/user/repo/pull/100') {
              return Promise.resolve(createReadyPr(prUrl));
            }
            if (prUrl === 'https://github.com/user/repo/pull/200') {
              return Promise.resolve({
                ...createReadyPr(prUrl),
                isConflicted: true,
              });
            }
            return Promise.resolve(null);
          },
        );

        await useCase.run({
          manager: 'manager-user',
          projectUrl: 'https://github.com/users/user/projects/1',
          allowedIssueAuthors: ['owner'],
          developerAgentNames: ['developer'],
        });

        expect(mockIssueRepository.findRelatedOpenPRs).not.toHaveBeenCalled();
        expect(mockIssueRepository.getOpenPullRequest).toHaveBeenCalledWith(
          'https://github.com/user/repo/pull/100',
        );
        expect(mockIssueRepository.getOpenPullRequest).toHaveBeenCalledWith(
          'https://github.com/user/repo/pull/200',
        );
        expect(mockIssueRepository.updateStatus).toHaveBeenCalledTimes(1);
        expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
          mockProject,
          notReadyIssue,
          'awaiting-workspace-id',
        );
        expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
          notReadyIssue,
          expect.stringContaining('PULL_REQUEST_CONFLICTED'),
        );
      });

      it('should match a PR to its issue via closingIssueReferenceUrls even when the PR item is listed before the issue', async () => {
        const issue = createMockIssue({
          status: 'Awaiting Owner',
          url: 'https://github.com/user/repo/issues/42',
          number: 42,
        });
        const prItem = createMockPullRequest({
          status: 'In Progress',
          url: 'https://github.com/user/repo/pull/77',
          number: 77,
          closingIssueReferenceUrls: ['https://github.com/user/repo/issues/42'],
        });
        mockIssueRepository.getAllIssues.mockResolvedValue({
          project: mockProject,
          issues: [prItem, issue],
          cacheUsed: false,
        });
        mockIssueRepository.getOpenPullRequest.mockResolvedValue(
          createReadyPr('https://github.com/user/repo/pull/77'),
        );

        await useCase.run({
          manager: 'manager-user',
          projectUrl: 'https://github.com/users/user/projects/1',
          allowedIssueAuthors: ['owner'],
          developerAgentNames: ['developer'],
        });

        expect(mockIssueRepository.getOpenPullRequest).toHaveBeenCalledWith(
          'https://github.com/user/repo/pull/77',
        );
        expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
        expect(mockIssueCommentRepository.createComment).not.toHaveBeenCalled();
      });

      it('should not match a closed PR even when its closingIssueReferenceUrls points at the issue', async () => {
        const issue = createMockIssue({
          status: 'Awaiting Owner',
          url: 'https://github.com/user/repo/issues/9',
          number: 9,
        });
        const closedPrItem = createMockPullRequest({
          status: 'In Progress',
          url: 'https://github.com/user/repo/pull/9',
          number: 9,
          isClosed: true,
          state: 'CLOSED',
          closingIssueReferenceUrls: ['https://github.com/user/repo/issues/9'],
        });
        mockIssueRepository.getAllIssues.mockResolvedValue({
          project: mockProject,
          issues: [issue, closedPrItem],
          cacheUsed: false,
        });

        await useCase.run({
          manager: 'manager-user',
          projectUrl: 'https://github.com/users/user/projects/1',
          allowedIssueAuthors: ['owner'],
          developerAgentNames: ['developer'],
        });

        expect(mockIssueRepository.getOpenPullRequest).not.toHaveBeenCalled();
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

      it('should fall back to findRelatedOpenPRs when the linked PR is absent from the allIssues cache', async () => {
        const issue = createMockIssue({
          status: 'Awaiting Owner',
          url: 'https://github.com/user/repo/issues/99',
          number: 99,
        });
        mockIssueRepository.getAllIssues.mockResolvedValue({
          project: mockProject,
          issues: [issue],
          cacheUsed: false,
        });
        const readyPr: RelatedPullRequest = {
          url: 'https://github.com/user/repo/pull/99',
          branchName: 'fix/issue-99',
          createdAt: new Date(),
          isDraft: false,
          isConflicted: false,
          mergeable: 'MERGEABLE',
          isPassedAllCiJob: true,
          isCiStateSuccess: true,
          isResolvedAllReviewComments: true,
          isBranchOutOfDate: false,
          missingRequiredCheckNames: [],
          reviewDecision: null,
        };
        mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([readyPr]);

        await useCase.run({
          manager: 'manager-user',
          projectUrl: 'https://github.com/users/user/projects/1',
          allowedIssueAuthors: ['owner'],
          developerAgentNames: ['developer'],
        });

        expect(mockIssueRepository.findRelatedOpenPRs).toHaveBeenCalledWith(
          'https://github.com/user/repo/issues/99',
        );
        expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
        expect(mockIssueCommentRepository.createComment).not.toHaveBeenCalled();
      });
    });

    describe('batched related-PR lookup for issues the bulk items do not cover', () => {
      const issueUrlOf = (issueNumber: number): string =>
        `https://github.com/user/repo/issues/${issueNumber}`;
      const prUrlOf = (prNumber: number): string =>
        `https://github.com/user/repo/pull/${prNumber}`;

      const createUncoveredAwaitingQualityCheckIssues = (
        issueNumbers: number[],
      ): Issue[] => {
        const issues = issueNumbers.map((issueNumber) =>
          createMockIssue({
            status: 'Awaiting Owner',
            number: issueNumber,
            url: issueUrlOf(issueNumber),
          }),
        );
        mockIssueRepository.getAllIssues.mockResolvedValue({
          project: mockProject,
          issues,
          cacheUsed: false,
        });
        return issues;
      };

      const runCycle = () =>
        useCase.run({
          manager: 'manager-user',
          projectUrl: 'https://github.com/users/user/projects/1',
          allowedIssueAuthors: ['owner'],
          developerAgentNames: ['developer'],
        });

      it('should resolve every uncovered issue in one batched lookup instead of one per-issue timeline query', async () => {
        const issues = createUncoveredAwaitingQualityCheckIssues([1, 2, 3]);
        mockIssueRepository.findRelatedOpenPrUrls.mockResolvedValue(
          new Map([
            [issueUrlOf(1), [prUrlOf(100)]],
            [issueUrlOf(2), [prUrlOf(200)]],
            [issueUrlOf(3), []],
          ]),
        );
        mockIssueRepository.getOpenPullRequests.mockResolvedValue(
          new Map([
            [prUrlOf(100), createReadyPr(prUrlOf(100))],
            [
              prUrlOf(200),
              { ...createReadyPr(prUrlOf(200)), isConflicted: true },
            ],
          ]),
        );

        await runCycle();

        expect(mockIssueRepository.findRelatedOpenPrUrls).toHaveBeenCalledTimes(
          1,
        );
        expect(mockIssueRepository.findRelatedOpenPrUrls).toHaveBeenCalledWith([
          issueUrlOf(1),
          issueUrlOf(2),
          issueUrlOf(3),
        ]);
        expect(mockIssueRepository.findRelatedOpenPRs).not.toHaveBeenCalled();
        expect(mockIssueRepository.getOpenPullRequest).not.toHaveBeenCalled();
        expect(mockIssueRepository.getOpenPullRequests).toHaveBeenCalledTimes(
          1,
        );
        expect(mockIssueRepository.getOpenPullRequests).toHaveBeenCalledWith(
          expect.arrayContaining([prUrlOf(100), prUrlOf(200)]),
        );
        expect(mockIssueRepository.updateStatus).toHaveBeenCalledTimes(2);
        expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
          issues[1],
          expect.stringContaining('PULL_REQUEST_CONFLICTED'),
        );
        expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
          issues[2],
          expect.stringContaining('PULL_REQUEST_NOT_FOUND'),
        );
        expect(
          mockIssueCommentRepository.createComment,
        ).not.toHaveBeenCalledWith(issues[0], expect.anything());
      });

      it('should keep the per-issue lookup only for an issue the batched lookup left unresolved', async () => {
        createUncoveredAwaitingQualityCheckIssues([1, 2]);
        mockIssueRepository.findRelatedOpenPrUrls.mockResolvedValue(
          new Map([[issueUrlOf(1), [prUrlOf(100)]]]),
        );
        mockIssueRepository.getOpenPullRequests.mockResolvedValue(
          new Map([[prUrlOf(100), createReadyPr(prUrlOf(100))]]),
        );
        mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
          createReadyPr(prUrlOf(200)),
        ]);

        await runCycle();

        expect(mockIssueRepository.findRelatedOpenPRs).toHaveBeenCalledTimes(1);
        expect(mockIssueRepository.findRelatedOpenPRs).toHaveBeenCalledWith(
          issueUrlOf(2),
        );
        expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
        expect(mockIssueCommentRepository.createComment).not.toHaveBeenCalled();
      });

      it('should not report PULL_REQUEST_NOT_FOUND for an unresolved issue whose pull request exists', async () => {
        const issues = createUncoveredAwaitingQualityCheckIssues([1]);
        mockIssueRepository.findRelatedOpenPrUrls.mockResolvedValue(new Map());
        mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
          createReadyPr(prUrlOf(100)),
        ]);

        await runCycle();

        expect(mockIssueRepository.findRelatedOpenPrUrls).toHaveBeenCalledTimes(
          1,
        );
        expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
        expect(
          mockIssueCommentRepository.createComment,
        ).not.toHaveBeenCalledWith(
          issues[0],
          expect.stringContaining('PULL_REQUEST_NOT_FOUND'),
        );
      });

      it('should exclude an Awaiting Owner pull request item from the batched lookup', async () => {
        const pullRequestItem = createMockPullRequest({
          status: 'Awaiting Owner',
          url: prUrlOf(9),
          number: 9,
        });
        mockIssueRepository.getAllIssues.mockResolvedValue({
          project: mockProject,
          issues: [pullRequestItem],
          cacheUsed: false,
        });

        await runCycle();

        expect(
          mockIssueRepository.findRelatedOpenPrUrls,
        ).not.toHaveBeenCalled();
      });
    });

    describe('change-target label auto-approve', () => {
      const setupReadyIssue = (labels: string[]) => {
        const issue = createMockIssue({
          status: 'Awaiting Owner',
          labels,
        });
        linkRelatedOpenPrsToIssue(mockIssueRepository, issue, [
          createReadyPr(),
        ]);
        return issue;
      };

      const runCycle = () =>
        useCase.run({
          manager: 'manager-user',
          projectUrl: 'https://github.com/users/user/projects/1',
          allowedIssueAuthors: ['owner'],
          developerAgentNames: ['developer'],
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
        mockIssueRepository.getPullRequestChangedFilePaths.mockResolvedValue(
          [],
        );

        await runCycle();

        expect(
          mockIssueRepository.getPullRequestChangedFilePaths,
        ).toHaveBeenCalledWith('https://github.com/user/repo/pull/1');
        expect(mockIssueRepository.approvePullRequest).not.toHaveBeenCalled();
      });

      it('should not approve when there is no ready PR even if change-target label is present', async () => {
        const issue = createMockIssue({
          status: 'Awaiting Owner',
          labels: ['change-target:src/domain'],
        });
        linkRelatedOpenPrsToIssue(mockIssueRepository, issue, []);

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
          status: 'Awaiting Owner',
          labels: ['change-target:src/domain'],
        });
        linkRelatedOpenPrsToIssue(mockIssueRepository, issue, [
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

      it('should skip change-target auto-approve for issue with non-developer agent field', async () => {
        const issue = createMockIssue({
          status: 'Awaiting Owner',
          labels: ['change-target:src/domain'],
          agent: 'chore',
        });
        linkRelatedOpenPrsToIssue(mockIssueRepository, issue, [
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

      it('should expand changeTargetPathAliases when alias matches a change-target label', async () => {
        setupReadyIssue(['change-target:adapters']);
        mockIssueRepository.getPullRequestChangedFilePaths.mockResolvedValue([
          'src/domain/usecases/adapter-interfaces/IssueRepository.ts',
        ]);

        await useCase.run({
          manager: 'manager-user',
          projectUrl: 'https://github.com/users/user/projects/1',
          allowedIssueAuthors: ['owner'],
          developerAgentNames: ['developer'],
          changeTargetPathAliases: {
            adapters: 'src/domain/usecases/adapter-interfaces',
          },
        });

        expect(mockIssueRepository.approvePullRequest).toHaveBeenCalledWith(
          'https://github.com/user/repo/pull/1',
        );
      });

      it('should not approve when file is outside the alias-expanded path', async () => {
        setupReadyIssue(['change-target:adapters']);
        mockIssueRepository.getPullRequestChangedFilePaths.mockResolvedValue([
          'src/domain/usecases/SomeOtherUseCase.ts',
        ]);

        await useCase.run({
          manager: 'manager-user',
          projectUrl: 'https://github.com/users/user/projects/1',
          allowedIssueAuthors: ['owner'],
          developerAgentNames: ['developer'],
          changeTargetPathAliases: {
            adapters: 'src/domain/usecases/adapter-interfaces',
          },
        });

        expect(mockIssueRepository.approvePullRequest).not.toHaveBeenCalled();
      });
    });
  });

  describe('archived project item containment', () => {
    let warnSpy: jest.SpyInstance;

    beforeEach(() => {
      warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      warnSpy.mockRestore();
    });

    it('should skip an archived issue on updateStatus failure and continue with remaining issues', async () => {
      const archivedIssue = createMockIssue({
        number: 1,
        url: 'https://github.com/user/repo/issues/1',
        itemId: 'archived-item',
        status: 'Awaiting Owner',
      });
      const normalIssue = createMockIssue({
        number: 2,
        url: 'https://github.com/user/repo/issues/2',
        itemId: 'normal-item',
        status: 'Awaiting Owner',
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: mockProject,
        issues: [archivedIssue, normalIssue],
        cacheUsed: false,
      });
      mockIssueRepository.updateStatus.mockImplementation(
        (_project: Project, issue: Issue) =>
          issue.url === archivedIssue.url
            ? Promise.reject(
                new Error('The item is archived and cannot be updated'),
              )
            : Promise.resolve(undefined),
      );

      await useCase.run({
        manager: 'manager-user',
        projectUrl: 'https://github.com/users/user/projects/1',
        allowedIssueAuthors: ['owner'],
        developerAgentNames: ['developer'],
      });

      expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
        mockProject,
        archivedIssue,
        'awaiting-workspace-id',
      );
      expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
        mockProject,
        normalIssue,
        'awaiting-workspace-id',
      );
      expect(mockIssueCommentRepository.createComment).not.toHaveBeenCalledWith(
        archivedIssue,
        expect.anything(),
      );
      expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
        normalIssue,
        expect.stringContaining('Auto Status Check: REJECTED'),
      );
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining(archivedIssue.url),
      );
    });

    it('should propagate a non-archived updateStatus error for issues unchanged', async () => {
      const issue = createMockIssue({
        status: 'Awaiting Owner',
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: mockProject,
        issues: [issue],
        cacheUsed: false,
      });
      mockIssueRepository.updateStatus.mockRejectedValue(
        new Error('Something went wrong'),
      );

      await expect(
        useCase.run({
          manager: 'manager-user',
          projectUrl: 'https://github.com/users/user/projects/1',
          allowedIssueAuthors: ['owner'],
          developerAgentNames: ['developer'],
        }),
      ).rejects.toThrow('Something went wrong');

      expect(mockIssueCommentRepository.createComment).not.toHaveBeenCalled();
    });

    it('should never reach updateStatus for a PR-type Awaiting Owner item, so the archived-item containment path is never exercised for it', async () => {
      const pullRequestItem = createMockPullRequest({
        number: 1,
        url: 'https://github.com/user/repo/pull/1',
        itemId: 'pr-item',
        status: 'Awaiting Owner',
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: mockProject,
        issues: [pullRequestItem],
        cacheUsed: false,
      });
      mockIssueRepository.updateStatus.mockRejectedValue(
        new Error('The item is archived and cannot be updated'),
      );

      await useCase.run({
        manager: 'manager-user',
        projectUrl: 'https://github.com/users/user/projects/1',
        allowedIssueAuthors: ['owner'],
        developerAgentNames: ['developer'],
      });

      expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
      expect(mockIssueCommentRepository.createComment).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });

  describe('ky TimeoutError containment', () => {
    let warnSpy: jest.SpyInstance;

    const createKyTimeoutError = (): Error => {
      const error = new Error(
        'Request timed out: POST https://api.github.com/graphql',
      );
      error.name = 'TimeoutError';
      return error;
    };

    beforeEach(() => {
      warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      warnSpy.mockRestore();
    });

    it('should skip an issue whose updateStatus times out and continue with remaining issues', async () => {
      const timedOutIssue = createMockIssue({
        number: 1,
        url: 'https://github.com/user/repo/issues/1',
        itemId: 'timed-out-item',
        status: 'Awaiting Owner',
      });
      const normalIssue = createMockIssue({
        number: 2,
        url: 'https://github.com/user/repo/issues/2',
        itemId: 'normal-item',
        status: 'Awaiting Owner',
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: mockProject,
        issues: [timedOutIssue, normalIssue],
        cacheUsed: false,
      });
      mockIssueRepository.updateStatus.mockImplementation(
        (_project: Project, issue: Issue) =>
          issue.url === timedOutIssue.url
            ? Promise.reject(createKyTimeoutError())
            : Promise.resolve(undefined),
      );

      await useCase.run({
        manager: 'manager-user',
        projectUrl: 'https://github.com/users/user/projects/1',
        allowedIssueAuthors: ['owner'],
        developerAgentNames: ['developer'],
      });

      expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
        mockProject,
        timedOutIssue,
        'awaiting-workspace-id',
      );
      expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
        mockProject,
        normalIssue,
        'awaiting-workspace-id',
      );
      expect(mockIssueCommentRepository.createComment).not.toHaveBeenCalledWith(
        timedOutIssue,
        expect.anything(),
      );
      expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
        normalIssue,
        expect.stringContaining('Auto Status Check: REJECTED'),
      );
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining(timedOutIssue.url),
      );
    });

    it('should skip an issue whose createComment times out and continue with remaining issues', async () => {
      const timedOutIssue = createMockIssue({
        number: 1,
        url: 'https://github.com/user/repo/issues/1',
        itemId: 'timed-out-item',
        status: 'Awaiting Owner',
      });
      const normalIssue = createMockIssue({
        number: 2,
        url: 'https://github.com/user/repo/issues/2',
        itemId: 'normal-item',
        status: 'Awaiting Owner',
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: mockProject,
        issues: [timedOutIssue, normalIssue],
        cacheUsed: false,
      });
      mockIssueCommentRepository.createComment.mockImplementation(
        (issue: Issue) =>
          issue.url === timedOutIssue.url
            ? Promise.reject(createKyTimeoutError())
            : Promise.resolve(undefined),
      );

      await useCase.run({
        manager: 'manager-user',
        projectUrl: 'https://github.com/users/user/projects/1',
        allowedIssueAuthors: ['owner'],
        developerAgentNames: ['developer'],
      });

      expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
        normalIssue,
        expect.stringContaining('Auto Status Check: REJECTED'),
      );
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining(timedOutIssue.url),
      );
    });

    it('should never reach updateStatus for a PR-type Awaiting Owner item, so the ky TimeoutError containment path is never exercised for it', async () => {
      const pullRequestItem = createMockPullRequest({
        number: 1,
        url: 'https://github.com/user/repo/pull/1',
        itemId: 'pr-item',
        status: 'Awaiting Owner',
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: mockProject,
        issues: [pullRequestItem],
        cacheUsed: false,
      });
      mockIssueRepository.updateStatus.mockRejectedValue(
        createKyTimeoutError(),
      );

      await useCase.run({
        manager: 'manager-user',
        projectUrl: 'https://github.com/users/user/projects/1',
        allowedIssueAuthors: ['owner'],
        developerAgentNames: ['developer'],
      });

      expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
      expect(mockIssueCommentRepository.createComment).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('should propagate a non-timeout non-archived error from createComment unchanged', async () => {
      const issue = createMockIssue({
        status: 'Awaiting Owner',
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: mockProject,
        issues: [issue],
        cacheUsed: false,
      });
      mockIssueCommentRepository.createComment.mockRejectedValue(
        new Error('Something went wrong'),
      );

      await expect(
        useCase.run({
          manager: 'manager-user',
          projectUrl: 'https://github.com/users/user/projects/1',
          allowedIssueAuthors: ['owner'],
          developerAgentNames: ['developer'],
        }),
      ).rejects.toThrow('Something went wrong');
    });
  });

  describe('manager-assignee gating', () => {
    it('should not revert a rejected Awaiting Owner issue that is not assigned to the manager', async () => {
      const issue = createMockIssue({
        status: 'Awaiting Owner',
        assignees: ['other-user'],
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: mockProject,
        issues: [issue],
        cacheUsed: false,
      });

      await useCase.run({
        manager: 'manager-user',
        projectUrl: 'https://github.com/users/user/projects/1',
        allowedIssueAuthors: ['owner'],
        developerAgentNames: ['developer'],
      });

      expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
      expect(mockIssueCommentRepository.createComment).not.toHaveBeenCalled();
    });

    it('should revert a rejected Awaiting Owner issue that is assigned to the manager', async () => {
      const issue = createMockIssue({
        status: 'Awaiting Owner',
        assignees: ['manager-user'],
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: mockProject,
        issues: [issue],
        cacheUsed: false,
      });

      await useCase.run({
        manager: 'manager-user',
        projectUrl: 'https://github.com/users/user/projects/1',
        allowedIssueAuthors: ['owner'],
        developerAgentNames: ['developer'],
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
    });

    it('should not revert a rejected Awaiting Owner pull request that is not assigned to the manager', async () => {
      const pullRequest = createMockPullRequest({
        status: 'Awaiting Owner',
        assignees: ['other-user'],
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: mockProject,
        issues: [pullRequest],
        cacheUsed: false,
      });
      mockIssueRepository.getOpenPullRequests.mockResolvedValue(
        new Map([
          [
            'https://github.com/user/repo/pull/1',
            {
              ...createReadyPr('https://github.com/user/repo/pull/1'),
              isConflicted: true,
            },
          ],
        ]),
      );

      await useCase.run({
        manager: 'manager-user',
        projectUrl: 'https://github.com/users/user/projects/1',
        allowedIssueAuthors: ['owner'],
        developerAgentNames: ['developer'],
      });

      expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
      expect(mockIssueRepository.updateStory).not.toHaveBeenCalled();
      expect(mockIssueCommentRepository.createComment).not.toHaveBeenCalled();
    });

    it('should not revert a PR-type Awaiting Owner item even when it is assigned to the manager, since it is excluded from the sweep before manager gating is reached', async () => {
      const pullRequest = createMockPullRequest({
        status: 'Awaiting Owner',
        assignees: ['manager-user'],
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: mockProject,
        issues: [pullRequest],
        cacheUsed: false,
      });
      mockIssueRepository.getOpenPullRequests.mockResolvedValue(
        new Map([
          [
            'https://github.com/user/repo/pull/1',
            {
              ...createReadyPr('https://github.com/user/repo/pull/1'),
              isConflicted: true,
            },
          ],
        ]),
      );

      await useCase.run({
        manager: 'manager-user',
        projectUrl: 'https://github.com/users/user/projects/1',
        allowedIssueAuthors: ['owner'],
        developerAgentNames: ['developer'],
      });

      expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
      expect(mockIssueCommentRepository.createComment).not.toHaveBeenCalled();
    });

    it('should revert Awaiting Owner issue with pending nextActionDate to Awaiting Workspace', async () => {
      const evaluatedAt = new Date(Date.UTC(2026, 0, 15, 10, 0, 0));
      const issue = createMockIssue({
        status: 'Awaiting Owner',
        nextActionDate: new Date(Date.UTC(2026, 0, 16)),
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: mockProject,
        issues: [issue],
        cacheUsed: false,
      });

      await useCase.run({
        manager: 'manager-user',
        projectUrl: 'https://github.com/users/user/projects/1',
        allowedIssueAuthors: ['owner'],
        developerAgentNames: ['developer'],
        evaluatedAt,
      });

      expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
        mockProject,
        issue,
        'awaiting-workspace-id',
      );
      expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
        issue,
        expect.stringContaining('Reactivation trigger not yet reached'),
      );
    });

    it('should revert Awaiting Owner issue with pending nextActionHour to Awaiting Workspace', async () => {
      const evaluatedAt = new Date(Date.UTC(2026, 0, 15, 10, 0, 0));
      const issue = createMockIssue({
        status: 'Awaiting Owner',
        nextActionHour: 11,
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: mockProject,
        issues: [issue],
        cacheUsed: false,
      });

      await useCase.run({
        manager: 'manager-user',
        projectUrl: 'https://github.com/users/user/projects/1',
        allowedIssueAuthors: ['owner'],
        developerAgentNames: ['developer'],
        evaluatedAt,
      });

      expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
        mockProject,
        issue,
        'awaiting-workspace-id',
      );
      expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
        issue,
        expect.stringContaining('Reactivation trigger not yet reached'),
      );
    });

    it('should not revert Awaiting Owner issue when reactivation trigger has been reached', async () => {
      const evaluatedAt = new Date(Date.UTC(2026, 0, 15, 10, 0, 0));
      const issue = createMockIssue({
        status: 'Awaiting Owner',
        nextActionDate: new Date(Date.UTC(2026, 0, 15)),
      });
      linkRelatedOpenPrsToIssue(mockIssueRepository, issue, [createReadyPr()]);

      await useCase.run({
        manager: 'manager-user',
        projectUrl: 'https://github.com/users/user/projects/1',
        allowedIssueAuthors: ['owner'],
        developerAgentNames: ['developer'],
        evaluatedAt,
      });

      expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
    });
  });

  describe('dependent issue URL gating', () => {
    it('should revert Awaiting Owner issue with depended issue URLs to Awaiting Workspace even when PR is ready', async () => {
      const issue = createMockIssue({
        status: 'Awaiting Owner',
        dependedIssueUrls: ['https://github.com/user/repo/issues/99'],
      });
      linkRelatedOpenPrsToIssue(mockIssueRepository, issue, [createReadyPr()]);

      await useCase.run({
        manager: 'manager-user',
        projectUrl: 'https://github.com/users/user/projects/1',
        allowedIssueAuthors: ['owner'],
        developerAgentNames: ['developer'],
      });

      expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
        mockProject,
        issue,
        'awaiting-workspace-id',
      );
      expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
        issue,
        expect.stringContaining('https://github.com/user/repo/issues/99'),
      );
    });

    it('should not revert Awaiting Owner issue when depended issue URLs are empty', async () => {
      const issue = createMockIssue({
        status: 'Awaiting Owner',
        dependedIssueUrls: [],
      });
      linkRelatedOpenPrsToIssue(mockIssueRepository, issue, [createReadyPr()]);

      await useCase.run({
        manager: 'manager-user',
        projectUrl: 'https://github.com/users/user/projects/1',
        allowedIssueAuthors: ['owner'],
        developerAgentNames: ['developer'],
      });

      expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
    });
  });

  describe('batched pull request state resolution', () => {
    const projectUrl = 'https://github.com/users/user/projects/1';

    const buildAwaitingQualityCheckBoard = (
      issueCount: number,
    ): { boardIssues: Issue[]; relatedPrs: RelatedPrLike[] } => {
      const boardIssues: Issue[] = [];
      const relatedPrs: RelatedPrLike[] = [];
      for (let index = 0; index < issueCount; index += 1) {
        const issueUrl = `https://github.com/user/repo/issues/${200 + index}`;
        const prUrl = `https://github.com/user/repo/pull/${300 + index}`;
        boardIssues.push(
          createMockIssue({
            url: issueUrl,
            number: 200 + index,
            itemId: `item-issue-${index}`,
          }),
        );
        boardIssues.push(
          createMockPullRequest({
            url: prUrl,
            number: 300 + index,
            itemId: `item-pr-${index}`,
            status: 'In Progress',
            closingIssueReferenceUrls: [issueUrl],
          }),
        );
        relatedPrs.push(createReadyPr(prUrl));
      }
      return { boardIssues, relatedPrs };
    };

    const resolveBatchFrom = (relatedPrs: RelatedPrLike[]): void => {
      const prByUrl = new Map(relatedPrs.map((pr) => [pr.url, pr]));
      mockIssueRepository.getOpenPullRequests.mockImplementation(
        (prUrls: string[]) =>
          Promise.resolve(
            new Map(prUrls.map((prUrl) => [prUrl, prByUrl.get(prUrl) ?? null])),
          ),
      );
    };

    it('resolves every related pull request in one batched call and makes no per-pull-request call', async () => {
      const { boardIssues, relatedPrs } = buildAwaitingQualityCheckBoard(3);
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: mockProject,
        issues: boardIssues,
        cacheUsed: false,
      });
      resolveBatchFrom(relatedPrs);

      await useCase.run({
        projectUrl,
        manager: 'manager-user',
        allowedIssueAuthors: ['owner'],
        developerAgentNames: ['developer'],
      });

      expect(mockIssueRepository.getOpenPullRequests).toHaveBeenCalledTimes(1);
      expect(mockIssueRepository.getOpenPullRequests).toHaveBeenCalledWith(
        relatedPrs.map((pr) => pr.url),
      );
      expect(mockIssueRepository.getOpenPullRequest).not.toHaveBeenCalled();
      expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
    });

    it('falls back to the single pull request query only for a url the batch left unresolved', async () => {
      const { boardIssues, relatedPrs } = buildAwaitingQualityCheckBoard(2);
      const resolvedPr = relatedPrs[0];
      const omittedPr = relatedPrs[1];
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: mockProject,
        issues: boardIssues,
        cacheUsed: false,
      });
      mockIssueRepository.getOpenPullRequests.mockResolvedValue(
        new Map([[resolvedPr.url, resolvedPr]]),
      );
      mockIssueRepository.getOpenPullRequest.mockImplementation(
        (prUrl: string) =>
          Promise.resolve(prUrl === omittedPr.url ? omittedPr : null),
      );

      await useCase.run({
        projectUrl,
        manager: 'manager-user',
        allowedIssueAuthors: ['owner'],
        developerAgentNames: ['developer'],
      });

      expect(mockIssueRepository.getOpenPullRequest).toHaveBeenCalledTimes(1);
      expect(mockIssueRepository.getOpenPullRequest).toHaveBeenCalledWith(
        omittedPr.url,
      );
      expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
    });

    it('reverts the issue whose pull request the batch resolved as absent', async () => {
      const { boardIssues, relatedPrs } = buildAwaitingQualityCheckBoard(1);
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: mockProject,
        issues: boardIssues,
        cacheUsed: false,
      });
      mockIssueRepository.getOpenPullRequests.mockResolvedValue(
        new Map([[relatedPrs[0].url, null]]),
      );

      await useCase.run({
        projectUrl,
        manager: 'manager-user',
        allowedIssueAuthors: ['owner'],
        developerAgentNames: ['developer'],
      });

      expect(mockIssueRepository.getOpenPullRequest).not.toHaveBeenCalled();
      expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
        mockProject,
        expect.objectContaining({ url: boardIssues[0].url }),
        'awaiting-workspace-id',
      );
    });

    it('excludes a lone PR-type Awaiting Owner item from the pre-cycle batch entirely, since it never contributes its own URL once it is filtered out upstream', async () => {
      const prUrl = 'https://github.com/user/repo/pull/42';
      const pullRequestItem = createMockPullRequest({
        status: 'Awaiting Owner',
        url: prUrl,
        number: 42,
        assignees: ['manager-user'],
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: mockProject,
        issues: [pullRequestItem],
        cacheUsed: false,
      });

      await useCase.run({
        projectUrl,
        manager: 'manager-user',
        allowedIssueAuthors: ['owner'],
        developerAgentNames: ['developer'],
      });

      expect(mockIssueRepository.getOpenPullRequests).not.toHaveBeenCalled();
      expect(mockIssueRepository.getOpenPullRequest).not.toHaveBeenCalled();
      expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
    });

    it('fetches a PR URL exactly once via batch when it appears as both a PR item in AQC and a related PR for a non-PR issue in AQC', async () => {
      const prUrl = 'https://github.com/user/repo/pull/42';
      const issueUrl = 'https://github.com/user/repo/issues/10';
      const pullRequestItem = createMockPullRequest({
        status: 'Awaiting Owner',
        url: prUrl,
        number: 42,
        closingIssueReferenceUrls: [issueUrl],
        assignees: ['manager-user'],
      });
      const nonPrIssue = createMockIssue({
        status: 'Awaiting Owner',
        url: issueUrl,
        number: 10,
        assignees: ['manager-user'],
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: mockProject,
        issues: [pullRequestItem, nonPrIssue],
        cacheUsed: false,
      });
      mockIssueRepository.getOpenPullRequests.mockResolvedValue(
        new Map([[prUrl, createReadyPr(prUrl)]]),
      );

      await useCase.run({
        projectUrl,
        manager: 'manager-user',
        allowedIssueAuthors: ['owner'],
        developerAgentNames: ['developer'],
      });

      const allPassedUrls =
        mockIssueRepository.getOpenPullRequests.mock.calls.flatMap(
          (call: string[][]) => call[0],
        );
      expect(allPassedUrls.filter((url: string) => url === prUrl)).toHaveLength(
        1,
      );
      expect(mockIssueRepository.getOpenPullRequest).not.toHaveBeenCalled();
      expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
    });

    it('splits getOpenPullRequests into separate calls when there are more than 100 related PR URLs to resolve for Awaiting Owner task issues', async () => {
      const { boardIssues, relatedPrs } = buildAwaitingQualityCheckBoard(101);
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: mockProject,
        issues: boardIssues,
        cacheUsed: false,
      });
      resolveBatchFrom(relatedPrs);

      await useCase.run({
        projectUrl,
        manager: 'manager-user',
        allowedIssueAuthors: ['owner'],
        developerAgentNames: ['developer'],
      });

      expect(mockIssueRepository.getOpenPullRequests).toHaveBeenCalledTimes(2);
      const calls: string[][] =
        mockIssueRepository.getOpenPullRequests.mock.calls.map(
          (call: string[][]) => call[0],
        );
      expect(calls[0]).toHaveLength(100);
      expect(calls[1]).toHaveLength(1);
      expect(calls[0].length + calls[1].length).toBe(101);
      expect(mockIssueRepository.getOpenPullRequest).not.toHaveBeenCalled();
    });

    it('fetches exactly 100 related PR URLs in a single getOpenPullRequests call for Awaiting Owner task issues', async () => {
      const { boardIssues, relatedPrs } = buildAwaitingQualityCheckBoard(100);
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: mockProject,
        issues: boardIssues,
        cacheUsed: false,
      });
      resolveBatchFrom(relatedPrs);

      await useCase.run({
        projectUrl,
        manager: 'manager-user',
        allowedIssueAuthors: ['owner'],
        developerAgentNames: ['developer'],
      });

      expect(mockIssueRepository.getOpenPullRequests).toHaveBeenCalledTimes(1);
      const [firstCallUrls] =
        mockIssueRepository.getOpenPullRequests.mock.calls.map(
          (call: string[][]) => call[0],
        );
      expect(firstCallUrls).toHaveLength(100);
      expect(mockIssueRepository.getOpenPullRequest).not.toHaveBeenCalled();
    });
  });

  describe('reviewDecision gate', () => {
    it('should revert issue when linked PR has reviewDecision CHANGES_REQUESTED', async () => {
      const issue = createMockIssue({ status: 'Awaiting Owner' });
      linkRelatedOpenPrsToIssue(mockIssueRepository, issue, [
        { ...createReadyPr(), reviewDecision: 'CHANGES_REQUESTED' },
      ]);

      await useCase.run({
        manager: 'manager-user',
        projectUrl: 'https://github.com/users/user/projects/1',
        allowedIssueAuthors: ['owner'],
        developerAgentNames: ['developer'],
      });

      expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
        mockProject,
        issue,
        'awaiting-workspace-id',
      );
      expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
        issue,
        expect.stringContaining('REVIEW_DECISION_CHANGES_REQUESTED'),
      );
    });
  });

  describe('dispatch repetition escalation', () => {
    const projectWithFailedPrep = createMockProject({
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
            id: 'awaiting-owner-id',
            name: 'Awaiting Owner',
            color: 'BLUE',
            description: '',
          },
          {
            id: 'failed-preparation-id',
            name: 'Failed Preparation',
            color: 'RED',
            description: '',
          },
        ],
      },
    });

    const projectWithoutFailedPreparation = createMockProject({
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
            id: 'awaiting-owner-id',
            name: 'Awaiting Owner',
            color: 'BLUE',
            description: '',
          },
        ],
      },
    });

    const agentReport = (nextStepAgent: string) => ({
      author: 'owner',
      content: `From: :robot: developer (model-id)\n\n## Summary\n\`\`\`json\n{ "nextStepAgent": "${nextStepAgent}" }\n\`\`\``,
      createdAt: new Date(),
    });

    it('dispatches again for self-reference when dispatch loop threshold is reached', async () => {
      mockProjectRepository.getProject.mockResolvedValue(projectWithFailedPrep);

      const issue = createMockIssue({
        status: 'Awaiting Owner',
        author: 'owner',
        assignees: ['manager-user'],
        agent: 'developer',
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: projectWithFailedPrep,
        issues: [issue],
        cacheUsed: false,
      });
      mockIssueRepository.getOpenPullRequests.mockResolvedValue(new Map());

      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        agentReport('developer'),
        agentReport('developer'),
        agentReport('developer'),
      ]);

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        manager: 'manager-user',
        allowedIssueAuthors: ['owner'],
        developerAgentNames: ['developer'],
        thresholdForAutoReject: 5,
        thresholdForDispatchLoop: 3,
      });

      expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
        projectWithFailedPrep,
        issue,
        'awaiting-workspace-id',
      );
      expect(mockIssueRepository.updateStatus).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        'failed-preparation-id',
      );
      expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
        issue,
        expect.stringContaining('Auto Status Check: REJECTED'),
      );
    });

    it('dispatches again for self-reference when dispatch loop threshold is reached and Failed Preparation issue is not processed on the following cycle', async () => {
      mockProjectRepository.getProject.mockResolvedValue(projectWithFailedPrep);

      const issue = createMockIssue({
        status: 'Awaiting Owner',
        author: 'owner',
        assignees: ['manager-user'],
        agent: 'developer',
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: projectWithFailedPrep,
        issues: [issue],
        cacheUsed: false,
      });
      mockIssueRepository.getOpenPullRequests.mockResolvedValue(new Map());

      const firstRunComments = [
        agentReport('developer'),
        agentReport('developer'),
        agentReport('developer'),
      ];
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue(
        firstRunComments,
      );

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        manager: 'manager-user',
        allowedIssueAuthors: ['owner'],
        developerAgentNames: ['developer'],
        thresholdForAutoReject: 5,
        thresholdForDispatchLoop: 3,
      });

      expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
        projectWithFailedPrep,
        issue,
        'awaiting-workspace-id',
      );
      const lastCreateCommentCall =
        mockIssueCommentRepository.createComment.mock.calls[
          mockIssueCommentRepository.createComment.mock.calls.length - 1
        ];
      const escalationCommentBody = lastCreateCommentCall[1];

      mockIssueRepository.updateStatus.mockClear();
      mockIssueCommentRepository.createComment.mockClear();
      issue.status = 'Failed Preparation';
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        ...firstRunComments,
        {
          author: 'owner',
          content: escalationCommentBody,
          createdAt: new Date(),
        },
      ]);

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        manager: 'manager-user',
        allowedIssueAuthors: ['owner'],
        developerAgentNames: ['developer'],
        thresholdForAutoReject: 5,
        thresholdForDispatchLoop: 3,
      });

      expect(mockIssueRepository.updateStatus).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        'awaiting-workspace-id',
      );
      expect(mockIssueCommentRepository.createComment).not.toHaveBeenCalled();
    });

    it('escalates to Failed Preparation instead of reverting when silent redispatch threshold is reached', async () => {
      mockProjectRepository.getProject.mockResolvedValue(projectWithFailedPrep);

      const issue = createMockIssue({
        status: 'Awaiting Owner',
        author: 'owner',
        assignees: ['manager-user'],
        agent: 'developer',
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: projectWithFailedPrep,
        issues: [issue],
        cacheUsed: false,
      });
      mockIssueRepository.getOpenPullRequests.mockResolvedValue(new Map());

      const silentRedispatchComment = (count: number) => ({
        author: 'owner',
        content: `Auto Status Check: DISPATCH_AGAIN developer\n\nThe latest agent report names this agent as the next step and the agent field already holds it, so the previous dispatch to it ended without a report. Dispatching it again (${count}/3).`,
        createdAt: new Date(),
      });
      // The agent report is placed before the human comment so it is outside
      // the current cycle. Silent-redispatch comments inside the cycle with
      // no agent report in the cycle → hasReportsInCycle = false →
      // escalateSilentRedispatch (not escalateReportingLoop).
      const humanComment = {
        author: 'owner',
        content: 'please continue',
        createdAt: new Date(),
      };

      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        agentReport('developer'),
        humanComment,
        silentRedispatchComment(1),
        silentRedispatchComment(2),
      ]);

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        manager: 'manager-user',
        allowedIssueAuthors: ['owner'],
        developerAgentNames: ['developer'],
        thresholdForAutoReject: 3,
        thresholdForDispatchLoop: 6,
      });

      expect(mockIssueRepository.updateStatus).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        'awaiting-workspace-id',
      );
      expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
        projectWithFailedPrep,
        issue,
        'failed-preparation-id',
      );
      expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
        issue,
        expect.stringContaining('Failed to receive a report'),
      );
    });

    it('reverts normally to Awaiting Workspace when dispatch count is below threshold', async () => {
      mockProjectRepository.getProject.mockResolvedValue(projectWithFailedPrep);

      const issue = createMockIssue({
        status: 'Awaiting Owner',
        author: 'owner',
        assignees: ['manager-user'],
        agent: 'developer',
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: projectWithFailedPrep,
        issues: [issue],
        cacheUsed: false,
      });
      mockIssueRepository.getOpenPullRequests.mockResolvedValue(new Map());

      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        agentReport('developer'),
        agentReport('developer'),
      ]);

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        manager: 'manager-user',
        allowedIssueAuthors: ['owner'],
        developerAgentNames: ['developer'],
        thresholdForAutoReject: 5,
        thresholdForDispatchLoop: 3,
      });

      expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
        projectWithFailedPrep,
        issue,
        'awaiting-workspace-id',
      );
      expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
        issue,
        expect.stringContaining('Auto Status Check: REJECTED'),
      );
    });

    it('escalates to Failed Preparation for self-reference when agent has been reporting every cycle and count reaches threshold', async () => {
      mockProjectRepository.getProject.mockResolvedValue(projectWithFailedPrep);

      const issue = createMockIssue({
        status: 'Awaiting Owner',
        author: 'owner',
        assignees: ['manager-user'],
        agent: 'developer',
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: projectWithFailedPrep,
        issues: [issue],
        cacheUsed: false,
      });
      mockIssueRepository.getOpenPullRequests.mockResolvedValue(new Map());

      const silentRedispatchComment = (count: number) => ({
        author: 'owner',
        content: `Auto Status Check: DISPATCH_AGAIN developer\n\nThe latest agent report names this agent as the next step and the agent field already holds it, so the previous dispatch to it ended without a report. Dispatching it again (${count}/2).`,
        createdAt: new Date(),
      });
      const humanComment = {
        author: 'owner',
        content: 'please continue',
        createdAt: new Date(),
      };

      // One silent-redispatch comment in cycle → count = 2 >= threshold = 2.
      // agentReport in cycle → hasReportsInCycle = true.
      // escalateReportingLoop triggers regardless of self-reference.
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        humanComment,
        silentRedispatchComment(1),
        agentReport('developer'),
      ]);

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        manager: 'manager-user',
        allowedIssueAuthors: ['owner'],
        developerAgentNames: ['developer'],
        thresholdForAutoReject: 2,
        thresholdForDispatchLoop: 6,
      });

      expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
        projectWithFailedPrep,
        issue,
        'failed-preparation-id',
      );
      expect(mockIssueRepository.updateStatus).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        'awaiting-owner-id',
      );
      expect(mockIssueRepository.updateStatus).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        'awaiting-workspace-id',
      );
      expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
        issue,
        expect.stringContaining(
          'This task has been marked as Failed Preparation',
        ),
      );
    });

    it('does not update any status or post a comment for the escalating issue when the project defines no Failed Preparation status option', async () => {
      mockProjectRepository.getProject.mockResolvedValue(
        projectWithoutFailedPreparation,
      );

      const issue = createMockIssue({
        status: 'Awaiting Owner',
        author: 'owner',
        assignees: ['manager-user'],
        agent: 'developer',
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: projectWithoutFailedPreparation,
        issues: [issue],
        cacheUsed: false,
      });
      mockIssueRepository.getOpenPullRequests.mockResolvedValue(new Map());

      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        agentReport('developer'),
        agentReport('developer'),
        agentReport('developer'),
      ]);

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        manager: 'manager-user',
        allowedIssueAuthors: ['owner'],
        developerAgentNames: ['developer'],
        thresholdForAutoReject: 5,
        thresholdForDispatchLoop: 3,
      });

      expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
      expect(mockIssueCommentRepository.createComment).not.toHaveBeenCalled();
    });
  });

  describe('when the Status changed after the item snapshot was taken', () => {
    const snapshotIssueWithoutLinkedPullRequest = createMockIssue({
      status: 'Awaiting Owner',
    });
    const snapshotIssueWithDependedIssue = createMockIssue({
      status: 'Awaiting Owner',
      dependedIssueUrls: ['https://github.com/user/repo/issues/99'],
    });

    it.each<{
      label: string;
      snapshotIssue: Issue;
      liveIssue: Issue | null;
      expectedUpdateStatusCalls: unknown[][];
      expectedCreateCommentCallCount: number;
    }>([
      {
        label:
          'does not overwrite a Status an agent set after the snapshot was taken when the item is rejected',
        snapshotIssue: snapshotIssueWithoutLinkedPullRequest,
        liveIssue: createMockIssue({ status: 'In Tmux by agent' }),
        expectedUpdateStatusCalls: [],
        expectedCreateCommentCallCount: 0,
      },
      {
        label:
          'does not overwrite a Status an agent set after the snapshot was taken when the item has a depended issue',
        snapshotIssue: snapshotIssueWithDependedIssue,
        liveIssue: createMockIssue({ status: 'In Tmux by agent' }),
        expectedUpdateStatusCalls: [],
        expectedCreateCommentCallCount: 0,
      },
      {
        label: 'does not write when the item is no longer on the project',
        snapshotIssue: snapshotIssueWithoutLinkedPullRequest,
        liveIssue: null,
        expectedUpdateStatusCalls: [],
        expectedCreateCommentCallCount: 0,
      },
      {
        label:
          'writes Awaiting Workspace when the live Status is still Awaiting Owner',
        snapshotIssue: snapshotIssueWithoutLinkedPullRequest,
        liveIssue: createMockIssue({ status: 'Awaiting Owner' }),
        expectedUpdateStatusCalls: [
          [
            createMockProject(),
            snapshotIssueWithoutLinkedPullRequest,
            'awaiting-workspace-id',
          ],
        ],
        expectedCreateCommentCallCount: 1,
      },
    ])(
      '$label',
      async ({
        snapshotIssue,
        liveIssue,
        expectedUpdateStatusCalls,
        expectedCreateCommentCallCount,
      }) => {
        mockIssueRepository.getAllIssues.mockResolvedValue({
          project: mockProject,
          issues: [snapshotIssue],
          cacheUsed: false,
        });
        mockIssueRepository.get.mockResolvedValue(liveIssue);

        await useCase.run({
          manager: 'manager-user',
          projectUrl: 'https://github.com/users/user/projects/1',
          allowedIssueAuthors: ['owner'],
          developerAgentNames: ['developer'],
        });

        expect(mockIssueRepository.get.mock.calls).toEqual([
          [snapshotIssue.url, mockProject],
        ]);
        expect(mockIssueRepository.updateStatus.mock.calls).toEqual(
          expectedUpdateStatusCalls,
        );
        expect(mockIssueCommentRepository.createComment).toHaveBeenCalledTimes(
          expectedCreateCommentCallCount,
        );
      },
    );
  });
});
