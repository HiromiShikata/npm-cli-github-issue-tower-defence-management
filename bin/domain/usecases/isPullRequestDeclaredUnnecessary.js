"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isPullRequestDeclaredUnnecessary = void 0;
const extractFencedJsonBlocks_1 = require("./extractFencedJsonBlocks");
const isAgentReportBody_1 = require("./isAgentReportBody");
const isPullRequestDeclaredUnnecessary = (comments, isTrustedAuthor) => {
    const lastComment = comments[comments.length - 1];
    if (!lastComment ||
        !isTrustedAuthor(lastComment.author) ||
        !(0, isAgentReportBody_1.isAgentReportBody)(lastComment.content)) {
        return false;
    }
    for (const block of (0, extractFencedJsonBlocks_1.extractFencedJsonBlocks)(lastComment.content, 'pullRequestRequired')) {
        if (typeof block !== 'object' || block === null) {
            continue;
        }
        const report = { ...block };
        if (report.pullRequestRequired === false) {
            return true;
        }
    }
    return false;
};
exports.isPullRequestDeclaredUnnecessary = isPullRequestDeclaredUnnecessary;
//# sourceMappingURL=isPullRequestDeclaredUnnecessary.js.map