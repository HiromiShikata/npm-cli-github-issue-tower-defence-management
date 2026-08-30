import type {
  ConsoleChangedFile,
  ConsoleColor,
  ConsoleComment,
  ConsoleCommit,
  ConsoleIssueState,
  ConsoleMergeableStatus,
  ConsolePullRequestStatus,
  ConsoleRelatedPullRequest,
} from '../logic/types';

export type ConsoleApiClient = {
  fetchItemBody: (url: string) => Promise<string>;
  fetchComments: (url: string) => Promise<ConsoleComment[]>;
  fetchPrFiles: (url: string) => Promise<ConsoleChangedFile[]>;
  fetchPrCommits: (url: string) => Promise<ConsoleCommit[]>;
  fetchRelatedPrs: (url: string) => Promise<ConsoleRelatedPullRequest[]>;
  fetchIssueState: (url: string) => Promise<ConsoleIssueState>;
  fetchPullRequestStatus: (url: string) => Promise<ConsolePullRequestStatus>;
};

export type ConsoleReviewRequest = {
  pjcode: string;
  action: string;
  prUrl: string;
  projectItemId: string;
  issueUrl?: string;
  commentBody?: string;
  issueCommentBody?: string;
  changedFilePath?: string;
  line?: number;
  side?: ConsoleReviewCommentSide;
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

export type ConsoleReviewCommentSide = 'LEFT' | 'RIGHT';

export type ConsoleReviewCommentRequest = {
  pjcode: string;
  url: string;
  path: string;
  line: number;
  side: ConsoleReviewCommentSide;
  body: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const getString = (value: unknown): string =>
  typeof value === 'string' ? value : '';

const getNumber = (value: unknown): number =>
  typeof value === 'number' ? value : 0;

const getBoolean = (value: unknown): boolean => value === true;

const CONSOLE_API_CACHE_NAME = 'console-api-v1';

const requestJson = async (
  apiPath: string,
  resourceUrl: string,
): Promise<unknown> => {
  const url = `${apiPath}?url=${encodeURIComponent(resourceUrl)}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`;
      try {
        const payload: unknown = await response.json();
        if (
          isRecord(payload) &&
          typeof payload.error === 'string' &&
          payload.error.length > 0
        ) {
          errorMessage = payload.error;
        }
      } catch (e: unknown) {
        console.warn('Failed to parse error body from non-ok response:', e);
      }
      throw new Error(errorMessage);
    }
    const payload: unknown = await response.json();
    try {
      if ('caches' in globalThis) {
        globalThis.caches
          .open(CONSOLE_API_CACHE_NAME)
          .then((cache) =>
            cache.put(
              url,
              new Response(JSON.stringify(payload), {
                headers: { 'Content-Type': 'application/json' },
              }),
            ),
          )
          .catch((e: unknown) => {
            console.warn('Failed to persist API response to cache:', e);
          });
      }
    } catch (e: unknown) {
      console.warn('Failed to access cache storage:', e);
    }
    return payload;
  } catch (e: unknown) {
    try {
      if ('caches' in globalThis) {
        const cache = await globalThis.caches.open(CONSOLE_API_CACHE_NAME);
        const cached = await cache.match(url);
        if (cached !== undefined) {
          return cached.json();
        }
      }
    } catch {
      // cache read failure, fall through to original error
    }
    throw e;
  }
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
    rawUrl: typeof file.rawUrl === 'string' ? file.rawUrl : null,
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

const parseStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((name): name is string => typeof name === 'string')
    : [];

const parseMergeableStatus = (value: unknown): ConsoleMergeableStatus => {
  if (value === 'MERGEABLE') {
    return 'MERGEABLE';
  }
  if (value === 'CONFLICTING') {
    return 'CONFLICTING';
  }
  return 'UNKNOWN';
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
    mergeableStatus: parseMergeableStatus(pr.mergeableStatus),
    isPassedAllCiJob: getBoolean(pr.isPassedAllCiJob),
    isCiStateSuccess: getBoolean(pr.isCiStateSuccess),
    isResolvedAllReviewComments: getBoolean(pr.isResolvedAllReviewComments),
    isBranchOutOfDate: getBoolean(pr.isBranchOutOfDate),
    missingRequiredCheckNames: parseStringArray(pr.missingRequiredCheckNames),
    summary: parseSummary(pr.summary),
  }));
};

const parsePullRequestStatus = (payload: unknown): ConsolePullRequestStatus => {
  if (!isRecord(payload) || !isRecord(payload.status)) {
    return {
      found: false,
      isConflicted: false,
      mergeableStatus: 'UNKNOWN',
      isPassedAllCiJob: false,
      isCiStateSuccess: false,
      isBranchOutOfDate: false,
      missingRequiredCheckNames: [],
    };
  }
  const status = payload.status;
  return {
    found: true,
    isConflicted: getBoolean(status.isConflicted),
    mergeableStatus: parseMergeableStatus(status.mergeableStatus),
    isPassedAllCiJob: getBoolean(status.isPassedAllCiJob),
    isCiStateSuccess: getBoolean(status.isCiStateSuccess),
    isBranchOutOfDate: getBoolean(status.isBranchOutOfDate),
    missingRequiredCheckNames: parseStringArray(
      status.missingRequiredCheckNames,
    ),
  };
};

const parseState = (payload: unknown): ConsoleIssueState => {
  if (!isRecord(payload)) {
    return { state: 'open', merged: false, isPullRequest: false, title: '' };
  }
  return {
    state: getString(payload.state) || 'open',
    merged: getBoolean(payload.merged),
    isPullRequest: getBoolean(payload.isPullRequest),
    title: getString(payload.title),
  };
};

