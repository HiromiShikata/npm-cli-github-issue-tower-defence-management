import { isConsoleListItemDone } from './consoleListItemDone';
import type { ConsoleStoryEntry } from './types';

export const CONSOLE_STORY_STATUS_SELECTION_KEY =
  'console-story-selected-statuses';

export const readConsoleStoryStatusSelection = (): string[] | null => {
  if (typeof localStorage === 'undefined') {
    return null;
  }
  const raw = localStorage.getItem(CONSOLE_STORY_STATUS_SELECTION_KEY);
  if (raw === null) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return null;
    }
    return parsed.filter((value): value is string => typeof value === 'string');
  } catch {
    return null;
  }
};

const DONE_STATUS_NAME = 'Done';

export const defaultConsoleStoryStatusSelection = (
  optionNames: string[],
): string[] => optionNames.filter((name) => name !== DONE_STATUS_NAME);

export const displayedConsoleStoryStatusSelection = (
  selected: string[] | null,
  optionNames: string[],
): string[] => selected ?? defaultConsoleStoryStatusSelection(optionNames);

export const isConsoleStoryDoneShown = (selected: string[] | null): boolean => {
  if (selected === null) {
    return false;
  }
  return selected.length === 0 || selected.includes(DONE_STATUS_NAME);
};

export const writeConsoleStoryStatusSelection = (statuses: string[]): void => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(
      CONSOLE_STORY_STATUS_SELECTION_KEY,
      JSON.stringify(statuses),
    );
  }
};

export const resolveEffectiveConsoleStoryStatusSelection = (
  selected: string[] | null,
  optionNames: string[],
): string[] => {
  if (selected === null) {
    return [];
  }
  const present = selected.filter((name) => optionNames.includes(name));
  return Array.from(new Set(present));
};

export const filterConsoleStoryEntriesByStatusSelection = (
  stories: ConsoleStoryEntry[],
  effectiveSelection: string[],
): ConsoleStoryEntry[] => {
  if (effectiveSelection.length === 0) {
    return stories;
  }
  return stories.flatMap((entry) => {
    const items = (entry.items ?? []).filter((item) => {
      const statusKey = isConsoleListItemDone(item) ? 'Done' : item.status;
      return statusKey !== null && effectiveSelection.includes(statusKey);
    });
    return items.length > 0 ? [{ ...entry, items }] : [];
  });
};

const CONSOLE_STORY_STATUS_PARAM = 'status';

export const parseConsoleStoryStatusSelectionFromSearch = (
  search: string,
): string[] | null => {
  const params = new URLSearchParams(search);
  if (!params.has(CONSOLE_STORY_STATUS_PARAM)) {
    return null;
  }
  const names = params.getAll(CONSOLE_STORY_STATUS_PARAM);
  return Array.from(new Set(names.filter((name) => name.length > 0)));
};

export const formatConsoleStoryStatusSelectionIntoSearch = (
  search: string,
  statuses: string[],
): string => {
  const params = new URLSearchParams(search);
  params.delete(CONSOLE_STORY_STATUS_PARAM);
  if (statuses.length === 0) {
    params.append(CONSOLE_STORY_STATUS_PARAM, '');
  }
  for (const status of Array.from(new Set(statuses))) {
    params.append(CONSOLE_STORY_STATUS_PARAM, status);
  }
  const query = params.toString();
  return query.length > 0 ? `?${query}` : '';
};
