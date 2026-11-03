import type { ConsoleListItem, ConsoleStoryEntry } from './types';

export const patchTaskInStories = (
  entries: ConsoleStoryEntry[],
  projectItemId: string,
  patch: Partial<ConsoleListItem>,
): ConsoleStoryEntry[] =>
  entries.map((entry) => {
    const items = entry.items ?? [];
    if (!items.some((item) => item.projectItemId === projectItemId)) {
      return entry;
    }
    return {
      ...entry,
      items: items.map((item) =>
        item.projectItemId === projectItemId ? { ...item, ...patch } : item,
      ),
    };
  });

export const parseDependedIssueUrlsInput = (value: string): string[] =>
  value
    .split(',')
    .map((url) => url.trim())
    .filter((url) => url.length > 0);
