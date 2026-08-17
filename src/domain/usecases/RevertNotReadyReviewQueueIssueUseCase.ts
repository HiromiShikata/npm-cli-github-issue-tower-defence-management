import { Issue } from '../entities/Issue';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { IssueCommentRepository } from './adapter-interfaces/IssueCommentRepository';
import { IssueRejectionEvaluator } from './IssueRejectionEvaluator';
import { ChangeTargetPullRequestApprover } from './ChangeTargetPullRequestApprover';
import { resolveLabelsNotRequiringPullRequest } from './resolveLabelsNotRequiringPullRequest';
import { isPullRequestDeclaredUnnecessary } from './isPullRequestDeclaredUnnecessary';
import { isAuthorAuthorizedForAutoStatusCheck } from './isAuthorAuthorizedForAutoStatusCheck';
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

// GitHub occasionally returns a permission error for UpdateProjectV2ItemFieldValue
// even when the token has project write access — observed when targeting a specific
// project item. The failure is per-item, so it must not abort the whole schedule cycle.
const isPermissionError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .toLowerCase()
    .includes('does not have the correct permissions to execute');
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
      | 'getOpenPullRequest'
      | 'getOpenPullRequests'
      | 'getPullRequestChangedFilePaths'
      | 'approvePullRequest'
      | 'requestChangesWithInlineComment'
    >,
    private readonly issueCommentRepository: Pick<
      IssueCommentRepository,
      'createComment' | 'getCommentsFromIssue'
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
  }): Promise<void> => {
    const permissionErrorItems: string[] = [];
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

    const unreadPullRequests = issues.filter(
      (issue) => issue.status === DEFAULT_STATUS_NAME && issue.isPr,
    );

    const labelsNotRequiringPullRequest =
      resolveLabelsNotRequiringPullRequest(params);
    const willBeEvaluated = (item: Issue): boolean =>
      isAuthorAuthorizedForAutoStatusCheck(item.author, allowedIssueAuthors) &&
      this.issueRejectionEvaluator.requiresPullRequestEvaluation(
        item,
        labelsNotRequiringPullRequest,
      );

    const resolvedOpenPrByUrl = await this.issueRepository.getOpenPullRequests(
      Array.from(
        new Set([
          ...awaitingQualityCheckIssues
            .filter(willBeEvaluated)
            .flatMap(
              (issue) => relatedOpenPrUrlsByIssueUrl.get(issue.url) ?? [],
            ),
          ...unreadPullRequests
            .filter(willBeEvaluated)
            .map((pullRequest) => pullRequest.url),
        ]),
      ),
    );

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
            labelsNotRequiringPullRequest,
            {
              relatedOpenPrUrls:
                relatedOpenPrUrlsByIssueUrl.get(issue.url) ?? null,
              resolvedOpenPrByUrl,
            },
          );
        if (
          rejections.length === 1 &&
          rejections[0].type === 'PULL_REQUEST_NOT_FOUND' &&
          isPullRequestDeclaredUnnecessary(
            await this.issueCommentRepository.getCommentsFromIssue(issue),
            (author) =>
              isAuthorAuthorizedForAutoStatusCheck(author, allowedIssueAuthors),
          )
        ) {
          continue;
        }
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
            if (isPermissionError(error)) {
              console.warn(
                `RevertNotReadyReviewQueueIssueUseCase: permission denied for UpdateProjectV2ItemFieldValue, skipping revert. issueUrl: ${issue.url}`,
              );
              permissionErrorItems.push(issue.url);
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
          labelsNotRequiringPullRequest,
          { resolvedOpenPrByUrl },
        );
        if (rejections.length > 0) {
          if (!pullRequest.assignees.includes(params.manager)) {
            continue;
          }
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
            if (isPermissionError(error)) {
              console.warn(
                `RevertNotReadyReviewQueueIssueUseCase: permission denied for UpdateProjectV2ItemFieldValue, skipping revert. prUrl: ${pullRequest.url}`,
              );
              permissionErrorItems.push(pullRequest.url);
              continue;
            }
            throw error;
          }
          if (projectStory) {
            try {
              await this.issueRepository.updateStory(
                { ...project, story: projectStory },
                pullRequest,
                projectStory.workflowManagementStory.id,
              );
            } catch (error) {
              if (isPermissionError(error)) {
                console.warn(
                  `RevertNotReadyReviewQueueIssueUseCase: permission denied for UpdateProjectV2ItemFieldValue on updateStory, skipping. prUrl: ${pullRequest.url}`,
                );
                permissionErrorItems.push(pullRequest.url);
                continue;
              }
              throw error;
            }
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

    if (permissionErrorItems.length > 0) {
      throw new Error(
        `UpdateProjectV2ItemFieldValue permission denied for ${permissionErrorItems.length} item(s): ${permissionErrorItems.join(', ')}`,
      );
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
