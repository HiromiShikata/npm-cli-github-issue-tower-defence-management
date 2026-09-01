import * as fs from 'fs';
import * as path from 'path';
import type { IssueRepository } from '../../../domain/usecases/adapter-interfaces/IssueRepository';
import { CONSOLE_LIST_TAB_NAMES } from './consoleTabNames';
import {
  IssueTitleStateCache,
  PullRequestStatusCache,
  handleComments,
  handleIssueTitle,
  handleItemBody,
  handlePrCommits,
  handlePrFiles,
  handlePullRequestStatus,
  handleRelatedPrs,
  deriveMergeableStatus,
} from './consoleReadApi';

export type AirplaneFilesItem = {
  path: string;
  additions: number;
  deletions: number;
  status: string;
  patch: string | null;
  rawUrl: string | null;
};

export type AirplaneCommitItem = {
  sha: string;
  message: string;
  author: string;
  authoredAt: string;
};

export type AirplaneCommentItem = {
  author: string;
  body: string;
  createdAt: string;
};

export type AirplanePrStatusItem = {
  found: boolean;
  isConflicted: boolean;
  mergeableStatus: string;
  isPassedAllCiJob: boolean;
  isCiStateSuccess: boolean;
  isBranchOutOfDate: boolean;
  missingRequiredCheckNames: string[];
};

export type AirplaneStateItem = {
  state: string;
  merged: boolean;
  isPullRequest: boolean;
  title: string;
};

export type AirplaneRelatedPrItem = {
  url: string;
  branchName: string | null;
  createdAt: string;
  isDraft: boolean;
  isConflicted: boolean;
  mergeableStatus: string;
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

export type AirplaneItemData = {
  body: string;
  comments: AirplaneCommentItem[];
  state: AirplaneStateItem;
  files: AirplaneFilesItem[] | null;
  commits: AirplaneCommitItem[] | null;
  prStatus: AirplanePrStatusItem | null;
  relatedPrs: AirplaneRelatedPrItem[] | null;
};

export type AirplaneTabData = Record<string, unknown>;

export type AirplaneSnapshotPayload = {
  capturedAt: string;
  tabs: Record<string, AirplaneTabData>;
  items: Record<string, AirplaneItemData>;
  failures: string[];
};

export type AirplaneSyncEvent =
  | { type: 'progress'; fetched: number; total: number }
  | { type: 'done'; snapshot: AirplaneSnapshotPayload }
  | { type: 'error'; message: string };

const RAW_CONTENT_SIZE_LIMIT = 512 * 1024;

const fetchRawFileContent = async (
  rawUrl: string,
  ghToken: string,
): Promise<{ patch: string | null; dataUrl: string | null }> => {
  try {
    const response = await fetch(rawUrl, {
      headers: { Authorization: `token ${ghToken}` },
    });
    if (!response.ok) {
      return { patch: null, dataUrl: null };
    }
    const contentType = response.headers.get('content-type') ?? '';
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > RAW_CONTENT_SIZE_LIMIT) {
      return { patch: null, dataUrl: null };
    }
    const buffer = Buffer.from(arrayBuffer);
    if (contentType.startsWith('image/')) {
      const base64 = buffer.toString('base64');
      return {
        patch: null,
        dataUrl: `data:${contentType.split(';')[0]};base64,${base64}`,
      };
    }
    if (
      contentType.startsWith('text/') ||
      contentType.includes('json') ||
      contentType.includes('xml') ||
      !buffer.includes(0)
    ) {
      return { patch: buffer.toString('utf-8'), dataUrl: null };
    }
    return { patch: null, dataUrl: null };
  } catch {
    return { patch: null, dataUrl: null };
  }
};

const enrichFilesWithRawContent = async (
  files: AirplaneFilesItem[],
  ghToken: string,
): Promise<AirplaneFilesItem[]> =>
  Promise.all(
    files.map(async (file) => {
      if (file.patch !== null || file.rawUrl === null) {
        return file;
      }
      const result = await fetchRawFileContent(file.rawUrl, ghToken);
      if (result.patch !== null) {
        return { ...file, patch: result.patch };
      }
      if (result.dataUrl !== null) {
        return { ...file, rawUrl: result.dataUrl };
      }
      return file;
    }),
  );

export type AirplaneSyncResponseWriter = {
  writeHead(statusCode: number, headers: Record<string, string>): void;
  write(data: string): void;
  end(): void;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const getString = (value: unknown): string =>
  typeof value === 'string' ? value : '';

const getNumber = (value: unknown): number =>
  typeof value === 'number' ? value : 0;

const getBoolean = (value: unknown): boolean => value === true;

const parseStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];

