"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitHubIssueCommentRepository = void 0;
function isRestCommentPayloadArray(value) {
    if (!Array.isArray(value))
        return false;
    return true;
}
function isCreateCommentResponse(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    return true;
}
function isIssueIdResponse(value) {
    if (typeof value !== 'object' || value === null)
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
    async getIssueNodeId(issue) {
        const { owner, repo, issueNumber, isPr } = this.parseIssueUrl(issue);
        const entityType = isPr ? 'pullRequest' : 'issue';
        const query = `
      query($owner: String!, $repo: String!, $issueNumber: Int!) {
        repository(owner: $owner, name: $repo) {
          ${entityType}(number: $issueNumber) {
            id
          }
        }
      }
    `;
        const response = await fetch('https://api.github.com/graphql', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${this.token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                query,
                variables: {
                    owner,
                    repo,
                    issueNumber,
                },
            }),
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch issue ID from GitHub GraphQL API: ${response.status} ${response.statusText}`);
        }
        const responseData = await response.json();
        if (!isIssueIdResponse(responseData)) {
            throw new Error('Unexpected response shape when fetching issue ID from GitHub GraphQL API');
        }
        const issueId = isPr
            ? responseData.data?.repository?.pullRequest?.id
            : responseData.data?.repository?.issue?.id;
        if (!issueId) {
            throw new Error(`${isPr ? 'Pull request' : 'Issue'} not found when fetching issue ID from GitHub GraphQL API`);
        }
        return issueId;
    }
    async createComment(issue, commentContent) {
        const issueId = await this.getIssueNodeId(issue);
        const mutation = `
      mutation($issueId: ID!, $body: String!) {
        addComment(input: {
          subjectId: $issueId
          body: $body
        }) {
          commentEdge {
            node {
              id
            }
          }
        }
      }
    `;
        const response = await fetch('https://api.github.com/graphql', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${this.token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                query: mutation,
                variables: {
                    issueId,
                    body: commentContent,
                },
            }),
        });
        if (!response.ok) {
            throw new Error(`Failed to create comment via GitHub GraphQL API: ${response.status} ${response.statusText}`);
        }
        const responseData = await response.json();
        if (!isCreateCommentResponse(responseData)) {
            throw new Error('Invalid API response format when creating comment');
        }
        if (responseData.errors) {
            throw new Error(`GraphQL errors when creating comment: ${JSON.stringify(responseData.errors)}`);
        }
    }
}
exports.GitHubIssueCommentRepository = GitHubIssueCommentRepository;
//# sourceMappingURL=GitHubIssueCommentRepository.js.map