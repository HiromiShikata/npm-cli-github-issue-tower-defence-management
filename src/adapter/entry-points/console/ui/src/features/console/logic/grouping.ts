import type {
  ConsoleColor,
  ConsoleListItem,
  ConsoleOverlay,
  ConsoleStoryColorSource,
} from './types';

export const CONSOLE_NO_STORY_LABEL = '(No story)';

export const resolveStoryColorEnum = (
  storyColors: ConsoleStoryColorSource,
  storyName: string,
): ConsoleColor | null => {
  const entry = storyColors[storyName];
  if (entry === undefined) {
    return null;
  }
  if (typeof entry === 'string') {
    return entry;
  }
  return entry.color;
};

export const resolveItemStory = (
  item: ConsoleListItem,
  overlay: ConsoleOverlay,
): string => {
  const overlayKey =
    item.projectItemId !== '' ? item.projectItemId : item.itemId;
  const overlayEntry = overlay[overlayKey];
  if (
    overlayEntry?.story?.name !== undefined &&
    overlayEntry.story.name !== ''
  ) {
    return overlayEntry.story.name;
  }
  const trimmed = item.story.trim();
  return trimmed !== '' ? item.story : CONSOLE_NO_STORY_LABEL;
};

export type ConsoleListGroupRow = {
  kind: 'group-header';
  story: string;
  count: number;
};

export type ConsoleItemSummary = {
  kind: 'item';
  item: ConsoleListItem;
};

export type ConsoleListRow = ConsoleListGroupRow | ConsoleItemSummary;

export const buildConsoleListRows = (
  items: ConsoleListItem[],
  overlay: ConsoleOverlay,
): ConsoleListRow[] => {
  const storyCounts = new Map<string, number>();
  for (const item of items) {
    const story = resolveItemStory(item, overlay);
    storyCounts.set(story, (storyCounts.get(story) ?? 0) + 1);
  }

  const rows: ConsoleListRow[] = [];
  let previousStory: string | null = null;
  for (const item of items) {
    const story = resolveItemStory(item, overlay);
    if (story !== previousStory) {
      rows.push({
        kind: 'group-header',
        story,
        count: storyCounts.get(story) ?? 0,
      });
      previousStory = story;
    }
    rows.push({ kind: 'item', item });
  }
  return rows;
};
