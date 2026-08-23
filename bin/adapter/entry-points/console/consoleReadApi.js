"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handlePullRequestStatus = exports.handleIssueTitle = exports.handleRelatedPrs = exports.handlePrCommits = exports.handlePrFiles = exports.handleComments = exports.handleItemBody = exports.PullRequestStatusCache = exports.IssueTitleStateCache = exports.deriveMergeableStatus = exports.PULL_REQUEST_STATUS_CACHE_TTL_MS = exports.ISSUE_TITLE_CACHE_TTL_MS = void 0;
const githubRateLimitRetry_1 = require("../../repositories/issue/githubRateLimitRetry");
exports.ISSUE_TITLE_CACHE_TTL_MS = 300 * 1000;
exports.PULL_REQUEST_STATUS_CACHE_TTL_MS = 30 * 1000;
const deriveMergeableStatus = (mergeable) => {
    if (mergeable === 'MERGEABLE') {
        return 'MERGEABLE';
    }
    if (mergeable === 'CONFLICTING') {
        return 'CONFLICTING';
    }
    return 'UNKNOWN';
};
exports.deriveMergeableStatus = deriveMergeableStatus;
class IssueTitleStateCache {
    constructor(nowMs = () => Date.now()) {
        this.nowMs = nowMs;
        this.entries = new Map();
        this.get = (url) => {
            const entry = this.entries.get(url);
            if (!entry) {
                return null;
            }
            if (entry.state.merged) {
                return entry.state;
            }
            if (this.nowMs() - entry.fetchedAtMs >= exports.ISSUE_TITLE_CACHE_TTL_MS) {
                return null;
            }
            return entry.state;
        };
        this.getStale = (url) => {
            const entry = this.entries.get(url);
            return entry?.state ?? null;
        };
        this.set = (url, state) => {
            this.entries.set(url, { state, fetchedAtMs: this.nowMs() });
        };
    }
}
exports.IssueTitleStateCache = IssueTitleStateCache;
class PullRequestStatusCache {
    constructor(nowMs = () => Date.now()) {
        this.nowMs = nowMs;
        this.entries = new Map();
        this.get = (url) => {
            const entry = this.entries.get(url);
            if (!entry) {
                return null;
            }
            if (this.nowMs() - entry.fetchedAtMs >= exports.PULL_REQUEST_STATUS_CACHE_TTL_MS) {
                return null;
            }
            return entry.status;
        };
        this.getStale = (url) => {
            const entry = this.entries.get(url);
            return entry?.status ?? null;
        };
        this.set = (url, status) => {
            this.entries.set(url, { status, fetchedAtMs: this.nowMs() });
        };
    }
}
exports.PullRequestStatusCache = PullRequestStatusCache;
const isGitHubRateLimitError = (error) => error instanceof githubRateLimitRetry_1.GitHubRateLimitError;
const badRequest = (message) => ({
    statusCode: 400,
    body: { error: message },
});
const ok = (body) => ({
    statusCode: 200,
    body,
});
const rateLimited = (error) => ({
    statusCode: 429,
    body: { error: error.message },
});
const serializeComments = (comments) => comments.map((comment) => ({
    author: comment.author,
    body: comment.body,
    createdAt: comment.createdAt.toISOString(),
}));
const serializeCommits = (commits) => commits.map((commit) => ({
    sha: commit.sha,
    message: commit.message,
    author: commit.author,
    authoredAt: commit.authoredAt.toISOString(),
}));
const handleItemBody = async (issueRepository, url) => {
    if (!url) {
        return badRequest('url query parameter is required');
    }
    try {
        const body = await issueRepository.getIssueOrPullRequestBody(url);
        return ok({ body });
    }
    catch (error) {
        if (isGitHubRateLimitError(error)) {
            return rateLimited(error);
        }
        throw error;
    }
};
exports.handleItemBody = handleItemBody;
const handleComments = async (issueRepository, url) => {
    if (!url) {
        return badRequest('url query parameter is required');
    }
    try {
        const comments = await issueRepository.getIssueOrPullRequestComments(url);
        return ok({ comments: serializeComments(comments) });
    }
    catch (error) {
        if (isGitHubRateLimitError(error)) {
            return rateLimited(error);
        }
        throw error;
    }
};
exports.handleComments = handleComments;
const handlePrFiles = async (issueRepository, url) => {
    if (!url) {
        return badRequest('url query parameter is required');
    }
    try {
        const detail = await issueRepository.getPullRequestDetail(url);
        if (detail === null) {
            return ok({ files: null });
        }
        return ok({ files: detail.files });
    }
    catch (error) {
        if (isGitHubRateLimitError(error)) {
            return rateLimited(error);
        }
        throw error;
    }
};
exports.handlePrFiles = handlePrFiles;
const handlePrCommits = async (issueRepository, url) => {
    if (!url) {
        return badRequest('url query parameter is required');
    }
    try {
        const commits = await issueRepository.getPullRequestCommits(url);
        return ok({ commits: serializeCommits(commits) });
    }
    catch (error) {
        if (isGitHubRateLimitError(error)) {
            return rateLimited(error);
        }
        throw error;
    }
};
exports.handlePrCommits = handlePrCommits;
const handleRelatedPrs = async (issueRepository, url) => {
    if (!url) {
        return badRequest('url query parameter is required');
    }
    try {
        const relatedPullRequests = await issueRepository.findRelatedOpenPRs(url);
        const withSummaries = await Promise.all(relatedPullRequests.map(async (relatedPullRequest) => {
            const summary = await issueRepository.getPullRequestSummary(relatedPullRequest.url);
            return {
                url: relatedPullRequest.url,
                branchName: relatedPullRequest.branchName,
                createdAt: relatedPullRequest.createdAt.toISOString(),
                isDraft: relatedPullRequest.isDraft,
                isConflicted: relatedPullRequest.isConflicted,
                mergeableStatus: (0, exports.deriveMergeableStatus)(relatedPullRequest.mergeable),
                isPassedAllCiJob: relatedPullRequest.isPassedAllCiJob,
                isCiStateSuccess: relatedPullRequest.isCiStateSuccess,
                isResolvedAllReviewComments: relatedPullRequest.isResolvedAllReviewComments,
                isBranchOutOfDate: relatedPullRequest.isBranchOutOfDate,
                missingRequiredCheckNames: relatedPullRequest.missingRequiredCheckNames,
                summary,
            };
        }));
        return ok({ relatedPullRequests: withSummaries });
    }
    catch (error) {
        if (isGitHubRateLimitError(error)) {
            return rateLimited(error);
        }
        throw error;
    }
};
exports.handleRelatedPrs = handleRelatedPrs;
const handleIssueTitle = async (issueRepository, cache, url) => {
    if (!url) {
        return badRequest('url query parameter is required');
    }
    const cached = cache.get(url);
    if (cached !== null) {
        return ok(cached);
    }
    try {
        const state = await issueRepository.getIssueOrPullRequestState(url);
        cache.set(url, state);
        return ok(state);
    }
    catch (error) {
        if (isGitHubRateLimitError(error)) {
            const stale = cache.getStale(url);
            if (stale !== null) {
                return ok(stale);
            }
            return rateLimited(error);
        }
        throw error;
    }
};
exports.handleIssueTitle = handleIssueTitle;
const handlePullRequestStatus = async (issueRepository, cache, url) => {
    if (!url) {
        return badRequest('url query parameter is required');
    }
    const cached = cache.get(url);
    if (cached !== null) {
        return ok(cached);
    }
    try {
        const pullRequest = await issueRepository.getOpenPullRequestCiStatus(url);
        const response = pullRequest === null
            ? { found: false, status: null }
            : {
                found: true,
                status: {
                    isConflicted: pullRequest.isConflicted,
                    mergeableStatus: (0, exports.deriveMergeableStatus)(pullRequest.mergeable),
                    isPassedAllCiJob: pullRequest.isPassedAllCiJob,
                    isCiStateSuccess: pullRequest.isCiStateSuccess,
                    isBranchOutOfDate: pullRequest.isBranchOutOfDate,
                    missingRequiredCheckNames: pullRequest.missingRequiredCheckNames,
                },
            };
        cache.set(url, response);
        return ok(response);
    }
    catch (error) {
        if (isGitHubRateLimitError(error)) {
            const stale = cache.getStale(url);
            if (stale !== null) {
                return ok(stale);
            }
            return rateLimited(error);
        }
        throw error;
    }
};
exports.handlePullRequestStatus = handlePullRequestStatus;
//# sourceMappingURL=consoleReadApi.js.map