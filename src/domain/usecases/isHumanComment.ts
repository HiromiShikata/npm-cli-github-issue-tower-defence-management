import { AUTO_STATUS_CHECK_MESSAGE_HEAD } from './autoStatusCheckComments';
import { isAgentReportBody } from './isAgentReportBody';
import { NEXT_STEP_AGENT_DISPATCH_REPEATED_MESSAGE_HEAD } from './nextStepAgentDispatchRepeatedMessage';

const MACHINE_GENERATED_COMMENT_HEADS = [
  AUTO_STATUS_CHECK_MESSAGE_HEAD,
  NEXT_STEP_AGENT_DISPATCH_REPEATED_MESSAGE_HEAD,
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
