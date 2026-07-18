import { Issue } from '../entities/Issue';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { IssueCommentRepository } from './adapter-interfaces/IssueCommentRepository';
import { IssueRejectionEvaluator } from './IssueRejectionEvaluator';
import { ChangeTargetPullRequestApprover } from './ChangeTargetPullRequestApprover';
import {
  AWAITING_QUALITY_CHECK_STATUS_NAME,
  AWAITING_WORKSPACE_STATUS_NAME,
  DEFAULT_STATUS_NAME,
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

const isAuthorAuthorizedForAutoStatusCheck = (
  author: string,
  allowedIssueAuthors: string[] | null | undefined,
): boolean => {
  if (allowedIssueAuthors === null || allowedIssueAuthors === undefined) {
    return false;
  }
  if (allowedIssueAuthors.length === 0) {
    return false;
  }
  return allowedIssueAuthors.includes(author);
};

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
      | 'getOpenPullRequest'
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
    labelsAsLlmAgentName?: string[] | null;
    changeTargetPathAliases?: Record<string, string> | null;
    allowedIssueAuthors?: string[] | null;
  }): Promise<void> => {
    const allowedIssueAuthors = params.allowedIssueAuthors ?? null;
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

    for (const issue of awaitingQualityCheckIssues) {
      const hasLlmAgentLabel = issue.labels.some(
        (l) => l === 'llm-agent' || l.startsWith('llm-agent:'),
      );
      if (hasLlmAgentLabel) {
        continue;
      }

      if (
        !isAuthorAuthorizedForAutoStatusCheck(issue.author, allowedIssueAuthors)
      ) {
        continue;
      }

      try {
        const { rejections, approvedPrUrl } =
          await this.issueRejectionEvaluator.evaluate(
            issue,
            params.labelsAsLlmAgentName ?? [],
            {
              relatedOpenPrUrls:
                relatedOpenPrUrlsByIssueUrl.get(issue.url) ?? [],
            },
          );
        if (rejections.length > 0) {
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

    const projectStory = project.story;
    const unreadPullRequests = issues.filter(
      (issue) => issue.status === DEFAULT_STATUS_NAME && issue.isPr,
    );

    for (const pullRequest of unreadPullRequests) {
      const hasLlmAgentLabel = pullRequest.labels.some(
        (l) => l === 'llm-agent' || l.startsWith('llm-agent:'),
      );
      if (hasLlmAgentLabel) {
        continue;
      }

      if (
        !isAuthorAuthorizedForAutoStatusCheck(
          pullRequest.author,
          allowedIssueAuthors,
        )
      ) {
        continue;
      }

      try {
        const { rejections } = await this.issueRejectionEvaluator.evaluate(
          pullRequest,
          params.labelsAsLlmAgentName ?? [],
        );
        if (rejections.length > 0) {
          try {
            await this.issueRepository.updateStatus(
              project,
              pullRequest,
              awaitingWorkspaceStatusOption.id,
            );
          } catch (error) {
            if (isArchivedProjectItemError(error)) {
              console.warn(
                `RevertNotReadyReviewQueueIssueUseCase: project item is archived and cannot be updated, skipping revert. prUrl: ${pullRequest.url}`,
              );
              continue;
            }
            throw error;
          }
          if (projectStory) {
            await this.issueRepository.updateStory(
              { ...project, story: projectStory },
              pullRequest,
              projectStory.workflowManagementStory.id,
            );
          }
          await this.issueCommentRepository.createComment(
            pullRequest,
            `Auto Status Check: REJECTED\n${rejections.map((r) => `- ${r.detail}`).join('\n')}`,
          );
        }
      } catch (error) {
        if (isTimeoutError(error)) {
          console.warn(
            `RevertNotReadyReviewQueueIssueUseCase: request timed out, skipping pull request for this cycle. prUrl: ${pullRequest.url} error: ${error instanceof Error ? error.message : String(error)}`,
          );
          continue;
        }
        throw error;
      }
    }
  };

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
