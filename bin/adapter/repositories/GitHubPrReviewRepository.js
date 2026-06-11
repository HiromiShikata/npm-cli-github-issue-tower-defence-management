"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitHubPrReviewRepository = void 0;
const BaseGitHubRepository_1 = require("./BaseGitHubRepository");
const ALLOWED_IMAGE_PROXY_HOSTNAMES = [
    'private-user-images.githubusercontent.com',
    'user-images.githubusercontent.com',
    'github.com',
];
class GitHubPrReviewRepository extends BaseGitHubRepository_1.BaseGitHubRepository {
    constructor() {
        super(...arguments);
        this.extractGitHubErrorMessage = async (response) => {
            try {
                const body = await response.json();
                if (typeof body['message'] === 'string') {
                    return body['message'];
                }
            }
            catch {
            }
            return `HTTP ${response.status}`;
        };
        this.approve = async (owner, repo, prNumber, body, comments) => {
            const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/reviews`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${this.ghToken}`,
                    'Content-Type': 'application/json',
                    Accept: 'application/vnd.github+json',
                },
                body: JSON.stringify({
                    event: 'APPROVE',
                    body: body ?? '',
                    comments: comments ?? [],
                }),
            });
            if (!response.ok) {
                const message = await this.extractGitHubErrorMessage(response);
                throw new Error(message);
            }
        };
        this.requestChanges = async (owner, repo, prNumber, body, comments) => {
            const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/reviews`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${this.ghToken}`,
                    'Content-Type': 'application/json',
                    Accept: 'application/vnd.github+json',
                },
                body: JSON.stringify({
                    event: 'REQUEST_CHANGES',
                    body: body ?? '',
                    comments: comments ?? [],
                }),
            });
            if (!response.ok) {
                const message = await this.extractGitHubErrorMessage(response);
                throw new Error(message);
            }
        };
        this.comment = async (owner, repo, prNumber, body, comments) => {
            const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/reviews`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${this.ghToken}`,
                    'Content-Type': 'application/json',
                    Accept: 'application/vnd.github+json',
                },
                body: JSON.stringify({
                    event: 'COMMENT',
                    body: body ?? '',
                    comments: comments ?? [],
                }),
            });
            if (!response.ok) {
                const message = await this.extractGitHubErrorMessage(response);
                throw new Error(message);
            }
        };
        this.createComment = async (owner, repo, issueNumber, body) => {
            const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/comments`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${this.ghToken}`,
                    'Content-Type': 'application/json',
                    Accept: 'application/vnd.github+json',
                },
                body: JSON.stringify({ body }),
            });
            if (!response.ok) {
                const message = await this.extractGitHubErrorMessage(response);
                throw new Error(message);
            }
        };
        this.closePullRequest = async (owner, repo, prNumber) => {
            const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`, {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${this.ghToken}`,
                    'Content-Type': 'application/json',
                    Accept: 'application/vnd.github+json',
                },
                body: JSON.stringify({ state: 'closed' }),
            });
            if (!response.ok) {
                const message = await this.extractGitHubErrorMessage(response);
                throw new Error(message);
            }
        };
        this.addLabel = async (owner, repo, issueNumber, label) => {
            const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/labels`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${this.ghToken}`,
                    'Content-Type': 'application/json',
                    Accept: 'application/vnd.github+json',
                },
                body: JSON.stringify({ labels: [label] }),
            });
            if (!response.ok) {
                const message = await this.extractGitHubErrorMessage(response);
                throw new Error(message);
            }
        };
        this.updateProjectItemStatus = async (projectId, fieldId, itemId, statusOptionId) => {
            const graphqlQuery = {
                query: `mutation {
      updateProjectV2ItemFieldValue(input: {
        projectId: "${projectId}"
        fieldId: "${fieldId}"
        itemId: "${itemId}"
        value: { singleSelectOptionId: "${statusOptionId}" },
      }) {
        clientMutationId
      }
    }`,
            };
            const response = await fetch('https://api.github.com/graphql', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${this.ghToken}`,
                    'Content-Type': 'application/json',
                    Accept: 'application/vnd.github+json',
                },
                body: JSON.stringify(graphqlQuery),
            });
            if (!response.ok) {
                const message = await this.extractGitHubErrorMessage(response);
                throw new Error(message);
            }
            const result = await response.json();
            if (result.errors && result.errors.length > 0) {
                throw new Error(result.errors.map((e) => e.message).join('\n'));
            }
        };
        this.getFileContent = async (owner, repo, filePath, ref, prHeadSha) => {
            const tryFetch = async (resolvedRef) => {
                const encodedPath = filePath
                    .split('/')
                    .map((segment) => encodeURIComponent(segment))
                    .join('/');
                return fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(resolvedRef)}`, {
                    headers: {
                        Authorization: `Bearer ${this.ghToken}`,
                        Accept: 'application/vnd.github.raw+json',
                    },
                });
            };
            let response = await tryFetch(ref);
            if (!response.ok && ref !== prHeadSha) {
                response = await tryFetch(prHeadSha);
            }
            if (!response.ok) {
                const message = await this.extractGitHubErrorMessage(response);
                throw new Error(message);
            }
            const arrayBuffer = await response.arrayBuffer();
            const content = Buffer.from(arrayBuffer);
            const contentType = response.headers.get('content-type') ?? 'application/octet-stream';
            return { content, contentType };
        };
        this.fetchImageProxy = async (targetUrl) => {
            let parsedUrl;
            try {
                parsedUrl = new URL(targetUrl);
            }
            catch {
                throw new Error(`Invalid URL: ${targetUrl}`);
            }
            if (!ALLOWED_IMAGE_PROXY_HOSTNAMES.includes(parsedUrl.hostname)) {
                throw new Error(`Hostname not allowed: ${parsedUrl.hostname}`);
            }
            const response = await fetch(targetUrl, {
                headers: {
                    Authorization: `token ${this.ghToken}`,
                },
            });
            if (!response.ok) {
                const message = await this.extractGitHubErrorMessage(response);
                throw new Error(message);
            }
            const arrayBuffer = await response.arrayBuffer();
            const content = Buffer.from(arrayBuffer);
            const contentType = response.headers.get('content-type') ?? 'application/octet-stream';
            return { content, contentType };
        };
        this.getIssueOrPrTitle = async (owner, repo, number) => {
            const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues/${number}`, {
                headers: {
                    Authorization: `Bearer ${this.ghToken}`,
                    Accept: 'application/vnd.github+json',
                },
            });
            if (!response.ok) {
                const message = await this.extractGitHubErrorMessage(response);
                throw new Error(message);
            }
            const data = await response.json();
            return {
                title: data.title,
                state: data.state,
                isPR: !!data.pull_request,
                url: data.html_url,
            };
        };
    }
}
exports.GitHubPrReviewRepository = GitHubPrReviewRepository;
//# sourceMappingURL=GitHubPrReviewRepository.js.map