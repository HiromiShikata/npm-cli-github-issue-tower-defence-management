import { extractNextStepAgent } from './extractNextStepAgent';
import { findLastAgentReport } from './findLastAgentReport';

export const extractNextStepAgentFromComments = (
  comments: { author: string; content: string }[],
  isTrustedAuthor: (author: string) => boolean,
  agentFieldValue: string | null,
): string | null => {
  const lastAgentReport = findLastAgentReport(
    comments,
    isTrustedAuthor,
    agentFieldValue,
  );
  if (!lastAgentReport) {
    return null;
  }
  return extractNextStepAgent(lastAgentReport.content);
};
