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

export const parseGeneratedAtMs = (generatedAt: string): number => {
  const parsed = Date.parse(generatedAt);
  return Number.isNaN(parsed) ? 0 : parsed;
};

export const isOverlayEntryExpiredForMode = (
  entry: ConsoleOverlayEntry,
  generatedAtMs: number,
  mode: ConsoleTabName,
): boolean =>
  entry.ts > 0 &&
  generatedAtMs > 0 &&
  entry.mode === mode &&
  entry.ts < generatedAtMs;

export const getOverlayEntry = (
  overlay: ConsoleOverlay,
  item: ConsoleListItem,
  generatedAtMs: number,
  mode: ConsoleTabName,
): ConsoleOverlayEntry | null => {
  const entry = overlay[overlayKeyForItem(item)];
  if (entry === undefined) {
    return null;
  }
  if (isOverlayEntryExpiredForMode(entry, generatedAtMs, mode)) {
    return null;
  }
  return entry;
};

export const isOverlayEntryActedForMode = (
  entry: ConsoleOverlayEntry | undefined,
  generatedAtMs: number,
  mode: ConsoleTabName,
): boolean => {
  if (entry === undefined || entry.done !== true) {
    return false;
  }
  return !isOverlayEntryExpiredForMode(entry, generatedAtMs, mode);
};

export const countPendingItems = (
  items: ConsoleListItem[],
  overlay: ConsoleOverlay,
  generatedAtMs: number,
  mode: ConsoleTabName,
): number =>
  items.filter(
    (item) =>
      !isOverlayEntryActedForMode(
        overlay[overlayKeyForItem(item)],
        generatedAtMs,
        mode,
      ),
  ).length;

export const filterPendingItems = (
  items: ConsoleListItem[],
  overlay: ConsoleOverlay,
  generatedAtMs: number,
  mode: ConsoleTabName,
): ConsoleListItem[] =>
  items.filter(
    (item) =>
      !isOverlayEntryActedForMode(
        overlay[overlayKeyForItem(item)],
        generatedAtMs,
        mode,
      ),
  );

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
