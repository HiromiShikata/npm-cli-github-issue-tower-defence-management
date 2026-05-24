import { IssueRejectionEvaluator } from './IssueRejectionEvaluator';
import { RelatedPullRequest } from './adapter-interfaces/IssueRepository';

describe('IssueRejectionEvaluator', () => {
  const buildRelatedPullRequest = (
    overrides: Partial<RelatedPullRequest> = {},
  ): RelatedPullRequest => ({
    url: 'https://github.com/HiromiShikata/test-repository/pull/1',
    branchName: 'feature-branch',
    createdAt: new Date('2024-01-01'),
    isConflicted: false,
    isPassedAllCiJob: true,
    isCiStateSuccess: true,
    isResolvedAllReviewComments: true,
    isBranchOutOfDate: false,
    missingRequiredCheckNames: [],
    ...overrides,
  });

  const createEvaluator = (pr: RelatedPullRequest | null) => {
    const issueRepository = {
      findRelatedOpenPRs: jest.fn().mockResolvedValue(pr ? [pr] : []),
      getOpenPullRequest: jest.fn().mockResolvedValue(pr),
    };
    return {
      evaluator: new IssueRejectionEvaluator(issueRepository),
      issueRepository,
    };
  };

  const buildIssue = (
    overrides: { labels?: string[]; isPr?: boolean } = {},
  ) => ({
    url: 'https://github.com/HiromiShikata/test-repository/issues/10',
    labels: overrides.labels ?? [],
    isPr: overrides.isPr ?? false,
  });

  describe('evaluate — SKIPPED required checks', () => {
    it('returns REQUIRED_CI_JOB_NEVER_STARTED when required check was skipped', async () => {
      const pr = buildRelatedPullRequest({
        isPassedAllCiJob: false,
        isCiStateSuccess: true,
        missingRequiredCheckNames: ['required-check'],
      });
      const { evaluator } = createEvaluator(pr);

      const result = await evaluator.evaluate(buildIssue());

      expect(result.rejections).toHaveLength(1);
      expect(result.rejections[0].type).toBe('REQUIRED_CI_JOB_NEVER_STARTED');
      expect(result.rejections[0].detail).toContain('required-check');
      expect(result.approvedPrUrl).toBeNull();
    });

    it('returns no rejection when all required checks passed with SUCCESS conclusion', async () => {
      const pr = buildRelatedPullRequest({
        isPassedAllCiJob: true,
        isCiStateSuccess: true,
        missingRequiredCheckNames: [],
      });
      const { evaluator } = createEvaluator(pr);

      const result = await evaluator.evaluate(buildIssue());

      expect(result.rejections).toHaveLength(0);
      expect(result.approvedPrUrl).toBe(pr.url);
    });

    it('returns ANY_CI_JOB_FAILED_OR_IN_PROGRESS when CI state is not SUCCESS', async () => {
      const pr = buildRelatedPullRequest({
        isPassedAllCiJob: false,
        isCiStateSuccess: false,
        missingRequiredCheckNames: [],
      });
      const { evaluator } = createEvaluator(pr);

      const result = await evaluator.evaluate(buildIssue());

      expect(result.rejections).toHaveLength(1);
      expect(result.rejections[0].type).toBe(
        'ANY_CI_JOB_FAILED_OR_IN_PROGRESS',
      );
      expect(result.approvedPrUrl).toBeNull();
    });

    it('returns multiple rejection types when PR has both skipped required checks and review comments', async () => {
      const pr = buildRelatedPullRequest({
        isPassedAllCiJob: false,
        isCiStateSuccess: true,
        missingRequiredCheckNames: ['ci-check-a', 'ci-check-b'],
        isResolvedAllReviewComments: false,
      });
      const { evaluator } = createEvaluator(pr);

      const result = await evaluator.evaluate(buildIssue());

      const rejectionTypes = result.rejections.map((r) => r.type);
      expect(rejectionTypes).toContain('REQUIRED_CI_JOB_NEVER_STARTED');
      expect(rejectionTypes).toContain('ANY_REVIEW_COMMENT_NOT_RESOLVED');
      expect(result.approvedPrUrl).toBeNull();
    });
  });
});
