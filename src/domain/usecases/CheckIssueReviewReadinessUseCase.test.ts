import { CheckIssueReviewReadinessUseCase } from './CheckIssueReviewReadinessUseCase';
import { Issue } from '../entities/Issue';
import { Comment } from '../entities/Comment';
import { RelatedPullRequest } from './adapter-interfaces/IssueRepository';

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
  assignees: [],
  labels: [],
  org: 'user',
  repo: 'repo',
  body: '',
  itemId: 'item-1',
  isPr: false,
  isInProgress: false,
  isClosed: false,
  createdAt: new Date('2000-01-01T00:00:00Z'),
  author: 'test-user',
  closingIssueReferenceUrls: [],
  ...overrides,
});

const createMockComment = (overrides: Partial<Comment> = {}): Comment => ({
  author: 'agent-bot',
  content: 'From: :robot: Agent report',
  createdAt: new Date('2000-01-01T00:00:00Z'),
  ...overrides,
});

const createReadyPr = (
  overrides: Partial<RelatedPullRequest> = {},
): RelatedPullRequest => ({
  url: 'https://github.com/user/repo/pull/1',
  branchName: 'feature-branch',
  createdAt: new Date('2000-01-01T00:00:00Z'),
  isDraft: false,
  isConflicted: false,
  mergeable: null,
  isPassedAllCiJob: true,
  isCiStateSuccess: true,
  isResolvedAllReviewComments: true,
  isBranchOutOfDate: false,
  missingRequiredCheckNames: [],
  ...overrides,
});

