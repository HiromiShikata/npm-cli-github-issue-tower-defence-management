import { Comment } from '../entities/Comment';
import { extractNeedOwnerConfirmationOrApproval } from './extractNeedOwnerConfirmationOrApproval';
import { findLastAgentReport } from './findLastAgentReport';
import { isHumanComment } from './isHumanComment';

export const issueHasUnansweredOwnerConfirmationRequest = (
  comments: Comment[],
  isTrustedAuthor: (author: string) => boolean,
): boolean => {
  const lastAgentReport = findLastAgentReport(comments, isTrustedAuthor);
  if (lastAgentReport === null) {
    return false;
  }
  if (!extractNeedOwnerConfirmationOrApproval(lastAgentReport.content)) {
    return false;
  }
  const hasReplyAfterReport = comments.some(
    (comment) =>
      comment.updatedAt.getTime() > lastAgentReport.updatedAt.getTime() &&
      isHumanComment(comment, isTrustedAuthor),
  );
  return !hasReplyAfterReport;
};
