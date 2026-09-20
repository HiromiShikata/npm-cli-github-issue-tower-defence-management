import fs from 'fs';
import path from 'path';
import type { Issue } from '../../../domain/entities/Issue';
import type { Project } from '../../../domain/entities/Project';
import {
  ConsoleLists,
  GenerateConsoleListsUseCase,
} from '../../../domain/usecases/console/GenerateConsoleListsUseCase';
import { appendCloseEventCount } from '../console/consoleCloseEventStore';
import { resetDoneProjectItemIdsAcrossTabs } from '../console/consoleDoneStore';
import { CONSOLE_LIST_TAB_NAMES, isRecord } from '../console/consoleTabNames';

export const CONSOLE_WRITE_LOCK_STALE_TIMEOUT_MS = 30 * 1000;

export type ConsoleListsWriterParams = {
  consoleDataOutputDir: string | null | undefined;
  pjcode: string | null | undefined;
  assigneeLogin: string | null | undefined;
  project: Project;
  issues: Issue[];
  workflowBlockerStoryName?: string | null | undefined;
  urlOfStoryView?: string | null;
  generatedAt?: string;
  nowMs?: number;
  defaultTaskNameWithOwner?: string | null;
};

export const formatConsoleGeneratedAt = (date: Date): string =>
  date.toISOString().replace(/\.\d{3}Z$/, 'Z');

const errorCode = (err: unknown): string | null => {
  if (!isRecord(err)) return null;
  const code = err.code;
  return typeof code === 'string' ? code : null;
};

const tryCreateLock = (lockPath: string): boolean => {
  try {
    const fd = fs.openSync(
      lockPath,
      fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY,
    );
    fs.closeSync(fd);
    return true;
  } catch (err) {
    if (errorCode(err) === 'EEXIST') return false;
    throw err;
  }
};

const writeJsonAtomic = (filePath: string, data: unknown): void => {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmpPath = `${filePath}.tmp.${process.pid}`;
  fs.writeFileSync(tmpPath, JSON.stringify(data));
  fs.renameSync(tmpPath, filePath);
};

const readItemIdsFromTabList = (listPath: string): string[] => {
  let raw: string;
  try {
    raw = fs.readFileSync(listPath, 'utf-8');
  } catch {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!isRecord(parsed) || !Array.isArray(parsed.items)) {
    return [];
  }
  const ids: string[] = [];
  for (const item of parsed.items) {
    if (isRecord(item) && typeof item.itemId === 'string') {
      ids.push(item.itemId);
    }
  }
  return ids;
};

const recordNewlyClosedItems = (
  consoleDataOutputDir: string,
  pjcode: string,
  issues: Issue[],
  nowMs: number,
): void => {
  const closedItemIds = new Set(
    issues.filter((issue) => issue.isClosed).map((issue) => issue.itemId),
  );
  const previouslyOpenItemIds = new Set<string>();
  for (const tab of CONSOLE_LIST_TAB_NAMES) {
    const listPath = path.join(consoleDataOutputDir, pjcode, tab, 'list.json');
    for (const itemId of readItemIdsFromTabList(listPath)) {
      previouslyOpenItemIds.add(itemId);
    }
  }
  let newlyClosedCount = 0;
  for (const itemId of previouslyOpenItemIds) {
    if (closedItemIds.has(itemId)) {
      newlyClosedCount++;
    }
  }
  appendCloseEventCount(consoleDataOutputDir, pjcode, newlyClosedCount, nowMs);
};

export const writeConsoleLists = (params: ConsoleListsWriterParams): void => {
  const { consoleDataOutputDir, pjcode, assigneeLogin } = params;
  if (!consoleDataOutputDir || !pjcode || !assigneeLogin) {
    return;
  }

  const nowMs = params.nowMs ?? Date.now();

  const lockDir = path.join(consoleDataOutputDir, pjcode);
  fs.mkdirSync(lockDir, { recursive: true });
  const lockPath = path.join(lockDir, '.console-list-write.lock');

  let lockAcquired = tryCreateLock(lockPath);
  if (!lockAcquired) {
    try {
      const stat = fs.statSync(lockPath);
      if (Date.now() - stat.mtimeMs >= CONSOLE_WRITE_LOCK_STALE_TIMEOUT_MS) {
        fs.unlinkSync(lockPath);
        lockAcquired = tryCreateLock(lockPath);
      }
    } catch { }
  }

  if (lockAcquired) {
    try {
      recordNewlyClosedItems(consoleDataOutputDir, pjcode, params.issues, nowMs);
    } finally {
      fs.unlinkSync(lockPath);
    }
  }

  const generatedAt =
    params.generatedAt ?? formatConsoleGeneratedAt(new Date());
  const lists: ConsoleLists = new GenerateConsoleListsUseCase().run({
    project: params.project,
    issues: params.issues,
    pjcode,
    assigneeLogin,
    generatedAt,
    workflowBlockerStoryName: params.workflowBlockerStoryName ?? null,
    urlOfStoryView: params.urlOfStoryView ?? null,
    now: new Date(nowMs),
    defaultTaskNameWithOwner: params.defaultTaskNameWithOwner ?? null,
  });

  for (const tab of CONSOLE_LIST_TAB_NAMES) {
    writeJsonAtomic(
      path.join(consoleDataOutputDir, pjcode, tab, 'list.json'),
      lists[tab],
    );
  }

  resetDoneProjectItemIdsAcrossTabs(consoleDataOutputDir, pjcode);
};
