import { extractFencedJsonBlocks } from './extractFencedJsonBlocks';
import { isAgentReportBody } from './isAgentReportBody';

export const isPullRequestDeclaredUnnecessary = (
  comments: { author: string; content: string }[],
  isTrustedAuthor: (author: string) => boolean,
): boolean => {
  const lastComment = comments[comments.length - 1];
  if (
    !lastComment ||
    !isTrustedAuthor(lastComment.author) ||
    !isAgentReportBody(lastComment.content)
  ) {
    return false;
  }
  for (const block of extractFencedJsonBlocks(
    lastComment.content,
    'pullRequestRequired',
  )) {
    if (typeof block !== 'object' || block === null) {
      continue;
    }
    const report: Record<string, unknown> = { ...block };
    if (report.pullRequestRequired === false) {
      return true;
    }
  }
  return false;
};
