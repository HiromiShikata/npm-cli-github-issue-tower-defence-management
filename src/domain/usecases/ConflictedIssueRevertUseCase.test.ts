import { ConflictedIssueRevertUseCase } from './ConflictedIssueRevertUseCase';
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
    ],
  },
  nextActionDate: null,
  nextActionHour: null,
  story: null,
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
  status: 'Preparation',
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
  stateReason: null,
  closingIssueReferenceUrls: [],
  agent: null,
  ...overrides,
});

const createMockPrItem = (overrides: Partial<Issue> = {}): Issue =>
  createMockIssue({
    title: 'Test PR',
    url: 'https://github.com/user/repo/pull/1',
    isPr: true,
    status: 'Preparation',
    ...overrides,
  });

const createMockRelatedPullRequest = (
  overrides: Partial<RelatedPullRequest> = {},
): RelatedPullRequest => ({
  url: 'https://github.com/user/repo/pull/1',
  branchName: 'fix/issue-1',
  createdAt: new Date(),
  isDraft: false,
  isConflicted: false,
  mergeable: 'MERGEABLE',
  isPassedAllCiJob: true,
  isCiStateSuccess: true,
  isResolvedAllReviewComments: true,
  isBranchOutOfDate: false,
  missingRequiredCheckNames: [],
  ...overrides,
});

