"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isWaitingForOwnerApproval = void 0;
const extractFencedJsonBlocks_1 = require("./extractFencedJsonBlocks");
const isWaitingForOwnerApproval = (reportContent) => {
    const blocks = (0, extractFencedJsonBlocks_1.extractFencedJsonBlocks)(reportContent, 'waitingForOwnerApproval');
    const firstBlock = blocks[0];
    if (typeof firstBlock !== 'object' || firstBlock === null) {
        return false;
    }
    const report = { ...firstBlock };
    return (report.pullRequestRequired === false &&
        report.waitingForOwnerApproval === true);
};
exports.isWaitingForOwnerApproval = isWaitingForOwnerApproval;
//# sourceMappingURL=isWaitingForOwnerApproval.js.map