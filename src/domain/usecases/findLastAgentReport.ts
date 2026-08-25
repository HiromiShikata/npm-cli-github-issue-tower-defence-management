import { isAgentReportBody } from './isAgentReportBody';

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
        isTrustedAuthor(comment.author) && isAgentReportBody(comment.content),
    ) ?? null;
