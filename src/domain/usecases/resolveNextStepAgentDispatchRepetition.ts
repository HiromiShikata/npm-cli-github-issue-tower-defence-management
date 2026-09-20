import { normalizeProjectFieldName } from '../entities/ProjectFieldName';
import { AUTO_STATUS_CHECK_MESSAGE_HEAD } from './autoStatusCheckComments';
import { extractNextStepAgent } from './extractNextStepAgent';
import { isAgentReportBody } from './isAgentReportBody';
import { isHumanComment } from './isHumanComment';

export const SILENT_CRASH_ESCALATION_PHRASE =
  'The agent may have crashed or stopped silently';
export const REPORTING_LOOP_ESCALATION_PHRASE =
  'This task has been marked as Failed Preparation';
const REPORTING_LOOP_ESCALATION_PHRASE_LEGACY =
  'Owner judgment is required to break the loop';
export const DISPATCH_LOOP_ESCALATION_PHRASE =
  'the issue is escalated for a decision';

export const DEFAULT_THRESHOLD_FOR_DISPATCH_LOOP = 6;

export type NextStepAgentDispatchRepetition =
  | { type: 'notRepeated' }
  | { type: 'dispatchAgain'; comment: string }
  | { type: 'escalateSilentRedispatch'; comment: string }
  | { type: 'escalateReportingLoop'; comment: string }
  | { type: 'escalateDispatchLoop'; comment: string }
  | { type: 'storyUnset'; comment: string };

type SilentRedispatch = { count: number; hasReportsInCycle: boolean };

const DISPATCH_REPETITION_PREFIX = `${AUTO_STATUS_CHECK_MESSAGE_HEAD} `;
const DISPATCH_AGAIN_KEYWORD = 'DISPATCH_AGAIN';
const SILENT_REDISPATCH_ESCALATED_KEYWORD = 'SILENT_REDISPATCH_ESCALATED';
const REPORTING_LOOP_ESCALATED_KEYWORD = 'REPORTING_LOOP_ESCALATED';
const DISPATCH_LOOP_ESCALATED_KEYWORD = 'DISPATCH_LOOP_ESCALATED';

const DISPATCH_REPETITION_KEYWORDS = new Set([
  DISPATCH_AGAIN_KEYWORD,
  SILENT_REDISPATCH_ESCALATED_KEYWORD,
  REPORTING_LOOP_ESCALATED_KEYWORD,
  DISPATCH_LOOP_ESCALATED_KEYWORD,
]);

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
  if (!content.startsWith(DISPATCH_REPETITION_PREFIX)) {
    return false;
  }
  const afterHead = content.slice(DISPATCH_REPETITION_PREFIX.length);
  const firstLine = afterHead.split('\n')[0];
  const parts = firstLine.split(' ');
  if (!DISPATCH_REPETITION_KEYWORDS.has(parts[0])) {
    return false;
  }
  const agentNameInComment = parts.slice(1).join(' ').trim();
  return (
    normalizeProjectFieldName(agentNameInComment) ===
    normalizeProjectFieldName(nextStepAgent)
  );
};

const isEscalationDispatchComment = (content: string): boolean =>
  content.includes(REPORTING_LOOP_ESCALATION_PHRASE) ||
  content.includes(REPORTING_LOOP_ESCALATION_PHRASE_LEGACY) ||
  content.includes(SILENT_CRASH_ESCALATION_PHRASE) ||
  content.includes(DISPATCH_LOOP_ESCALATION_PHRASE);

const countSilentRedispatches = <
  CommentLike extends { author: string; content: string },
>(params: {
  agentFieldValue: string | null;
  nextStepAgent: string | null;
  comments: CommentLike[];
  isTrustedAuthor: (author: string) => boolean;
}): SilentRedispatch | null => {
  if (params.nextStepAgent === null) {
    return null;
  }
  const nextStepAgent = params.nextStepAgent;
  if (
    params.agentFieldValue === null ||
    normalizeProjectFieldName(params.agentFieldValue) !==
      normalizeProjectFieldName(nextStepAgent)
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
      isSilentRedispatchCommentForAgent(comment.content, nextStepAgent) &&
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
        isSilentRedispatchCommentForAgent(comment.content, nextStepAgent),
    ).length + 1;
  const firstRedispatchIndex = commentsAfterLastEscalation.findIndex(
    (comment) =>
      params.isTrustedAuthor(comment.author) &&
      isSilentRedispatchCommentForAgent(comment.content, nextStepAgent),
  );
  const hasReportsInCycle =
    firstRedispatchIndex >= 0 &&
    commentsAfterLastEscalation
      .slice(firstRedispatchIndex + 1)
      .some(
        (comment) =>
          params.isTrustedAuthor(comment.author) &&
          isAgentReportBody(comment.content),
      );
  return { count, hasReportsInCycle };
};

const countDispatchesInCurrentCycle = <
  CommentLike extends { author: string; content: string },
