"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitHubIssueCommentRepository = void 0;
function isRestCommentPayloadArray(value) {
    if (!Array.isArray(value))
        return false;
    return true;
}
class GitHubIssueCommentRepository {
    constructor(token) {
        this.token = token;
    }
    parseIssueUrl(issue) {
        const urlMatch = issue.url.match(/github\.com\/([^/]+)\/([^/]+)\/(issues|pull)\/(\d+)/);
        if (!urlMatch) {
            throw new Error(`Invalid GitHub issue URL: ${issue.url}`);
        }
        return {
            owner: urlMatch[1],
            repo: urlMatch[2],
            issueNumber: parseInt(urlMatch[4], 10),
            isPr: urlMatch[3] === 'pull',
        };
    }
    async getCommentsFromIssue(issue) {
        const { owner, repo, issueNumber } = this.parseIssueUrl(issue);
        const comments = [];
        let page = 1;
        let hasNextPage = true;
        while (hasNextPage) {
            const url = `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/comments?per_page=100&page=${page}`;
            const response = await fetch(url, {
                headers: {
                    Authorization: `Bearer ${this.token}`,
                    Accept: 'application/vnd.github+json',
                },
            });
            if (!response.ok) {
                throw new Error(`Failed to fetch comments from GitHub REST API: ${response.status} ${response.statusText}`);
            }
            const responseData = await response.json();
            if (!isRestCommentPayloadArray(responseData)) {
                throw new Error('Unexpected response shape when fetching comments from GitHub REST API');
            }
            for (const payload of responseData) {
                comments.push({
                    author: payload.user?.login ?? '',
                    content: payload.body,
                    createdAt: new Date(payload.created_at),
                });
            }
            const linkHeader = response.headers.get('Link') ?? '';
            hasNextPage = linkHeader.includes('rel="next"');
            page++;
        }
        return comments;
    }
    async createComment(issue, commentContent) {
        const { owner, repo, issueNumber } = this.parseIssueUrl(issue);
        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/comments`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${this.token}`,
                Accept: 'application/vnd.github+json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ body: commentContent }),
        });
        if (!response.ok) {
            throw new Error(`Failed to create comment via GitHub REST API: ${response.status} ${response.statusText}`);
        }
    }
}
exports.GitHubIssueCommentRepository = GitHubIssueCommentRepository;
//# sourceMappingURL=GitHubIssueCommentRepository.js.map