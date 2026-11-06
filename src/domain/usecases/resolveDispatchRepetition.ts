import { normalizeProjectFieldName } from '../entities/ProjectFieldName';
import {
  AUTO_STATUS_CHECK_MESSAGE_HEAD,
  RATE_LIMIT_SESSION_END_MESSAGE,
  SESSION_INTERRUPTED_BEFORE_COMPLETION_MESSAGE,
} from './autoStatusCheckComments';
import { REACTIVATION_TRIGGER_COMMENT_HEAD } from './dependencyNotificationCommentHeads';
import {
  extractAgentNameFromReportBody,
  isAgentReportBody,
} from './isAgentReportBody';
import { isHumanComment } from './isHumanComment';

export const NO_REPORT_REDISPATCH_COUNT_PREFIX = `${AUTO_STATUS_CHECK_MESSAGE_HEAD} NO_REPORT_AGAIN `;

export const SILENT_CRASH_ESCALATION_PHRASE =
  'The agent may have crashed or stopped silently';
export const REPORTING_LOOP_ESCALATION_PHRASE =
  'This task has been marked as Failed Preparation';
const REPORTING_LOOP_ESCALATION_PHRASE_LEGACY =
  'Owner judgment is required to break the loop';
export const DISPATCH_LOOP_ESCALATION_PHRASE =
  'the issue is escalated for a decision';
export const DEFAULT_THRESHOLD_FOR_DISPATCH_LOOP = 6;

export type DispatchRepetition =
  | { type: 'notRepeated' }
  | { type: 'dispatchAgain'; comment: string }
  | { type: 'escalateSilentRedispatch'; comment: string }
  | { type: 'escalateReportingLoop'; comment: string }
  | { type: 'escalateDispatchLoop'; comment: string }
  | { type: 'sessionInterruptedBeforeCompletion'; comment: string };

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
  CommentLike extends { author: string; content: string; createdAt: Date },
>(
  comments: CommentLike[],
  isTrustedAuthor: (author: string) => boolean,
): number =>
  comments.reduce(
    (found, comment, index) =>
      isHumanComment(comment, isTrustedAuthor) ? index : found,
    -1,
  );

const findReopenedEventBoundaryIndex = <
  CommentLike extends { author: string; content: string; createdAt: Date },
>(
  comments: CommentLike[],
  latestReopenedAt: Date | null,
): number =>
  latestReopenedAt === null
    ? -1
    : comments.reduce(
        (found, comment, index) =>
          comment.createdAt <= latestReopenedAt ? index : found,
        -1,
      );

const findRateLimitBoundaryIndex = <
  CommentLike extends { author: string; content: string; createdAt: Date },
>(
  comments: CommentLike[],
  isTrustedAuthor: (author: string) => boolean,
): number =>
  comments.reduce(
    (found, comment, index) =>
      isTrustedAuthor(comment.author) &&
      comment.content.startsWith(RATE_LIMIT_SESSION_END_MESSAGE)
        ? index
        : found,
    -1,
  );

const findSessionInterruptedBoundaryIndex = <
  CommentLike extends { author: string; content: string; createdAt: Date },
>(
  comments: CommentLike[],
  isTrustedAuthor: (author: string) => boolean,
): number =>
  comments.reduce(
    (found, comment, index) =>
      isTrustedAuthor(comment.author) &&
      comment.content.startsWith(SESSION_INTERRUPTED_BEFORE_COMPLETION_MESSAGE)
        ? index
        : found,
    -1,
  );

const resolveActiveRateLimitBoundaryIndex = <
  CommentLike extends { author: string; content: string; createdAt: Date },
