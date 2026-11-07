import { isConsoleListItemDone } from './consoleListItemDone';
import { filterConsoleStoryEntriesByStatusSelection } from './consoleStoryStatusSelection';
import type { ConsoleListItem, ConsoleStoryEntry } from './types';

export const isConsoleListItemTriggered = (item: ConsoleListItem): boolean =>
  item.dependedIssueUrls.length > 0 ||
  item.nextActionDate !== null ||
  item.nextActionHour !== null;

export type ConsoleStoryRenderEntry = {
  entry: ConsoleStoryEntry;
  visibleItems: ConsoleListItem[];
  badgeCount: number;
};

export type BuildConsoleStoryRenderEntriesInput = {
  stories: ConsoleStoryEntry[];
  effectiveStatusSelection: string[];
  showDone: boolean;
  hideTriggered: boolean;
  hideEmptyStories: boolean;
};

const countStoryBadge = (
  entry: ConsoleStoryEntry,
  items: ConsoleListItem[],
  visibleItems: ConsoleListItem[],
  hasStatusSelection: boolean,
  hideTriggered: boolean,
): number => {
  if (hasStatusSelection) {
    return visibleItems.length;
  }
  if (!hideTriggered) {
    return entry.openItemCount;
  }
  return items.filter(
    (item) => !isConsoleListItemDone(item) && !isConsoleListItemTriggered(item),
  ).length;
};

export const buildConsoleStoryRenderEntries = ({
  stories,
  effectiveStatusSelection,
  showDone,
  hideTriggered,
  hideEmptyStories,
}: BuildConsoleStoryRenderEntriesInput): ConsoleStoryRenderEntry[] => {
  const hasStatusSelection = effectiveStatusSelection.length > 0;
  const statusFilteredStories = filterConsoleStoryEntriesByStatusSelection(
    stories,
    effectiveStatusSelection,
  );
  return statusFilteredStories.flatMap((entry) => {
    const items = entry.items ?? [];
    const statusVisibleItems = hasStatusSelection
      ? items
      : items.filter((item) => showDone || !isConsoleListItemDone(item));
    const visibleItems = hideTriggered
      ? statusVisibleItems.filter((item) => !isConsoleListItemTriggered(item))
      : statusVisibleItems;
    const badgeCount = countStoryBadge(
      entry,
      items,
      visibleItems,
      hasStatusSelection,
      hideTriggered,
    );
    return hideEmptyStories && badgeCount === 0
      ? []
      : [{ entry, visibleItems, badgeCount }];
  });
};
