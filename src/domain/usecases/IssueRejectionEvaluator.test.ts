import { IssueRejectionEvaluator } from './IssueRejectionEvaluator';
import { RelatedPullRequest } from './adapter-interfaces/IssueRepository';

const createReadyPr = (
  url = 'https://github.com/user/repo/pull/1',
  overrides: Partial<RelatedPullRequest> = {},
): RelatedPullRequest => ({
  url,
  branchName: 'feature-branch',
  createdAt: new Date('2000-01-01T00:00:00Z'),
  isDraft: false,
  isConflicted: false,
  isPassedAllCiJob: true,
  isCiStateSuccess: true,
  isResolvedAllReviewComments: true,
  isBranchOutOfDate: false,
  missingRequiredCheckNames: [],
  ...overrides,
});

describe('IssueRejectionEvaluator', () => {
  let mockIssueRepository: {
    findRelatedOpenPRs: jest.Mock;
    getOpenPullRequest: jest.Mock;
  };
  let evaluator: IssueRejectionEvaluator;

  beforeEach(() => {
    jest.resetAllMocks();

    mockIssueRepository = {
      findRelatedOpenPRs: jest.fn(),
      getOpenPullRequest: jest.fn(),
    };

    evaluator = new IssueRejectionEvaluator(mockIssueRepository);
  });

  describe('evaluate', () => {
    it('should return no rejections when PR is ready and not draft', async () => {
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
        createReadyPr(),
      ]);

      const result = await evaluator.evaluate({
        url: 'https://github.com/user/repo/issues/1',
        labels: [],
        isPr: false,
      });

      expect(result.rejections).toHaveLength(0);
      expect(result.approvedPrUrl).toBe('https://github.com/user/repo/pull/1');
    });

    it('should reject with PULL_REQUEST_IS_DRAFT when PR is in draft state', async () => {
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
        createReadyPr('https://github.com/user/repo/pull/1', { isDraft: true }),
      ]);

      const result = await evaluator.evaluate({
        url: 'https://github.com/user/repo/issues/1',
        labels: [],
        isPr: false,
      });

      expect(result.rejections).toHaveLength(1);
      expect(result.rejections[0].type).toBe('PULL_REQUEST_IS_DRAFT');
      expect(result.rejections[0].detail).toContain('PULL_REQUEST_IS_DRAFT');
      expect(result.rejections[0].detail).toContain(
        'https://github.com/user/repo/pull/1',
      );
      expect(result.approvedPrUrl).toBeNull();
    });

    it('should not approve a draft PR even when all other checks pass', async () => {
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
        createReadyPr('https://github.com/user/repo/pull/1', { isDraft: true }),
      ]);

      const result = await evaluator.evaluate({
        url: 'https://github.com/user/repo/issues/1',
        labels: [],
        isPr: false,
      });

      expect(result.approvedPrUrl).toBeNull();
    });

    it('should accumulate PULL_REQUEST_IS_DRAFT alongside PULL_REQUEST_CONFLICTED when draft PR is also conflicted', async () => {
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
        createReadyPr('https://github.com/user/repo/pull/1', {
          isDraft: true,
          isConflicted: true,
        }),
      ]);

      const result = await evaluator.evaluate({
        url: 'https://github.com/user/repo/issues/1',
        labels: [],
        isPr: false,
      });

      const rejectionTypes = result.rejections.map((r) => r.type);
      expect(rejectionTypes).toContain('PULL_REQUEST_IS_DRAFT');
      expect(rejectionTypes).toContain('PULL_REQUEST_CONFLICTED');
      expect(result.approvedPrUrl).toBeNull();
    });

    it('should reject with PULL_REQUEST_IS_DRAFT when PR item (isPr=true) is in draft state', async () => {
      mockIssueRepository.getOpenPullRequest.mockResolvedValue(
        createReadyPr('https://github.com/user/repo/pull/10', {
          isDraft: true,
        }),
      );

      const result = await evaluator.evaluate({
        url: 'https://github.com/user/repo/pull/10',
        labels: [],
        isPr: true,
      });

      expect(mockIssueRepository.getOpenPullRequest).toHaveBeenCalledWith(
        'https://github.com/user/repo/pull/10',
      );
      expect(result.rejections).toHaveLength(1);
      expect(result.rejections[0].type).toBe('PULL_REQUEST_IS_DRAFT');
      expect(result.approvedPrUrl).toBeNull();
    });

    it('should not reject for draft state when issue has llm-agent label', async () => {
      const result = await evaluator.evaluate({
        url: 'https://github.com/user/repo/issues/1',
        labels: ['llm-agent'],
        isPr: false,
      });

      expect(mockIssueRepository.findRelatedOpenPRs).not.toHaveBeenCalled();
      expect(result.rejections).toHaveLength(0);
      expect(result.approvedPrUrl).toBeNull();
    });

    it('should not reject for draft state when issue has non-e2e category label', async () => {
      const result = await evaluator.evaluate({
        url: 'https://github.com/user/repo/issues/1',
        labels: ['category:frontend'],
        isPr: false,
      });

      expect(mockIssueRepository.findRelatedOpenPRs).not.toHaveBeenCalled();
      expect(result.rejections).toHaveLength(0);
    });

    it('should reject with PULL_REQUEST_NOT_FOUND when a normal issue has no related PR', async () => {
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([]);

      const result = await evaluator.evaluate({
        url: 'https://github.com/user/repo/issues/1',
        labels: [],
        isPr: false,
      });

      expect(mockIssueRepository.findRelatedOpenPRs).toHaveBeenCalledWith(
        'https://github.com/user/repo/issues/1',
      );
      expect(result.rejections).toHaveLength(1);
      expect(result.rejections[0].type).toBe('PULL_REQUEST_NOT_FOUND');
      expect(result.approvedPrUrl).toBeNull();
    });

    it('should not reject with PULL_REQUEST_NOT_FOUND when issue has a label listed in labelsAsLlmAgentName', async () => {
      const result = await evaluator.evaluate(
        {
          url: 'https://github.com/user/repo/issues/1',
          labels: ['story'],
          isPr: false,
        },
        ['story'],
      );

      expect(mockIssueRepository.findRelatedOpenPRs).not.toHaveBeenCalled();
      expect(result.rejections).toHaveLength(0);
      expect(result.approvedPrUrl).toBeNull();
    });

    it('should still reject with PULL_REQUEST_NOT_FOUND when issue label is not in labelsAsLlmAgentName', async () => {
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([]);

      const result = await evaluator.evaluate(
        {
          url: 'https://github.com/user/repo/issues/1',
          labels: ['story'],
          isPr: false,
        },
        ['bug'],
      );

      expect(mockIssueRepository.findRelatedOpenPRs).toHaveBeenCalledWith(
        'https://github.com/user/repo/issues/1',
      );
      expect(result.rejections).toHaveLength(1);
      expect(result.rejections[0].type).toBe('PULL_REQUEST_NOT_FOUND');
    });
  });
});