>(params: {
  nextStepAgent: string | null;
  comments: CommentLike[];
  isTrustedAuthor: (author: string) => boolean;
}): number => {
  const lastHumanCommentIndex = findLastHumanCommentIndex(
    params.comments,
    params.isTrustedAuthor,
  );
  const lastEscalationCommentIndex = params.comments.reduce(
    (found, comment, index) => {
      if (!params.isTrustedAuthor(comment.author)) return found;
      if (!comment.content.startsWith(DISPATCH_REPETITION_PREFIX)) return found;
      const afterHead = comment.content.slice(
        DISPATCH_REPETITION_PREFIX.length,
      );
      const keyword = afterHead.split(/[ \n]/)[0];
      if (!DISPATCH_REPETITION_KEYWORDS.has(keyword)) return found;
      if (!isEscalationDispatchComment(comment.content)) return found;
      return index;
    },
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
      if (params.nextStepAgent === null) {
        return declared === null;
      }
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
  nextStepAgent: string | null;
  comments: CommentLike[];
  isTrustedAuthor: (author: string) => boolean;
  thresholdForAutoReject: number;
  thresholdForDispatchLoop: number;
  isNoStory: boolean;
}): NextStepAgentDispatchRepetition => {
  const isSelfReference =
    params.nextStepAgent !== null &&
    params.agentFieldValue !== null &&
    normalizeProjectFieldName(params.agentFieldValue) ===
      normalizeProjectFieldName(params.nextStepAgent);
  const silentRedispatches = countSilentRedispatches(params);
  if (params.isNoStory) {
    if (params.nextStepAgent !== null) {
      return {
        type: 'storyUnset',
        comment: `The story field is not set on this issue. The designated agent "${params.nextStepAgent}" cannot be started until a story is assigned; the default agent is being dispatched instead.`,
      };
    }
    return { type: 'notRepeated' };
  }
  if (
    silentRedispatches !== null &&
    silentRedispatches.count >= params.thresholdForAutoReject
  ) {
    if (silentRedispatches.hasReportsInCycle) {
      return {
        type: 'escalateReportingLoop',
        comment: `${DISPATCH_REPETITION_PREFIX}${REPORTING_LOOP_ESCALATED_KEYWORD} ${params.nextStepAgent}

The agent has been reporting every cycle but cannot advance — it has been dispatched ${params.thresholdForAutoReject} times since the last human comment without resolving the underlying blocker. ${REPORTING_LOOP_ESCALATION_PHRASE}.`,
      };
    }
    if (!silentRedispatches.hasReportsInCycle) {
      return {
        type: 'escalateSilentRedispatch',
        comment: `${DISPATCH_REPETITION_PREFIX}${SILENT_REDISPATCH_ESCALATED_KEYWORD} ${params.nextStepAgent}

Failed to receive a report from the dispatched agent for ${params.thresholdForAutoReject} consecutive dispatches since the last human comment. ${SILENT_CRASH_ESCALATION_PHRASE}.`,
      };
    }
  }
  const dispatchesInCycle = countDispatchesInCurrentCycle(params);
  if (
    !isSelfReference &&
    dispatchesInCycle >= params.thresholdForDispatchLoop
  ) {
    const agentLabel = params.nextStepAgent ?? '(no next-step agent)';
    const dispatchLoopBody =
      params.nextStepAgent === null
        ? `This no-next-step-agent task has been dispatched ${params.thresholdForDispatchLoop} times since the last human comment without advancing, so ${DISPATCH_LOOP_ESCALATION_PHRASE} instead of being dispatched again.`
        : `This agent has been dispatched ${params.thresholdForDispatchLoop} times since the last human comment on this issue and the task has not moved past it, so ${DISPATCH_LOOP_ESCALATION_PHRASE} instead of being dispatched again.`;
    return {
      type: 'escalateDispatchLoop',
      comment: `${DISPATCH_REPETITION_PREFIX}${DISPATCH_LOOP_ESCALATED_KEYWORD} ${agentLabel}

${dispatchLoopBody}`,
    };
  }
  if (params.nextStepAgent === null) {
    return { type: 'notRepeated' };
  }
  if (silentRedispatches !== null && silentRedispatches.count > 1) {
    return {
      type: 'dispatchAgain',
      comment: `${DISPATCH_REPETITION_PREFIX}${DISPATCH_AGAIN_KEYWORD} ${params.nextStepAgent}

No report has been received from the dispatched agent since the last human comment. Dispatching it again (${silentRedispatches.count}/${params.thresholdForAutoReject}).`,
    };
  }
  if (dispatchesInCycle > 1) {
    return {
      type: 'dispatchAgain',
      comment: `${DISPATCH_REPETITION_PREFIX}${DISPATCH_AGAIN_KEYWORD} ${params.nextStepAgent}

The latest agent report names this agent as the next step and it has already been dispatched on this issue since the last human comment. Dispatching it again (${dispatchesInCycle}/${params.thresholdForDispatchLoop}).`,
    };
  }
  if (silentRedispatches !== null) {
    const comment = silentRedispatches.hasReportsInCycle
      ? `${DISPATCH_REPETITION_PREFIX}${DISPATCH_AGAIN_KEYWORD} ${params.nextStepAgent}

The agent posted a report and nominated itself as the next step without resolving the blocker. Dispatching again (${silentRedispatches.count}/${params.thresholdForAutoReject}).`
      : `${DISPATCH_REPETITION_PREFIX}${DISPATCH_AGAIN_KEYWORD} ${params.nextStepAgent}

No report has been received from the dispatched agent since the last human comment. Dispatching it again (${silentRedispatches.count}/${params.thresholdForAutoReject}).`;
    return { type: 'dispatchAgain', comment };
  }
  return { type: 'notRepeated' };
};
