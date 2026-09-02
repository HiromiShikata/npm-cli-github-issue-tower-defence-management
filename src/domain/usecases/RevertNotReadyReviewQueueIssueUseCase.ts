import { Issue } from '../entities/Issue';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { IssueCommentRepository } from './adapter-interfaces/IssueCommentRepository';
import { IssueRejectionEvaluator } from './IssueRejectionEvaluator';
import { ChangeTargetPullRequestApprover } from './ChangeTargetPullRequestApprover';
import { resolveLabelsNotRequiringPullRequest } from './resolveLabelsNotRequiringPullRequest';
import { isAuthorAuthorizedForAutoStatusCheck } from './isAuthorAuthorizedForAutoStatusCheck';
import { issueReactivationTriggerIsPending } from './issueReactivationTriggerIsPending';
import {
  AWAITING_QUALITY_CHECK_STATUS_NAME,
  AWAITING_WORKSPACE_STATUS_NAME,
} from '../entities/WorkflowStatus';

// GitHub rejects field mutations against archived project items with
// "The item is archived and cannot be updated". Such a failure is specific to
// the single item being reverted, so it must not abort the whole schedule
// cycle (the same containment policy as the transient GraphQL error handling
// and the findRelatedOpenPRs NOT_FOUND handling).
const isArchivedProjectItemError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  return message.toLowerCase().includes('archived');
};

const isTimeoutError = (error: unknown): boolean =>
  error instanceof Error && error.name === 'TimeoutError';

export class RevertNotReadyReviewQueueIssueUseCase {
  private readonly issueRejectionEvaluator: IssueRejectionEvaluator;
  private readonly changeTargetPullRequestApprover: ChangeTargetPullRequestApprover;

  constructor(
    private readonly projectRepository: Pick<
      ProjectRepository,
      'findProjectIdByUrl' | 'getProject'
    >,
    private readonly issueRepository: Pick<
      IssueRepository,
      | 'getAllIssues'
      | 'updateStatus'
      | 'updateStory'
      | 'findRelatedOpenPRs'
      | 'findRelatedOpenPrUrls'
      | 'getOpenPullRequest'
      | 'getOpenPullRequests'
      | 'getPullRequestChangedFilePaths'
      | 'approvePullRequest'
      | 'requestChangesWithInlineComment'
    >,
    private readonly issueCommentRepository: Pick<
      IssueCommentRepository,
      'createComment'
    >,
  ) {
    this.issueRejectionEvaluator = new IssueRejectionEvaluator(issueRepository);
    this.changeTargetPullRequestApprover = new ChangeTargetPullRequestApprover(
      issueRepository,
    );
  }

  run = async (params: {
    projectUrl: string;
    manager: string;
    labelsAsLlmAgentName?: string[] | null;
    labelsNotRequiringPullRequest?: string[] | null;
    changeTargetPathAliases?: Record<string, string> | null;
    allowedIssueAuthors?: string[] | null;
    developerAgentNames?: string[] | null;
    evaluatedAt?: Date;
  }): Promise<void> => {
    const allowedIssueAuthors = params.allowedIssueAuthors ?? null;
    const evaluatedAt = params.evaluatedAt ?? new Date();
    const projectId = await this.projectRepository.findProjectIdByUrl(
      params.projectUrl,
    );
    if (!projectId) {
      throw new Error(`Project not found. projectUrl: ${params.projectUrl}`);
    }
    const project = await this.projectRepository.getProject(projectId);
    if (!project) {
      throw new Error(
        `Project not found. projectId: ${projectId} projectUrl: ${params.projectUrl}`,
      );
    }

    const awaitingWorkspaceStatusOption = project.status.statuses.find(
      (s) => s.name === AWAITING_WORKSPACE_STATUS_NAME,
    );
    if (!awaitingWorkspaceStatusOption) {
      return;
    }

    const { issues } = await this.issueRepository.getAllIssues(projectId);

    const awaitingQualityCheckIssues = issues.filter(
      (issue) => issue.status === AWAITING_QUALITY_CHECK_STATUS_NAME,
    );

    const relatedOpenPrUrlsByIssueUrl =
      this.buildRelatedOpenPrUrlsByIssueUrl(issues);

    const labelsNotRequiringPullRequest =
      resolveLabelsNotRequiringPullRequest(params);

    const batchedRelatedOpenPrUrlsByIssueUrl =
      await this.resolveRelatedOpenPrUrlsForUncoveredIssues(
        awaitingQualityCheckIssues,
        relatedOpenPrUrlsByIssueUrl,
      );

    const resolvedOpenPrByUrl = await this.issueRepository.getOpenPullRequests(
      Array.from(
        new Set([
          ...awaitingQualityCheckIssues.flatMap(
            (issue) =>
              this.resolveRelatedOpenPrUrls(
                issue,
                relatedOpenPrUrlsByIssueUrl,
                batchedRelatedOpenPrUrlsByIssueUrl,
              ) ?? [],
          ),
        ]),
      ),
    );

    for (const issue of awaitingQualityCheckIssues) {
      if (
        !isAuthorAuthorizedForAutoStatusCheck(issue.author, allowedIssueAuthors)
      ) {
        continue;
      }

      if (issueReactivationTriggerIsPending(issue, evaluatedAt)) {
        await this.issueRepository.updateStatus(
          project,
          issue,
          awaitingWorkspaceStatusOption.id,
        );
        await this.issueCommentRepository.createComment(
          issue,
          'Auto Status Check: REJECTED\n- Reactivation trigger not yet reached',
        );
        continue;
      }

      try {
        const { rejections, approvedPrUrl } =
          await this.issueRejectionEvaluator.evaluate(
            issue,
            labelsNotRequiringPullRequest,
            {
              relatedOpenPrUrls: this.resolveRelatedOpenPrUrls(
                issue,
                relatedOpenPrUrlsByIssueUrl,
                batchedRelatedOpenPrUrlsByIssueUrl,
              ),
              resolvedOpenPrByUrl,
              developerAgentNames: params.developerAgentNames,
              detectConflictEvenIfEvaluationSkipped: true,
            },
          );
        if (rejections.length > 0) {
          if (!issue.assignees.includes(params.manager)) {
            continue;
          }
          try {
            await this.issueRepository.updateStatus(
              project,
              issue,
              awaitingWorkspaceStatusOption.id,
            );
          } catch (error) {
            if (isArchivedProjectItemError(error)) {
              console.warn(
                `RevertNotReadyReviewQueueIssueUseCase: project item is archived and cannot be updated, skipping revert. issueUrl: ${issue.url}`,
              );
              continue;
            }
            throw error;
          }
          await this.issueCommentRepository.createComment(
            issue,
            `Auto Status Check: REJECTED\n${rejections.map((r) => `- ${r.detail}`).join('\n')}`,
          );
          continue;
        }

        await this.changeTargetPullRequestApprover.approveIfConfined(
          issue.labels,
          approvedPrUrl,
          params.changeTargetPathAliases,
        );
      } catch (error) {
        if (isTimeoutError(error)) {
          console.warn(
            `RevertNotReadyReviewQueueIssueUseCase: request timed out, skipping issue for this cycle. issueUrl: ${issue.url} error: ${error instanceof Error ? error.message : String(error)}`,
          );
          continue;
        }
        throw error;
      }
    }
  };

