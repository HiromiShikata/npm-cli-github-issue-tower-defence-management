"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isPullRequestDeclaredUnnecessary = void 0;
const isAgentReportBody_1 = require("./isAgentReportBody");
const normalizeReportBody_1 = require("./normalizeReportBody");
const isPullRequestDeclaredUnnecessary = (comments, isTrustedAuthor) => {
    const lastComment = comments[comments.length - 1];
    if (!lastComment ||
        !isTrustedAuthor(lastComment.author) ||
        !(0, isAgentReportBody_1.isAgentReportBody)(lastComment.content)) {
        return false;
    }
    const reportMatch = (0, normalizeReportBody_1.normalizeReportBody)(lastComment.content).match(/```json\n([\s\S]*?)\n```/);
    if (!reportMatch || reportMatch.length < 2) {
        return false;
    }
    let reportJson;
    try {
        reportJson = JSON.parse(reportMatch[1]);
    }
    catch (error) {
        console.warn('Invalid JSON in report body while checking pullRequestRequired:', error);
        return false;
    }
    if (typeof reportJson !== 'object' || reportJson === null) {
        return false;
    }
    const report = { ...reportJson };
    return report.pullRequestRequired === false;
};
exports.isPullRequestDeclaredUnnecessary = isPullRequestDeclaredUnnecessary;
//# sourceMappingURL=isPullRequestDeclaredUnnecessary.js.map