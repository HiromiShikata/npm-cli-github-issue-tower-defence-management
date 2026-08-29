import { extractNextStepAgent } from './extractNextStepAgent';
import { findLastAgentReport } from './findLastAgentReport';

export const extractNextStepAgentFromComments = (
  comments: { author: string; content: string }[],
  isTrustedAuthor: (author: string) => boolean,
): string | null => {
  const lastAgentReport = findLastAgentReport(comments, isTrustedAuthor);
  if (!lastAgentReport) {
    return null;
  }
  return extractNextStepAgent(lastAgentReport.content);
};