>(params: {
  comments: CommentLike[];
  isTrustedAuthor: (author: string) => boolean;
  latestReopenedAt: Date | null;
}): number => {
  const rateLimitBoundaryIndex = findRateLimitBoundaryIndex(
    params.comments,
    params.isTrustedAuthor,
  );
  if (rateLimitBoundaryIndex === -1) {
    return -1;
  }
  const lastHumanCommentIndex = findLastHumanCommentIndex(
    params.comments,
    params.isTrustedAuthor,
  );
  const reopenedEventBoundaryIndex = findReopenedEventBoundaryIndex(
    params.comments,
    params.latestReopenedAt,
  );
  const mostRecentBoundaryIndex = Math.max(
    lastHumanCommentIndex,
    reopenedEventBoundaryIndex,
    rateLimitBoundaryIndex,
  );
  return rateLimitBoundaryIndex === mostRecentBoundaryIndex
    ? rateLimitBoundaryIndex
    : -1;
};

const isRateLimitSilentFailureExclusionActive = <
  CommentLike extends { author: string; content: string; createdAt: Date },
>(params: {
  comments: CommentLike[];
  isTrustedAuthor: (author: string) => boolean;
  latestReopenedAt: Date | null;
  targetAgentName: string | null;
}): boolean => {
  const activeRateLimitBoundaryIndex = resolveActiveRateLimitBoundaryIndex({
    comments: params.comments,
    isTrustedAuthor: params.isTrustedAuthor,
    latestReopenedAt: params.latestReopenedAt,
  });
  if (activeRateLimitBoundaryIndex === -1) {
    return false;
  }
  const hasAgentResponseSinceRateLimitBoundary = params.comments
    .slice(activeRateLimitBoundaryIndex + 1)
    .some((comment) => {
      if (!params.isTrustedAuthor(comment.author)) {
        return false;
      }
      if (!isAgentReportBody(comment.content)) {
        return false;
      }
      const reportAgentName = extractAgentNameFromReportBody(comment.content);
      if (reportAgentName === null) {
        return true;
      }
      return (
        params.targetAgentName !== null &&
        normalizeProjectFieldName(reportAgentName) ===
          normalizeProjectFieldName(params.targetAgentName)
      );
    });
  return !hasAgentResponseSinceRateLimitBoundary;
};

export const countConsecutiveNoReportDispatches = <
  CommentLike extends { author: string; content: string; createdAt: Date },
>(params: {
  comments: CommentLike[];
  isTrustedAuthor: (author: string) => boolean;
  latestReopenedAt?: Date | null;
  agentFieldValue: string | null;
}): number => {
  const lastHumanCommentIndex = findLastHumanCommentIndex(
    params.comments,
    params.isTrustedAuthor,
  );
  const lastAgentReportIndex = params.comments.reduce(
    (found, comment, index) => {
      if (!params.isTrustedAuthor(comment.author)) {
        return found;
      }
      if (!isAgentReportBody(comment.content)) {
        return found;
      }
      const reportAgentName = extractAgentNameFromReportBody(comment.content);
      if (reportAgentName === null) {
        return index;
      }
      if (
        params.agentFieldValue === null ||
        normalizeProjectFieldName(reportAgentName) !==
          normalizeProjectFieldName(params.agentFieldValue)
      ) {
        return found;
      }
      return index;
    },
    -1,
  );
  const reopenedEventBoundaryIndex = findReopenedEventBoundaryIndex(
    params.comments,
    params.latestReopenedAt ?? null,
  );
  const rateLimitBoundaryIndex = findRateLimitBoundaryIndex(
    params.comments,
    params.isTrustedAuthor,
  );
  const cycleStart = Math.max(
    lastHumanCommentIndex,
    lastAgentReportIndex,
    reopenedEventBoundaryIndex,
    rateLimitBoundaryIndex,
  );
  return params.comments
    .slice(cycleStart + 1)
    .filter(
      (c) =>
        params.isTrustedAuthor(c.author) &&
        c.content.startsWith(NO_REPORT_REDISPATCH_COUNT_PREFIX),
    ).length;
};

