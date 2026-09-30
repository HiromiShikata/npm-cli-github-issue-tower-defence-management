import { StoryGateIssueComment } from '../adapter-interfaces/StoryGateIssueRepository';

export const AGENT_REPORT_PREFIX = 'From: :robot:';
export const FOLD_MARKER_LINE = '## Fold';
export const AGENT_COMMENT_READ_LIMIT = 40;
export const COMMENT_HISTORY_FOLD_THRESHOLD = 40;

export type IssueCommentSplit = {
  ownerComments: StoryGateIssueComment[];
  agentCommentsNewestFirst: StoryGateIssueComment[];
  ownerCommentCount: number;
  agentCommentCountRead: number;
  agentCommentCountTotal: number;
};

export const isAgentReportBody = (body: string): boolean =>
  body.startsWith(AGENT_REPORT_PREFIX);

export const hasFoldMarkerLine = (body: string): boolean =>
  body.split('\n').some((line) => line.replace(/\r$/, '') === FOLD_MARKER_LINE);

export const issueCommentsAfterLatestFold = (
  comments: StoryGateIssueComment[],
): StoryGateIssueComment[] => {
  const latestFoldIndex = comments.reduce(
    (foundIndex, comment, index) =>
      hasFoldMarkerLine(comment.body) ? index : foundIndex,
    -1,
  );
  return comments.slice(latestFoldIndex + 1);
};

export const issueCommentsSplitByAuthorKind = (
  comments: StoryGateIssueComment[],
): IssueCommentSplit => {
  const ownerComments = comments.filter(
    (comment) => !isAgentReportBody(comment.body),
  );
  const agentCommentCountTotal = comments.length - ownerComments.length;
  const agentCommentsNewestFirst = issueCommentsAfterLatestFold(comments)
    .filter((comment) => isAgentReportBody(comment.body))
    .reverse()
    .slice(0, AGENT_COMMENT_READ_LIMIT);
  return {
    ownerComments,
    agentCommentsNewestFirst,
    ownerCommentCount: ownerComments.length,
    agentCommentCountRead: agentCommentsNewestFirst.length,
    agentCommentCountTotal,
  };
};

export const issueCommentsFormatAsText = (
  comments: StoryGateIssueComment[],
): string =>
  comments
    .map(
      (comment, index) =>
        `===== comment ${index + 1} of ${comments.length} created ${comment.createdAt} ${comment.url} =====\n${comment.body}\n`,
    )
    .join('\n');
