import { isAgentReportBody } from './isAgentReportBody';
import { normalizeReportBody } from './normalizeReportBody';

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
  const reportMatch = normalizeReportBody(lastComment.content).match(
    /```json\n([\s\S]*?)\n```/,
  );
  if (!reportMatch || reportMatch.length < 2) {
    return false;
  }
  let reportJson: unknown;
  try {
    reportJson = JSON.parse(reportMatch[1]);
  } catch (error) {
    console.warn(
      'Invalid JSON in report body while checking pullRequestRequired:',
      error,
    );
    return false;
  }
  if (typeof reportJson !== 'object' || reportJson === null) {
    return false;
  }
  const report: Record<string, unknown> = { ...reportJson };
  return report.pullRequestRequired === false;
};