const isSilentRedispatchCommentForAgent = (
  content: string,
  targetAgentName: string,
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
    normalizeProjectFieldName(targetAgentName)
  );
};

const isEscalationDispatchComment = (content: string): boolean =>
  content.includes(REPORTING_LOOP_ESCALATION_PHRASE) ||
  content.includes(REPORTING_LOOP_ESCALATION_PHRASE_LEGACY) ||
  content.includes(SILENT_CRASH_ESCALATION_PHRASE) ||
  content.includes(DISPATCH_LOOP_ESCALATION_PHRASE);

const countSilentRedispatches = <
  CommentLike extends { author: string; content: string; createdAt: Date },
>(params: {
  agentFieldValue: string | null;
  targetAgentName: string | null;
  comments: CommentLike[];
  isTrustedAuthor: (author: string) => boolean;
  latestReopenedAt: Date | null;
}): SilentRedispatch | null => {
  if (params.targetAgentName === null) {
    return null;
  }
  const targetAgentName = params.targetAgentName;
  if (
    params.agentFieldValue === null ||
    normalizeProjectFieldName(params.agentFieldValue) !==
      normalizeProjectFieldName(targetAgentName)
  ) {
    return null;
  }
  const lastHumanCommentIndex = findLastHumanCommentIndex(
    params.comments,
    params.isTrustedAuthor,
  );
  const reopenedEventBoundaryIndex = findReopenedEventBoundaryIndex(
    params.comments,
    params.latestReopenedAt,
  );
  const rateLimitBoundaryIndex = findRateLimitBoundaryIndex(
    params.comments,
    params.isTrustedAuthor,
  );
  const cycleStart = Math.max(
    lastHumanCommentIndex,
    reopenedEventBoundaryIndex,
    rateLimitBoundaryIndex,
  );
  const commentsInCurrentCycle = params.comments.slice(cycleStart + 1);
  const lastEscalationIndex = commentsInCurrentCycle.reduce(
    (found, comment, index) =>
      params.isTrustedAuthor(comment.author) &&
      isSilentRedispatchCommentForAgent(comment.content, targetAgentName) &&
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
        isSilentRedispatchCommentForAgent(comment.content, targetAgentName),
    ).length + 1;
  const firstRedispatchIndex = commentsAfterLastEscalation.findIndex(
    (comment) =>
      params.isTrustedAuthor(comment.author) &&
      isSilentRedispatchCommentForAgent(comment.content, targetAgentName),
  );
  const hasReportsAfterFirstRedispatch =
    firstRedispatchIndex >= 0 &&
    commentsAfterLastEscalation
      .slice(firstRedispatchIndex + 1)
      .some((comment) => {
        if (!params.isTrustedAuthor(comment.author)) {
          return false;
        }
        if (!isAgentReportBody(comment.content)) {
          return false;
        }
        const reportAgentName = extractAgentNameFromReportBody(comment.content);
        if (reportAgentName === null) {
          return true;
        }
        return (
          normalizeProjectFieldName(reportAgentName) ===
          normalizeProjectFieldName(targetAgentName)
        );
      });
  const agentSelfReported =
    firstRedispatchIndex === -1 &&
    ((): boolean => {
      const lastReport =
        [...commentsAfterLastEscalation]
          .reverse()
          .find(
            (comment) =>
              params.isTrustedAuthor(comment.author) &&
              isAgentReportBody(comment.content),
          ) ?? null;
      if (lastReport === null) return false;
      const reportAgentName = extractAgentNameFromReportBody(
        lastReport.content,
      );
      return (
        reportAgentName !== null &&
        normalizeProjectFieldName(reportAgentName) ===
          normalizeProjectFieldName(targetAgentName)
      );
    })();
  const hasReportsInCycle = agentSelfReported || hasReportsAfterFirstRedispatch;
  return { count, hasReportsInCycle };
};

const countDispatchesInCurrentCycle = <
  CommentLike extends { author: string; content: string; createdAt: Date },
