import { overlayKeyForItem } from './overlay';
import type { ConsoleOverlay, ConsoleStoryEntry } from './types';

export const consoleStoryEntriesWithClosedOverlay = (
  stories: ConsoleStoryEntry[],
  overlay: ConsoleOverlay,
  storiesGeneratedAt: string | null,
): ConsoleStoryEntry[] => {
  const storiesGeneratedAtMs =
    storiesGeneratedAt === null ? null : Date.parse(storiesGeneratedAt);
  return stories.map((story) => {
    let openItemCount = story.openItemCount;
    const items = (story.items ?? []).map((item) => {
      const entry =
        overlay[overlayKeyForItem(item)] ??
        Object.values(overlay).find(
          (candidate) => candidate.itemUrl === item.url,
        ) ??
        Object.values(overlay).find(
          (candidate) => candidate.itemStoryName === story.storyName,
        );
      const shouldApply =
        entry?.closed === true &&
        (storiesGeneratedAtMs === null ||
          (!Number.isNaN(storiesGeneratedAtMs) &&
            entry.ts >= storiesGeneratedAtMs &&
            (entry.snapshotGeneratedAt === undefined ||
              (storiesGeneratedAt !== null &&
                storiesGeneratedAt <= entry.snapshotGeneratedAt))));
      if (!shouldApply || item.isClosed === true) {
        return { ...item, isClosed: item.isClosed };
      }
      openItemCount = Math.max(0, openItemCount - 1);
      return { ...item, isClosed: true };
    });
    return { ...story, items, openItemCount };
  });
};
