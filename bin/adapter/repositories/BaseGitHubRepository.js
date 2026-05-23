"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseGitHubRepository = void 0;
class BaseGitHubRepository {
    constructor(localStorageRepository, ghToken = process.env.GH_TOKEN || 'dummy') {
        this.localStorageRepository = localStorageRepository;
        this.ghToken = ghToken;
        this.extractIssueFromUrl = (issueUrl) => {
            const match = issueUrl.match(/https:\/\/github.com\/([^/]+)\/([^/]+)\/(issues|pull)\/(\d+)/);
            if (!match) {
                throw new Error(`Invalid issue URL: ${issueUrl}`);
            }
            const [, owner, repo, pullOrIssue, issueNumberStr] = match;
            const issueNumber = parseInt(issueNumberStr, 10);
            if (isNaN(issueNumber)) {
                throw new Error(`Invalid issue number: ${issueNumberStr}. URL: ${issueUrl}`);
            }
            return { owner, repo, issueNumber, isIssue: pullOrIssue === 'issues' };
        };
    }
}
exports.BaseGitHubRepository = BaseGitHubRepository;
//# sourceMappingURL=BaseGitHubRepository.js.map