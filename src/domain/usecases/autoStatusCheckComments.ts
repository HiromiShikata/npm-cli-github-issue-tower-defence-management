import { Comment } from '../entities/Comment';

export const AUTO_STATUS_CHECK_MESSAGE_HEAD = 'Auto Status Check:';
export const AUTO_STATUS_CHECK_CONFLICT_MESSAGE =
  'Auto Status Check: CONFLICT\nThis pull request has a merge conflict and has been returned to Awaiting Workspace.';
export const AUTO_STATUS_CHECK_CI_FAILURE_MESSAGE =
  "Auto Status Check: CI_FAILURE\nThis pull request's CI checks are failing and it has been returned to Awaiting Workspace.";
export const RATE_LIMIT_SESSION_END_MESSAGE =
  'Session ended due to API rate limit; returning to Awaiting Workspace without incrementing the consecutive-no-report counter.';
export const SESSION_INTERRUPTED_BEFORE_COMPLETION_MESSAGE =
  'Auto Status Check: SESSION_INTERRUPTED_BEFORE_COMPLETION (no next-step agent)\n' +
  "The prior dispatch's worker session ended before completing its turn, so this report is excluded from the consecutive-dispatch loop count.";
export const AUTO_STATUS_CHECK_HUMAN_AUTHORED_INVESTIGATION_TASK_MESSAGE =
  'Auto Status Check: HUMAN_AUTHORED_INVESTIGATION_TASK\n' +
  'This issue looks like a human-authored investigation or report request, so the requested close was skipped and the issue was routed to Awaiting Owner for the requester to review.';

export const isAutoStatusCheckComment = (content: string): boolean =>
  content.startsWith(AUTO_STATUS_CHECK_MESSAGE_HEAD);

export const findEffectiveLastComment = (
  comments: Comment[],
): Comment | null => {
  let index = comments.length - 1;
  while (index >= 0 && isAutoStatusCheckComment(comments[index].content)) {
    index -= 1;
  }
  return index >= 0 ? comments[index] : null;
};
