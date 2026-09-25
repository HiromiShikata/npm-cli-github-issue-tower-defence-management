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
    const closedTaskIssueUrls = new Set(
      input.issues
        .filter((issue) => !issue.isPr && issue.isClosed)
        .map((issue) => issue.url),
    );
    for (const issue of input.issues) {
      if (!issue.isPr || issue.isClosed) {
        continue;
      }
      if (issue.closingIssueReferenceUrls.length === 0) {
        continue;
      }
      const everyReferencedTaskIssueClosed =
        issue.closingIssueReferenceUrls.every((url) =>
          closedTaskIssueUrls.has(url),
        );
      if (!everyReferencedTaskIssueClosed) {
        continue;
      }
      const pullRequestAgeMs =
        evaluatedAt.getTime() - issue.createdAt.getTime();
      if (pullRequestAgeMs < minimumPullRequestAgeMs) {
        continue;
      }
      const closedRefs = issue.closingIssueReferenceUrls.join(', ');
      try {
        await this.createCommentByUrlWithDedup(
          issue.url,
          `Closing this pull request because all referenced task issues are already closed: ${closedRefs}`,
        );
        await this.issueRepository.closePullRequest(issue.url);
      } catch (error) {
        console.warn(
          `Failed to close stale pull request ${issue.url}, skipping and continuing with remaining pull requests: ${error instanceof Error ? error.message : String(error)}`,
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
