"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitHubIssueCheckpointRepository = void 0;
const CHECKPOINT_COMMENT_BODY = 'From: :robot: preparation-daemon (-)\n\n```json\n{"pullRequestRequired": false}\n```\n\nThis implementation session was interrupted by the preparation daemon due to token near exhaustion. The task will be re-dispatched.';
class GitHubIssueCheckpointRepository {
    constructor(ghToken) {
        this.ghToken = ghToken;
        this.postCheckpoint = async (issueUrl) => {
            const { owner, repo, issueNumber } = this.parseIssueUrl(issueUrl);
            const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/comments`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${this.ghToken}`,
                    Accept: 'application/vnd.github+json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ body: CHECKPOINT_COMMENT_BODY }),
            });
            if (!response.ok) {
                throw new Error(`Failed to post checkpoint comment to ${issueUrl}: ${response.status} ${response.statusText}`);
            }
        };
        this.parseIssueUrl = (issueUrl) => {
            const match = issueUrl.match(/github\.com\/([^/]+)\/([^/]+)\/(issues|pull)\/(\d+)/);
            if (!match) {
                throw new Error(`Invalid GitHub issue URL: ${issueUrl}`);
            }
            return {
                owner: match[1],
                repo: match[2],
                issueNumber: parseInt(match[4], 10),
            };
        };
    }
}
exports.GitHubIssueCheckpointRepository = GitHubIssueCheckpointRepository;
//# sourceMappingURL=GitHubIssueCheckpointRepository.js.map