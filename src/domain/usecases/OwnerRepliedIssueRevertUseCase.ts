import { Comment } from '../entities/Comment';
import { Issue } from '../entities/Issue';
import { Project } from '../entities/Project';
import {
  AWAITING_OWNER_STATUS_NAME,
  AWAITING_WORKSPACE_STATUS_NAME,
} from '../entities/WorkflowStatus';
import { IssueCommentRepository } from './adapter-interfaces/IssueCommentRepository';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { isAgentReportBody } from './isAgentReportBody';
import { isAuthorAuthorizedForAutoStatusCheck } from './isAuthorAuthorizedForAutoStatusCheck';
import { isHumanComment } from './isHumanComment';
import { issueSnapshotStalenessCheck } from './issueSnapshotStalenessCheck';

const AGENT_COMMENT_PREFIX = 'From: :robot: ';

type TrustedAuthorCheck = (author: string) => boolean;

const isAgentComment = (
  comment: Comment,
  isTrustedAuthor: TrustedAuthorCheck,
): boolean =>
  isTrustedAuthor(comment.author) &&
  (comment.content.trimStart().startsWith(AGENT_COMMENT_PREFIX) ||
    isAgentReportBody(comment.content));

const isOwnerReply = (
  comment: Comment,
  isTrustedAuthor: TrustedAuthorCheck,
): boolean =>
  isTrustedAuthor(comment.author) &&
  !isAgentComment(comment, isTrustedAuthor) &&
  isHumanComment(comment, isTrustedAuthor);

const hasOwnerReplyAfterNewestAgentComment = (
  comments: Comment[],
  isTrustedAuthor: TrustedAuthorCheck,
): boolean => {
  const newestAgentComment = comments
    .filter((comment) => isAgentComment(comment, isTrustedAuthor))
    .reduce<Comment | null>(
      (newest, comment) =>
        newest === null ||
        comment.createdAt.getTime() > newest.createdAt.getTime()
          ? comment
          : newest,
      null,
    );
  if (newestAgentComment === null) {
    return false;
  }
  return comments.some(
    (comment) =>
      isOwnerReply(comment, isTrustedAuthor) &&
      comment.createdAt.getTime() > newestAgentComment.createdAt.getTime(),
  );
};

export class OwnerRepliedIssueRevertUseCase {
  constructor(
    readonly issueRepository: Pick<
      IssueRepository,
      'updateStatus' | 'get' | 'removeIssueFromProjectCache'
    >,
    readonly issueCommentRepository: Pick<
      IssueCommentRepository,
      'getCommentsFromIssue'
    >,
  ) {}

  run = async (params: {
    project: Project;
    issues: Issue[];
    allowedIssueAuthors?: string[] | null;
  }): Promise<void> => {
    const { project, allowedIssueAuthors } = params;
    const awaitingWorkspaceStatusOption = project.status.statuses.find(
      (statusOption) => statusOption.name === AWAITING_WORKSPACE_STATUS_NAME,
    );
    if (!awaitingWorkspaceStatusOption) {
      console.error(
        `OwnerRepliedIssueRevertUseCase: status option '${AWAITING_WORKSPACE_STATUS_NAME}' not found in project ${project.url}.`,
      );
      return;
    }
    if (!allowedIssueAuthors || allowedIssueAuthors.length === 0) {
      return;
    }
    const isTrustedAuthor: TrustedAuthorCheck = (author) =>
      isAuthorAuthorizedForAutoStatusCheck(author, allowedIssueAuthors);

    const awaitingOwnerIssues = params.issues.filter(
      (issue) =>
        issue.status === AWAITING_OWNER_STATUS_NAME &&
        !issue.isPr &&
        !issue.isClosed,
    );

    const failures: { issueUrl: string; error: unknown }[] = [];
    for (const issue of awaitingOwnerIssues) {
      try {
        const comments =
          await this.issueCommentRepository.getCommentsFromIssue(issue);
        if (!hasOwnerReplyAfterNewestAgentComment(comments, isTrustedAuthor)) {
          continue;
        }
        const staleness = await issueSnapshotStalenessCheck({
          issueRepository: this.issueRepository,
          project,
          snapshotIssue: issue,
          checkedFieldNames: ['status'],
          skippedWriteDescription: `the ${AWAITING_WORKSPACE_STATUS_NAME} Status write of an ${AWAITING_OWNER_STATUS_NAME} item the owner replied to`,
        });
        if (staleness.type !== 'current') {
          continue;
        }
        await this.issueRepository.updateStatus(
          project,
          issue,
          awaitingWorkspaceStatusOption.id,
        );
      } catch (error) {
        failures.push({ issueUrl: issue.url, error });
      }
    }
    if (failures.length > 0) {
      const failureDescriptions = failures.map(
        (failure) =>
          `${failure.issueUrl} (${failure.error instanceof Error ? failure.error.message : String(failure.error)})`,
      );
      throw new AggregateError(
        failures.map((failure) => failure.error),
        `OwnerRepliedIssueRevertUseCase: failed to check or revert ${failures.length} ${AWAITING_OWNER_STATUS_NAME} issue(s) for an owner reply: ${failureDescriptions.join(', ')}`,
      );
    }
  };
}
