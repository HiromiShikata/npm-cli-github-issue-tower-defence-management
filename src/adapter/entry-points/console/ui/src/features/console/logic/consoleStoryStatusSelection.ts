import type { ConsoleStoryEntry } from './types';

export const CONSOLE_STORY_STATUS_SELECTION_KEY =
  'console-story-selected-statuses';

export const readConsoleStoryStatusSelection = (): string[] => {
  if (typeof localStorage === 'undefined') {
    return [];
  }
  const raw = localStorage.getItem(CONSOLE_STORY_STATUS_SELECTION_KEY);
  if (raw === null) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((value): value is string => typeof value === 'string');
  } catch {
    return [];
  }
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
  selected: string[],
  optionNames: string[],
): string[] => {
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
    const items = (entry.items ?? []).filter(
      (item) =>
        item.status !== null && effectiveSelection.includes(item.status),
    );
    return items.length > 0 ? [{ ...entry, items }] : [];
  });
};
