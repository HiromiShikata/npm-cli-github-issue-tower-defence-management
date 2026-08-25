"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAgentReportBodyFromAgent = exports.isAgentReportBody = exports.stripLeadingFencedBlocks = void 0;
const agentReportPrefix_1 = require("./agentReportPrefix");
const normalizeReportBody_1 = require("./normalizeReportBody");
const FENCE_OPENING = /^ {0,3}(`{3,}|~{3,})/;
const isFenceClosingLine = (line, marker) => {
    const trimmed = line.trim();
    return (trimmed.length >= marker.length &&
        [...trimmed].every((character) => character === marker[0]));
};
const stripLeadingFencedBlocks = (body) => {
    const lines = (0, normalizeReportBody_1.normalizeReportBody)(body).split('\n');
    let index = 0;
    while (index < lines.length) {
        const line = lines[index];
        if (line.trim() === '') {
            index += 1;
            continue;
        }
        const opening = FENCE_OPENING.exec(line);
        if (!opening) {
            break;
        }
        const marker = opening[1];
        let closingIndex = index + 1;
        while (closingIndex < lines.length &&
            !isFenceClosingLine(lines[closingIndex], marker)) {
            closingIndex += 1;
        }
        if (closingIndex >= lines.length) {
            return '';
        }
        index = closingIndex + 1;
    }
    return lines.slice(index).join('\n');
};
exports.stripLeadingFencedBlocks = stripLeadingFencedBlocks;
const isAgentReportBody = (body) => (0, exports.stripLeadingFencedBlocks)(body).startsWith(agentReportPrefix_1.AGENT_REPORT_PREFIX);
exports.isAgentReportBody = isAgentReportBody;
const isAgentReportBodyFromAgent = (body, agentName) => (0, exports.stripLeadingFencedBlocks)(body).startsWith(`${agentReportPrefix_1.AGENT_REPORT_PREFIX} ${agentName}`);
exports.isAgentReportBodyFromAgent = isAgentReportBodyFromAgent;
//# sourceMappingURL=isAgentReportBody.js.map