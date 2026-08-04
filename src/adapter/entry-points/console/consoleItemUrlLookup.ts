import * as fs from 'fs';
import * as path from 'path';
import { CONSOLE_DONE_TAB_NAMES } from './consoleDoneStore';

const CONSOLE_LIST_FILE_NAME = 'list.json';

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
  if (parsed === null || typeof parsed !== 'object') {
    return [];
  }
  const items = (parsed as { items?: unknown }).items;
  if (!Array.isArray(items)) {
    return [];
  }
  const urls: string[] = [];
  for (const item of items) {
    if (item === null || typeof item !== 'object') {
      continue;
    }
    const url = (item as { url?: unknown }).url;
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
