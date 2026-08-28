"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveNextStepAgentDispatchRepetition = exports.DEFAULT_THRESHOLD_FOR_DISPATCH_LOOP = exports.NEXT_STEP_AGENT_DISPATCH_REPEATED_MESSAGE_HEAD = void 0;
const ProjectFieldName_1 = require("../entities/ProjectFieldName");
const extractNextStepAgent_1 = require("./extractNextStepAgent");
const findLastAgentReport_1 = require("./findLastAgentReport");
const isAgentReportBody_1 = require("./isAgentReportBody");
const isHumanComment_1 = require("./isHumanComment");
const nextStepAgentDispatchRepeatedMessage_1 = require("./nextStepAgentDispatchRepeatedMessage");
Object.defineProperty(exports, "NEXT_STEP_AGENT_DISPATCH_REPEATED_MESSAGE_HEAD", { enumerable: true, get: function () { return nextStepAgentDispatchRepeatedMessage_1.NEXT_STEP_AGENT_DISPATCH_REPEATED_MESSAGE_HEAD; } });
exports.DEFAULT_THRESHOLD_FOR_DISPATCH_LOOP = 6;
const countSilentRedispatches = (params) => {
    if (params.agentFieldValue === null ||
        (0, ProjectFieldName_1.normalizeProjectFieldName)(params.agentFieldValue) !==
            (0, ProjectFieldName_1.normalizeProjectFieldName)(params.nextStepAgent)) {
        return null;
    }
    const lastAgentReport = (0, findLastAgentReport_1.findLastAgentReport)(params.comments, params.isTrustedAuthor);
    const commentsAfterLastAgentReport = lastAgentReport
        ? params.comments.slice(params.comments.indexOf(lastAgentReport) + 1)
        : [];
    return (commentsAfterLastAgentReport.filter((comment) => params.isTrustedAuthor(comment.author) &&
        comment.content.startsWith(nextStepAgentDispatchRepeatedMessage_1.NEXT_STEP_AGENT_DISPATCH_REPEATED_MESSAGE_HEAD)).length + 1);
};
const countDispatchesInCurrentCycle = (params) => {
    const lastHumanCommentIndex = params.comments.reduce((found, comment, index) => (0, isHumanComment_1.isHumanComment)(comment, params.isTrustedAuthor) ? index : found, -1);
    const reportsInCurrentCycle = params.comments
        .slice(lastHumanCommentIndex + 1)
        .filter((comment) => params.isTrustedAuthor(comment.author) &&
        (0, isAgentReportBody_1.isAgentReportBody)(comment.content));
    return (reportsInCurrentCycle.slice(0, -1).filter((comment) => {
        const declared = (0, extractNextStepAgent_1.extractNextStepAgent)(comment.content);
        return (declared !== null &&
            (0, ProjectFieldName_1.normalizeProjectFieldName)(declared) ===
                (0, ProjectFieldName_1.normalizeProjectFieldName)(params.nextStepAgent));
    }).length + 1);
};
const resolveNextStepAgentDispatchRepetition = (params) => {
    const silentRedispatches = countSilentRedispatches(params);
    if (silentRedispatches !== null &&
        silentRedispatches >= params.thresholdForAutoReject) {
        return {
            type: 'escalateToFailedPreparation',
            comment: `${nextStepAgentDispatchRepeatedMessage_1.NEXT_STEP_AGENT_DISPATCH_REPEATED_MESSAGE_HEAD} ${params.nextStepAgent}

Failed to receive a report from the dispatched agent for ${params.thresholdForAutoReject} times`,
        };
    }
    const dispatchesInCycle = countDispatchesInCurrentCycle(params);
    if (dispatchesInCycle >= params.thresholdForDispatchLoop) {
        return {
            type: 'escalateToFailedPreparation',
            comment: `${nextStepAgentDispatchRepeatedMessage_1.NEXT_STEP_AGENT_DISPATCH_REPEATED_MESSAGE_HEAD} ${params.nextStepAgent}

This agent has been dispatched ${params.thresholdForDispatchLoop} times since the last human comment on this issue and the task has not moved past it, so the issue is escalated for a decision instead of being dispatched again.`,
        };
    }
    const silentRedispatchMessage = {
        type: 'dispatchAgain',
        comment: `${nextStepAgentDispatchRepeatedMessage_1.NEXT_STEP_AGENT_DISPATCH_REPEATED_MESSAGE_HEAD} ${params.nextStepAgent}

The latest agent report names this agent as the next step and the agent field already holds it, so the previous dispatch to it ended without a report. Dispatching it again (${silentRedispatches}/${params.thresholdForAutoReject}).`,
    };
    if (silentRedispatches !== null && silentRedispatches > 1) {
        return silentRedispatchMessage;
    }
    if (dispatchesInCycle > 1) {
        return {
            type: 'dispatchAgain',
            comment: `${nextStepAgentDispatchRepeatedMessage_1.NEXT_STEP_AGENT_DISPATCH_REPEATED_MESSAGE_HEAD} ${params.nextStepAgent}

The latest agent report names this agent as the next step and it has already been dispatched on this issue since the last human comment. Dispatching it again (${dispatchesInCycle}/${params.thresholdForDispatchLoop}).`,
        };
    }
    if (silentRedispatches !== null) {
        return silentRedispatchMessage;
    }
    return { type: 'notRepeated' };
};
exports.resolveNextStepAgentDispatchRepetition = resolveNextStepAgentDispatchRepetition;
//# sourceMappingURL=resolveNextStepAgentDispatchRepetition.js.map