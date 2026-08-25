export declare const NEXT_STEP_AGENT_DISPATCH_REPEATED_MESSAGE_HEAD = "Next step agent dispatch repeated:";
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
    commentsAfterLastAgentReport: CommentLike[];
    isTrustedAuthor: (author: string) => boolean;
    thresholdForAutoReject: number;
}) => NextStepAgentDispatchRepetition;
//# sourceMappingURL=resolveNextStepAgentDispatchRepetition.d.ts.map