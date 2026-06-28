"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handlePullRequestStatus = exports.handleIssueTitle = exports.handleRelatedPrs = exports.handlePrCommits = exports.handlePrFiles = exports.handleComments = exports.handleItemBody = exports.PullRequestStatusCache = exports.IssueTitleStateCache = exports.PULL_REQUEST_STATUS_CACHE_TTL_MS = exports.ISSUE_TITLE_CACHE_TTL_MS = void 0;
exports.ISSUE_TITLE_CACHE_TTL_MS = 300 * 1000;
exports.PULL_REQUEST_STATUS_CACHE_TTL_MS = 30 * 1000;
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
        this.set = (url, status) => {
            this.entries.set(url, { status, fetchedAtMs: this.nowMs() });
        };
    }
}
exports.PullRequestStatusCache = PullRequestStatusCache;
const badRequest = (message) => ({
    statusCode: 400,
    body: { error: message },
});
const ok = (body) => ({
    statusCode: 200,
    body,
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
    const body = await issueRepository.getIssueOrPullRequestBody(url);
    return ok({ body });
};
exports.handleItemBody = handleItemBody;
const handleComments = async (issueRepository, url) => {
    if (!url) {
        return badRequest('url query parameter is required');
    }
    const comments = await issueRepository.getIssueOrPullRequestComments(url);
    return ok({ comments: serializeComments(comments) });
};
exports.handleComments = handleComments;
const handlePrFiles = async (issueRepository, url) => {
    if (!url) {
        return badRequest('url query parameter is required');
    }
    const detail = await issueRepository.getPullRequestDetail(url);
    if (detail === null) {
        return ok({ files: null });
    }
    return ok({ files: detail.files });
};
exports.handlePrFiles = handlePrFiles;
const handlePrCommits = async (issueRepository, url) => {
    if (!url) {
        return badRequest('url query parameter is required');
    }
    const commits = await issueRepository.getPullRequestCommits(url);
    return ok({ commits: serializeCommits(commits) });
};
exports.handlePrCommits = handlePrCommits;
const handleRelatedPrs = async (issueRepository, url) => {
    if (!url) {
        return badRequest('url query parameter is required');
    }
    const relatedPullRequests = await issueRepository.findRelatedOpenPRs(url);
    const withSummaries = await Promise.all(relatedPullRequests.map(async (relatedPullRequest) => {
        const summary = await issueRepository.getPullRequestSummary(relatedPullRequest.url);
        return {
            url: relatedPullRequest.url,
            branchName: relatedPullRequest.branchName,
            createdAt: relatedPullRequest.createdAt.toISOString(),
            isDraft: relatedPullRequest.isDraft,
            isConflicted: relatedPullRequest.isConflicted,
            isPassedAllCiJob: relatedPullRequest.isPassedAllCiJob,
            isCiStateSuccess: relatedPullRequest.isCiStateSuccess,
            isResolvedAllReviewComments: relatedPullRequest.isResolvedAllReviewComments,
            isBranchOutOfDate: relatedPullRequest.isBranchOutOfDate,
            missingRequiredCheckNames: relatedPullRequest.missingRequiredCheckNames,
            summary,
        };
    }));
    return ok({ relatedPullRequests: withSummaries });
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
    const state = await issueRepository.getIssueOrPullRequestState(url);
    cache.set(url, state);
    return ok(state);
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
    const pullRequest = await issueRepository.getOpenPullRequest(url);
    const response = pullRequest === null
        ? { found: false, status: null }
        : {
            found: true,
            status: {
                isConflicted: pullRequest.isConflicted,
                isPassedAllCiJob: pullRequest.isPassedAllCiJob,
                isCiStateSuccess: pullRequest.isCiStateSuccess,
                isBranchOutOfDate: pullRequest.isBranchOutOfDate,
                missingRequiredCheckNames: pullRequest.missingRequiredCheckNames,
            },
        };
    cache.set(url, response);
    return ok(response);
};
exports.handlePullRequestStatus = handlePullRequestStatus;
//# sourceMappingURL=consoleReadApi.js.map