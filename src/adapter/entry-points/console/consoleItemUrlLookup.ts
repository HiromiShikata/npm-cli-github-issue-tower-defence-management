import * as fs from 'fs';
import * as path from 'path';
import { CONSOLE_DONE_TAB_NAMES } from './consoleDoneStore';

const CONSOLE_LIST_FILE_NAME = 'list.json';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const readListItemUrls = (
  consoleDataOutputDir: string,
  pjcode: string,
  tab: string,
): string[] => {
  const filePath = path.join(
    consoleDataOutputDir,
    pjcode,
    tab,
    CONSOLE_LIST_FILE_NAME,
  );
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, 'utf-8');
  } catch {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!isRecord(parsed)) {
    return [];
  }
  const items = parsed.items;
  if (!Array.isArray(items)) {
    return [];
  }
  const urls: string[] = [];
  for (const item of items) {
    if (!isRecord(item)) {
      continue;
    }
    const url = item.url;
    if (typeof url === 'string' && url.length > 0) {
      urls.push(url);
    }
  }
  return urls;
};

export const findConsoleItemUrl = (
  consoleDataOutputDir: string,
  pjcode: string,
  requestedUrl: string,
): string | null => {
  for (const tab of CONSOLE_DONE_TAB_NAMES) {
    for (const url of readListItemUrls(consoleDataOutputDir, pjcode, tab)) {
      if (url === requestedUrl) {
        return url;
      }
    }
  }
  return null;
};