export const createConsoleApiClient = (): ConsoleApiClient => ({
  fetchItemBody: async (url) => {
    const payload = await requestJson('/api/itembody', url);
    return isRecord(payload) ? getString(payload.body) : '';
  },
  fetchComments: async (url) =>
    parseComments(await requestJson('/api/comments', url)),
  fetchPrFiles: async (url) =>
    parseFiles(await requestJson('/api/prfiles', url)),
  fetchPrCommits: async (url) =>
    parseCommits(await requestJson('/api/prcommits', url)),
  fetchRelatedPrs: async (url) =>
    parseRelatedPrs(await requestJson('/api/relatedprs', url)),
  fetchIssueState: async (url) =>
    parseState(await requestJson('/api/issuetitle', url)),
  fetchPullRequestStatus: async (url) =>
    parsePullRequestStatus(await requestJson('/api/pullrequeststatus', url)),
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

export const postConsoleOperation = async <T extends Record<string, unknown>>(
  apiPath: string,
  body: T,
): Promise<void> => {
  const response = await fetch(apiPath, {
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
  request: ConsoleCommentRequest,
): Promise<ConsoleComment> => {
  const response = await fetch(COMMENT_OPERATION_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return parsePostedComment(await response.json());
};

export const ATTACHMENT_UPLOAD_OPERATION_PATH = '/api/upload';

export type ConsoleAttachmentUploadRequest = {
  pjcode: string;
  url: string;
  fileName: string;
  contentBase64: string;
};

export const encodeAttachmentContent = (bytes: Uint8Array): string => {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
};

export const postConsoleAttachment = async (
  request: ConsoleAttachmentUploadRequest,
): Promise<string> => {
  const response = await fetch(ATTACHMENT_UPLOAD_OPERATION_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    throw new Error(await readOperationErrorReason(response));
  }
  const payload: unknown = await response.json();
  if (!isRecord(payload) || typeof payload.markdown !== 'string') {
    throw new Error('markdown was not returned');
  }
  return payload.markdown;
};

export const ADD_STORY_OPERATION_PATH = '/api/addstory';

export type ConsoleAddStoryRequest = {
  pjcode: string;
  storyName: string;
};

export const postConsoleAddStory = async (
  request: ConsoleAddStoryRequest,
): Promise<void> => {
  const response = await fetch(ADD_STORY_OPERATION_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    throw new Error(await readOperationErrorReason(response));
  }
};

export const REVIEW_COMMENT_OPERATION_PATH = '/api/reviewcomment';

export const postConsoleReviewComment = async (
  request: ConsoleReviewCommentRequest,
): Promise<void> => {
  const response = await fetch(REVIEW_COMMENT_OPERATION_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    throw new Error(await readOperationErrorReason(response));
  }
};

export const CREATE_ISSUE_OPERATION_PATH = '/api/createissue';

export type ConsoleCreateIssueRequest = {
  pjcode: string;
  title: string;
  storyOptionId: string;
  nameWithOwner: string;
};

export const STORY_COLOR_OPERATION_PATH = '/api/storycolor';

export type ConsoleStoryColorRequest = {
  pjcode: string;
  storyOptionId: string;
  newColor: ConsoleColor;
  nameWithOwner: string;
};

export const postConsoleStoryColor = async (
  request: ConsoleStoryColorRequest,
): Promise<void> => {
  const response = await fetch(STORY_COLOR_OPERATION_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    throw new Error(await readOperationErrorReason(response));
  }
};

export const postConsoleCreateIssue = async (
  request: ConsoleCreateIssueRequest,
): Promise<string> => {
  const response = await fetch(CREATE_ISSUE_OPERATION_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    throw new Error(await readOperationErrorReason(response));
  }
  const payload: unknown = await response.json();
  const isRecord = (v: unknown): v is Record<string, unknown> =>
    v !== null && typeof v === 'object' && !Array.isArray(v);
  if (!isRecord(payload) || typeof payload.issueUrl !== 'string') {
    throw new Error('issueUrl was not returned');
  }
  return payload.issueUrl;
};

export const REORDER_STORY_OPERATION_PATH = '/api/reorderstory';

export type ConsoleReorderStoryRequest = {
  pjcode: string;
  storyOptionId: string;
  direction: 'up' | 'down';
};

export const postConsoleReorderStory = async (
  request: ConsoleReorderStoryRequest,
): Promise<void> => {
  const response = await fetch(REORDER_STORY_OPERATION_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    throw new Error(await readOperationErrorReason(response));
  }
};

export type ProjectListResponse = {
  pjcodes: string[];
  workflowImprovementIssueUrl: string | null;
};

export const fetchProjectList = async (): Promise<ProjectListResponse> => {
  const response = await fetch('/api/projects');
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const payload: unknown = await response.json();
  if (
    payload === null ||
    typeof payload !== 'object' ||
    Array.isArray(payload)
  ) {
    return { pjcodes: [], workflowImprovementIssueUrl: null };
  }
  const record = payload as Record<string, unknown>;
  const pjcodes = Array.isArray(record.pjcodes)
    ? record.pjcodes.filter(
        (entry): entry is string => typeof entry === 'string',
      )
    : [];
  const workflowImprovementIssueUrl =
    typeof record.workflowImprovementIssueUrl === 'string'
      ? record.workflowImprovementIssueUrl
      : null;
  return { pjcodes, workflowImprovementIssueUrl };
};