>(params: {
  agentFieldValue: string | null;
  comments: CommentLike[];
  isTrustedAuthor: (author: string) => boolean;
  latestReopenedAt: Date | null;
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
  const lastReactivationTriggerConfirmationIndex = params.comments.reduce(
    (found, comment, index) =>
      params.isTrustedAuthor(comment.author) &&
      comment.content.startsWith(REACTIVATION_TRIGGER_COMMENT_HEAD)
        ? index
        : found,
    -1,
  );
  const reopenedEventBoundaryIndex = findReopenedEventBoundaryIndex(
    params.comments,
    params.latestReopenedAt,
  );
  const sessionInterruptedBoundaryIndex = findSessionInterruptedBoundaryIndex(
    params.comments,
    params.isTrustedAuthor,
  );
  const cycleStart = Math.max(
    lastHumanCommentIndex,
    lastEscalationCommentIndex,
    lastReactivationTriggerConfirmationIndex,
    reopenedEventBoundaryIndex,
    sessionInterruptedBoundaryIndex,
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
      if (params.agentFieldValue === null) {
        return true;
      }
      const reportAgentName = extractAgentNameFromReportBody(comment.content);
      if (reportAgentName === null) {
        return true;
      }
      return (
        normalizeProjectFieldName(reportAgentName) ===
        normalizeProjectFieldName(params.agentFieldValue)
      );
    }).length + 1
  );
};

export const resolveDispatchRepetition = <
  CommentLike extends { author: string; content: string; createdAt: Date },
