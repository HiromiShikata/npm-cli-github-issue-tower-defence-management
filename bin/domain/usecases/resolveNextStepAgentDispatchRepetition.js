"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveNextStepAgentDispatchRepetition = exports.NEXT_STEP_AGENT_DISPATCH_REPEATED_MESSAGE_HEAD = void 0;
const ProjectFieldName_1 = require("../entities/ProjectFieldName");
exports.NEXT_STEP_AGENT_DISPATCH_REPEATED_MESSAGE_HEAD = 'Next step agent dispatch repeated:';
const resolveNextStepAgentDispatchRepetition = (params) => {
    if (params.agentFieldValue === null ||
        (0, ProjectFieldName_1.normalizeProjectFieldName)(params.agentFieldValue) !==
            (0, ProjectFieldName_1.normalizeProjectFieldName)(params.nextStepAgent)) {
        return { type: 'notRepeated' };
    }
    const previousRepetitions = params.commentsAfterLastAgentReport.filter((comment) => params.isTrustedAuthor(comment.author) &&
        comment.content.startsWith(exports.NEXT_STEP_AGENT_DISPATCH_REPEATED_MESSAGE_HEAD)).length;
    const repetition = previousRepetitions + 1;
    if (repetition >= params.thresholdForAutoReject) {
        return {
            type: 'escalateToFailedPreparation',
            comment: `${exports.NEXT_STEP_AGENT_DISPATCH_REPEATED_MESSAGE_HEAD} ${params.nextStepAgent}

Failed to receive a report from the dispatched agent for ${params.thresholdForAutoReject} times`,
        };
    }
    return {
        type: 'dispatchAgain',
        comment: `${exports.NEXT_STEP_AGENT_DISPATCH_REPEATED_MESSAGE_HEAD} ${params.nextStepAgent}

The latest agent report names this agent as the next step and the agent field already holds it, so the previous dispatch to it ended without a report. Dispatching it again (${repetition}/${params.thresholdForAutoReject}).`,
    };
};
exports.resolveNextStepAgentDispatchRepetition = resolveNextStepAgentDispatchRepetition;
//# sourceMappingURL=resolveNextStepAgentDispatchRepetition.js.map