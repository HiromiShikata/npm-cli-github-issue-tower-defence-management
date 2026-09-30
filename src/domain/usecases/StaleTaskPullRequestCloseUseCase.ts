import type { Issue } from '../entities/Issue';
import type { IssueRepository } from './adapter-interfaces/IssueRepository';
import { isDuplicateWithinWindow } from '../services/commentDeduplication';

export const DEFAULT_MINIMUM_PULL_REQUEST_AGE_MS = 24 * 60 * 60 * 1000;

export class StaleTaskPullRequestCloseUseCase {
  constructor(
    readonly issueRepository: Pick<
      IssueRepository,
      | 'closePullRequest'
      | 'createCommentByUrl'
      | 'getIssueOrPullRequestComments'
      | 'findRelatedOpenPrUrls'
      | 'getIssueByUrl'
    >,
  ) {}

  run = async (input: {
    issues: Issue[];
    evaluatedAt?: Date;
    minimumPullRequestAgeMs?: number;
  }): Promise<void> => {
    const evaluatedAt = input.evaluatedAt ?? new Date();
    const minimumPullRequestAgeMs =
      input.minimumPullRequestAgeMs ?? DEFAULT_MINIMUM_PULL_REQUEST_AGE_MS;
    const closedTaskIssues = input.issues.filter(
      (issue) => !issue.isPr && issue.isClosed,
    );
    const closedTaskIssueUrlsInInputOrder = closedTaskIssues.map(
      (issue) => issue.url,
    );
    const closedTaskIssueUrls = new Set(closedTaskIssueUrlsInInputOrder);
    const relatedOpenPrUrlsByIssueUrl =
      await this.issueRepository.findRelatedOpenPrUrls(
        closedTaskIssueUrlsInInputOrder,
      );
    const unresolvedClosedTaskIssueUrls: string[] = [];
    const candidatePullRequestUrls = new Set<string>();
    for (const closedTaskIssueUrl of closedTaskIssueUrlsInInputOrder) {
      const relatedOpenPrUrls =
        relatedOpenPrUrlsByIssueUrl.get(closedTaskIssueUrl);
      if (relatedOpenPrUrls === undefined) {
        unresolvedClosedTaskIssueUrls.push(closedTaskIssueUrl);
        continue;
      }
      for (const relatedOpenPrUrl of relatedOpenPrUrls) {
        candidatePullRequestUrls.add(relatedOpenPrUrl);
      }
    }
    if (unresolvedClosedTaskIssueUrls.length > 0) {
      console.warn(
        `StaleTaskPullRequestCloseUseCase: skipping closed task issues whose related open pull requests could not be resolved in this run. count: ${unresolvedClosedTaskIssueUrls.length} issueUrls: ${unresolvedClosedTaskIssueUrls.join(', ')}`,
      );
    }
    for (const pullRequestUrl of candidatePullRequestUrls) {
      const pullRequestIssue =
        await this.issueRepository.getIssueByUrl(pullRequestUrl);
      if (!pullRequestIssue || pullRequestIssue.isClosed) {
        continue;
      }
      if (pullRequestIssue.closingIssueReferenceUrls.length === 0) {
        continue;
      }
      const everyReferencedTaskIssueClosed =
        pullRequestIssue.closingIssueReferenceUrls.every((url) =>
          closedTaskIssueUrls.has(url),
        );
      if (!everyReferencedTaskIssueClosed) {
        continue;
      }
      const pullRequestAgeMs =
        evaluatedAt.getTime() - pullRequestIssue.createdAt.getTime();
      if (pullRequestAgeMs < minimumPullRequestAgeMs) {
        continue;
      }
      const closedRefs = pullRequestIssue.closingIssueReferenceUrls.join(', ');
      try {
        await this.createCommentByUrlWithDedup(
          pullRequestIssue.url,
          `Closing this pull request because all referenced task issues are already closed: ${closedRefs}`,
        );
        await this.issueRepository.closePullRequest(pullRequestIssue.url);
      } catch (error) {
        console.warn(
          `Failed to close stale pull request ${pullRequestIssue.url}, skipping and continuing with remaining pull requests: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  };

  private createCommentByUrlWithDedup = async (
    url: string,
    commentBody: string,
  ): Promise<void> => {
    const existing =
      await this.issueRepository.getIssueOrPullRequestComments(url);
    if (
      isDuplicateWithinWindow(
        commentBody,
        existing.map((c) => ({ text: c.body, createdAt: c.createdAt })),
        new Date(),
      )
    ) {
      return;
    }
    await this.issueRepository.createCommentByUrl(url, commentBody);
  };
}
