"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractFencedJsonBlocks = void 0;
const normalizeReportBody_1 = require("./normalizeReportBody");
const extractFencedJsonBlocks = (body, context) => {
    const blocks = [];
    for (const match of (0, normalizeReportBody_1.normalizeReportBody)(body).matchAll(/```json\n([\s\S]*?)\n```/g)) {
        try {
            blocks.push(JSON.parse(match[1]));
        }
        catch (error) {
            console.warn(`Invalid JSON in report body while checking ${context}:`, error);
        }
    }
    return blocks;
};
exports.extractFencedJsonBlocks = extractFencedJsonBlocks;
//# sourceMappingURL=extractFencedJsonBlocks.js.map