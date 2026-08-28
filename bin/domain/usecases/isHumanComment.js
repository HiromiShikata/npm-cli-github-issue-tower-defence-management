"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isHumanComment = void 0;
const autoStatusCheckComments_1 = require("./autoStatusCheckComments");
const isAgentReportBody_1 = require("./isAgentReportBody");
const nextStepAgentDispatchRepeatedMessage_1 = require("./nextStepAgentDispatchRepeatedMessage");
const MACHINE_GENERATED_COMMENT_HEADS = [
    autoStatusCheckComments_1.AUTO_STATUS_CHECK_MESSAGE_HEAD,
    nextStepAgentDispatchRepeatedMessage_1.NEXT_STEP_AGENT_DISPATCH_REPEATED_MESSAGE_HEAD,
];
const isHumanComment = (comment, isTrustedAuthor) => {
    if (!isTrustedAuthor(comment.author)) {
        return true;
    }
    if ((0, isAgentReportBody_1.isAgentReportBody)(comment.content)) {
        return false;
    }
    return !MACHINE_GENERATED_COMMENT_HEADS.some((head) => comment.content.startsWith(head));
};
exports.isHumanComment = isHumanComment;
//# sourceMappingURL=isHumanComment.js.map