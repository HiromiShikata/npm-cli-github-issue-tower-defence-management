"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveAllowedIssueAuthors = void 0;
const resolveAllowedIssueAuthors = (source) => {
    return source.topLevel ?? source.startPreparation ?? null;
};
exports.resolveAllowedIssueAuthors = resolveAllowedIssueAuthors;
//# sourceMappingURL=resolveAllowedIssueAuthors.js.map