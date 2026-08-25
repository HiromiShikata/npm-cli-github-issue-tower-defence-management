"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findLastAgentReport = void 0;
const isAgentReportBody_1 = require("./isAgentReportBody");
const findLastAgentReport = (comments, isTrustedAuthor) => [...comments]
    .reverse()
    .find((comment) => isTrustedAuthor(comment.author) && (0, isAgentReportBody_1.isAgentReportBody)(comment.content)) ?? null;
exports.findLastAgentReport = findLastAgentReport;
//# sourceMappingURL=findLastAgentReport.js.map