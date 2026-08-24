"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findLastAgentReport = void 0;
const agentReportPrefix_1 = require("./agentReportPrefix");
const findLastAgentReport = (comments, isTrustedAuthor) => [...comments]
    .reverse()
    .find((comment) => isTrustedAuthor(comment.author) &&
    comment.content.startsWith(agentReportPrefix_1.AGENT_REPORT_PREFIX)) ?? null;
exports.findLastAgentReport = findLastAgentReport;
//# sourceMappingURL=findLastAgentReport.js.map