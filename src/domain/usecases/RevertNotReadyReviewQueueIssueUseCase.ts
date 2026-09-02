import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { buildRelatedOpenPrUrlsByIssueUrl } from './buildRelatedOpenPrUrlsByIssueUrl';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { IssueCommentRepository } from './adapter-interfaces/IssueCommentRepository';
import { IssueRejectionEvaluator } from './IssueRejectionEvaluator';
import { ChangeTargetPullRequestApprover } from './ChangeTargetPullRequestApprover';
import { resolveLabelsNotRequiringPullRequest } from './resolveLabelsNotRequiringPullRequest';
import { extractNextStepAgentFromComments } from './extractNextStepAgentFromComments';
import { isTriagerAgentName } from './triagerAgentName';
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
      buildRelatedOpenPrUrlsByIssueUrl(issues);

    const labelsNotRequiringPullRequest =
      resolveLabelsNotRequiringPullRequest(params);

    const resolvedOpenPrByUrl = await this.issueRepository.getOpenPullRequests(
      Array.from(
        new Set([
          ...awaitingQualityCheckIssues.flatMap(
            (issue) => relatedOpenPrUrlsByIssueUrl.get(issue.url) ?? [],
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
              relatedOpenPrUrls:
                relatedOpenPrUrlsByIssueUrl.get(issue.url) ?? null,
              resolvedOpenPrByUrl,
              developerAgentNames: params.developerAgentNames,
              detectConflictEvenIfEvaluationSkipped: true,
            },
          );
        if (
          rejections.length === 1 &&
          rejections[0].type === 'PULL_REQUEST_NOT_FOUND' &&
          isTriagerAgentName(
            extractNextStepAgentFromComments(
              await this.issueCommentRepository.getCommentsFromIssue(issue),
              (author) =>
                isAuthorAuthorizedForAutoStatusCheck(
                  author,
                  allowedIssueAuthors,
                ),
            ),
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
}
