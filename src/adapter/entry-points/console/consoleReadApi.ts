import {
  IssueRepository,
  IssueComment,
  PullRequestCommit,
} from '../../../domain/usecases/adapter-interfaces/IssueRepository';

export const ISSUE_TITLE_CACHE_TTL_MS = 300 * 1000;

export const PULL_REQUEST_STATUS_CACHE_TTL_MS = 30 * 1000;

export type IssueOrPullRequestState = {
  state: string;
  merged: boolean;
  isPullRequest: boolean;
  title: string;
};

export type MergeableStatus = 'MERGEABLE' | 'CONFLICTING' | 'UNKNOWN';

export const deriveMergeableStatus = (
  mergeable: string | null,
): MergeableStatus => {
  if (mergeable === 'MERGEABLE') {
    return 'MERGEABLE';
  }
  if (mergeable === 'CONFLICTING') {
    return 'CONFLICTING';
  }
  return 'UNKNOWN';
};

export type PullRequestStatus = {
  isConflicted: boolean;
  mergeableStatus: MergeableStatus;
  isPassedAllCiJob: boolean;
  isCiStateSuccess: boolean;
  isBranchOutOfDate: boolean;
  missingRequiredCheckNames: string[];
};

export type PullRequestStatusResponse = {
  found: boolean;
  status: PullRequestStatus | null;
};

type IssueTitleCacheEntry = {
  state: IssueOrPullRequestState;
  fetchedAtMs: number;
};

type PullRequestStatusCacheEntry = {
  status: PullRequestStatusResponse;
  fetchedAtMs: number;
};

export class IssueTitleStateCache {
  private readonly entries = new Map<string, IssueTitleCacheEntry>();

  constructor(private readonly nowMs: () => number = () => Date.now()) {}

  get = (url: string): IssueOrPullRequestState | null => {
    const entry = this.entries.get(url);
    if (!entry) {
      return null;
    }
    if (entry.state.merged) {
      return entry.state;
    }
    if (this.nowMs() - entry.fetchedAtMs >= ISSUE_TITLE_CACHE_TTL_MS) {
      return null;
    }
    return entry.state;
  };

  set = (url: string, state: IssueOrPullRequestState): void => {
    this.entries.set(url, { state, fetchedAtMs: this.nowMs() });
  };
}

export class PullRequestStatusCache {
  private readonly entries = new Map<string, PullRequestStatusCacheEntry>();

  constructor(private readonly nowMs: () => number = () => Date.now()) {}

  get = (url: string): PullRequestStatusResponse | null => {
    const entry = this.entries.get(url);
    if (!entry) {
      return null;
    }
    if (this.nowMs() - entry.fetchedAtMs >= PULL_REQUEST_STATUS_CACHE_TTL_MS) {
      return null;
    }
    return entry.status;
  };

  set = (url: string, status: PullRequestStatusResponse): void => {
    this.entries.set(url, { status, fetchedAtMs: this.nowMs() });
  };
}

export type ConsoleReadApiResponse = {
  statusCode: number;
  body: unknown;
};

const GITHUB_RATE_LIMIT_MESSAGE_PATTERN = /GitHub rate limit exceeded/;

const isGitHubRateLimitError = (error: unknown): error is Error =>
  error instanceof Error &&
  GITHUB_RATE_LIMIT_MESSAGE_PATTERN.test(error.message);

const badRequest = (message: string): ConsoleReadApiResponse => ({
  statusCode: 400,
  body: { error: message },
});

const ok = (body: unknown): ConsoleReadApiResponse => ({
  statusCode: 200,
  body,
});

const rateLimited = (error: Error): ConsoleReadApiResponse => ({
  statusCode: 429,
  body: { error: error.message },
});

export type RelatedPullRequestWithSummary = {
  url: string;
  branchName: string | null;
  createdAt: string;
  isDraft: boolean;
  isConflicted: boolean;
  mergeableStatus: MergeableStatus;
  isPassedAllCiJob: boolean;
  isCiStateSuccess: boolean;
  isResolvedAllReviewComments: boolean;
  isBranchOutOfDate: boolean;
  missingRequiredCheckNames: string[];
  summary: {
    title: string;
    body: string;
    additions: number;
    deletions: number;
    changedFiles: number;
  } | null;
};

const serializeComments = (
  comments: IssueComment[],
): { author: string; body: string; createdAt: string }[] =>
  comments.map((comment) => ({
    author: comment.author,
    body: comment.body,
    createdAt: comment.createdAt.toISOString(),
  }));

const serializeCommits = (
  commits: PullRequestCommit[],
): { sha: string; message: string; author: string; authoredAt: string }[] =>
  commits.map((commit) => ({
    sha: commit.sha,
    message: commit.message,
    author: commit.author,
    authoredAt: commit.authoredAt.toISOString(),
  }));

export const handleItemBody = async (
  issueRepository: IssueRepository,
  url: string | null,
): Promise<ConsoleReadApiResponse> => {
  if (!url) {
    return badRequest('url query parameter is required');
  }
  try {
    const body = await issueRepository.getIssueOrPullRequestBody(url);
    return ok({ body });
  } catch (error) {
    if (isGitHubRateLimitError(error)) {
      return rateLimited(error);
    }
    throw error;
  }
};

