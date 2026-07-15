import {
  IssueRepository,
  RelatedPullRequest,
} from './adapter-interfaces/IssueRepository';

export type PrRejectedReasonType =
  | 'PULL_REQUEST_NOT_FOUND'
  | 'MULTIPLE_PULL_REQUESTS_FOUND'
  | 'PULL_REQUEST_IS_DRAFT'
  | 'PULL_REQUEST_CONFLICTED'
  | 'ANY_CI_JOB_FAILED_OR_IN_PROGRESS'
  | 'REQUIRED_CI_JOB_NEVER_STARTED'
  | 'ANY_REVIEW_COMMENT_NOT_RESOLVED'
  | 'CHANGE_TARGET_MUST_PATH_NOT_CHANGED';

export type PrRejectionResult = {
  rejections: { type: PrRejectedReasonType; detail: string }[];
  approvedPrUrl: string | null;
};

export type EvaluateOptions = {
  // When provided, the related open pull requests for a non-PR issue are
  // resolved from these prebuilt URLs via getOpenPullRequest instead of
  // discovering them with a per-issue findRelatedOpenPRs timeline query.
  // Callers that already hold the bulk project items (e.g. the per-cycle
  // review-readiness sweep) derive these URLs in memory from PR items'
  // closingIssueReferenceUrls, eliminating the per-issue timeline fan-out.
  // When null or undefined, behaviour is unchanged: findRelatedOpenPRs runs.
  relatedOpenPrUrls?: string[] | null;
};

export class IssueRejectionEvaluator {
  constructor(
    private readonly issueRepository: Pick<
      IssueRepository,
      | 'findRelatedOpenPRs'
      | 'getOpenPullRequest'
      | 'getPullRequestChangedFilePaths'
      | 'requestChangesWithInlineComment'
    >,
  ) {}

  evaluate = async (
    issue: {
      url: string;
      labels: string[];
      isPr: boolean;
    },
    labelsAsLlmAgentName: string[] = [],
    options: EvaluateOptions = {},
  ): Promise<PrRejectionResult> => {
    const rejections: { type: PrRejectedReasonType; detail: string }[] = [];
    let approvedPrUrl: string | null = null;

    const categoryLabels = issue.labels.filter((label) =>
      label.startsWith('category:'),
    );
    const hasLlmAgentLabel = issue.labels.some(
      (l) => l === 'llm-agent' || l.startsWith('llm-agent:'),
    );
    const hasLabelAsLlmAgentName = issue.labels.some((label) =>
      labelsAsLlmAgentName.includes(label),
    );

    if (
      !hasLlmAgentLabel &&
      !hasLabelAsLlmAgentName &&
      (categoryLabels.length <= 0 || categoryLabels.includes('category:e2e'))
    ) {
      let prsToCheck: RelatedPullRequest[];
      let anyPrResolutionFailed = false;
      if (issue.isPr) {
        const resolved = await this.resolveOpenPrsForPrItem(issue.url);
        if (resolved === null) {
          // getOpenPullRequest failed transiently: the PR's state is unknown
          // for this cycle, so skip it without emitting any rejection.
          return { rejections, approvedPrUrl };
        }
        prsToCheck = resolved;
      } else if (options.relatedOpenPrUrls != null) {
        const resolved = await this.resolveOpenPrsFromUrls(
          options.relatedOpenPrUrls,
        );
        prsToCheck = resolved.prs;
        anyPrResolutionFailed = resolved.anyResolutionFailed;
      } else {
        prsToCheck = await this.issueRepository.findRelatedOpenPRs(issue.url);
      }

      if (prsToCheck.length <= 0) {
        if (!anyPrResolutionFailed) {
          rejections.push({
            type: 'PULL_REQUEST_NOT_FOUND',
            detail: 'PULL_REQUEST_NOT_FOUND',
          });
        }
        // When a resolution failed and no PR resolved, the related PR state is
        // unknown for this cycle; emit no rejection so a transient GraphQL
        // error cannot cause a false PULL_REQUEST_NOT_FOUND revert.
      } else if (prsToCheck.length > 1) {
        rejections.push({
          type: 'MULTIPLE_PULL_REQUESTS_FOUND',
          detail: `MULTIPLE_PULL_REQUESTS_FOUND: ${prsToCheck.map((pr) => pr.url).join(', ')}`,
        });
      } else {
        const pr = prsToCheck[0];
        if (pr.isDraft) {
          rejections.push({
            type: 'PULL_REQUEST_IS_DRAFT',
            detail: `PULL_REQUEST_IS_DRAFT: ${pr.url}`,
          });
        }
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

        const mustPaths = this.extractChangeTargetMustPaths(issue.labels);
        if (mustPaths.length > 0) {
          const changedFilePaths =
            await this.issueRepository.getPullRequestChangedFilePaths(pr.url);
          for (const mustPath of mustPaths) {
            const hasChange = changedFilePaths.some((filePath) =>
              this.isFilePathUnderPath(filePath, mustPath),
            );
            if (!hasChange) {
              rejections.push({
                type: 'CHANGE_TARGET_MUST_PATH_NOT_CHANGED',
                detail: `CHANGE_TARGET_MUST_PATH_NOT_CHANGED: ${mustPath}`,
              });
              const firstChangedFile =
                changedFilePaths.length > 0 ? changedFilePaths[0] : null;
              const commentBody = `The directory \`${mustPath}\` must contain at least one changed file in this pull request.`;
              await this.issueRepository.requestChangesWithInlineComment(
                pr.url,
                firstChangedFile,
                commentBody,
              );
            }
          }
        }

        if (
          !pr.isDraft &&
          !pr.isConflicted &&
          pr.isPassedAllCiJob &&
          pr.isResolvedAllReviewComments &&
          rejections.filter(
            (r) => r.type === 'CHANGE_TARGET_MUST_PATH_NOT_CHANGED',
          ).length === 0
        ) {
          approvedPrUrl = pr.url;
        }
      }
    }

    return { rejections, approvedPrUrl };
  };

