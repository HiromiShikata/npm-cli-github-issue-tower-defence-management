import * as fs from 'fs';
import * as path from 'path';

export const CONSOLE_DONE_FILE_NAME = '.done.json';

export type ConsoleDoneRecord = {
  projectItemIds: string[];
};

const isValidProjectItemId = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const parseDoneRecord = (raw: string): ConsoleDoneRecord => {
  const parsed: unknown = JSON.parse(raw);
  if (!isRecord(parsed)) {
    return { projectItemIds: [] };
  }
  const rawProjectItemIds = parsed.projectItemIds;
  if (!Array.isArray(rawProjectItemIds)) {
    return { projectItemIds: [] };
  }
  const projectItemIds = rawProjectItemIds.filter(isValidProjectItemId);
  return { projectItemIds };
};

export const doneFilePathForTab = (
  consoleDataOutputDir: string,
  pjcode: string,
  tab: string,
): string =>
  path.join(consoleDataOutputDir, pjcode, tab, CONSOLE_DONE_FILE_NAME);

const writeDoneRecordAtomic = (
  filePath: string,
  record: ConsoleDoneRecord,
): void => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(record));
  fs.renameSync(tmpPath, filePath);
};

export const readDoneProjectItemIds = (
  consoleDataOutputDir: string,
  pjcode: string,
  tab: string,
): string[] => {
  const filePath = doneFilePathForTab(consoleDataOutputDir, pjcode, tab);
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, 'utf-8');
  } catch {
    return [];
  }
  return parseDoneRecord(raw).projectItemIds;
};

export const recordDoneProjectItemId = (
  consoleDataOutputDir: string,
  pjcode: string,
  tab: string,
  projectItemId: string,
): void => {
  if (!isValidProjectItemId(projectItemId)) {
    return;
  }
  const filePath = doneFilePathForTab(consoleDataOutputDir, pjcode, tab);
  const existing = readDoneProjectItemIds(consoleDataOutputDir, pjcode, tab);
  if (existing.includes(projectItemId)) {
    return;
  }
  const updated: ConsoleDoneRecord = {
    projectItemIds: [...existing, projectItemId],
  };
  writeDoneRecordAtomic(filePath, updated);
};

export const CONSOLE_DONE_TAB_NAMES: string[] = [
  'workflow-blocker',
  'prs',
  'triage',
  'unread',
  'failed-preparation',
  'todo-by-human',
  'in-tmux-by-human',
];

export const recordDoneProjectItemIdAcrossTabs = (
  consoleDataOutputDir: string,
  pjcode: string,
  projectItemId: string,
): void => {
  for (const tab of CONSOLE_DONE_TAB_NAMES) {
    recordDoneProjectItemId(consoleDataOutputDir, pjcode, tab, projectItemId);
  }
};

export const resetDoneProjectItemIds = (
  consoleDataOutputDir: string,
  pjcode: string,
  tab: string,
): void => {
  const filePath = doneFilePathForTab(consoleDataOutputDir, pjcode, tab);
  writeDoneRecordAtomic(filePath, { projectItemIds: [] });
};

export const resetDoneProjectItemIdsAcrossTabs = (
  consoleDataOutputDir: string,
  pjcode: string,
): void => {
  for (const tab of CONSOLE_DONE_TAB_NAMES) {
    resetDoneProjectItemIds(consoleDataOutputDir, pjcode, tab);
  }
};
