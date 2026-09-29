import { Comment } from '../entities/Comment';

export const AUTO_STATUS_CHECK_MESSAGE_HEAD = 'Auto Status Check:';
export const AUTO_STATUS_CHECK_CONFLICT_MESSAGE =
  'Auto Status Check: CONFLICT\nThis pull request has a merge conflict and has been returned to Awaiting Workspace.';
export const AUTO_STATUS_CHECK_CI_FAILURE_MESSAGE =
  "Auto Status Check: CI_FAILURE\nThis pull request's CI checks are failing and it has been returned to Awaiting Workspace.";

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