describe('ConflictedIssueRevertUseCase', () => {
  const projectUrl = 'https://github.com/users/user/projects/1';

  let mockProjectRepository: {
    findProjectIdByUrl: jest.Mock;
    getProject: jest.Mock;
  };
  let mockIssueRepository: {
    getAllIssues: jest.Mock;
    getOpenPullRequests: jest.Mock;
    updateStatus: jest.Mock;
    updateBranch: jest.Mock;
  };
  let mockIssueCommentRepository: {
    createComment: jest.Mock;
  };
  let mockProject: Project;
  let useCase: ConflictedIssueRevertUseCase;

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
      getOpenPullRequests: jest.fn().mockResolvedValue(new Map()),
      updateStatus: jest.fn().mockResolvedValue(undefined),
      updateBranch: jest.fn().mockResolvedValue(false),
    };

    mockIssueCommentRepository = {
      createComment: jest.fn().mockResolvedValue(undefined),
    };

    useCase = new ConflictedIssueRevertUseCase(
      mockProjectRepository,
      mockIssueRepository,
      mockIssueCommentRepository,
    );
  });

  describe('status filtering', () => {
    it('should do nothing when there are no issues', async () => {
      await useCase.run({ projectUrl });

      expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
      expect(mockIssueCommentRepository.createComment).not.toHaveBeenCalled();
    });

    const excludedStatuses = [
      'Done',
      'Icebox',
      'Failed Preparation',
      'In Tmux by human',
    ];

    excludedStatuses.forEach((status) => {
      it(`should not process issues in ${status} status`, async () => {
        const issue = createMockIssue({ status });
        const prItem = createMockPrItem({
          closingIssueReferenceUrls: [issue.url],
        });
        mockIssueRepository.getAllIssues.mockResolvedValue({
          project: mockProject,
          issues: [issue, prItem],
          cacheUsed: false,
        });

        await useCase.run({ projectUrl });

        expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
        expect(mockIssueCommentRepository.createComment).not.toHaveBeenCalled();
      });
    });

    it('should process Awaiting Workspace issues when their linked PR is conflicted and update-branch fails', async () => {
      const issue = createMockIssue({ status: 'Awaiting Workspace' });
      const prItem = createMockPrItem({
        url: 'https://github.com/user/repo/pull/1',
        closingIssueReferenceUrls: [issue.url],
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: mockProject,
        issues: [issue, prItem],
        cacheUsed: false,
      });
      const conflictedPr = createMockRelatedPullRequest({
        url: prItem.url,
        isConflicted: true,
        mergeable: 'CONFLICTING',
      });
      mockIssueRepository.getOpenPullRequests.mockResolvedValue(
        new Map([[conflictedPr.url, conflictedPr]]),
      );
      mockIssueRepository.updateBranch.mockResolvedValue(false);

      await useCase.run({ projectUrl });

      expect(mockIssueRepository.updateBranch).toHaveBeenCalledWith(
        conflictedPr.url,
      );
      expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
        mockProject,
        issue,
        'awaiting-workspace-id',
      );
      expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
        issue,
        'conflict',
      );
    });

    it('should not update status or post comment when Awaiting Workspace PR update-branch succeeds', async () => {
      const issue = createMockIssue({ status: 'Awaiting Workspace' });
      const prItem = createMockPrItem({
        url: 'https://github.com/user/repo/pull/1',
        closingIssueReferenceUrls: [issue.url],
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: mockProject,
        issues: [issue, prItem],
        cacheUsed: false,
      });
      const conflictedPr = createMockRelatedPullRequest({
        url: prItem.url,
        isConflicted: true,
        mergeable: 'CONFLICTING',
      });
      mockIssueRepository.getOpenPullRequests.mockResolvedValue(
        new Map([[conflictedPr.url, conflictedPr]]),
      );
      mockIssueRepository.updateBranch.mockResolvedValue(true);

      await useCase.run({ projectUrl });

      expect(mockIssueRepository.updateBranch).toHaveBeenCalledWith(
        conflictedPr.url,
      );
      expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
      expect(mockIssueCommentRepository.createComment).not.toHaveBeenCalled();
    });

    it('should skip PR items when scanning for target task issues', async () => {
      const prIssue = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
        status: 'Preparation',
        isPr: false,
      });
      const prItem = createMockPrItem({
        url: 'https://github.com/user/repo/pull/2',
        status: 'Preparation',
        isPr: true,
        closingIssueReferenceUrls: [prIssue.url],
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: mockProject,
        issues: [prIssue, prItem],
        cacheUsed: false,
      });
      const conflictedPr = createMockRelatedPullRequest({
        url: prItem.url,
        isConflicted: true,
        mergeable: 'CONFLICTING',
      });
      mockIssueRepository.getOpenPullRequests.mockResolvedValue(
        new Map([[conflictedPr.url, conflictedPr]]),
      );
      mockIssueRepository.updateBranch.mockResolvedValue(false);

      await useCase.run({ projectUrl });

      expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
        mockProject,
        prIssue,
        'awaiting-workspace-id',
      );
      expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
        prIssue,
        'conflict',
      );
    });
  });

  describe('conflict detection', () => {
    it('should skip an issue with no linked open PRs', async () => {
      const issue = createMockIssue({ status: 'Preparation' });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: mockProject,
        issues: [issue],
        cacheUsed: false,
      });

      await useCase.run({ projectUrl });

      expect(mockIssueRepository.getOpenPullRequests).not.toHaveBeenCalled();
      expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
      expect(mockIssueCommentRepository.createComment).not.toHaveBeenCalled();
    });

    it('should skip an issue whose linked PR is not conflicted', async () => {
      const issue = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
        status: 'Preparation',
      });
      const prItem = createMockPrItem({
        url: 'https://github.com/user/repo/pull/1',
        closingIssueReferenceUrls: [issue.url],
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: mockProject,
        issues: [issue, prItem],
        cacheUsed: false,
      });
      const pr = createMockRelatedPullRequest({
        url: prItem.url,
        isConflicted: false,
        mergeable: 'MERGEABLE',
      });
      mockIssueRepository.getOpenPullRequests.mockResolvedValue(
        new Map([[pr.url, pr]]),
      );

      await useCase.run({ projectUrl });

      expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
      expect(mockIssueCommentRepository.createComment).not.toHaveBeenCalled();
    });

    it('should update status and post conflict comment when linked PR is conflicted and update-branch fails', async () => {
      const issue = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
        status: 'Preparation',
      });
      const prItem = createMockPrItem({
        url: 'https://github.com/user/repo/pull/1',
        closingIssueReferenceUrls: [issue.url],
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: mockProject,
        issues: [issue, prItem],
        cacheUsed: false,
      });
      const conflictedPr = createMockRelatedPullRequest({
        url: prItem.url,
        isConflicted: true,
        mergeable: 'CONFLICTING',
      });
      mockIssueRepository.getOpenPullRequests.mockResolvedValue(
        new Map([[conflictedPr.url, conflictedPr]]),
      );
      mockIssueRepository.updateBranch.mockResolvedValue(false);

      await useCase.run({ projectUrl });

      expect(mockIssueRepository.updateBranch).toHaveBeenCalledWith(
        conflictedPr.url,
      );
      expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
        mockProject,
        issue,
        'awaiting-workspace-id',
      );
      expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
        issue,
        'conflict',
      );
    });

    it('should propagate error when update-branch throws for a non-200 non-422 response', async () => {
      const issue = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
        status: 'Preparation',
      });
      const prItem = createMockPrItem({
        url: 'https://github.com/user/repo/pull/1',
        closingIssueReferenceUrls: [issue.url],
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: mockProject,
        issues: [issue, prItem],
        cacheUsed: false,
      });
      const conflictedPr = createMockRelatedPullRequest({
        url: prItem.url,
        isConflicted: true,
        mergeable: 'CONFLICTING',
      });
      mockIssueRepository.getOpenPullRequests.mockResolvedValue(
        new Map([[conflictedPr.url, conflictedPr]]),
      );
      mockIssueRepository.updateBranch.mockRejectedValue(
        new Error('Failed to update branch for PR https://github.com/user/repo/pull/1: 500 Internal Server Error'),
      );

      await expect(useCase.run({ projectUrl })).rejects.toThrow(
        'Failed to update branch for PR',
      );
    });

    it('should not update status or post comment when update-branch succeeds for the conflicted PR', async () => {
      const issue = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
        status: 'Preparation',
      });
      const prItem = createMockPrItem({
        url: 'https://github.com/user/repo/pull/1',
        closingIssueReferenceUrls: [issue.url],
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: mockProject,
        issues: [issue, prItem],
        cacheUsed: false,
      });
      const conflictedPr = createMockRelatedPullRequest({
        url: prItem.url,
        isConflicted: true,
        mergeable: 'CONFLICTING',
      });
      mockIssueRepository.getOpenPullRequests.mockResolvedValue(
        new Map([[conflictedPr.url, conflictedPr]]),
      );
      mockIssueRepository.updateBranch.mockResolvedValue(true);

      await useCase.run({ projectUrl });

      expect(mockIssueRepository.updateBranch).toHaveBeenCalledWith(
        conflictedPr.url,
      );
      expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
      expect(mockIssueCommentRepository.createComment).not.toHaveBeenCalled();
    });

    it('should call update-branch only for conflicted PRs, not for all linked PRs', async () => {
      const issue = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
        status: 'Preparation',
      });
      const prItem1 = createMockPrItem({
        url: 'https://github.com/user/repo/pull/1',
        number: 1,
        closingIssueReferenceUrls: [issue.url],
      });
      const prItem2 = createMockPrItem({
        url: 'https://github.com/user/repo/pull/2',
        number: 2,
        closingIssueReferenceUrls: [issue.url],
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: mockProject,
        issues: [issue, prItem1, prItem2],
        cacheUsed: false,
      });
      const conflictedPr = createMockRelatedPullRequest({
        url: prItem1.url,
        isConflicted: true,
        mergeable: 'CONFLICTING',
      });
      const mergeablePr = createMockRelatedPullRequest({
        url: prItem2.url,
        isConflicted: false,
        mergeable: 'MERGEABLE',
      });
      mockIssueRepository.getOpenPullRequests.mockResolvedValue(
        new Map([
          [conflictedPr.url, conflictedPr],
          [mergeablePr.url, mergeablePr],
        ]),
      );
      mockIssueRepository.updateBranch.mockResolvedValue(true);

      await useCase.run({ projectUrl });

      expect(mockIssueRepository.updateBranch).toHaveBeenCalledTimes(1);
      expect(mockIssueRepository.updateBranch).toHaveBeenCalledWith(
        conflictedPr.url,
      );
      expect(mockIssueRepository.updateBranch).not.toHaveBeenCalledWith(
        mergeablePr.url,
      );
    });

    it('should fall back to status update when any conflicted PR update-branch fails', async () => {
      const issue = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
        status: 'Preparation',
      });
      const prItem1 = createMockPrItem({
        url: 'https://github.com/user/repo/pull/1',
        number: 1,
        closingIssueReferenceUrls: [issue.url],
      });
      const prItem2 = createMockPrItem({
        url: 'https://github.com/user/repo/pull/2',
        number: 2,
        closingIssueReferenceUrls: [issue.url],
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: mockProject,
        issues: [issue, prItem1, prItem2],
        cacheUsed: false,
      });
      const conflictedPr1 = createMockRelatedPullRequest({
        url: prItem1.url,
        isConflicted: true,
        mergeable: 'CONFLICTING',
      });
      const conflictedPr2 = createMockRelatedPullRequest({
        url: prItem2.url,
        isConflicted: true,
        mergeable: 'CONFLICTING',
      });
      mockIssueRepository.getOpenPullRequests.mockResolvedValue(
        new Map([
          [conflictedPr1.url, conflictedPr1],
          [conflictedPr2.url, conflictedPr2],
        ]),
      );
      mockIssueRepository.updateBranch
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      await useCase.run({ projectUrl });

      expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
        mockProject,
        issue,
        'awaiting-workspace-id',
      );
      expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
        issue,
        'conflict',
      );
    });

    it('should post exactly the string conflict as the comment body', async () => {
      const issue = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
        status: 'In Tmux by agent',
      });
      const prItem = createMockPrItem({
        url: 'https://github.com/user/repo/pull/1',
        closingIssueReferenceUrls: [issue.url],
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: mockProject,
        issues: [issue, prItem],
        cacheUsed: false,
      });
      const conflictedPr = createMockRelatedPullRequest({
        url: prItem.url,
        isConflicted: true,
        mergeable: 'CONFLICTING',
      });
      mockIssueRepository.getOpenPullRequests.mockResolvedValue(
        new Map([[conflictedPr.url, conflictedPr]]),
      );
      mockIssueRepository.updateBranch.mockResolvedValue(false);

      await useCase.run({ projectUrl });

      expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
        issue,
        'conflict',
      );
    });

    it('should skip an issue whose linked PR has mergeable UNKNOWN', async () => {
      const issue = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
        status: 'Preparation',
      });
      const prItem = createMockPrItem({
        url: 'https://github.com/user/repo/pull/1',
        closingIssueReferenceUrls: [issue.url],
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: mockProject,
        issues: [issue, prItem],
        cacheUsed: false,
      });
      const unknownPr = createMockRelatedPullRequest({
        url: prItem.url,
        isConflicted: false,
        mergeable: 'UNKNOWN',
      });
      mockIssueRepository.getOpenPullRequests.mockResolvedValue(
        new Map([[unknownPr.url, unknownPr]]),
      );

      await useCase.run({ projectUrl });

      expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
      expect(mockIssueCommentRepository.createComment).not.toHaveBeenCalled();
    });

    it('should skip when any linked PR has mergeable UNKNOWN even if another is conflicted', async () => {
      const issue = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
        status: 'Preparation',
      });
      const prItem1 = createMockPrItem({
        url: 'https://github.com/user/repo/pull/1',
        number: 1,
        closingIssueReferenceUrls: [issue.url],
      });
      const prItem2 = createMockPrItem({
        url: 'https://github.com/user/repo/pull/2',
        number: 2,
        closingIssueReferenceUrls: [issue.url],
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: mockProject,
        issues: [issue, prItem1, prItem2],
        cacheUsed: false,
      });
      const conflictedPr = createMockRelatedPullRequest({
        url: prItem1.url,
        isConflicted: true,
        mergeable: 'CONFLICTING',
      });
      const unknownPr = createMockRelatedPullRequest({
        url: prItem2.url,
        isConflicted: false,
        mergeable: 'UNKNOWN',
      });
      mockIssueRepository.getOpenPullRequests.mockResolvedValue(
        new Map([
          [conflictedPr.url, conflictedPr],
          [unknownPr.url, unknownPr],
        ]),
      );

      await useCase.run({ projectUrl });

      expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
      expect(mockIssueCommentRepository.createComment).not.toHaveBeenCalled();
    });

    it('should process an issue when one of multiple linked PRs is conflicted and none is UNKNOWN', async () => {
      const issue = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
        status: 'Preparation',
      });
      const prItem1 = createMockPrItem({
        url: 'https://github.com/user/repo/pull/1',
        number: 1,
        closingIssueReferenceUrls: [issue.url],
      });
      const prItem2 = createMockPrItem({
        url: 'https://github.com/user/repo/pull/2',
        number: 2,
        closingIssueReferenceUrls: [issue.url],
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: mockProject,
        issues: [issue, prItem1, prItem2],
        cacheUsed: false,
      });
      const conflictedPr = createMockRelatedPullRequest({
        url: prItem1.url,
        isConflicted: true,
        mergeable: 'CONFLICTING',
      });
      const mergeablePr = createMockRelatedPullRequest({
        url: prItem2.url,
        isConflicted: false,
        mergeable: 'MERGEABLE',
      });
      mockIssueRepository.getOpenPullRequests.mockResolvedValue(
        new Map([
          [conflictedPr.url, conflictedPr],
          [mergeablePr.url, mergeablePr],
        ]),
      );
      mockIssueRepository.updateBranch.mockResolvedValue(false);

      await useCase.run({ projectUrl });

      expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
        mockProject,
        issue,
        'awaiting-workspace-id',
      );
      expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
        issue,
        'conflict',
      );
    });

    it('should skip an issue whose linked PR resolved as null (absent/closed)', async () => {
      const issue = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
        status: 'Preparation',
      });
      const prItem = createMockPrItem({
        url: 'https://github.com/user/repo/pull/1',
        closingIssueReferenceUrls: [issue.url],
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: mockProject,
        issues: [issue, prItem],
        cacheUsed: false,
      });
      mockIssueRepository.getOpenPullRequests.mockResolvedValue(
        new Map([['https://github.com/user/repo/pull/1', null]]),
      );

      await useCase.run({ projectUrl });

      expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
      expect(mockIssueCommentRepository.createComment).not.toHaveBeenCalled();
    });

    it('should not include closed PR items in the related PR map', async () => {
      const issue = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
        status: 'Preparation',
      });
      const closedPrItem = createMockPrItem({
        url: 'https://github.com/user/repo/pull/1',
        isClosed: true,
        closingIssueReferenceUrls: [issue.url],
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: mockProject,
        issues: [issue, closedPrItem],
        cacheUsed: false,
      });

      await useCase.run({ projectUrl });

      expect(mockIssueRepository.getOpenPullRequests).not.toHaveBeenCalled();
      expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
      expect(mockIssueCommentRepository.createComment).not.toHaveBeenCalled();
    });

    it('should call update-branch before status update and comment when update-branch fails', async () => {
      const callOrder: string[] = [];
      const issue = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
        status: 'Preparation',
      });
      const prItem = createMockPrItem({
        url: 'https://github.com/user/repo/pull/1',
        closingIssueReferenceUrls: [issue.url],
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: mockProject,
        issues: [issue, prItem],
        cacheUsed: false,
      });
      const conflictedPr = createMockRelatedPullRequest({
        url: prItem.url,
        isConflicted: true,
        mergeable: 'CONFLICTING',
      });
      mockIssueRepository.getOpenPullRequests.mockResolvedValue(
        new Map([[conflictedPr.url, conflictedPr]]),
      );
      mockIssueRepository.updateBranch.mockImplementation(() => {
        callOrder.push('updateBranch');
        return Promise.resolve(false);
      });
      mockIssueRepository.updateStatus.mockImplementation(() => {
        callOrder.push('updateStatus');
        return Promise.resolve();
      });
      mockIssueCommentRepository.createComment.mockImplementation(() => {
        callOrder.push('createComment');
        return Promise.resolve();
      });

      await useCase.run({ projectUrl });

      expect(callOrder).toEqual([
        'updateBranch',
        'updateStatus',
        'createComment',
      ]);
    });

    it('should fetch all PR URLs in a single batched call', async () => {
      const issue1 = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
        number: 1,
        status: 'Preparation',
      });
      const issue2 = createMockIssue({
        url: 'https://github.com/user/repo/issues/2',
        number: 2,
        status: 'Todo by human',
      });
      const prItem1 = createMockPrItem({
        url: 'https://github.com/user/repo/pull/10',
        number: 10,
        closingIssueReferenceUrls: [issue1.url],
      });
      const prItem2 = createMockPrItem({
        url: 'https://github.com/user/repo/pull/20',
        number: 20,
        closingIssueReferenceUrls: [issue2.url],
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: mockProject,
        issues: [issue1, issue2, prItem1, prItem2],
        cacheUsed: false,
      });
      mockIssueRepository.getOpenPullRequests.mockResolvedValue(new Map());

      await useCase.run({ projectUrl });

      expect(mockIssueRepository.getOpenPullRequests).toHaveBeenCalledTimes(1);
      expect(mockIssueRepository.getOpenPullRequests).toHaveBeenCalledWith(
        expect.arrayContaining([
          'https://github.com/user/repo/pull/10',
          'https://github.com/user/repo/pull/20',
        ]),
      );
    });

    it('should process multiple conflicted issues in one run when update-branch fails for both', async () => {
      const issue1 = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
        number: 1,
        status: 'Preparation',
      });
      const issue2 = createMockIssue({
        url: 'https://github.com/user/repo/issues/2',
        number: 2,
        status: 'In Tmux by agent',
      });
      const prItem1 = createMockPrItem({
        url: 'https://github.com/user/repo/pull/10',
        number: 10,
        closingIssueReferenceUrls: [issue1.url],
      });
      const prItem2 = createMockPrItem({
        url: 'https://github.com/user/repo/pull/20',
        number: 20,
        closingIssueReferenceUrls: [issue2.url],
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: mockProject,
        issues: [issue1, issue2, prItem1, prItem2],
        cacheUsed: false,
      });
      const conflictedPr1 = createMockRelatedPullRequest({
        url: prItem1.url,
        isConflicted: true,
        mergeable: 'CONFLICTING',
      });
      const conflictedPr2 = createMockRelatedPullRequest({
        url: prItem2.url,
        isConflicted: true,
        mergeable: 'CONFLICTING',
      });
      mockIssueRepository.getOpenPullRequests.mockResolvedValue(
        new Map([
          [conflictedPr1.url, conflictedPr1],
          [conflictedPr2.url, conflictedPr2],
        ]),
      );
      mockIssueRepository.updateBranch.mockResolvedValue(false);

      await useCase.run({ projectUrl });

      expect(mockIssueRepository.updateStatus).toHaveBeenCalledTimes(2);
      expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
        mockProject,
        issue1,
        'awaiting-workspace-id',
      );
      expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
        mockProject,
        issue2,
        'awaiting-workspace-id',
      );
      expect(mockIssueCommentRepository.createComment).toHaveBeenCalledTimes(2);
    });
  });
});
