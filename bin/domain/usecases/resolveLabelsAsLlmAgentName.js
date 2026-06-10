"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveLabelsAsLlmAgentName = void 0;
const resolveLabelsAsLlmAgentName = (source) => {
    return source.topLevel ?? source.startPreparation ?? [];
};
exports.resolveLabelsAsLlmAgentName = resolveLabelsAsLlmAgentName;
//# sourceMappingURL=resolveLabelsAsLlmAgentName.js.map