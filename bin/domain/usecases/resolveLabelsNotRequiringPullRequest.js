"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveLabelsNotRequiringPullRequest = void 0;
const resolveLabelsNotRequiringPullRequest = (source) => [
    ...(source.labelsAsLlmAgentName ?? []),
    ...(source.labelsNotRequiringPullRequest ?? []),
];
exports.resolveLabelsNotRequiringPullRequest = resolveLabelsNotRequiringPullRequest;
//# sourceMappingURL=resolveLabelsNotRequiringPullRequest.js.map