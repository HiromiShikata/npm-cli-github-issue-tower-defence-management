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

export const findLastAgentReportPostedSince = <
  Comment extends { author: string; content: string; createdAt: Date },
>(
  comments: Comment[],
  isTrustedAuthor: (author: string) => boolean,
  postedSince: Date | null,
): Comment | null =>
  findLastAgentReport(
    postedSince === null
      ? comments
      : comments.filter((comment) => comment.createdAt >= postedSince),
    isTrustedAuthor,
  );
