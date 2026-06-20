import { useCallback, useState } from 'react';
import { overlayStorageKey, writeOverlayEntry } from '../overlay';
import type {
  ConsoleOverlay,
  ConsoleOverlayEntry,
  ConsoleTabName,
} from '../types';

const isOverlayEntry = (value: unknown): value is ConsoleOverlayEntry =>
  value !== null &&
  typeof value === 'object' &&
  typeof (value as { ts?: unknown }).ts === 'number';

const readOverlay = (pjcode: string): ConsoleOverlay => {
  if (typeof localStorage === 'undefined') {
    return {};
  }
  const raw = localStorage.getItem(overlayStorageKey(pjcode));
  if (raw === null) {
    return {};
  }
  const parsed: unknown = JSON.parse(raw);
  if (parsed === null || typeof parsed !== 'object') {
    return {};
  }
  const overlay: ConsoleOverlay = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (isOverlayEntry(value)) {
      overlay[key] = value;
    }
  }
  return overlay;
};

const persistOverlay = (pjcode: string, overlay: ConsoleOverlay): void => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(overlayStorageKey(pjcode), JSON.stringify(overlay));
  }
};

export type ConsoleOverlayState = {
  overlay: ConsoleOverlay;
  patchOverlay: (
    key: string,
    patch: Partial<Omit<ConsoleOverlayEntry, 'ts' | 'mode'>>,
    mode: ConsoleTabName,
  ) => void;
};

export const useConsoleOverlay = (pjcode: string): ConsoleOverlayState => {
  const [overlay, setOverlay] = useState<ConsoleOverlay>(() =>
    readOverlay(pjcode),
  );

  const patchOverlay = useCallback(
    (
      key: string,
      patch: Partial<Omit<ConsoleOverlayEntry, 'ts' | 'mode'>>,
      mode: ConsoleTabName,
    ) => {
      setOverlay((current) => {
        const next = writeOverlayEntry(current, key, patch, mode, Date.now());
        persistOverlay(pjcode, next);
        return next;
      });
    },
    [pjcode],
  );

  return { overlay, patchOverlay };
};
