import { overlayKeyForItem } from './overlay';
import type { ConsoleOverlay, ConsoleStoryEntry } from './types';

export const consoleStoryEntriesWithClosedOverlay = (
  stories: ConsoleStoryEntry[],
  overlay: ConsoleOverlay,
  storiesGeneratedAt: string | null,
): ConsoleStoryEntry[] => {
  const storiesGeneratedAtMs =
    storiesGeneratedAt === null ? null : Date.parse(storiesGeneratedAt);
  const canApplyEntries =
    storiesGeneratedAtMs === null || !Number.isNaN(storiesGeneratedAtMs);
  if (!canApplyEntries) {
    return stories.map((story) => ({
      ...story,
      items: (story.items ?? []).map((item) => ({
        ...item,
        isClosed: item.isClosed,
      })),
    }));
  }
  return stories.map((story) => {
    let openItemCount = story.openItemCount;
    const items = (story.items ?? []).map((item) => {
      const entry = overlay[overlayKeyForItem(item)];
      const shouldApply =
        entry?.closed === true &&
        (storiesGeneratedAtMs === null || entry.ts >= storiesGeneratedAtMs);
      if (!shouldApply) {
        return { ...item, isClosed: item.isClosed };
      }
      if (item.isClosed !== true) {
        openItemCount = Math.max(0, openItemCount - 1);
      }
      return { ...item, isClosed: true };
    });
    return { ...story, items, openItemCount };
  });
};
