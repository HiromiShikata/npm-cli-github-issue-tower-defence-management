"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findLastAgentDeclaringReport = void 0;
const agentReportPrefix_1 = require("./agentReportPrefix");
const extractNextStepAgent_1 = require("./extractNextStepAgent");
const hasReportJsonBlock_1 = require("./hasReportJsonBlock");
const findLastAgentDeclaringReport = (comments, isTrustedAuthor) => {
    const lastReport = [...comments]
        .reverse()
        .find((comment) => isTrustedAuthor(comment.author) &&
        comment.content.startsWith(agentReportPrefix_1.AGENT_REPORT_PREFIX) &&
        (0, hasReportJsonBlock_1.hasReportJsonBlock)(comment.content)) ?? null;
    if (lastReport === null) {
        return null;
    }
    return (0, extractNextStepAgent_1.extractNextStepAgent)(lastReport.content) === null ? null : lastReport;
};
exports.findLastAgentDeclaringReport = findLastAgentDeclaringReport;
//# sourceMappingURL=findLastAgentDeclaringReport.js.map