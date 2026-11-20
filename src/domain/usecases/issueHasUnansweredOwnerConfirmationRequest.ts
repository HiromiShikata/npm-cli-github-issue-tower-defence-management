import { Comment } from '../entities/Comment';
import { extractNeedOwnerConfirmationOrApproval } from './extractNeedOwnerConfirmationOrApproval';
import { findLastAgentReport } from './findLastAgentReport';

export const issueHasUnansweredOwnerConfirmationRequest = (
  comments: Comment[],
  isTrustedAuthor: (author: string) => boolean,
  agentFieldValue: string | null,
): boolean => {
  const lastAgentReport = findLastAgentReport(
    comments,
    isTrustedAuthor,
    agentFieldValue,
  );
  if (lastAgentReport === null) {
    return false;
  }
  if (!extractNeedOwnerConfirmationOrApproval(lastAgentReport.content)) {
    return false;
  }
  return comments[comments.length - 1] === lastAgentReport;
};
