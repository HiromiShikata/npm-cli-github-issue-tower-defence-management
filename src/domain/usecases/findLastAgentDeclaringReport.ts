import { AGENT_REPORT_PREFIX } from './agentReportPrefix';
import { extractNextStepAgent } from './extractNextStepAgent';
import { hasReportJsonBlock } from './hasReportJsonBlock';

export const findLastAgentDeclaringReport = <
  Comment extends { author: string; content: string },
>(
  comments: Comment[],
  isTrustedAuthor: (author: string) => boolean,
): Comment | null => {
  const lastReport =
    [...comments]
      .reverse()
      .find(
        (comment) =>
          isTrustedAuthor(comment.author) &&
          comment.content.startsWith(AGENT_REPORT_PREFIX) &&
          hasReportJsonBlock(comment.content),
      ) ?? null;
  if (lastReport === null) {
    return null;
  }
  return extractNextStepAgent(lastReport.content) === null ? null : lastReport;
};
