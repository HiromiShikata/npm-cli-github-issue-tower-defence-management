"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findLastAgentDeclaringReport = void 0;
const agentReportPrefix_1 = require("./agentReportPrefix");
const extractNextStepAgent_1 = require("./extractNextStepAgent");
const findLastAgentDeclaringReport = (comments, isTrustedAuthor) => [...comments]
    .reverse()
    .find((comment) => isTrustedAuthor(comment.author) &&
    comment.content.startsWith(agentReportPrefix_1.AGENT_REPORT_PREFIX) &&
    (0, extractNextStepAgent_1.extractNextStepAgent)(comment.content) !== null) ?? null;
exports.findLastAgentDeclaringReport = findLastAgentDeclaringReport;
//# sourceMappingURL=findLastAgentDeclaringReport.js.map