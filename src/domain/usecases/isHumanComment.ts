import { AUTO_STATUS_CHECK_MESSAGE_HEAD } from './autoStatusCheckComments';
import {
  ALL_DEPENDED_CLOSED_CLEARED_COMMENT_HEAD,
  ALL_DEPENDED_ICEBOX_CLEARED_COMMENT_HEAD,
  CIRCULAR_DEPENDENCY_REMOVED_COMMENT_HEAD,
  DEPENDENCY_REMOVED_COMMENT_HEAD,
  DEPENDED_ISSUE_URLS_COMMENT_HEAD,
  SOME_DEPENDED_CLOSED_REMOVED_COMMENT_HEAD,
  SOME_DEPENDED_ICEBOX_REMOVED_COMMENT_HEAD,
} from './dependencyNotificationCommentHeads';
import { isAgentReportBody } from './isAgentReportBody';

const LEGACY_DISPATCH_REPEATED_COMMENT_HEAD =
  'Next step agent dispatch repeated:';

const MACHINE_GENERATED_COMMENT_HEADS = [
  AUTO_STATUS_CHECK_MESSAGE_HEAD,
  LEGACY_DISPATCH_REPEATED_COMMENT_HEAD,
  DEPENDED_ISSUE_URLS_COMMENT_HEAD,
  ALL_DEPENDED_CLOSED_CLEARED_COMMENT_HEAD,
  SOME_DEPENDED_CLOSED_REMOVED_COMMENT_HEAD,
  ALL_DEPENDED_ICEBOX_CLEARED_COMMENT_HEAD,
  SOME_DEPENDED_ICEBOX_REMOVED_COMMENT_HEAD,
  DEPENDENCY_REMOVED_COMMENT_HEAD,
  CIRCULAR_DEPENDENCY_REMOVED_COMMENT_HEAD,
];

export const isHumanComment = (
  comment: { author: string; content: string },
  isTrustedAuthor: (author: string) => boolean,
): boolean => {
  if (!isTrustedAuthor(comment.author)) {
    return true;
  }
  if (isAgentReportBody(comment.content)) {
    return false;
  }
  return !MACHINE_GENERATED_COMMENT_HEADS.some((head) =>
    comment.content.startsWith(head),
  );
};
