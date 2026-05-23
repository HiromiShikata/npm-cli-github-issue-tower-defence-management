import {
  IssueRepository,
  RelatedPullRequest,
} from './adapter-interfaces/IssueRepository';

export type PrRejectedReasonType =
  | 'PULL_REQUEST_NOT_FOUND'
  | 'MULTIPLE_PULL_REQUESTS_FOUND'
  | 'PULL_REQUEST_CONFLICTED'
  | 'ANY_CI_JOB_FAILED_OR_IN_PROGRESS'
  | 'REQUIRED_CI_JOB_NEVER_STARTED'
  | 'ANY_REVIEW_COMMENT_NOT_RESOLVED';

export type PrRejectionResult = {
  rejections: { type: PrRejectedReasonType; detail: string }[];
  approvedPrUrl: string | null;
};

export class IssueRejectionEvaluator {
  constructor(
    private readonly issueRepository: Pick<
      IssueRepository,
      'findRelatedOpenPRs' | 'getOpenPullRequest'
    >,
  ) {}

  evaluate = async (issue: {
    url: string;
    labels: string[];
    isPr: boolean;
  }): Promise<PrRejectionResult> => {
    const rejections: { type: PrRejectedReasonType; detail: string }[] = [];
    let approvedPrUrl: string | null = null;

    const categoryLabels = issue.labels.filter((label) =>
      label.startsWith('category:'),
    );
    const hasLlmAgentLabel = issue.labels.some(
      (l) => l === 'llm-agent' || l.startsWith('llm-agent:'),
    );

    if (
      !hasLlmAgentLabel &&
      (categoryLabels.length <= 0 || categoryLabels.includes('category:e2e'))
    ) {
      const prsToCheck = issue.isPr
        ? await this.resolveOpenPrsForPrItem(issue.url)
        : await this.issueRepository.findRelatedOpenPRs(issue.url);

      if (prsToCheck.length <= 0) {
        rejections.push({
          type: 'PULL_REQUEST_NOT_FOUND',
          detail: 'PULL_REQUEST_NOT_FOUND',
        });
      } else if (prsToCheck.length > 1) {
        rejections.push({
          type: 'MULTIPLE_PULL_REQUESTS_FOUND',
          detail: `MULTIPLE_PULL_REQUESTS_FOUND: ${prsToCheck.map((pr) => pr.url).join(', ')}`,
        });
      } else {
        const pr = prsToCheck[0];
        if (pr.isConflicted) {
          rejections.push({
            type: 'PULL_REQUEST_CONFLICTED',
            detail: `PULL_REQUEST_CONFLICTED: ${pr.url}`,
          });
        }
        if (!pr.isPassedAllCiJob) {
          const missingChecks = pr.missingRequiredCheckNames;
          const missingSuffix =
            missingChecks.length > 0
              ? ` (missing: ${missingChecks.join(', ')})`
              : '';
          if (pr.isCiStateSuccess && missingChecks.length > 0) {
            rejections.push({
              type: 'REQUIRED_CI_JOB_NEVER_STARTED',
              detail: `REQUIRED_CI_JOB_NEVER_STARTED: ${pr.url}${missingSuffix}`,
            });
          } else {
            rejections.push({
              type: 'ANY_CI_JOB_FAILED_OR_IN_PROGRESS',
              detail: `ANY_CI_JOB_FAILED_OR_IN_PROGRESS: ${pr.url}${missingSuffix}`,
            });
          }
        }
        if (!pr.isResolvedAllReviewComments) {
          rejections.push({
            type: 'ANY_REVIEW_COMMENT_NOT_RESOLVED',
            detail: `ANY_REVIEW_COMMENT_NOT_RESOLVED: ${pr.url}`,
          });
        }
        if (
          !pr.isConflicted &&
          pr.isPassedAllCiJob &&
          pr.isResolvedAllReviewComments
        ) {
          approvedPrUrl = pr.url;
        }
      }
    }

    return { rejections, approvedPrUrl };
  };

  private resolveOpenPrsForPrItem = async (
    prUrl: string,
  ): Promise<RelatedPullRequest[]> => {
    const pr = await this.issueRepository.getOpenPullRequest(prUrl);
    if (pr === null) {
      return [];
    }
    return [pr];
  };
}
