import { normalizeProjectFieldName } from '../entities/ProjectFieldName';

export const NEXT_STEP_AGENT_DISPATCH_REPEATED_MESSAGE_HEAD =
  'Next step agent dispatch repeated:';

export type NextStepAgentDispatchRepetition =
  | { type: 'notRepeated' }
  | { type: 'dispatchAgain'; comment: string }
  | { type: 'escalateToFailedPreparation'; comment: string };

export const resolveNextStepAgentDispatchRepetition = <
  CommentLike extends { author: string; content: string },
>(params: {
  agentFieldValue: string | null;
  nextStepAgent: string;
  commentsAfterLastAgentReport: CommentLike[];
  isTrustedAuthor: (author: string) => boolean;
  thresholdForAutoReject: number;
}): NextStepAgentDispatchRepetition => {
  if (
    params.agentFieldValue === null ||
    normalizeProjectFieldName(params.agentFieldValue) !==
      normalizeProjectFieldName(params.nextStepAgent)
  ) {
    return { type: 'notRepeated' };
  }
  const previousRepetitions = params.commentsAfterLastAgentReport.filter(
    (comment) =>
      params.isTrustedAuthor(comment.author) &&
      comment.content.startsWith(NEXT_STEP_AGENT_DISPATCH_REPEATED_MESSAGE_HEAD),
  ).length;
  const repetition = previousRepetitions + 1;
  if (repetition >= params.thresholdForAutoReject) {
    return {
      type: 'escalateToFailedPreparation',
      comment: `${NEXT_STEP_AGENT_DISPATCH_REPEATED_MESSAGE_HEAD} ${params.nextStepAgent}

Failed to receive a report from the dispatched agent for ${params.thresholdForAutoReject} times`,
    };
  }
  return {
    type: 'dispatchAgain',
    comment: `${NEXT_STEP_AGENT_DISPATCH_REPEATED_MESSAGE_HEAD} ${params.nextStepAgent}

The latest agent report names this agent as the next step and the agent field already holds it, so the previous dispatch to it ended without a report. Dispatching it again (${repetition}/${params.thresholdForAutoReject}).`,
  };
};
