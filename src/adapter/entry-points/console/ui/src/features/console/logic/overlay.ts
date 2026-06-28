import type {
  ConsoleListItem,
  ConsoleOverlay,
  ConsoleOverlayEntry,
  ConsoleTabName,
} from './types';

export const overlayStorageKey = (pjcode: string): string =>
  `pv_overlay_${pjcode}`;

export const overlayKeyForItem = (item: ConsoleListItem): string =>
  item.projectItemId !== '' ? item.projectItemId : item.itemId;

export const isOverlayEntryActed = (
  entry: ConsoleOverlayEntry | undefined,
): boolean => entry !== undefined && entry.done === true;

export const countPendingItems = (
  items: ConsoleListItem[],
  overlay: ConsoleOverlay,
): number =>
  items.filter((item) => !isOverlayEntryActed(overlay[overlayKeyForItem(item)]))
    .length;

export const filterPendingItems = (
  items: ConsoleListItem[],
  overlay: ConsoleOverlay,
): ConsoleListItem[] =>
  items.filter(
    (item) => !isOverlayEntryActed(overlay[overlayKeyForItem(item)]),
  );

export const tabIgnoresDoneOverlay = (tab: ConsoleTabName): boolean =>
  tab === 'workflow-blocker';

export const countTabPendingItems = (
  items: ConsoleListItem[],
  overlay: ConsoleOverlay,
  tab: ConsoleTabName,
): number =>
  tabIgnoresDoneOverlay(tab) ? items.length : countPendingItems(items, overlay);

export const filterTabPendingItems = (
  items: ConsoleListItem[],
  overlay: ConsoleOverlay,
  tab: ConsoleTabName,
): ConsoleListItem[] =>
  tabIgnoresDoneOverlay(tab) ? items : filterPendingItems(items, overlay);

export const writeOverlayEntry = (
  overlay: ConsoleOverlay,
  key: string,
  patch: Partial<Omit<ConsoleOverlayEntry, 'ts' | 'mode'>>,
  mode: ConsoleTabName,
  now: number,
): ConsoleOverlay => {
  const existing = overlay[key];
  const next: ConsoleOverlayEntry = {
    ...(existing ?? {}),
    ...patch,
    ts: now,
    mode,
  };
  return { ...overlay, [key]: next };
};