const normalizePrFiles = (body: unknown): AirplaneFilesItem[] | null => {
  if (!isRecord(body)) {
    return null;
  }
  if (body.files === null) {
    return null;
  }
  if (!Array.isArray(body.files)) {
    return [];
  }
  return body.files.filter(isRecord).map((file) => ({
    path: getString(file.path) || getString(file.filename),
    additions: getNumber(file.additions),
    deletions: getNumber(file.deletions),
    status: getString(file.status),
    patch: typeof file.patch === 'string' ? file.patch : null,
    rawUrl: typeof file.rawUrl === 'string' ? file.rawUrl : null,
  }));
};

const normalizePrCommits = (body: unknown): AirplaneCommitItem[] => {
  if (!isRecord(body) || !Array.isArray(body.commits)) {
    return [];
  }
  return body.commits.filter(isRecord).map((commit) => ({
    sha: getString(commit.sha),
    message: getString(commit.message),
    author: getString(commit.author),
    authoredAt: getString(commit.authoredAt),
  }));
};

const normalizePrStatus = (body: unknown): AirplanePrStatusItem => {
  if (!isRecord(body)) {
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
  const found = getBoolean(body.found);
  const status = isRecord(body.status) ? body.status : {};
  return {
    found,
    isConflicted: getBoolean(status.isConflicted),
    mergeableStatus: getString(status.mergeableStatus) || 'UNKNOWN',
    isPassedAllCiJob: getBoolean(status.isPassedAllCiJob),
    isCiStateSuccess: getBoolean(status.isCiStateSuccess),
    isBranchOutOfDate: getBoolean(status.isBranchOutOfDate),
    missingRequiredCheckNames: parseStringArray(
      status.missingRequiredCheckNames,
    ),
  };
};

const normalizeComments = (body: unknown): AirplaneCommentItem[] => {
  if (!isRecord(body) || !Array.isArray(body.comments)) {
    return [];
  }
  return body.comments.filter(isRecord).map((comment) => ({
    author: getString(comment.author),
    body: getString(comment.body),
    createdAt: getString(comment.createdAt),
  }));
};

const normalizeState = (body: unknown): AirplaneStateItem => {
  if (!isRecord(body)) {
    return { state: 'open', merged: false, isPullRequest: false, title: '' };
  }
  return {
    state: getString(body.state) || 'open',
    merged: getBoolean(body.merged),
    isPullRequest: getBoolean(body.isPullRequest),
    title: getString(body.title),
  };
};

const normalizeRelatedPrs = (body: unknown): AirplaneRelatedPrItem[] => {
  if (!isRecord(body) || !Array.isArray(body.relatedPullRequests)) {
    return [];
  }
  return body.relatedPullRequests.filter(isRecord).map((pr) => {
    const summary = isRecord(pr.summary)
      ? {
          title: getString(pr.summary.title),
          body: getString(pr.summary.body),
          additions: getNumber(pr.summary.additions),
          deletions: getNumber(pr.summary.deletions),
          changedFiles: getNumber(pr.summary.changedFiles),
        }
      : null;
    return {
      url: getString(pr.url),
      branchName: typeof pr.branchName === 'string' ? pr.branchName : null,
      createdAt: getString(pr.createdAt),
      isDraft: getBoolean(pr.isDraft),
      isConflicted: getBoolean(pr.isConflicted),
      mergeableStatus:
        getString(pr.mergeableStatus) ||
        deriveMergeableStatus(
          typeof pr.mergeable === 'string' ? pr.mergeable : null,
        ),
      isPassedAllCiJob: getBoolean(pr.isPassedAllCiJob),
      isCiStateSuccess: getBoolean(pr.isCiStateSuccess),
      isResolvedAllReviewComments: getBoolean(pr.isResolvedAllReviewComments),
      isBranchOutOfDate: getBoolean(pr.isBranchOutOfDate),
      missingRequiredCheckNames: parseStringArray(pr.missingRequiredCheckNames),
      summary,
    };
  });
};

const discoverPjcodes = (consoleDataOutputDir: string): string[] => {
  try {
    const entries = fs.readdirSync(consoleDataOutputDir, {
      withFileTypes: true,
    });
    return entries
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
      .map((entry) => entry.name);
  } catch {
    return [];
  }
};

const readTabListJson = (
  consoleDataOutputDir: string,
  pjcode: string,
  tab: string,
): unknown => {
  const filePath = path.join(consoleDataOutputDir, pjcode, tab, 'list.json');
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) {
      return null;
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

type UniqueItem = { url: string; isPr: boolean };

const collectUniqueItems = (
  tabData: Record<string, AirplaneTabData>,
): UniqueItem[] => {
  const seen = new Set<string>();
  const items: UniqueItem[] = [];
  for (const pjTabs of Object.values(tabData)) {
    for (const tabPayload of Object.values(pjTabs)) {
      if (!isRecord(tabPayload) || !Array.isArray(tabPayload.items)) {
        continue;
      }
      for (const item of tabPayload.items) {
        if (!isRecord(item) || typeof item.url !== 'string') {
          continue;
        }
        if (seen.has(item.url)) {
          continue;
        }
        seen.add(item.url);
        items.push({ url: item.url, isPr: getBoolean(item.isPr) });
      }
    }
  }
  return items;
};

const runWithConcurrency = async (
  tasks: Array<() => Promise<void>>,
  limit: number,
): Promise<void> => {
  let index = 0;
  const workers = Array.from(
    { length: Math.min(limit, tasks.length) },
    async () => {
      while (index < tasks.length) {
        const current = tasks[index];
        index += 1;
        await current();
      }
    },
  );
  await Promise.all(workers);
};

const SYNC_CONCURRENCY_LIMIT = 5;

const writeSseEvent = (
  response: AirplaneSyncResponseWriter,
  event: AirplaneSyncEvent,
): void => {
  response.write(`data: ${JSON.stringify(event)}\n\n`);
};

export const handleAirplaneSync = async (
  response: AirplaneSyncResponseWriter,
  consoleDataOutputDir: string,
  resolveIssueRepository: (url: string) => IssueRepository,
  issueTitleStateCache: IssueTitleStateCache,
  pullRequestStatusCache: PullRequestStatusCache,
  ghToken: string | null = null,
): Promise<void> => {
  response.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-store',
    Connection: 'keep-alive',
  });

  const pjcodes = discoverPjcodes(consoleDataOutputDir);
  const tabData: Record<string, AirplaneTabData> = {};
  for (const pjcode of pjcodes) {
    const pjTabs: AirplaneTabData = {};
    for (const tab of CONSOLE_LIST_TAB_NAMES) {
      const payload = readTabListJson(consoleDataOutputDir, pjcode, tab);
      if (payload !== null) {
        pjTabs[tab] = payload;
      }
    }
    tabData[pjcode] = pjTabs;
  }

  const uniqueItems = collectUniqueItems(tabData);
  const total = uniqueItems.length;
  let fetched = 0;
  const failures: string[] = [];
  const items: Record<string, AirplaneItemData> = {};

  writeSseEvent(response, { type: 'progress', fetched: 0, total });

  const tasks = uniqueItems.map((item) => async (): Promise<void> => {
    const { url, isPr } = item;
    try {
      const issueRepository = resolveIssueRepository(url);
      const [bodyResult, commentsResult, stateResult] = await Promise.all([
        handleItemBody(issueRepository, url),
        handleComments(issueRepository, url),
        handleIssueTitle(issueRepository, issueTitleStateCache, url),
      ]);

      let files: AirplaneFilesItem[] | null = null;
      let commits: AirplaneCommitItem[] | null = null;
      let prStatus: AirplanePrStatusItem | null = null;
      let relatedPrs: AirplaneRelatedPrItem[] | null = null;

      if (isPr) {
        const [filesResult, commitsResult, prStatusResult] = await Promise.all([
          handlePrFiles(issueRepository, url),
          handlePrCommits(issueRepository, url),
          handlePullRequestStatus(issueRepository, pullRequestStatusCache, url),
        ]);
        files = normalizePrFiles(filesResult.body);
        if (files !== null && ghToken !== null) {
          files = await enrichFilesWithRawContent(files, ghToken);
        }
        commits = normalizePrCommits(commitsResult.body);
        prStatus = normalizePrStatus(prStatusResult.body);
      } else {
        const relatedPrsResult = await handleRelatedPrs(issueRepository, url);
        relatedPrs = normalizeRelatedPrs(relatedPrsResult.body);
      }

      items[url] = {
        body:
          isRecord(bodyResult.body) && typeof bodyResult.body.body === 'string'
            ? bodyResult.body.body
            : '',
        comments: normalizeComments(commentsResult.body),
        state: normalizeState(stateResult.body),
        files,
        commits,
        prStatus,
        relatedPrs,
      };
    } catch (error) {
      console.error('Airplane sync item failed:', url, error);
      failures.push(url);
    }
    fetched += 1;
    writeSseEvent(response, { type: 'progress', fetched, total });
  });

  await runWithConcurrency(tasks, SYNC_CONCURRENCY_LIMIT);

  const snapshot: AirplaneSnapshotPayload = {
    capturedAt: new Date().toISOString(),
    tabs: tabData,
    items,
    failures,
  };

  writeSseEvent(response, { type: 'done', snapshot });
  response.end();
};
