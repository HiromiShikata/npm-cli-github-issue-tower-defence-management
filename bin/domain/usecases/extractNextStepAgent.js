"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractNextStepAgent = void 0;
const extractFencedJsonBlocks_1 = require("./extractFencedJsonBlocks");
const extractNextStepAgent = (body) => {
    for (const block of (0, extractFencedJsonBlocks_1.extractFencedJsonBlocks)(body, 'nextStepAgent')) {
        if (typeof block !== 'object' || block === null) {
            continue;
        }
        if (!('nextStepAgent' in block)) {
            continue;
        }
        const value = Reflect.get(block, 'nextStepAgent');
        if (typeof value !== 'string' || value.trim() === '') {
            continue;
        }
        return value.trim();
    }
    return null;
};
exports.extractNextStepAgent = extractNextStepAgent;
//# sourceMappingURL=extractNextStepAgent.js.map