  // Resolves in one batched request the related open pull requests of every
  // Awaiting Quality Check issue the bulk project items do not cover, so a
  // cycle costs one request instead of one findRelatedOpenPRs timeline query
  // per uncovered issue. A pull request item is excluded because
  // findRelatedOpenPRs rejects pull request URLs and IssueRejectionEvaluator
  // resolves such an item through getOpenPullRequest instead.
  private resolveRelatedOpenPrUrlsForUncoveredIssues = async (
    awaitingQualityCheckIssues: Issue[],
    relatedOpenPrUrlsByIssueUrl: Map<string, string[]>,
  ): Promise<Map<string, string[]>> => {
    const uncoveredIssueUrls = awaitingQualityCheckIssues
      .filter(
        (issue) => !issue.isPr && !relatedOpenPrUrlsByIssueUrl.has(issue.url),
      )
      .map((issue) => issue.url);
    if (uncoveredIssueUrls.length <= 0) {
      return new Map();
    }
    return this.issueRepository.findRelatedOpenPrUrls(uncoveredIssueUrls);
  };

  // Keeps the three states apart: the URLs a lookup resolved, an empty list
  // when a lookup resolved that no open pull request references the issue, and
  // null when neither lookup resolved it, which routes the issue to the
  // per-issue findRelatedOpenPRs fallback. Returning an empty list for an
  // unresolved issue would make IssueRejectionEvaluator report
  // PULL_REQUEST_NOT_FOUND for an issue whose pull request exists.
  private resolveRelatedOpenPrUrls = (
    issue: Issue,
    relatedOpenPrUrlsByIssueUrl: Map<string, string[]>,
    batchedRelatedOpenPrUrlsByIssueUrl: Map<string, string[]>,
  ): string[] | null =>
    relatedOpenPrUrlsByIssueUrl.get(issue.url) ??
    batchedRelatedOpenPrUrlsByIssueUrl.get(issue.url) ??
    null;

  // Derives, for each issue, the set of open pull request URLs that reference it
  // via a closing keyword. The linkage is taken from each open PR item's
  // closingIssueReferenceUrls (populated in bulk by fetchProjectItems), the same
  // in-memory derivation SetDependedIssueUrlForOpenTaskPRsUseCase uses. This
  // replaces the per-issue findRelatedOpenPRs timeline query in the
  // review-readiness sweep with a single in-memory pass over the bulk items.
  private buildRelatedOpenPrUrlsByIssueUrl = (
    issues: Issue[],
  ): Map<string, string[]> => {
    const openPrUrlsByIssueUrl = new Map<string, Set<string>>();
    for (const issue of issues) {
      if (!issue.isPr || issue.isClosed) {
        continue;
      }
      for (const referencedIssueUrl of issue.closingIssueReferenceUrls) {
        const existing = openPrUrlsByIssueUrl.get(referencedIssueUrl);
        if (existing) {
          existing.add(issue.url);
        } else {
          openPrUrlsByIssueUrl.set(referencedIssueUrl, new Set([issue.url]));
        }
      }
    }
    const result = new Map<string, string[]>();
    for (const [issueUrl, prUrls] of openPrUrlsByIssueUrl) {
      result.set(issueUrl, Array.from(prUrls));
    }
    return result;
  };
}
