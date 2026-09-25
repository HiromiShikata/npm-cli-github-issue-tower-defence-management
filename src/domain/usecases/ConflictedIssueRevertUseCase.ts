import { Issue } from '../entities/Issue';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { IssueCommentRepository } from './adapter-interfaces/IssueCommentRepository';
import {
  AWAITING_OWNER_STATUS_NAME,
  AWAITING_WORKSPACE_STATUS_NAME,
  FAILED_PREPARATION_STATUS_NAME,
} from '../entities/WorkflowStatus';
import { isAuthorAuthorizedForAutoStatusCheck } from './isAuthorAuthorizedForAutoStatusCheck';
import { extractNextStepAgentFromComments } from './extractNextStepAgentFromComments';
import {
  DEFAULT_THRESHOLD_FOR_DISPATCH_LOOP,
  resolveNextStepAgentDispatchRepetition,
} from './resolveNextStepAgentDispatchRepetition';
import { isDuplicateWithinWindow } from '../services/commentDeduplication';
import {
  AUTO_STATUS_CHECK_CI_FAILURE_MESSAGE,
  AUTO_STATUS_CHECK_CONFLICT_MESSAGE,
} from './autoStatusCheckComments';

export class ConflictedIssueRevertUseCase {
  constructor(
    private readonly projectRepository: Pick<
      ProjectRepository,
      'findProjectIdByUrl' | 'getProject'
    >,
    private readonly issueRepository: Pick<
      IssueRepository,
      'getAllIssues' | 'getOpenPullRequests' | 'updateStatus' | 'updateBranch'
    >,
    private readonly issueCommentRepository: Pick<
      IssueCommentRepository,
      'getCommentsFromIssue' | 'createComment'
    >,
  ) {}

  run = async (params: {
    projectUrl: string;
    allowedIssueAuthors?: string[] | null;
    thresholdForAutoReject?: number;
    thresholdForDispatchLoop?: number;
  }): Promise<void> => {
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

    const failedPreparationStatusOption = project.status.statuses.find(
      (s) => s.name === FAILED_PREPARATION_STATUS_NAME,
    );
    if (!failedPreparationStatusOption) {
      console.error(
        `Failed preparation status option '${FAILED_PREPARATION_STATUS_NAME}' not found in project. projectUrl: ${params.projectUrl}`,
      );
      return;
    }

    const { issues } = await this.issueRepository.getAllIssues(projectId);

    const targetIssues = issues.filter(
      (issue) => !issue.isPr && issue.status === AWAITING_OWNER_STATUS_NAME,
    );

    const relatedOpenPrUrlsByIssueUrl =
      this.buildRelatedOpenPrUrlsByIssueUrl(issues);

    const allPrUrls = Array.from(
      new Set(
        targetIssues.flatMap(
          (issue) => relatedOpenPrUrlsByIssueUrl.get(issue.url) ?? [],
        ),
      ),
    );

    if (allPrUrls.length === 0) {
      return;
    }

    const resolvedPrByUrl =
      await this.issueRepository.getOpenPullRequests(allPrUrls);

    for (const issue of targetIssues) {
      const prUrls = relatedOpenPrUrlsByIssueUrl.get(issue.url) ?? [];
      if (prUrls.length === 0) {
        continue;
      }

      const relatedPrs = prUrls
        .map((url) => resolvedPrByUrl.get(url) ?? null)
        .filter((pr): pr is NonNullable<typeof pr> => pr !== null);

      const hasUnknownMergeable = relatedPrs.some(
        (pr) => pr.mergeable === 'UNKNOWN',
      );
      if (hasUnknownMergeable) {
        continue;
      }

      const conflictedPrs = relatedPrs.filter((pr) => pr.isConflicted);
      const ciFailingPrs = relatedPrs.filter(
        (pr) => !pr.isConflicted && pr.isCiFailing === true,
      );
      if (conflictedPrs.length === 0 && ciFailingPrs.length === 0) {
        continue;
      }

      let hasUnresolvedConflict = false;
      if (conflictedPrs.length > 0) {
        const allBranchesUpdated = (
          await Promise.all(
            conflictedPrs.map((pr) =>
              this.issueRepository.updateBranch(pr.url),
            ),
          )
        ).every(Boolean);
        hasUnresolvedConflict = !allBranchesUpdated;
      }
      const hasCiFailure = ciFailingPrs.length > 0;
      if (!hasUnresolvedConflict && !hasCiFailure) {
        continue;
      }
      const commentMessage = hasUnresolvedConflict
        ? AUTO_STATUS_CHECK_CONFLICT_MESSAGE
        : AUTO_STATUS_CHECK_CI_FAILURE_MESSAGE;

      const existingComments =
        await this.issueCommentRepository.getCommentsFromIssue(issue);
      if (params.thresholdForAutoReject !== undefined) {
        const nextStepAgent = extractNextStepAgentFromComments(
          existingComments,
          (author) =>
            isAuthorAuthorizedForAutoStatusCheck(
              author,
              params.allowedIssueAuthors,
            ),
        );
        if (nextStepAgent !== null) {
          const repetition = resolveNextStepAgentDispatchRepetition({
            agentFieldValue: issue.agent,
            nextStepAgent,
            currentDispatchHasNoReportRejection: false,
            comments: existingComments,
            isTrustedAuthor: (author) =>
              isAuthorAuthorizedForAutoStatusCheck(
                author,
                params.allowedIssueAuthors,
              ),
            thresholdForAutoReject: params.thresholdForAutoReject,
            thresholdForDispatchLoop:
              params.thresholdForDispatchLoop ??
              DEFAULT_THRESHOLD_FOR_DISPATCH_LOOP,
            isNoStory: false,
          });
          if (repetition.type === 'escalateSilentRedispatch') {
            await this.issueRepository.updateStatus(
              project,
              issue,
              failedPreparationStatusOption.id,
            );
            await this.issueCommentRepository.createComment(
              issue,
              repetition.comment,
            );
            continue;
          }
          if (
            repetition.type === 'escalateReportingLoop' ||
            repetition.type === 'escalateDispatchLoop'
          ) {
            await this.issueRepository.updateStatus(
              project,
              issue,
              failedPreparationStatusOption.id,
            );
            await this.issueCommentRepository.createComment(
              issue,
              repetition.comment,
            );
            continue;
          }
        }
      }
      await this.issueRepository.updateStatus(
        project,
        issue,
        awaitingWorkspaceStatusOption.id,
      );
      if (
        isDuplicateWithinWindow(
          commentMessage,
          existingComments.map((c) => ({
            text: c.content,
            createdAt: c.createdAt,
          })),
          new Date(),
        )
      ) {
        continue;
      }
      try {
        await this.issueCommentRepository.createComment(issue, commentMessage);
      } catch (error) {
        console.error(
          `Failed to post conflict comment on ${issue.url}: ${String(error)}`,
        );
      }
    }
  };

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
