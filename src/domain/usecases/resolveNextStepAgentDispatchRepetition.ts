import { normalizeProjectFieldName } from '../entities/ProjectFieldName';
import { extractNextStepAgent } from './extractNextStepAgent';
import { isAgentReportBody } from './isAgentReportBody';
import { isHumanComment } from './isHumanComment';
import { NEXT_STEP_AGENT_DISPATCH_REPEATED_MESSAGE_HEAD } from './nextStepAgentDispatchRepeatedMessage';

export { NEXT_STEP_AGENT_DISPATCH_REPEATED_MESSAGE_HEAD };

export const DEFAULT_THRESHOLD_FOR_DISPATCH_LOOP = 6;

export type NextStepAgentDispatchRepetition =
  | { type: 'notRepeated' }
  | { type: 'dispatchAgain'; comment: string }
  | { type: 'escalateSilentRedispatch'; comment: string }
  | { type: 'escalateDispatchLoop'; comment: string };

const findLastHumanCommentIndex = <
  CommentLike extends { author: string; content: string },
>(
  comments: CommentLike[],
  isTrustedAuthor: (author: string) => boolean,
): number =>
  comments.reduce(
    (found, comment, index) =>
      isHumanComment(comment, isTrustedAuthor) ? index : found,
    -1,
  );

const isSilentRedispatchCommentForAgent = (
  content: string,
  nextStepAgent: string,
): boolean => {
  if (!content.startsWith(NEXT_STEP_AGENT_DISPATCH_REPEATED_MESSAGE_HEAD)) {
    return false;
  }
  const agentNameInComment = content
    .slice(NEXT_STEP_AGENT_DISPATCH_REPEATED_MESSAGE_HEAD.length + 1)
    .split('\n')[0]
    .trim();
  return (
    normalizeProjectFieldName(agentNameInComment) ===
    normalizeProjectFieldName(nextStepAgent)
  );
};

const countSilentRedispatches = <
  CommentLike extends { author: string; content: string },
>(params: {
  agentFieldValue: string | null;
  nextStepAgent: string;
  comments: CommentLike[];
  isTrustedAuthor: (author: string) => boolean;
}): number | null => {
  if (
    params.agentFieldValue === null ||
    normalizeProjectFieldName(params.agentFieldValue) !==
      normalizeProjectFieldName(params.nextStepAgent)
  ) {
    return null;
  }
  const lastHumanCommentIndex = findLastHumanCommentIndex(
    params.comments,
    params.isTrustedAuthor,
  );
  const commentsInCurrentCycle = params.comments.slice(
    lastHumanCommentIndex + 1,
  );
  const lastAgentReportIndex = commentsInCurrentCycle.reduce(
    (found, comment, index) =>
      params.isTrustedAuthor(comment.author) &&
      isAgentReportBody(comment.content)
        ? index
        : found,
    -1,
  );
  const commentsAfterLastReport = commentsInCurrentCycle.slice(
    lastAgentReportIndex + 1,
  );
  return (
    commentsAfterLastReport.filter(
      (comment) =>
        params.isTrustedAuthor(comment.author) &&
        isSilentRedispatchCommentForAgent(
          comment.content,
          params.nextStepAgent,
        ),
    ).length + 1
  );
};

const countDispatchesInCurrentCycle = <
  CommentLike extends { author: string; content: string },
>(params: {
  nextStepAgent: string;
  comments: CommentLike[];
  isTrustedAuthor: (author: string) => boolean;
}): number => {
  const lastHumanCommentIndex = findLastHumanCommentIndex(
    params.comments,
    params.isTrustedAuthor,
  );
  const reportsInCurrentCycle = params.comments
    .slice(lastHumanCommentIndex + 1)
    .filter(
      (comment) =>
        params.isTrustedAuthor(comment.author) &&
        isAgentReportBody(comment.content),
    );
  return (
    reportsInCurrentCycle.slice(0, -1).filter((comment) => {
      const declared = extractNextStepAgent(comment.content);
      return (
        declared !== null &&
        normalizeProjectFieldName(declared) ===
          normalizeProjectFieldName(params.nextStepAgent)
      );
    }).length + 1
  );
};

export const resolveNextStepAgentDispatchRepetition = <
  CommentLike extends { author: string; content: string },
>(params: {
  agentFieldValue: string | null;
  nextStepAgent: string;
  comments: CommentLike[];
  isTrustedAuthor: (author: string) => boolean;
  thresholdForAutoReject: number;
  thresholdForDispatchLoop: number;
}): NextStepAgentDispatchRepetition => {
  const silentRedispatches = countSilentRedispatches(params);
  if (
    silentRedispatches !== null &&
    silentRedispatches >= params.thresholdForAutoReject
  ) {
    return {
      type: 'escalateSilentRedispatch',
      comment: `${NEXT_STEP_AGENT_DISPATCH_REPEATED_MESSAGE_HEAD} ${params.nextStepAgent}

Failed to receive a report from the dispatched agent for ${params.thresholdForAutoReject} times`,
    };
  }
  const dispatchesInCycle = countDispatchesInCurrentCycle(params);
  if (dispatchesInCycle >= params.thresholdForDispatchLoop) {
    return {
      type: 'escalateDispatchLoop',
      comment: `${NEXT_STEP_AGENT_DISPATCH_REPEATED_MESSAGE_HEAD} ${params.nextStepAgent}

This agent has been dispatched ${params.thresholdForDispatchLoop} times since the last human comment on this issue and the task has not moved past it, so the issue is escalated for a decision instead of being dispatched again.`,
    };
  }
  const silentRedispatchMessage = {
    type: 'dispatchAgain' as const,
    comment: `${NEXT_STEP_AGENT_DISPATCH_REPEATED_MESSAGE_HEAD} ${params.nextStepAgent}

The latest agent report names this agent as the next step and the agent field already holds it, so the previous dispatch to it ended without a report. Dispatching it again (${silentRedispatches}/${params.thresholdForAutoReject}).`,
  };
  if (silentRedispatches !== null && silentRedispatches > 1) {
    return silentRedispatchMessage;
  }
  if (dispatchesInCycle > 1) {
    return {
      type: 'dispatchAgain',
      comment: `${NEXT_STEP_AGENT_DISPATCH_REPEATED_MESSAGE_HEAD} ${params.nextStepAgent}

The latest agent report names this agent as the next step and it has already been dispatched on this issue since the last human comment. Dispatching it again (${dispatchesInCycle}/${params.thresholdForDispatchLoop}).`,
    };
  }
  if (silentRedispatches !== null) {
    return silentRedispatchMessage;
  }
  return { type: 'notRepeated' };
};
