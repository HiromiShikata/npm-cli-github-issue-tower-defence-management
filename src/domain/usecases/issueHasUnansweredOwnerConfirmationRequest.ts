import { Comment } from '../entities/Comment';
import { extractNeedOwnerConfirmationOrApproval } from './extractNeedOwnerConfirmationOrApproval';
import { findLastAgentReport } from './findLastAgentReport';
import {
  isConsoleElapsedTimeCommentBody,
  stripConsoleElapsedTimeLine,
} from './consoleElapsedTimeComment';

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
  const lastNonElapsedComment = [...comments]
    .reverse()
    .find(
      (comment) =>
        !(
          isConsoleElapsedTimeCommentBody(comment.content) &&
          stripConsoleElapsedTimeLine(comment.content).trim() === ''
        ),
    );
  return lastNonElapsedComment === lastAgentReport;
};
