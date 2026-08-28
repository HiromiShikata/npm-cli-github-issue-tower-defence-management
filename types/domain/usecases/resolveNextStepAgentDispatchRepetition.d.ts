import { NEXT_STEP_AGENT_DISPATCH_REPEATED_MESSAGE_HEAD } from './nextStepAgentDispatchRepeatedMessage';
export { NEXT_STEP_AGENT_DISPATCH_REPEATED_MESSAGE_HEAD };
export declare const DEFAULT_THRESHOLD_FOR_DISPATCH_LOOP = 6;
export type NextStepAgentDispatchRepetition = {
    type: 'notRepeated';
} | {
    type: 'dispatchAgain';
    comment: string;
} | {
    type: 'escalateToFailedPreparation';
    comment: string;
};
export declare const resolveNextStepAgentDispatchRepetition: <CommentLike extends {
    author: string;
    content: string;
}>(params: {
    agentFieldValue: string | null;
    nextStepAgent: string;
    comments: CommentLike[];
    isTrustedAuthor: (author: string) => boolean;
    thresholdForAutoReject: number;
    thresholdForDispatchLoop: number;
}) => NextStepAgentDispatchRepetition;
//# sourceMappingURL=resolveNextStepAgentDispatchRepetition.d.ts.map