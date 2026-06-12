"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitHubApiError = void 0;
class GitHubApiError extends Error {
    constructor(userMessage) {
        super();
        this.userMessage = userMessage;
    }
}
exports.GitHubApiError = GitHubApiError;
//# sourceMappingURL=GitHubApiError.js.map