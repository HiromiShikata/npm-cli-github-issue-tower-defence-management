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

export type PullRequestStatus = {
  isConflicted: boolean;
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

const badRequest = (message: string): ConsoleReadApiResponse => ({
  statusCode: 400,
  body: { error: message },
});

const ok = (body: unknown): ConsoleReadApiResponse => ({
  statusCode: 200,
  body,
});

export type RelatedPullRequestWithSummary = {
  url: string;
  branchName: string | null;
  createdAt: string;
  isDraft: boolean;
  isConflicted: boolean;
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
  const body = await issueRepository.getIssueOrPullRequestBody(url);
  return ok({ body });
};

export const handleComments = async (
  issueRepository: IssueRepository,
  url: string | null,
): Promise<ConsoleReadApiResponse> => {
  if (!url) {
    return badRequest('url query parameter is required');
  }
  const comments = await issueRepository.getIssueOrPullRequestComments(url);
  return ok({ comments: serializeComments(comments) });
};

export const handlePrFiles = async (
  issueRepository: IssueRepository,
  url: string | null,
): Promise<ConsoleReadApiResponse> => {
  if (!url) {
    return badRequest('url query parameter is required');
  }
  const detail = await issueRepository.getPullRequestDetail(url);
  if (detail === null) {
    return ok({ files: null });
  }
  return ok({ files: detail.files });
};

export const handlePrCommits = async (
  issueRepository: IssueRepository,
  url: string | null,
): Promise<ConsoleReadApiResponse> => {
  if (!url) {
    return badRequest('url query parameter is required');
  }
  const commits = await issueRepository.getPullRequestCommits(url);
  return ok({ commits: serializeCommits(commits) });
};

export const handleRelatedPrs = async (
  issueRepository: IssueRepository,
  url: string | null,
): Promise<ConsoleReadApiResponse> => {
  if (!url) {
    return badRequest('url query parameter is required');
  }
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
};

const resolveIssueOrPullRequestTitle = async (
  issueRepository: IssueRepository,
  url: string,
  isPullRequest: boolean,
): Promise<string> => {
  if (isPullRequest) {
    const summary = await issueRepository.getPullRequestSummary(url);
    return summary?.title ?? '';
  }
  const issue = await issueRepository.getIssueByUrl(url);
  return issue?.title ?? '';
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
  const baseState = await issueRepository.getIssueOrPullRequestState(url);
  const title = await resolveIssueOrPullRequestTitle(
    issueRepository,
    url,
    baseState.isPullRequest,
  );
  const state: IssueOrPullRequestState = { ...baseState, title };
  cache.set(url, state);
  return ok(state);
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
  const pullRequest = await issueRepository.getOpenPullRequest(url);
  const response: PullRequestStatusResponse =
    pullRequest === null
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
