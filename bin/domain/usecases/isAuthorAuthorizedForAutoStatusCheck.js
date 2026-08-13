"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAuthorAuthorizedForAutoStatusCheck = void 0;
const isAuthorAuthorizedForAutoStatusCheck = (author, allowedIssueAuthors) => {
    if (allowedIssueAuthors === null || allowedIssueAuthors === undefined) {
        return false;
    }
    if (allowedIssueAuthors.length === 0) {
        return false;
    }
    return allowedIssueAuthors.includes(author);
};
exports.isAuthorAuthorizedForAutoStatusCheck = isAuthorAuthorizedForAutoStatusCheck;
//# sourceMappingURL=isAuthorAuthorizedForAutoStatusCheck.js.map