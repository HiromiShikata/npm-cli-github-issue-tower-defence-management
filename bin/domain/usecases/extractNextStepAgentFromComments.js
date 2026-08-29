"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractNextStepAgentFromComments = void 0;
const extractNextStepAgent_1 = require("./extractNextStepAgent");
const findLastAgentReport_1 = require("./findLastAgentReport");
const extractNextStepAgentFromComments = (comments, isTrustedAuthor) => {
    const lastAgentReport = (0, findLastAgentReport_1.findLastAgentReport)(comments, isTrustedAuthor);
    if (!lastAgentReport) {
        return null;
    }
    return (0, extractNextStepAgent_1.extractNextStepAgent)(lastAgentReport.content);
};
exports.extractNextStepAgentFromComments = extractNextStepAgentFromComments;
//# sourceMappingURL=extractNextStepAgentFromComments.js.map