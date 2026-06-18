import type { ConsoleListItem, ConsoleTabName } from './types';

export type ConsoleProcessedOverlay = Record<string, true>;

export const overlayKeyForItem = (item: ConsoleListItem): string =>
  String(item.projectItemId !== '' ? item.projectItemId : item.number);

export const markItemProcessed = (
  overlay: ConsoleProcessedOverlay,
  item: ConsoleListItem,
): ConsoleProcessedOverlay => ({
  ...overlay,
  [overlayKeyForItem(item)]: true,
});

export const isItemProcessed = (
  overlay: ConsoleProcessedOverlay,
  item: ConsoleListItem,
): boolean => overlay[overlayKeyForItem(item)] === true;

export const subtractProcessedItems = (
  items: ConsoleListItem[],
  overlay: ConsoleProcessedOverlay,
): ConsoleListItem[] => items.filter((item) => !isItemProcessed(overlay, item));

export const countPendingItems = (
  items: ConsoleListItem[],
  overlay: ConsoleProcessedOverlay,
): number => subtractProcessedItems(items, overlay).length;

export type ConsoleTabCounts = Record<ConsoleTabName, number>;

export const emptyTabCounts: ConsoleTabCounts = {
  prs: 0,
  triage: 0,
  unread: 0,
  'failed-preparation': 0,
  'todo-by-human': 0,
};
