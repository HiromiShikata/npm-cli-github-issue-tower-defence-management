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
  Comment extends {
    author: string;
    content: string;
    createdAt: Date;
    updatedAt: Date;
  },
>(
  comments: Comment[],
  isTrustedAuthor: (author: string) => boolean,
  postedSince: Date | null,
): Comment | null => {
  if (postedSince === null) {
    return findLastAgentReport(comments, isTrustedAuthor);
  }
  return (
    comments
      .filter((comment) => comment.updatedAt >= postedSince)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .find(
        (comment) =>
          isTrustedAuthor(comment.author) && isAgentReportBody(comment.content),
      ) ?? null
  );
};