  // Returns null when getOpenPullRequest throws (e.g. a transient GitHub
  // GraphQL server error): the PR's state is unknown for this cycle and the
  // caller skips it instead of letting the error abort the schedule cycle.
  private resolveOpenPrsForPrItem = async (
    prUrl: string,
  ): Promise<RelatedPullRequest[] | null> => {
    let pr: RelatedPullRequest | null;
    try {
      pr = await this.issueRepository.getOpenPullRequest(prUrl);
    } catch (error) {
      console.warn(
        `IssueRejectionEvaluator: getOpenPullRequest failed, skipping PR for this cycle. prUrl: ${prUrl} error: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
    if (pr === null) {
      return [];
    }
    return [pr];
  };

  // Resolves the status of each prebuilt related PR URL via getOpenPullRequest,
  // dropping any URL whose PR is not open (getOpenPullRequest returns null).
  // This mirrors findRelatedOpenPRs, which also returns only OPEN pull requests,
  // so the resulting set is equivalent while avoiding the per-issue timeline
  // query. Duplicate URLs are de-duplicated to mirror findRelatedOpenPRs, which
  // collapses duplicates via its internal Map keyed by PR URL.
  //
  // When getOpenPullRequest throws for a URL (e.g. a transient GitHub GraphQL
  // server error), that PR is logged and skipped for this cycle while the
  // remaining URLs are still resolved; anyResolutionFailed reports whether at
  // least one URL failed so the caller can avoid treating an unknown state as
  // PULL_REQUEST_NOT_FOUND.
  private resolveOpenPrsFromUrls = async (
    prUrls: string[],
  ): Promise<{ prs: RelatedPullRequest[]; anyResolutionFailed: boolean }> => {
    const uniquePrUrls = Array.from(new Set(prUrls));
    const resolvedPrs: RelatedPullRequest[] = [];
    let anyResolutionFailed = false;
    for (const prUrl of uniquePrUrls) {
      let pr: RelatedPullRequest | null;
      try {
        pr = await this.issueRepository.getOpenPullRequest(prUrl);
      } catch (error) {
        console.warn(
          `IssueRejectionEvaluator: getOpenPullRequest failed, skipping PR for this cycle. prUrl: ${prUrl} error: ${error instanceof Error ? error.message : String(error)}`,
        );
        anyResolutionFailed = true;
        continue;
      }
      if (pr !== null) {
        resolvedPrs.push(pr);
      }
    }
    return { prs: resolvedPrs, anyResolutionFailed };
  };

  private extractChangeTargetMustPaths = (labels: string[]): string[] => {
    const prefix = 'change-target-must:';
    const paths: string[] = [];
    for (const label of labels) {
      if (!label.startsWith(prefix)) continue;
      const raw = label.slice(prefix.length).trim();
      if (raw.length === 0) continue;
      const normalized = raw.replace(/^\/+/, '').replace(/\/+$/, '');
      if (normalized.length === 0) continue;
      paths.push(normalized);
    }
    return paths;
  };

  private isFilePathUnderPath = (
    filePath: string,
    targetPath: string,
  ): boolean =>
    filePath === targetPath || filePath.startsWith(`${targetPath}/`);
}
