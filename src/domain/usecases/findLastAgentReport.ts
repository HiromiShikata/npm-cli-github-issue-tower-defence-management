import { AGENT_REPORT_PREFIX } from './agentReportPrefix';

export const findLastAgentReport = <
  Comment extends { author: string; content: string },
>(
  comments: Comment[],
  isTrustedAuthor: (author: string) => boolean,
): Comment | null =>
  [...comments]
    .reverse()
    .find(
      (comment) =>
        isTrustedAuthor(comment.author) &&
        comment.content.startsWith(AGENT_REPORT_PREFIX),
    ) ?? null;
