import { normalizeProjectFieldName } from '../entities/ProjectFieldName';
import { extractNextStepAgent } from './extractNextStepAgent';
import { AGENT_REPORT_PREFIX } from './agentReportPrefix';
import {
  isAgentReportBody,
  stripLeadingFencedBlocks,
} from './isAgentReportBody';
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

const isEscalationDispatchComment = (content: string): boolean =>
  content.includes('Owner judgment is required') ||
  content.includes('Failed to receive a report') ||
  content.includes('escalated for a decision');

type SilentRedispatch = { count: number; hasReportsInCycle: boolean };

const countSilentRedispatches = <
  CommentLike extends { author: string; content: string },
>(params: {
  agentFieldValue: string | null;
  nextStepAgent: string;
  comments: CommentLike[];
  isTrustedAuthor: (author: string) => boolean;
}): SilentRedispatch | null => {
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
  const lastEscalationIndex = commentsInCurrentCycle.reduce(
    (found, comment, index) =>
      params.isTrustedAuthor(comment.author) &&
      isSilentRedispatchCommentForAgent(
        comment.content,
        params.nextStepAgent,
      ) &&
      isEscalationDispatchComment(comment.content)
        ? index
        : found,
    -1,
  );
  const commentsAfterLastEscalation =
    lastEscalationIndex >= 0
      ? commentsInCurrentCycle.slice(lastEscalationIndex + 1)
      : commentsInCurrentCycle;
  const count =
    commentsAfterLastEscalation.filter(
      (comment) =>
        params.isTrustedAuthor(comment.author) &&
        isSilentRedispatchCommentForAgent(
          comment.content,
          params.nextStepAgent,
        ),
    ).length + 1;
  const hasReportsInCycle = commentsAfterLastEscalation.some((comment) => {
    if (!params.isTrustedAuthor(comment.author)) return false;
    const cleaned = stripLeadingFencedBlocks(comment.content);
    if (!cleaned.startsWith(AGENT_REPORT_PREFIX)) return false;
    const reportingAgent = cleaned
      .slice(AGENT_REPORT_PREFIX.length)
      .trimStart()
      .split(/[\n(]/)[0]
      .trim();
    return (
      normalizeProjectFieldName(reportingAgent) ===
      normalizeProjectFieldName(params.nextStepAgent)
    );
  });
  return { count, hasReportsInCycle };
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
  const lastEscalationCommentIndex = params.comments.reduce(
    (found, comment, index) =>
      params.isTrustedAuthor(comment.author) &&
      comment.content.startsWith(
        NEXT_STEP_AGENT_DISPATCH_REPEATED_MESSAGE_HEAD,
      ) &&
      isEscalationDispatchComment(comment.content)
        ? index
        : found,
    -1,
  );
  const cycleStart = Math.max(
    lastHumanCommentIndex,
    lastEscalationCommentIndex,
  );
  const reportsInCurrentCycle = params.comments
    .slice(cycleStart + 1)
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
    silentRedispatches.count >= params.thresholdForAutoReject
  ) {
    const comment = silentRedispatches.hasReportsInCycle
      ? `${NEXT_STEP_AGENT_DISPATCH_REPEATED_MESSAGE_HEAD} ${params.nextStepAgent}

The agent has been reporting every cycle but cannot advance — it has been dispatched ${params.thresholdForAutoReject} times since the last human comment without resolving the underlying blocker. Owner judgment is required to break the loop.`
      : `${NEXT_STEP_AGENT_DISPATCH_REPEATED_MESSAGE_HEAD} ${params.nextStepAgent}

Failed to receive a report from the dispatched agent for ${params.thresholdForAutoReject} consecutive dispatches since the last human comment. The agent may have crashed or stopped silently.`;
    return { type: 'escalateSilentRedispatch', comment };
  }
  const dispatchesInCycle = countDispatchesInCurrentCycle(params);
  if (dispatchesInCycle >= params.thresholdForDispatchLoop) {
    return {
      type: 'escalateDispatchLoop',
      comment: `${NEXT_STEP_AGENT_DISPATCH_REPEATED_MESSAGE_HEAD} ${params.nextStepAgent}

This agent has been dispatched ${params.thresholdForDispatchLoop} times since the last human comment on this issue and the task has not moved past it, so the issue is escalated for a decision instead of being dispatched again.`,
    };
  }
  if (silentRedispatches !== null && silentRedispatches.count > 1) {
    const comment = silentRedispatches.hasReportsInCycle
      ? `${NEXT_STEP_AGENT_DISPATCH_REPEATED_MESSAGE_HEAD} ${params.nextStepAgent}

The agent posted a report and nominated itself as the next step without resolving the blocker. Dispatching again (${silentRedispatches.count}/${params.thresholdForAutoReject}).`
      : `${NEXT_STEP_AGENT_DISPATCH_REPEATED_MESSAGE_HEAD} ${params.nextStepAgent}

No report has been received from the dispatched agent since the last human comment. Dispatching it again (${silentRedispatches.count}/${params.thresholdForAutoReject}).`;
    return { type: 'dispatchAgain', comment };
  }
  if (dispatchesInCycle > 1) {
    return {
      type: 'dispatchAgain',
      comment: `${NEXT_STEP_AGENT_DISPATCH_REPEATED_MESSAGE_HEAD} ${params.nextStepAgent}

The latest agent report names this agent as the next step and it has already been dispatched on this issue since the last human comment. Dispatching it again (${dispatchesInCycle}/${params.thresholdForDispatchLoop}).`,
    };
  }
  if (silentRedispatches !== null) {
    const comment = silentRedispatches.hasReportsInCycle
      ? `${NEXT_STEP_AGENT_DISPATCH_REPEATED_MESSAGE_HEAD} ${params.nextStepAgent}

The agent posted a report and nominated itself as the next step without resolving the blocker. Dispatching again (${silentRedispatches.count}/${params.thresholdForAutoReject}).`
      : `${NEXT_STEP_AGENT_DISPATCH_REPEATED_MESSAGE_HEAD} ${params.nextStepAgent}

No report has been received from the dispatched agent since the last human comment. Dispatching it again (${silentRedispatches.count}/${params.thresholdForAutoReject}).`;
    return { type: 'dispatchAgain', comment };
  }
  return { type: 'notRepeated' };
};