>(params: {
  agentFieldValue: string | null;
  currentDispatchHasNoReportRejection: boolean;
  comments: CommentLike[];
  isTrustedAuthor: (author: string) => boolean;
  thresholdForAutoReject: number;
  thresholdForDispatchLoop: number;
  dependedIssueUrls: string[];
  latestReopenedAt?: Date | null;
  sessionEndedWithoutCompletingTurn?: boolean;
}): DispatchRepetition => {
  if (params.dependedIssueUrls.length > 0) {
    return { type: 'notRepeated' };
  }
  const effectiveAgentName = params.currentDispatchHasNoReportRejection
    ? params.agentFieldValue
    : null;
  const isSelfReference =
    effectiveAgentName !== null &&
    params.agentFieldValue !== null &&
    normalizeProjectFieldName(params.agentFieldValue) ===
      normalizeProjectFieldName(effectiveAgentName);
  const silentRedispatches = countSilentRedispatches({
    ...params,
    targetAgentName: effectiveAgentName,
    latestReopenedAt: params.latestReopenedAt ?? null,
  });
  if (
    silentRedispatches !== null &&
    silentRedispatches.count >= params.thresholdForAutoReject
  ) {
    if (silentRedispatches.hasReportsInCycle) {
      return {
        type: 'escalateReportingLoop',
        comment: `${DISPATCH_REPETITION_PREFIX}${REPORTING_LOOP_ESCALATED_KEYWORD} ${effectiveAgentName}

The agent has been reporting every cycle but cannot advance — it has been dispatched ${params.thresholdForAutoReject} times since the last human comment without resolving the underlying blocker. ${REPORTING_LOOP_ESCALATION_PHRASE}.`,
      };
    }
    if (!silentRedispatches.hasReportsInCycle) {
      if (
        isRateLimitSilentFailureExclusionActive({
          comments: params.comments,
          isTrustedAuthor: params.isTrustedAuthor,
          latestReopenedAt: params.latestReopenedAt ?? null,
          targetAgentName: params.agentFieldValue,
        })
      ) {
        return {
          type: 'dispatchAgain',
          comment: `${DISPATCH_REPETITION_PREFIX}${DISPATCH_AGAIN_KEYWORD} ${effectiveAgentName}

No report has been received from the dispatched agent since the last human comment. Dispatching it again (${silentRedispatches.count}/${params.thresholdForAutoReject}).`,
        };
      }
      return {
        type: 'escalateSilentRedispatch',
        comment: `${DISPATCH_REPETITION_PREFIX}${SILENT_REDISPATCH_ESCALATED_KEYWORD} ${effectiveAgentName}

Failed to receive a report from the dispatched agent for ${params.thresholdForAutoReject} consecutive dispatches since the last human comment. ${SILENT_CRASH_ESCALATION_PHRASE}.`,
      };
    }
  }
  if (
    params.sessionEndedWithoutCompletingTurn === true &&
    effectiveAgentName === null
  ) {
    return {
      type: 'sessionInterruptedBeforeCompletion',
      comment: SESSION_INTERRUPTED_BEFORE_COMPLETION_MESSAGE,
    };
  }
  const dispatchesInCycle = countDispatchesInCurrentCycle({
    ...params,
    latestReopenedAt: params.latestReopenedAt ?? null,
  });
  if (
    !isSelfReference &&
    dispatchesInCycle >= params.thresholdForDispatchLoop
  ) {
    const agentLabel = effectiveAgentName ?? '(no next-step agent)';
    const dispatchLoopBody =
      effectiveAgentName === null
        ? `This no-next-step-agent task has been dispatched ${params.thresholdForDispatchLoop} times since the last human comment without advancing, so ${DISPATCH_LOOP_ESCALATION_PHRASE} instead of being dispatched again.`
        : `This agent has been dispatched ${params.thresholdForDispatchLoop} times since the last human comment on this issue and the task has not moved past it, so ${DISPATCH_LOOP_ESCALATION_PHRASE} instead of being dispatched again.`;
    return {
      type: 'escalateDispatchLoop',
      comment: `${DISPATCH_REPETITION_PREFIX}${DISPATCH_LOOP_ESCALATED_KEYWORD} ${agentLabel}

${dispatchLoopBody}`,
    };
  }
  if (effectiveAgentName === null) {
    return { type: 'notRepeated' };
  }
  if (silentRedispatches !== null && silentRedispatches.count > 1) {
    const comment = silentRedispatches.hasReportsInCycle
      ? `${DISPATCH_REPETITION_PREFIX}${DISPATCH_AGAIN_KEYWORD} ${effectiveAgentName}

The agent completed its session with work remaining. Dispatching again (${silentRedispatches.count}/${params.thresholdForAutoReject}).`
      : `${DISPATCH_REPETITION_PREFIX}${DISPATCH_AGAIN_KEYWORD} ${effectiveAgentName}

No report has been received from the dispatched agent since the last human comment. Dispatching it again (${silentRedispatches.count}/${params.thresholdForAutoReject}).`;
    return { type: 'dispatchAgain', comment };
  }
  if (dispatchesInCycle > 1) {
    return {
      type: 'dispatchAgain',
      comment: `${DISPATCH_REPETITION_PREFIX}${DISPATCH_AGAIN_KEYWORD} ${effectiveAgentName}

This agent has already been dispatched on this issue since the last human comment. Dispatching it again (${dispatchesInCycle}/${params.thresholdForDispatchLoop}).`,
    };
  }
  if (silentRedispatches !== null) {
    const comment = silentRedispatches.hasReportsInCycle
      ? `${DISPATCH_REPETITION_PREFIX}${DISPATCH_AGAIN_KEYWORD} ${effectiveAgentName}

The agent completed its session with work remaining. Dispatching again (${silentRedispatches.count}/${params.thresholdForAutoReject}).`
      : `${DISPATCH_REPETITION_PREFIX}${DISPATCH_AGAIN_KEYWORD} ${effectiveAgentName}

No report has been received from the dispatched agent since the last human comment. Dispatching it again (${silentRedispatches.count}/${params.thresholdForAutoReject}).`;
    return { type: 'dispatchAgain', comment };
  }
  return { type: 'notRepeated' };
};
