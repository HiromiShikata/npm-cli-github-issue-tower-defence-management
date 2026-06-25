import * as fs from 'fs';
import * as path from 'path';
import { readDoneProjectItemIds } from './consoleDoneStore';

export const CONSOLE_LIST_TAB_NAMES: string[] = [
  'workflow-blocker',
  'prs',
  'triage',
  'unread',
  'failed-preparation',
  'todo-by-human',
];

export type ConsoleDataRoute =
  | { kind: 'list'; pjcode: string; tab: string }
  | { kind: 'detail'; pjcode: string; tab: string; key: string }
  | { kind: 'in-tmux'; pjcode: string; relativePath: string };

const SAFE_SEGMENT = /^[A-Za-z0-9._-]+$/;

const isSafeSegment = (segment: string): boolean =>
  SAFE_SEGMENT.test(segment) && !segment.startsWith('.');

export const parseConsoleDataRoute = (
  requestPath: string,
): ConsoleDataRoute | null => {
  const segments = requestPath
    .split('/')
    .filter((segment) => segment.length > 0);
  if (segments.length < 3 || segments[0] !== 'projects') {
    return null;
  }
  const pjcode = segments[1];
  if (!isSafeSegment(pjcode)) {
    return null;
  }
  const tab = segments[2];
  if (!isSafeSegment(tab)) {
    return null;
  }
  if (tab === 'in-tmux-by-human') {
    const rest = segments.slice(3);
    if (rest.length === 0 || rest.some((segment) => !isSafeSegment(segment))) {
      return null;
    }
    return { kind: 'in-tmux', pjcode, relativePath: rest.join('/') };
  }
  if (!CONSOLE_LIST_TAB_NAMES.includes(tab)) {
    return null;
  }
  if (segments.length === 4 && segments[3] === 'list.json') {
    return { kind: 'list', pjcode, tab };
  }
  if (segments.length === 5 && segments[3] === 'detail') {
    const key = segments[4];
    if (!isSafeSegment(key) || !key.endsWith('.json')) {
      return null;
    }
    return { kind: 'detail', pjcode, tab, key };
  }
  return null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

type ReadJsonResult = { found: false } | { found: true; data: unknown };

const readJsonFile = (filePath: string): ReadJsonResult => {
  let raw: string;
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) {
      return { found: false };
    }
    raw = fs.readFileSync(filePath, 'utf-8');
  } catch {
    return { found: false };
  }
  const data: unknown = JSON.parse(raw);
  return { found: true, data };
};

const isExcludedItem = (item: unknown, doneSet: Set<string>): boolean => {
  if (!isRecord(item)) {
    return false;
  }
  const projectItemId = item.projectItemId;
  return typeof projectItemId === 'string' && doneSet.has(projectItemId);
};

const applyDoneExclusion = (
  listData: unknown,
  doneProjectItemIds: string[],
): unknown => {
  if (!isRecord(listData) || !Array.isArray(listData.items)) {
    return listData;
  }
  const doneSet = new Set(doneProjectItemIds);
  const items = listData.items.filter((item) => !isExcludedItem(item, doneSet));
  return { ...listData, items };
};

export type ConsoleDataResponse = {
  statusCode: number;
  contentType: string;
  body: string;
};

export const buildConsoleDataResponse = (
  consoleDataOutputDir: string,
  route: ConsoleDataRoute,
): ConsoleDataResponse => {
  if (route.kind === 'list') {
    const filePath = path.join(
      consoleDataOutputDir,
      route.pjcode,
      route.tab,
      'list.json',
    );
    const listResult = readJsonFile(filePath);
    if (!listResult.found) {
      return notFoundJson();
    }
    const doneProjectItemIds = readDoneProjectItemIds(
      consoleDataOutputDir,
      route.pjcode,
      route.tab,
    );
    const filtered = applyDoneExclusion(listResult.data, doneProjectItemIds);
    return okJson(filtered);
  }
  if (route.kind === 'detail') {
    const filePath = path.join(
      consoleDataOutputDir,
      route.pjcode,
      route.tab,
      'detail',
      route.key,
    );
    const detailResult = readJsonFile(filePath);
    if (!detailResult.found) {
      return notFoundJson();
    }
    return okJson(detailResult.data);
  }
  const inTmuxFilePath = path.join(
    consoleDataOutputDir,
    route.pjcode,
    'in-tmux-by-human',
    route.relativePath,
  );
  const inTmuxResult = readJsonFile(inTmuxFilePath);
  if (!inTmuxResult.found) {
    return notFoundJson();
  }
  return okJson(inTmuxResult.data);
};

const okJson = (data: unknown): ConsoleDataResponse => ({
  statusCode: 200,
  contentType: 'application/json; charset=utf-8',
  body: JSON.stringify(data),
});

const notFoundJson = (): ConsoleDataResponse => ({
  statusCode: 404,
  contentType: 'text/plain; charset=utf-8',
  body: 'Not Found',
});