describe('CheckIssueReviewReadinessUseCase', () => {
  let mockIssueRepository: {
    getIssueByUrl: jest.Mock;
    findRelatedOpenPRs: jest.Mock;
    getOpenPullRequest: jest.Mock;
    getPullRequestChangedFilePaths: jest.Mock;
    requestChangesWithInlineComment: jest.Mock;
  };
  let mockIssueCommentRepository: {
    getCommentsFromIssue: jest.Mock;
  };
  let useCase: CheckIssueReviewReadinessUseCase;

  beforeEach(() => {
    jest.resetAllMocks();

    mockIssueRepository = {
      getIssueByUrl: jest.fn(),
      findRelatedOpenPRs: jest.fn(),
      getOpenPullRequest: jest.fn(),
      getPullRequestChangedFilePaths: jest.fn().mockResolvedValue([]),
      requestChangesWithInlineComment: jest.fn().mockResolvedValue(undefined),
    };

    mockIssueCommentRepository = {
      getCommentsFromIssue: jest.fn(),
    };

    useCase = new CheckIssueReviewReadinessUseCase(
      mockIssueRepository,
      mockIssueCommentRepository,
    );
  });

  describe('run', () => {
    it('should return reviewReady=false with ISSUE_NOT_FOUND when issue does not exist', async () => {
      mockIssueRepository.getIssueByUrl.mockResolvedValue(null);

      const result = await useCase.run({
        issueUrl: 'https://github.com/user/repo/issues/999',
      });

      expect(result.reviewReady).toBe(false);
      expect(result.rejections).toEqual([
        {
          type: 'ISSUE_NOT_FOUND',
          detail: 'Issue not found: https://github.com/user/repo/issues/999',
        },
      ]);
    });

    it('should return reviewReady=false with NO_REPORT_FROM_AGENT_BOT when no comments exist', async () => {
      const issue = createMockIssue();
      mockIssueRepository.getIssueByUrl.mockResolvedValue(issue);
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([]);
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
        createReadyPr(),
      ]);

      const result = await useCase.run({
        issueUrl: 'https://github.com/user/repo/issues/1',
      });

      expect(result.reviewReady).toBe(false);
      expect(result.rejections).toContainEqual({
        type: 'NO_REPORT_FROM_AGENT_BOT',
        detail: 'NO_REPORT_FROM_AGENT_BOT',
      });
    });

    it('should return reviewReady=false with NO_REPORT_FROM_AGENT_BOT when last comment does not start with From: :robot:', async () => {
      const issue = createMockIssue();
      mockIssueRepository.getIssueByUrl.mockResolvedValue(issue);
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createMockComment({ content: 'Some regular comment' }),
      ]);
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
        createReadyPr(),
      ]);

      const result = await useCase.run({
        issueUrl: 'https://github.com/user/repo/issues/1',
      });

      expect(result.reviewReady).toBe(false);
      expect(result.rejections).toContainEqual({
        type: 'NO_REPORT_FROM_AGENT_BOT',
        detail: 'NO_REPORT_FROM_AGENT_BOT',
      });
    });

    it('should return reviewReady=false with REPORT_HAS_NEXT_STEP when last comment has nextStep in JSON', async () => {
      const issue = createMockIssue();
      mockIssueRepository.getIssueByUrl.mockResolvedValue(issue);
      const commentWithNextStep = createMockComment({
        content:
          'From: :robot: Agent report\n```json\n{"nextStep": "fix the bug"}\n```',
      });
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        commentWithNextStep,
      ]);
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
        createReadyPr(),
      ]);

      const result = await useCase.run({
        issueUrl: 'https://github.com/user/repo/issues/1',
      });

      expect(result.reviewReady).toBe(false);
      expect(result.rejections).toContainEqual({
        type: 'REPORT_HAS_NEXT_STEP',
        detail: 'REPORT_HAS_NEXT_STEP',
      });
    });

    it('should return reviewReady=false with PULL_REQUEST_NOT_FOUND when no related PR exists', async () => {
      const issue = createMockIssue();
      mockIssueRepository.getIssueByUrl.mockResolvedValue(issue);
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createMockComment(),
      ]);
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([]);

      const result = await useCase.run({
        issueUrl: 'https://github.com/user/repo/issues/1',
      });

      expect(result.reviewReady).toBe(false);
      expect(result.rejections).toContainEqual({
        type: 'PULL_REQUEST_NOT_FOUND',
        detail: 'PULL_REQUEST_NOT_FOUND',
      });
    });

    it('should return reviewReady=true with empty rejections when all checks pass', async () => {
      const issue = createMockIssue();
      mockIssueRepository.getIssueByUrl.mockResolvedValue(issue);
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createMockComment(),
      ]);
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
        createReadyPr(),
      ]);

      const result = await useCase.run({
        issueUrl: 'https://github.com/user/repo/issues/1',
      });

      expect(result.reviewReady).toBe(true);
      expect(result.rejections).toEqual([]);
    });

    it('should return reviewReady=false with ANY_CI_JOB_FAILED_OR_IN_PROGRESS when PR CI is failing', async () => {
      const issue = createMockIssue();
      mockIssueRepository.getIssueByUrl.mockResolvedValue(issue);
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createMockComment(),
      ]);
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
        createReadyPr({
          isPassedAllCiJob: false,
          isCiStateSuccess: false,
        }),
      ]);

      const result = await useCase.run({
        issueUrl: 'https://github.com/user/repo/issues/1',
      });

      expect(result.reviewReady).toBe(false);
      expect(result.rejections[0].type).toBe(
        'ANY_CI_JOB_FAILED_OR_IN_PROGRESS',
      );
    });

    it('should treat all authors as trusted when allowedIssueAuthors is null', async () => {
      const issue = createMockIssue();
      mockIssueRepository.getIssueByUrl.mockResolvedValue(issue);
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createMockComment({ author: 'any-unknown-author' }),
      ]);
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
        createReadyPr(),
      ]);

      const result = await useCase.run({
        issueUrl: 'https://github.com/user/repo/issues/1',
        allowedIssueAuthors: null,
      });

      expect(result.reviewReady).toBe(true);
      expect(result.rejections).toEqual([]);
    });

    it('should reject when last comment author is not in allowedIssueAuthors list', async () => {
      const issue = createMockIssue();
      mockIssueRepository.getIssueByUrl.mockResolvedValue(issue);
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createMockComment({ author: 'untrusted-author' }),
      ]);
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
        createReadyPr(),
      ]);

      const result = await useCase.run({
        issueUrl: 'https://github.com/user/repo/issues/1',
        allowedIssueAuthors: ['trusted-author'],
      });

      expect(result.reviewReady).toBe(false);
      expect(result.rejections).toContainEqual({
        type: 'NO_REPORT_FROM_AGENT_BOT',
        detail: 'NO_REPORT_FROM_AGENT_BOT',
      });
    });

    it('should accept when last comment author is in allowedIssueAuthors list', async () => {
      const issue = createMockIssue();
      mockIssueRepository.getIssueByUrl.mockResolvedValue(issue);
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createMockComment({ author: 'trusted-author' }),
      ]);
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
        createReadyPr(),
      ]);

      const result = await useCase.run({
        issueUrl: 'https://github.com/user/repo/issues/1',
        allowedIssueAuthors: ['trusted-author'],
      });

      expect(result.reviewReady).toBe(true);
      expect(result.rejections).toEqual([]);
    });
  });
});
