import { Comment } from '../entities/Comment';
import { isAgentReportBody } from './isAgentReportBody';

const AGENT_COMMENT_PREFIX = 'From: :robot: ';

export type TrustedAuthorCheck = (author: string) => boolean;

export const isAgentComment = (
  comment: Comment,
  isTrustedAuthor: TrustedAuthorCheck,
): boolean =>
  isTrustedAuthor(comment.author) &&
  (comment.content.trimStart().startsWith(AGENT_COMMENT_PREFIX) ||
    isAgentReportBody(comment.content));
