import { RevertNotReadyReviewQueueIssueUseCase } from './RevertNotReadyReviewQueueIssueUseCase';
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
      {
        id: 'unread-id',
        name: 'Unread',
        color: 'ORANGE',
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
  author: 'owner',
  closingIssueReferenceUrls: [],
  ...overrides,
});

const createMockPullRequest = (overrides: Partial<Issue> = {}): Issue =>
  createMockIssue({
    title: 'Test PR',
    status: 'Unread',
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
});

// Builds the in-memory linkage the production code now relies on instead of the
// per-issue findRelatedOpenPRs timeline query: each related pull request becomes
// an open PR project item whose closingIssueReferenceUrls points at the AQC
// issue, and getOpenPullRequest is routed by URL to return that PR's status.
// This proves the review-readiness outcome is identical to the previous
// findRelatedOpenPRs-based path while removing the per-issue timeline call.
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
    getOpenPullRequest: jest.Mock;
    getPullRequestChangedFilePaths: jest.Mock;
    approvePullRequest: jest.Mock;
    requestChangesWithInlineComment: jest.Mock;
  };
  let mockIssueCommentRepository: {
    createComment: jest.Mock;
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
      getOpenPullRequest: jest.fn().mockResolvedValue(null),
      getPullRequestChangedFilePaths: jest.fn().mockResolvedValue([]),
      approvePullRequest: jest.fn().mockResolvedValue(undefined),
      requestChangesWithInlineComment: jest.fn().mockResolvedValue(undefined),
    };

    mockIssueCommentRepository = {
      createComment: jest.fn().mockResolvedValue(undefined),
    };

    useCase = new RevertNotReadyReviewQueueIssueUseCase(
      mockProjectRepository,
      mockIssueRepository,
      mockIssueCommentRepository,
    );
  });

  describe('Awaiting Quality Check processing', () => {
    it('should do nothing when there are no Awaiting Quality Check issues', async () => {
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: mockProject,
        issues: [
          createMockIssue({ status: 'Awaiting Workspace' }),
          createMockIssue({ status: 'Preparation' }),
        ],
        cacheUsed: false,
      });

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        allowedIssueAuthors: ['owner'],
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
        project: mockProject,
        issues: [issue],
        cacheUsed: false,
      });

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        allowedIssueAuthors: ['owner'],
      });

      expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
      expect(mockIssueCommentRepository.createComment).not.toHaveBeenCalled();
    });

    it('should revert issue when no linked PR is found', async () => {
      const issue = createMockIssue({
        status: 'Awaiting Quality Check',
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: mockProject,
        issues: [issue],
        cacheUsed: false,
      });

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        allowedIssueAuthors: ['owner'],
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
        project: mockProject,
        issues: [issue],
        cacheUsed: false,
      });

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        labelsAsLlmAgentName: ['story', 'chore', 'accounting'],
        allowedIssueAuthors: ['owner'],
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
        project: mockProject,
        issues: [issue],
        cacheUsed: false,
      });

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        labelsAsLlmAgentName: ['story', 'chore'],
        allowedIssueAuthors: ['owner'],
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
        project: mockProject,
        issues: [issue],
        cacheUsed: false,
      });

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        allowedIssueAuthors: ['owner'],
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
        project: mockProject,
        issues: [issue],
        cacheUsed: false,
      });

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        labelsAsLlmAgentName: null,
        allowedIssueAuthors: ['owner'],
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
      linkRelatedOpenPrsToIssue(mockIssueRepository, issue, [createReadyPr()]);

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        allowedIssueAuthors: ['owner'],
      });

      expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
      expect(mockIssueCommentRepository.createComment).not.toHaveBeenCalled();
    });

    it('should revert issue when PR is conflicted', async () => {
      const issue = createMockIssue({
        status: 'Awaiting Quality Check',
      });
      linkRelatedOpenPrsToIssue(mockIssueRepository, issue, [
        { ...createReadyPr(), isConflicted: true },
      ]);

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        allowedIssueAuthors: ['owner'],
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
      linkRelatedOpenPrsToIssue(mockIssueRepository, issue, [
        {
          ...createReadyPr(),
          isPassedAllCiJob: false,
          isCiStateSuccess: false,
        },
      ]);

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        allowedIssueAuthors: ['owner'],
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
      linkRelatedOpenPrsToIssue(mockIssueRepository, issue, [
        { ...createReadyPr(), isResolvedAllReviewComments: false },
      ]);

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        allowedIssueAuthors: ['owner'],
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
      linkRelatedOpenPrsToIssue(mockIssueRepository, issue, [
        { ...createReadyPr(), isDraft: true },
      ]);

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        allowedIssueAuthors: ['owner'],
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
      linkRelatedOpenPrsToIssue(mockIssueRepository, issue, [
        createReadyPr('https://github.com/user/repo/pull/1'),
        createReadyPr('https://github.com/user/repo/pull/2'),
      ]);

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        allowedIssueAuthors: ['owner'],
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
      linkRelatedOpenPrsToIssue(mockIssueRepository, issue, [
        {
          ...createReadyPr(),
          isPassedAllCiJob: false,
          isCiStateSuccess: true,
          missingRequiredCheckNames: ['E2E Tests'],
        },
      ]);

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        allowedIssueAuthors: ['owner'],
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
      it('should never call findRelatedOpenPRs while sweeping Awaiting Quality Check issues', async () => {
        const readyIssue = createMockIssue({
          status: 'Awaiting Quality Check',
          url: 'https://github.com/user/repo/issues/1',
        });
        const notReadyIssue = createMockIssue({
          status: 'Awaiting Quality Check',
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
          projectUrl: 'https://github.com/users/user/projects/1',
          allowedIssueAuthors: ['owner'],
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
          status: 'Awaiting Quality Check',
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
          projectUrl: 'https://github.com/users/user/projects/1',
          allowedIssueAuthors: ['owner'],
        });

        expect(mockIssueRepository.getOpenPullRequest).toHaveBeenCalledWith(
          'https://github.com/user/repo/pull/77',
        );
        expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
        expect(mockIssueCommentRepository.createComment).not.toHaveBeenCalled();
      });

      it('should not match a closed PR even when its closingIssueReferenceUrls points at the issue', async () => {
        const issue = createMockIssue({
          status: 'Awaiting Quality Check',
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
          projectUrl: 'https://github.com/users/user/projects/1',
          allowedIssueAuthors: ['owner'],
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
    });

    describe('change-target label auto-approve', () => {
      const setupReadyIssue = (labels: string[]) => {
        const issue = createMockIssue({
          status: 'Awaiting Quality Check',
          labels,
        });
        linkRelatedOpenPrsToIssue(mockIssueRepository, issue, [
          createReadyPr(),
        ]);
        return issue;
      };

      const runCycle = () =>
        useCase.run({
          projectUrl: 'https://github.com/users/user/projects/1',
          allowedIssueAuthors: ['owner'],
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
          status: 'Awaiting Quality Check',
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
          status: 'Awaiting Quality Check',
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

      it('should skip change-target auto-approve for issue with llm-agent label', async () => {
        const issue = createMockIssue({
          status: 'Awaiting Quality Check',
          labels: ['llm-agent', 'change-target:src/domain'],
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
          projectUrl: 'https://github.com/users/user/projects/1',
          allowedIssueAuthors: ['owner'],
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
          projectUrl: 'https://github.com/users/user/projects/1',
          allowedIssueAuthors: ['owner'],
          changeTargetPathAliases: {
            adapters: 'src/domain/usecases/adapter-interfaces',
          },
        });

        expect(mockIssueRepository.approvePullRequest).not.toHaveBeenCalled();
      });
    });
  });

  describe('Unread pull request processing', () => {
    it('should do nothing when there are no Unread pull requests', async () => {
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: mockProject,
        issues: [
          createMockPullRequest({ status: 'Awaiting Workspace' }),
          createMockPullRequest({ status: 'Preparation' }),
        ],
        cacheUsed: false,
      });

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        allowedIssueAuthors: ['owner'],
      });

      expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
      expect(mockIssueRepository.updateStory).not.toHaveBeenCalled();
      expect(mockIssueCommentRepository.createComment).not.toHaveBeenCalled();
    });

    it('should skip Unread issue that is not a pull request', async () => {
      const issue = createMockIssue({
        status: 'Unread',
        isPr: false,
        url: 'https://github.com/user/repo/issues/1',
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: mockProject,
        issues: [issue],
        cacheUsed: false,
      });

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        allowedIssueAuthors: ['owner'],
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
        project: mockProject,
        issues: [pullRequest],
        cacheUsed: false,
      });

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        allowedIssueAuthors: ['owner'],
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
        project: mockProject,
        issues: [pullRequest],
        cacheUsed: false,
      });
      mockIssueRepository.getOpenPullRequest.mockResolvedValue(createReadyPr());

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        allowedIssueAuthors: ['owner'],
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
        project: mockProject,
        issues: [pullRequest],
        cacheUsed: false,
      });
      mockIssueRepository.getOpenPullRequest.mockResolvedValue({
        ...createReadyPr(),
        isConflicted: true,
      });

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        allowedIssueAuthors: ['owner'],
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
        project: mockProject,
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
        allowedIssueAuthors: ['owner'],
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
        project: mockProject,
        issues: [pullRequest],
        cacheUsed: false,
      });
      mockIssueRepository.getOpenPullRequest.mockResolvedValue({
        ...createReadyPr(),
        isDraft: true,
      });

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        allowedIssueAuthors: ['owner'],
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
        project: mockProject,
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
        allowedIssueAuthors: ['owner'],
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
        project: mockProject,
        issues: [pullRequest],
        cacheUsed: false,
      });
      mockIssueRepository.getOpenPullRequest.mockResolvedValue({
        ...createReadyPr(),
        isResolvedAllReviewComments: false,
      });

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        allowedIssueAuthors: ['owner'],
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
        project: mockProject,
        issues: [pullRequest],
        cacheUsed: false,
      });
      mockIssueRepository.getOpenPullRequest.mockResolvedValue(null);

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        allowedIssueAuthors: ['owner'],
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
        project: mockProject,
        issues: [pullRequest],
        cacheUsed: false,
      });
      mockIssueRepository.getOpenPullRequest.mockResolvedValue({
        ...createReadyPr(),
        isConflicted: true,
      });

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        allowedIssueAuthors: ['owner'],
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
        project: mockProject,
        issues: [pullRequest],
        cacheUsed: false,
      });

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        allowedIssueAuthors: ['owner'],
      });

      expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
      expect(mockIssueRepository.updateStory).not.toHaveBeenCalled();
      expect(mockIssueCommentRepository.createComment).not.toHaveBeenCalled();
    });

    describe('author authorization guard', () => {
      it('should skip an Unread pull request authored by a non-owner human not in allowedIssueAuthors', async () => {
        const pullRequest = createMockPullRequest({
          status: 'Unread',
          author: 'outside-contributor',
        });
        mockIssueRepository.getAllIssues.mockResolvedValue({
          project: mockProject,
          issues: [pullRequest],
          cacheUsed: false,
        });
        mockIssueRepository.getOpenPullRequest.mockResolvedValue({
          ...createReadyPr(),
          isConflicted: true,
        });

        await useCase.run({
          projectUrl: 'https://github.com/users/user/projects/1',
          allowedIssueAuthors: ['owner'],
        });

        expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
        expect(mockIssueRepository.updateStory).not.toHaveBeenCalled();
        expect(mockIssueCommentRepository.createComment).not.toHaveBeenCalled();
      });

      it('should act on an Unread pull request authored by an allowed owner', async () => {
        const pullRequest = createMockPullRequest({
          status: 'Unread',
          author: 'owner',
        });
        mockIssueRepository.getAllIssues.mockResolvedValue({
          project: mockProject,
          issues: [pullRequest],
          cacheUsed: false,
        });
        mockIssueRepository.getOpenPullRequest.mockResolvedValue({
          ...createReadyPr(),
          isConflicted: true,
        });

        await useCase.run({
          projectUrl: 'https://github.com/users/user/projects/1',
          allowedIssueAuthors: ['owner'],
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
      });

      it('should skip an Unread pull request authored by a dependency-update bot not in allowedIssueAuthors', async () => {
        const pullRequest = createMockPullRequest({
          status: 'Unread',
          author: 'dependabot[bot]',
        });
        mockIssueRepository.getAllIssues.mockResolvedValue({
          project: mockProject,
          issues: [pullRequest],
          cacheUsed: false,
        });
        mockIssueRepository.getOpenPullRequest.mockResolvedValue({
          ...createReadyPr(),
          isConflicted: true,
        });

        await useCase.run({
          projectUrl: 'https://github.com/users/user/projects/1',
          allowedIssueAuthors: ['owner'],
        });

        expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
        expect(mockIssueRepository.updateStory).not.toHaveBeenCalled();
        expect(mockIssueCommentRepository.createComment).not.toHaveBeenCalled();
      });

      it('should act on a dependency-update bot only when it is explicitly listed in allowedIssueAuthors', async () => {
        const pullRequest = createMockPullRequest({
          status: 'Unread',
          author: 'dependabot[bot]',
        });
        mockIssueRepository.getAllIssues.mockResolvedValue({
          project: mockProject,
          issues: [pullRequest],
          cacheUsed: false,
        });
        mockIssueRepository.getOpenPullRequest.mockResolvedValue({
          ...createReadyPr(),
          isConflicted: true,
        });

        await useCase.run({
          projectUrl: 'https://github.com/users/user/projects/1',
          allowedIssueAuthors: ['owner', 'dependabot[bot]'],
        });

        expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
          mockProject,
          pullRequest,
          'awaiting-workspace-id',
        );
        expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
          pullRequest,
          expect.stringContaining('Auto Status Check: REJECTED'),
        );
      });

      it('should process no author when allowedIssueAuthors is null', async () => {
        const pullRequest = createMockPullRequest({
          status: 'Unread',
          author: 'outside-contributor',
        });
        mockIssueRepository.getAllIssues.mockResolvedValue({
          project: mockProject,
          issues: [pullRequest],
          cacheUsed: false,
        });
        mockIssueRepository.getOpenPullRequest.mockResolvedValue({
          ...createReadyPr(),
          isConflicted: true,
        });

        await useCase.run({
          projectUrl: 'https://github.com/users/user/projects/1',
          allowedIssueAuthors: null,
        });

        expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
        expect(mockIssueRepository.updateStory).not.toHaveBeenCalled();
        expect(mockIssueCommentRepository.createComment).not.toHaveBeenCalled();
      });

      it('should process no author when allowedIssueAuthors is undefined', async () => {
        const pullRequest = createMockPullRequest({
          status: 'Unread',
          author: 'owner',
        });
        mockIssueRepository.getAllIssues.mockResolvedValue({
          project: mockProject,
          issues: [pullRequest],
          cacheUsed: false,
        });
        mockIssueRepository.getOpenPullRequest.mockResolvedValue({
          ...createReadyPr(),
          isConflicted: true,
        });

        await useCase.run({
          projectUrl: 'https://github.com/users/user/projects/1',
        });

        expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
        expect(mockIssueRepository.updateStory).not.toHaveBeenCalled();
        expect(mockIssueCommentRepository.createComment).not.toHaveBeenCalled();
      });

      it('should process no author when allowedIssueAuthors is an empty list', async () => {
        const pullRequest = createMockPullRequest({
          status: 'Unread',
          author: 'owner',
        });
        mockIssueRepository.getAllIssues.mockResolvedValue({
          project: mockProject,
          issues: [pullRequest],
          cacheUsed: false,
        });
        mockIssueRepository.getOpenPullRequest.mockResolvedValue({
          ...createReadyPr(),
          isConflicted: true,
        });

        await useCase.run({
          projectUrl: 'https://github.com/users/user/projects/1',
          allowedIssueAuthors: [],
        });

        expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
        expect(mockIssueRepository.updateStory).not.toHaveBeenCalled();
        expect(mockIssueCommentRepository.createComment).not.toHaveBeenCalled();
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
        status: 'Awaiting Quality Check',
      });
      const normalIssue = createMockIssue({
        number: 2,
        url: 'https://github.com/user/repo/issues/2',
        itemId: 'normal-item',
        status: 'Awaiting Quality Check',
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
        projectUrl: 'https://github.com/users/user/projects/1',
        allowedIssueAuthors: ['owner'],
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
        status: 'Awaiting Quality Check',
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
          projectUrl: 'https://github.com/users/user/projects/1',
          allowedIssueAuthors: ['owner'],
        }),
      ).rejects.toThrow('Something went wrong');

      expect(mockIssueCommentRepository.createComment).not.toHaveBeenCalled();
    });

    it('should skip an archived Unread pull request on updateStatus failure and continue with remaining pull requests', async () => {
      const archivedPullRequest = createMockPullRequest({
        number: 1,
        url: 'https://github.com/user/repo/pull/1',
        itemId: 'archived-pr-item',
        status: 'Unread',
      });
      const normalPullRequest = createMockPullRequest({
        number: 2,
        url: 'https://github.com/user/repo/pull/2',
        itemId: 'normal-pr-item',
        status: 'Unread',
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: mockProject,
        issues: [archivedPullRequest, normalPullRequest],
        cacheUsed: false,
      });
      mockIssueRepository.getOpenPullRequest.mockImplementation(
        (prUrl: string) =>
          Promise.resolve({
            ...createReadyPr(prUrl),
            isConflicted: true,
          }),
      );
      mockIssueRepository.updateStatus.mockImplementation(
        (_project: Project, issue: Issue) =>
          issue.url === archivedPullRequest.url
            ? Promise.reject(
                new Error('The item is archived and cannot be updated'),
              )
            : Promise.resolve(undefined),
      );

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        allowedIssueAuthors: ['owner'],
      });

      expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
        mockProject,
        archivedPullRequest,
        'awaiting-workspace-id',
      );
      expect(mockIssueRepository.updateStory).not.toHaveBeenCalledWith(
        expect.anything(),
        archivedPullRequest,
        expect.anything(),
      );
      expect(mockIssueCommentRepository.createComment).not.toHaveBeenCalledWith(
        archivedPullRequest,
        expect.anything(),
      );
      expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
        mockProject,
        normalPullRequest,
        'awaiting-workspace-id',
      );
      expect(mockIssueRepository.updateStory).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'project-1' }),
        normalPullRequest,
        'workflow-management-story-id',
      );
      expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
        normalPullRequest,
        expect.stringContaining('Auto Status Check: REJECTED'),
      );
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining(archivedPullRequest.url),
      );
    });

    it('should propagate a non-archived updateStatus error for Unread pull requests unchanged', async () => {
      const pullRequest = createMockPullRequest({
        status: 'Unread',
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: mockProject,
        issues: [pullRequest],
        cacheUsed: false,
      });
      mockIssueRepository.getOpenPullRequest.mockResolvedValue({
        ...createReadyPr(),
        isConflicted: true,
      });
      mockIssueRepository.updateStatus.mockRejectedValue(
        new Error('Something went wrong'),
      );

      await expect(
        useCase.run({
          projectUrl: 'https://github.com/users/user/projects/1',
          allowedIssueAuthors: ['owner'],
        }),
      ).rejects.toThrow('Something went wrong');

      expect(mockIssueRepository.updateStory).not.toHaveBeenCalled();
      expect(mockIssueCommentRepository.createComment).not.toHaveBeenCalled();
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
        status: 'Awaiting Quality Check',
      });
      const normalIssue = createMockIssue({
        number: 2,
        url: 'https://github.com/user/repo/issues/2',
        itemId: 'normal-item',
        status: 'Awaiting Quality Check',
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
        projectUrl: 'https://github.com/users/user/projects/1',
        allowedIssueAuthors: ['owner'],
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
        status: 'Awaiting Quality Check',
      });
      const normalIssue = createMockIssue({
        number: 2,
        url: 'https://github.com/user/repo/issues/2',
        itemId: 'normal-item',
        status: 'Awaiting Quality Check',
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
        projectUrl: 'https://github.com/users/user/projects/1',
        allowedIssueAuthors: ['owner'],
      });

      expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
        normalIssue,
        expect.stringContaining('Auto Status Check: REJECTED'),
      );
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining(timedOutIssue.url),
      );
    });

    it('should skip an Unread pull request whose updateStatus times out and continue with remaining pull requests', async () => {
      const timedOutPullRequest = createMockPullRequest({
        number: 1,
        url: 'https://github.com/user/repo/pull/1',
        itemId: 'timed-out-pr-item',
        status: 'Unread',
      });
      const normalPullRequest = createMockPullRequest({
        number: 2,
        url: 'https://github.com/user/repo/pull/2',
        itemId: 'normal-pr-item',
        status: 'Unread',
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: mockProject,
        issues: [timedOutPullRequest, normalPullRequest],
        cacheUsed: false,
      });
      mockIssueRepository.getOpenPullRequest.mockImplementation(
        (prUrl: string) =>
          Promise.resolve({
            ...createReadyPr(prUrl),
            isConflicted: true,
          }),
      );
      mockIssueRepository.updateStatus.mockImplementation(
        (_project: Project, issue: Issue) =>
          issue.url === timedOutPullRequest.url
            ? Promise.reject(createKyTimeoutError())
            : Promise.resolve(undefined),
      );

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        allowedIssueAuthors: ['owner'],
      });

      expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
        mockProject,
        timedOutPullRequest,
        'awaiting-workspace-id',
      );
      expect(mockIssueRepository.updateStory).not.toHaveBeenCalledWith(
        expect.anything(),
        timedOutPullRequest,
        expect.anything(),
      );
      expect(mockIssueCommentRepository.createComment).not.toHaveBeenCalledWith(
        timedOutPullRequest,
        expect.anything(),
      );
      expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
        mockProject,
        normalPullRequest,
        'awaiting-workspace-id',
      );
      expect(mockIssueRepository.updateStory).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'project-1' }),
        normalPullRequest,
        'workflow-management-story-id',
      );
      expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
        normalPullRequest,
        expect.stringContaining('Auto Status Check: REJECTED'),
      );
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining(timedOutPullRequest.url),
      );
    });

    it('should propagate a non-timeout non-archived error from createComment unchanged', async () => {
      const issue = createMockIssue({
        status: 'Awaiting Quality Check',
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
          projectUrl: 'https://github.com/users/user/projects/1',
          allowedIssueAuthors: ['owner'],
        }),
      ).rejects.toThrow('Something went wrong');
    });
  });
});
