import { useCallback, useEffect, useState } from 'react';
import {
  type OverlayCloseSuccess,
  overlayCloseSuccessRead,
  overlayEntryClosedAtUpdate,
  overlayStorageKey,
  removeOverlayEntry,
  writeOverlayEntry,
} from '../logic/overlay';
import type {
  ConsoleOverlay,
  ConsoleOverlayEntry,
  ConsoleOverlayPatch,
  ConsoleTabName,
} from '../logic/types';

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

type OverlayCloseSuccessListener = (success: OverlayCloseSuccess) => void;

const overlayCloseSuccessListeners = new Set<OverlayCloseSuccessListener>();

export const overlayCloseSuccessRecord = (
  request: Record<string, unknown>,
  response: unknown,
): void => {
  const success = overlayCloseSuccessRead(request, response);
  if (success === null) {
    return;
  }
  const current = readOverlay(success.pjcode);
  const next = overlayEntryClosedAtUpdate(
    current,
    success.key,
    success.closedAtMs,
  );
  if (next !== current) {
    persistOverlay(success.pjcode, next);
  }
  for (const listener of overlayCloseSuccessListeners) {
    listener(success);
  }
};

export type ConsoleOverlayState = {
  overlay: ConsoleOverlay;
  patchOverlay: (
    key: string,
    patch: ConsoleOverlayPatch,
    mode: ConsoleTabName,
  ) => void;
  revertOverlayEntry: (key: string) => void;
};

export const useConsoleOverlay = (pjcode: string): ConsoleOverlayState => {
  const [overlay, setOverlay] = useState<ConsoleOverlay>(() =>
    readOverlay(pjcode),
  );

  const patchOverlay = useCallback(
    (key: string, patch: ConsoleOverlayPatch, mode: ConsoleTabName) => {
      setOverlay((current) => {
        const next = writeOverlayEntry(current, key, patch, mode, Date.now());
        persistOverlay(pjcode, next);
        return next;
      });
    },
    [pjcode],
  );

  const revertOverlayEntry = useCallback(
    (key: string) => {
      setOverlay((current) => {
        const next = removeOverlayEntry(current, key);
        persistOverlay(pjcode, next);
        return next;
      });
    },
    [pjcode],
  );

  useEffect(() => {
    const listener: OverlayCloseSuccessListener = (success) => {
      if (success.pjcode !== pjcode) {
        return;
      }
      setOverlay((current) => {
        const next = overlayEntryClosedAtUpdate(
          current,
          success.key,
          success.closedAtMs,
        );
        if (next !== current) {
          persistOverlay(pjcode, next);
        }
        return next;
      });
    };
    overlayCloseSuccessListeners.add(listener);
    return () => {
      overlayCloseSuccessListeners.delete(listener);
    };
  }, [pjcode]);

  return {
    overlay,
    patchOverlay,
    revertOverlayEntry,
  };
};