export const handleComments = async (
  issueRepository: IssueRepository,
  url: string | null,
): Promise<ConsoleReadApiResponse> => {
  if (!url) {
    return badRequest('url query parameter is required');
  }
  try {
    const comments = await issueRepository.getIssueOrPullRequestComments(url);
    return ok({ comments: serializeComments(comments) });
  } catch (error) {
    if (isGitHubRateLimitError(error)) {
      return rateLimited(error);
    }
    throw error;
  }
};

export const handlePrFiles = async (
  issueRepository: IssueRepository,
  url: string | null,
): Promise<ConsoleReadApiResponse> => {
  if (!url) {
    return badRequest('url query parameter is required');
  }
  try {
    const detail = await issueRepository.getPullRequestDetail(url);
    if (detail === null) {
      return ok({ files: null });
    }
    return ok({ files: detail.files });
  } catch (error) {
    if (isGitHubRateLimitError(error)) {
      return rateLimited(error);
    }
    throw error;
  }
};

export const handlePrCommits = async (
  issueRepository: IssueRepository,
  url: string | null,
): Promise<ConsoleReadApiResponse> => {
  if (!url) {
    return badRequest('url query parameter is required');
  }
  try {
    const commits = await issueRepository.getPullRequestCommits(url);
    return ok({ commits: serializeCommits(commits) });
  } catch (error) {
    if (isGitHubRateLimitError(error)) {
      return rateLimited(error);
    }
    throw error;
  }
};

export const handleRelatedPrs = async (
  issueRepository: IssueRepository,
  url: string | null,
): Promise<ConsoleReadApiResponse> => {
  if (!url) {
    return badRequest('url query parameter is required');
  }
  try {
    const relatedPullRequests = await issueRepository.findRelatedOpenPRs(url);
    const withSummaries: RelatedPullRequestWithSummary[] = await Promise.all(
      relatedPullRequests.map(async (relatedPullRequest) => {
        const summary = await issueRepository.getPullRequestSummary(
          relatedPullRequest.url,
        );
        return {
          url: relatedPullRequest.url,
          branchName: relatedPullRequest.branchName,
          createdAt: relatedPullRequest.createdAt.toISOString(),
          isDraft: relatedPullRequest.isDraft,
          isConflicted: relatedPullRequest.isConflicted,
          mergeableStatus: deriveMergeableStatus(relatedPullRequest.mergeable),
          isPassedAllCiJob: relatedPullRequest.isPassedAllCiJob,
          isCiStateSuccess: relatedPullRequest.isCiStateSuccess,
          isResolvedAllReviewComments:
            relatedPullRequest.isResolvedAllReviewComments,
          isBranchOutOfDate: relatedPullRequest.isBranchOutOfDate,
          missingRequiredCheckNames: relatedPullRequest.missingRequiredCheckNames,
          summary,
        };
      }),
    );
    return ok({ relatedPullRequests: withSummaries });
  } catch (error) {
    if (isGitHubRateLimitError(error)) {
      return rateLimited(error);
    }
    throw error;
  }
};

export const handleIssueTitle = async (
  issueRepository: IssueRepository,
  cache: IssueTitleStateCache,
  url: string | null,
): Promise<ConsoleReadApiResponse> => {
  if (!url) {
    return badRequest('url query parameter is required');
  }
  const cached = cache.get(url);
  if (cached !== null) {
    return ok(cached);
  }
  try {
    const state: IssueOrPullRequestState =
      await issueRepository.getIssueOrPullRequestState(url);
    cache.set(url, state);
    return ok(state);
  } catch (error) {
    if (isGitHubRateLimitError(error)) {
      return rateLimited(error);
    }
    throw error;
  }
};

export const handlePullRequestStatus = async (
  issueRepository: IssueRepository,
  cache: PullRequestStatusCache,
  url: string | null,
): Promise<ConsoleReadApiResponse> => {
  if (!url) {
    return badRequest('url query parameter is required');
  }
  const cached = cache.get(url);
  if (cached !== null) {
    return ok(cached);
  }
  try {
    const pullRequest = await issueRepository.getOpenPullRequestCiStatus(url);
    const response: PullRequestStatusResponse =
      pullRequest === null
        ? { found: false, status: null }
        : {
            found: true,
            status: {
              isConflicted: pullRequest.isConflicted,
              mergeableStatus: deriveMergeableStatus(pullRequest.mergeable),
              isPassedAllCiJob: pullRequest.isPassedAllCiJob,
              isCiStateSuccess: pullRequest.isCiStateSuccess,
              isBranchOutOfDate: pullRequest.isBranchOutOfDate,
              missingRequiredCheckNames: pullRequest.missingRequiredCheckNames,
            },
          };
    cache.set(url, response);
    return ok(response);
  } catch (error) {
    if (isGitHubRateLimitError(error)) {
      return rateLimited(error);
    }
    throw error;
  }
};
