import type {
  ConsoleColor,
  ConsoleListItem,
  ConsoleOverlay,
  ConsoleStoryColorSource,
} from './types';

export const CONSOLE_NO_STORY_LABEL = '(No story)';

export const resolveStoryColorEnum = (
  storyColors: ConsoleStoryColorSource,
  storyOptionId: string,
): ConsoleColor | null => {
  const entry = storyColors[storyOptionId];
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
  snapshotGeneratedAt: string | null = null,
): string => {
  const overlayKey =
    item.projectItemId !== '' ? item.projectItemId : item.itemId;
  const overlayEntry = overlay[overlayKey];
  if (
    overlayEntry?.story?.name !== undefined &&
    overlayEntry.story.name !== ''
  ) {
    if (snapshotGeneratedAt !== null) {
      const snapshotGeneratedAtMs = Date.parse(snapshotGeneratedAt);
      if (
        !Number.isNaN(snapshotGeneratedAtMs) &&
        overlayEntry.ts < snapshotGeneratedAtMs
      ) {
        const trimmed = item.story.trim();
        return trimmed !== '' ? item.story : CONSOLE_NO_STORY_LABEL;
      }
    }
    return overlayEntry.story.name;
  }
  const trimmed = item.story.trim();
  return trimmed !== '' ? item.story : CONSOLE_NO_STORY_LABEL;
};

export const resolveItemStoryOptionId = (
  item: ConsoleListItem,
  overlay: ConsoleOverlay,
  snapshotGeneratedAt: string | null = null,
): string | null => {
  const overlayKey =
    item.projectItemId !== '' ? item.projectItemId : item.itemId;
  const overlayEntry = overlay[overlayKey];
  if (
    overlayEntry?.story?.name !== undefined &&
    overlayEntry.story.name !== ''
  ) {
    if (snapshotGeneratedAt !== null) {
      const snapshotGeneratedAtMs = Date.parse(snapshotGeneratedAt);
      if (
        !Number.isNaN(snapshotGeneratedAtMs) &&
        overlayEntry.ts < snapshotGeneratedAtMs
      ) {
        return item.storyOptionId ?? null;
      }
    }
    return overlayEntry.story.id ?? null;
  }
  return item.storyOptionId ?? null;
};

export type ConsoleListGroupRow = {
  kind: 'group-header';
  groupKey: string;
  story: string;
  storyOptionId: string | null;
  count: number;
};

export type ConsoleItemSummary = {
  kind: 'item';
  item: ConsoleListItem;
};

export type ConsoleListRow = ConsoleListGroupRow | ConsoleItemSummary;

const UNKNOWN_STORY_SORT_INDEX = 999999;

const buildStoryGroupKey = (
  storyOptionId: string | null,
  story: string,
): string =>
  storyOptionId !== null
    ? `story-option-id:${storyOptionId}`
    : `story-label:${story}`;

export const buildConsoleListRows = (
  items: ConsoleListItem[],
  overlay: ConsoleOverlay,
  storyOrder: string[],
  snapshotGeneratedAt: string | null = null,
): ConsoleListRow[] => {
  const indexByStory = new Map(storyOrder.map((name, index) => [name, index]));
  const firstAppearanceIndexByGroupKey = new Map<string, number>();
  const groupedItems = items.map((item, itemIndex) => {
    const story = resolveItemStory(item, overlay, snapshotGeneratedAt);
    const storyOptionId = resolveItemStoryOptionId(
      item,
      overlay,
      snapshotGeneratedAt,
    );
    const groupKey = buildStoryGroupKey(storyOptionId, story);
    const groupFirstAppearanceIndex =
      firstAppearanceIndexByGroupKey.get(groupKey) ?? itemIndex;
    firstAppearanceIndexByGroupKey.set(groupKey, groupFirstAppearanceIndex);
    return { item, story, storyOptionId, groupKey, groupFirstAppearanceIndex };
  });
  const sorted =
    storyOrder.length === 0
      ? groupedItems
      : [...groupedItems].sort((a, b) => {
          const indexA = indexByStory.get(a.story) ?? UNKNOWN_STORY_SORT_INDEX;
          const indexB = indexByStory.get(b.story) ?? UNKNOWN_STORY_SORT_INDEX;
          return (
            indexA - indexB ||
            a.groupFirstAppearanceIndex - b.groupFirstAppearanceIndex
          );
        });

  const countByGroupKey = new Map<string, number>();
  for (const { groupKey } of sorted) {
    countByGroupKey.set(groupKey, (countByGroupKey.get(groupKey) ?? 0) + 1);
  }

  const rows: ConsoleListRow[] = [];
  let previousGroupKey: string | null = null;
  for (const { item, story, storyOptionId, groupKey } of sorted) {
    if (groupKey !== previousGroupKey) {
      rows.push({
        kind: 'group-header',
        groupKey,
        story,
        storyOptionId,
        count: countByGroupKey.get(groupKey) ?? 0,
      });
      previousGroupKey = groupKey;
    }
    rows.push({ kind: 'item', item });
  }
  return rows;
};
