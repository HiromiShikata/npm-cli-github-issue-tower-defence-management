import type {
  ConsoleChangedFile,
  ConsoleComment,
  ConsoleCommit,
  ConsoleIssueState,
  ConsoleRelatedPullRequest,
} from '../logic/types';

export type ConsoleApiClient = {
  fetchItemBody: (url: string) => Promise<string>;
  fetchComments: (url: string) => Promise<ConsoleComment[]>;
  fetchPrFiles: (url: string) => Promise<ConsoleChangedFile[]>;
  fetchPrCommits: (url: string) => Promise<ConsoleCommit[]>;
  fetchRelatedPrs: (url: string) => Promise<ConsoleRelatedPullRequest[]>;
  fetchIssueState: (url: string) => Promise<ConsoleIssueState>;
};

export type ConsoleReviewRequest = {
  pjcode: string;
  action: string;
  prUrl: string;
  projectItemId: string;
  commentBody?: string;
  changedFilePath?: string;
};

export type ConsoleTriageRequest = {
  pjcode: string;
  action: string;
  issueUrl: string;
  projectItemId: string;
  statusName?: string;
  storyOptionId?: string;
  commentBody?: string;
};

export type ConsoleIntmuxRequest = {
  pjcode: string;
  action: 'set_intmux';
  issueUrl: string;
  projectItemId: string;
};

type AppendToken = (url: string) => string;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const getString = (value: unknown): string =>
  typeof value === 'string' ? value : '';

const getNumber = (value: unknown): number =>
  typeof value === 'number' ? value : 0;

const getBoolean = (value: unknown): boolean => value === true;

const requestJson = async (
  appendToken: AppendToken,
  apiPath: string,
  resourceUrl: string,
): Promise<unknown> => {
  const target = appendToken(
    `${apiPath}?url=${encodeURIComponent(resourceUrl)}`,
  );
  const response = await fetch(target);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
};

const parseComments = (payload: unknown): ConsoleComment[] => {
  if (!isRecord(payload) || !Array.isArray(payload.comments)) {
    return [];
  }
  return payload.comments.filter(isRecord).map((comment) => ({
    author: getString(comment.author),
    body: getString(comment.body),
    createdAt: getString(comment.createdAt),
  }));
};

const parseFiles = (payload: unknown): ConsoleChangedFile[] => {
  if (!isRecord(payload) || !Array.isArray(payload.files)) {
    return [];
  }
  return payload.files.filter(isRecord).map((file) => ({
    path: getString(file.path) || getString(file.filename),
    additions: getNumber(file.additions),
    deletions: getNumber(file.deletions),
    status: getString(file.status),
    patch: typeof file.patch === 'string' ? file.patch : null,
  }));
};

const parseCommits = (payload: unknown): ConsoleCommit[] => {
  if (!isRecord(payload) || !Array.isArray(payload.commits)) {
    return [];
  }
  return payload.commits.filter(isRecord).map((commit) => ({
    sha: getString(commit.sha),
    message: getString(commit.message),
    author: getString(commit.author),
    authoredAt: getString(commit.authoredAt),
  }));
};

const parseSummary = (value: unknown): ConsoleRelatedPullRequest['summary'] => {
  if (!isRecord(value)) {
    return null;
  }
  return {
    title: getString(value.title),
    body: getString(value.body),
    additions: getNumber(value.additions),
    deletions: getNumber(value.deletions),
    changedFiles: getNumber(value.changedFiles),
  };
};

const parseRelatedPrs = (payload: unknown): ConsoleRelatedPullRequest[] => {
  if (!isRecord(payload) || !Array.isArray(payload.relatedPullRequests)) {
    return [];
  }
  return payload.relatedPullRequests.filter(isRecord).map((pr) => ({
    url: getString(pr.url),
    branchName: typeof pr.branchName === 'string' ? pr.branchName : null,
    createdAt: getString(pr.createdAt),
    isDraft: getBoolean(pr.isDraft),
    isConflicted: getBoolean(pr.isConflicted),
    isPassedAllCiJob: getBoolean(pr.isPassedAllCiJob),
    isCiStateSuccess: getBoolean(pr.isCiStateSuccess),
    isResolvedAllReviewComments: getBoolean(pr.isResolvedAllReviewComments),
    isBranchOutOfDate: getBoolean(pr.isBranchOutOfDate),
    missingRequiredCheckNames: Array.isArray(pr.missingRequiredCheckNames)
      ? pr.missingRequiredCheckNames.filter(
          (name): name is string => typeof name === 'string',
        )
      : [],
    summary: parseSummary(pr.summary),
  }));
};

const parseState = (payload: unknown): ConsoleIssueState => {
  if (!isRecord(payload)) {
    return { state: 'open', merged: false, isPullRequest: false };
  }
  return {
    state: getString(payload.state) || 'open',
    merged: getBoolean(payload.merged),
    isPullRequest: getBoolean(payload.isPullRequest),
  };
};

export const createConsoleApiClient = (
  appendToken: AppendToken,
): ConsoleApiClient => ({
  fetchItemBody: async (url) => {
    const payload = await requestJson(appendToken, '/api/itembody', url);
    return isRecord(payload) ? getString(payload.body) : '';
  },
  fetchComments: async (url) =>
    parseComments(await requestJson(appendToken, '/api/comments', url)),
  fetchPrFiles: async (url) =>
    parseFiles(await requestJson(appendToken, '/api/prfiles', url)),
  fetchPrCommits: async (url) =>
    parseCommits(await requestJson(appendToken, '/api/prcommits', url)),
  fetchRelatedPrs: async (url) =>
    parseRelatedPrs(await requestJson(appendToken, '/api/relatedprs', url)),
  fetchIssueState: async (url) =>
    parseState(await requestJson(appendToken, '/api/issuetitle', url)),
});

const readOperationErrorReason = async (
  response: Response,
): Promise<string> => {
  const raw = await response.text().catch(() => '');
  if (raw.length === 0) {
    return `HTTP ${response.status}`;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isRecord(parsed) && typeof parsed.error === 'string') {
      return parsed.error;
    }
  } catch {
    return raw;
  }
  return raw;
};

export const postConsoleOperation = async (
  appendToken: AppendToken,
  apiPath: string,
  body: ConsoleReviewRequest | ConsoleTriageRequest | ConsoleIntmuxRequest,
): Promise<void> => {
  const response = await fetch(appendToken(apiPath), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(await readOperationErrorReason(response));
  }
};

export const COMMENT_OPERATION_PATH = '/api/comment';

export type ConsoleCommentRequest = {
  pjcode: string;
  url: string;
  body: string;
};

const parsePostedComment = (payload: unknown): ConsoleComment => {
  if (!isRecord(payload) || !isRecord(payload.comment)) {
    throw new Error('comment was not returned');
  }
  return {
    author: getString(payload.comment.author),
    body: getString(payload.comment.body),
    createdAt: getString(payload.comment.createdAt),
  };
};

export const postConsoleComment = async (
  appendToken: AppendToken,
  request: ConsoleCommentRequest,
): Promise<ConsoleComment> => {
  const response = await fetch(appendToken(COMMENT_OPERATION_PATH), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return parsePostedComment(await response.json());
};
