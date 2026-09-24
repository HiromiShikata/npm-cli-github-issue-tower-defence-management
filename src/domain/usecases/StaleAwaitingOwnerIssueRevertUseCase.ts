import { Issue } from '../entities/Issue';
import { Project } from '../entities/Project';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import {
  AWAITING_OWNER_STATUS_NAME,
  AWAITING_WORKSPACE_STATUS_NAME,
} from '../entities/WorkflowStatus';
import { isAgentReportBody } from './isAgentReportBody';
import { isAuthorAuthorizedForAutoStatusCheck } from './isAuthorAuthorizedForAutoStatusCheck';
import { extractNeedOwnerConfirmationOrApproval } from './extractNeedOwnerConfirmationOrApproval';
import { isDuplicateWithinWindow } from '../services/commentDeduplication';

export const DEFAULT_STALE_AWAITING_OWNER_THRESHOLD_MINUTES = 60;

const formatElapsed = (elapsedMinutes: number): string => {
  const hours = Math.floor(elapsedMinutes / 60);
  const minutes = Math.floor(elapsedMinutes % 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};

const buildRevertComment = (
  elapsedMinutes: number,
  lastAgentCommentBody: string,
  hadConfirmationRequest: boolean,
): string => {
  const elapsed = formatElapsed(elapsedMinutes);
  const agentContext = hadConfirmationRequest
    ? `The previous agent explicitly requested owner confirmation or approval. Content of the previous agent comment:`
    : `The previous agent comment (no explicit confirmation request, but status was Awaiting Owner):`;

  return [
    `Stale Awaiting Owner: auto-reverted to Awaiting Workspace after ${elapsed} with no owner response.`,
    ``,
    `**Previous agent question**`,
    agentContext,
    ``,
    lastAgentCommentBody
      .split('\n')
      .map((line) => `> ${line}`)
      .join('\n'),
    ``,
    `**Guidance for next agent**`,
    `Per \`story-gate-check\` criteria: reversible decisions — those undoable by a later pull request without external action — belong to the agent, not the owner.`,
    `Irreversible actions (contacting external parties, spending money, altering production in a way code cannot revert) still require the owner.`,
    `Proceed autonomously for reversible choices and record your reasoning in a comment.`,
  ].join('\n');
};

export class StaleAwaitingOwnerIssueRevertUseCase {
  constructor(
    private readonly issueRepository: Pick<
      IssueRepository,
      'updateStatus' | 'createCommentByUrl' | 'getIssueOrPullRequestComments'
    >,
  ) {}

  run = async (params: {
    project: Project;
    issues: Issue[];
    now: Date;
    staleThresholdMinutes: number;
    allowedIssueAuthors: string[] | null | undefined;
  }): Promise<number> => {
    const awaitingWorkspaceStatusOption = params.project.status.statuses.find(
      (s) => s.name === AWAITING_WORKSPACE_STATUS_NAME,
    );
    if (!awaitingWorkspaceStatusOption) {
      console.error(
        `Awaiting Workspace status option '${AWAITING_WORKSPACE_STATUS_NAME}' not found in project.`,
      );
      return 0;
    }

    const awaitingOwnerIssues = params.issues.filter(
      (issue) =>
        issue.status === AWAITING_OWNER_STATUS_NAME &&
        !issue.isClosed &&
        !issue.isPr,
    );

    let revertedCount = 0;
    const errors: unknown[] = [];

    for (const issue of awaitingOwnerIssues) {
      try {
        const reverted = await this.processIssue(
          issue,
          params.project,
          awaitingWorkspaceStatusOption.id,
          params.now,
          params.staleThresholdMinutes,
          params.allowedIssueAuthors,
        );
        if (reverted) {
          revertedCount++;
        }
      } catch (error) {
        errors.push(error);
      }
    }

    if (errors.length > 0) {
      throw new AggregateError(
        errors,
        `Failed to process ${errors.length} stale Awaiting Owner issue(s)`,
      );
    }

    return revertedCount;
  };

  private processIssue = async (
    issue: Issue,
    project: Project,
    awaitingWorkspaceStatusOptionId: string,
    now: Date,
    staleThresholdMinutes: number,
    allowedIssueAuthors: string[] | null | undefined,
  ): Promise<boolean> => {
    const comments =
      await this.issueRepository.getIssueOrPullRequestComments(issue.url);

    const reversedComments = [...comments].reverse();
    const lastAgentComment = reversedComments.find((comment) =>
      isAgentReportBody(comment.body),
    );

    if (!lastAgentComment) {
      return false;
    }

    const hasOwnerCommentAfterAgent = comments.some(
      (comment) =>
        isAuthorAuthorizedForAutoStatusCheck(
          comment.author,
          allowedIssueAuthors,
        ) && comment.createdAt > lastAgentComment.createdAt,
    );

    if (hasOwnerCommentAfterAgent) {
      return false;
    }

    const elapsedMs = now.getTime() - lastAgentComment.createdAt.getTime();
    const elapsedMinutes = elapsedMs / (1000 * 60);

    if (elapsedMinutes < staleThresholdMinutes) {
      return false;
    }

    const hadConfirmationRequest = extractNeedOwnerConfirmationOrApproval(
      lastAgentComment.body,
    );
    const commentBody = buildRevertComment(
      elapsedMinutes,
      lastAgentComment.body,
      hadConfirmationRequest,
    );

    if (
      isDuplicateWithinWindow(
        commentBody,
        comments.map((c) => ({ text: c.body, createdAt: c.createdAt })),
        now,
      )
    ) {
      return false;
    }

    await this.issueRepository.createCommentByUrl(issue.url, commentBody);
    await this.issueRepository.updateStatus(
      project,
      issue,
      awaitingWorkspaceStatusOptionId,
    );

    return true;
  };
}
