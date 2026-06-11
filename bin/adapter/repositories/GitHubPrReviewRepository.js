"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitHubPrReviewRepository = void 0;
const BaseGitHubRepository_1 = require("./BaseGitHubRepository");
const GitHubApiError_1 = require("../../domain/entities/GitHubApiError");
const ALLOWED_IMAGE_PROXY_HOSTNAMES = [
    'private-user-images.githubusercontent.com',
    'user-images.githubusercontent.com',
    'github.com',
];
const buildRepoApiUrl = (owner, repo, ...segments) => {
    const encoded = [
        encodeURIComponent(owner),
        encodeURIComponent(repo),
        ...segments.map((s) => encodeURIComponent(String(s))),
    ];
    return `https://api.github.com/repos/${encoded[0]}/${encoded[1]}/${encoded.slice(2).join('/')}`;
};
class GitHubPrReviewRepository extends BaseGitHubRepository_1.BaseGitHubRepository {
    constructor() {
        super(...arguments);
        this.extractGitHubErrorMessage = async (response) => {
            try {
                const body = await response.json();
                if (typeof body === 'object' &&
                    body !== null &&
                    'message' in body &&
                    typeof body['message'] === 'string') {
                    return body['message'];
                }
            }
            catch (_error) {
                process.stderr.write(String(_error) + '\n');
            }
            return `HTTP ${response.status}`;
        };
        this.approve = async (owner, repo, prNumber, body, comments) => {
            const url = buildRepoApiUrl(owner, repo, 'pulls', prNumber, 'reviews');
            const response = await fetch(url, {
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
                throw new GitHubApiError_1.GitHubApiError(message);
            }
        };
        this.requestChanges = async (owner, repo, prNumber, body, comments) => {
            const url = buildRepoApiUrl(owner, repo, 'pulls', prNumber, 'reviews');
            const response = await fetch(url, {
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
                throw new GitHubApiError_1.GitHubApiError(message);
            }
        };
        this.comment = async (owner, repo, prNumber, body, comments) => {
            const url = buildRepoApiUrl(owner, repo, 'pulls', prNumber, 'reviews');
            const response = await fetch(url, {
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
                throw new GitHubApiError_1.GitHubApiError(message);
            }
        };
        this.createComment = async (owner, repo, issueNumber, body) => {
            const url = buildRepoApiUrl(owner, repo, 'issues', issueNumber, 'comments');
            const response = await fetch(url, {
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
                throw new GitHubApiError_1.GitHubApiError(message);
            }
        };
        this.closePullRequest = async (owner, repo, prNumber) => {
            const url = buildRepoApiUrl(owner, repo, 'pulls', prNumber);
            const response = await fetch(url, {
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
                throw new GitHubApiError_1.GitHubApiError(message);
            }
        };
        this.addLabel = async (owner, repo, issueNumber, label) => {
            const url = buildRepoApiUrl(owner, repo, 'issues', issueNumber, 'labels');
            const response = await fetch(url, {
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
                throw new GitHubApiError_1.GitHubApiError(message);
            }
        };
        this.updateProjectItemStatus = async (projectId, fieldId, itemId, statusOptionId) => {
            const graphqlQuery = {
                query: `mutation UpdateProjectItemFieldValue($projectId: ID!, $fieldId: ID!, $itemId: ID!, $statusOptionId: String!) {
        updateProjectV2ItemFieldValue(input: {
          projectId: $projectId
          fieldId: $fieldId
          itemId: $itemId
          value: { singleSelectOptionId: $statusOptionId },
        }) {
          clientMutationId
        }
      }`,
                variables: { projectId, fieldId, itemId, statusOptionId },
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
                throw new GitHubApiError_1.GitHubApiError(message);
            }
            const result = await response.json();
            if (typeof result === 'object' &&
                result !== null &&
                'errors' in result &&
                Array.isArray(result['errors']) &&
                result['errors'].length > 0) {
                const messages = result['errors']
                    .filter((e) => typeof e === 'object' && e !== null && 'message' in e)
                    .map((e) => e.message);
                throw new GitHubApiError_1.GitHubApiError(messages.join('\n'));
            }
        };
        this.getFileContent = async (owner, repo, filePath, ref, prHeadSha) => {
            const tryFetch = async (resolvedRef) => {
                const encodedOwner = encodeURIComponent(owner);
                const encodedRepo = encodeURIComponent(repo);
                const encodedPath = filePath
                    .split('/')
                    .map((segment) => encodeURIComponent(segment))
                    .join('/');
                const url = `https://api.github.com/repos/${encodedOwner}/${encodedRepo}/contents/${encodedPath}?ref=${encodeURIComponent(resolvedRef)}`;
                return fetch(url, {
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
                throw new Error('Invalid URL');
            }
            const allowedIndex = ALLOWED_IMAGE_PROXY_HOSTNAMES.indexOf(parsedUrl.hostname);
            if (allowedIndex === -1) {
                throw new Error('Hostname not allowed');
            }
            const safeHostname = ALLOWED_IMAGE_PROXY_HOSTNAMES[allowedIndex];
            const encodedPathAndQuery = parsedUrl.pathname.split('/').map(encodeURIComponent).join('/') +
                (parsedUrl.search
                    ? '?' +
                        Array.from(parsedUrl.searchParams.entries())
                            .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
                            .join('&')
                    : '');
            const safeUrl = `https://${safeHostname}${encodedPathAndQuery}`;
            const response = await fetch(safeUrl, {
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
            const url = buildRepoApiUrl(owner, repo, 'issues', number);
            const response = await fetch(url, {
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
            if (typeof data !== 'object' ||
                data === null ||
                !('title' in data) ||
                !('state' in data) ||
                !('html_url' in data)) {
                throw new Error('Unexpected GitHub API response format');
            }
            return {
                title: String(data['title']),
                state: String(data['state']),
                isPR: 'pull_request' in data && data['pull_request'] !== null,
                url: String(data['html_url']),
            };
        };
    }
}
exports.GitHubPrReviewRepository = GitHubPrReviewRepository;
//# sourceMappingURL=GitHubPrReviewRepository.js.map