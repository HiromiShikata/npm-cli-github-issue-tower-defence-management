import { useEffect } from 'react';
import type { ConsoleListItem } from '../logic/types';
import type { ConsoleCaches } from './useConsoleCaches';

const PREFETCH_AHEAD_COUNT = 0;
const PREFETCH_DEFER_MS = 500;
const PREFETCH_IDLE_TIMEOUT_MS = 2000;

type IdleHandle = { cancel: () => void };

const scheduleOnIdle = (task: () => void): IdleHandle => {
  const idleWindow = window as Window & {
    requestIdleCallback?: (
      callback: () => void,
      options?: { timeout: number },
    ) => number;
    cancelIdleCallback?: (handle: number) => void;
  };
  if (
    typeof idleWindow.requestIdleCallback === 'function' &&
    typeof idleWindow.cancelIdleCallback === 'function'
  ) {
    const handle = idleWindow.requestIdleCallback(task, {
      timeout: PREFETCH_IDLE_TIMEOUT_MS,
    });
    return { cancel: () => idleWindow.cancelIdleCallback?.(handle) };
  }
  const handle = window.setTimeout(task, 0);
  return { cancel: () => window.clearTimeout(handle) };
};

const prefetchItem = (caches: ConsoleCaches, item: ConsoleListItem): void => {
  const key = `${item.repo}#${item.number}`;
  caches.body.prefetch(key, item.url);
  caches.state.prefetch(key, item.url);
  caches.comments.prefetch(key, item.url);
  if (item.isPr) {
    caches.files.prefetch(key, item.url);
    caches.commits.prefetch(key, item.url);
    caches.prStatus.prefetch(key, item.url);
  } else {
    caches.relatedPrs.prefetch(key, item.url);
  }
};

export const useConsoleDetailPrefetch = (
  caches: ConsoleCaches,
  selectedItem: ConsoleListItem | null,
  orderedPendingItems: ConsoleListItem[],
): void => {
  useEffect(() => {
    if (selectedItem === null) {
      return;
    }
    const selectedIndex = orderedPendingItems.findIndex(
      (item) => item.projectItemId === selectedItem.projectItemId,
    );
    if (selectedIndex === -1) {
      return;
    }
    const upcoming = orderedPendingItems.slice(
      selectedIndex + 1,
      selectedIndex + 1 + PREFETCH_AHEAD_COUNT,
    );
    if (upcoming.length === 0) {
      return;
    }

    let idleHandle: IdleHandle | null = null;
    const deferHandle = window.setTimeout(() => {
      idleHandle = scheduleOnIdle(() => {
        for (const item of upcoming) {
          prefetchItem(caches, item);
        }
      });
    }, PREFETCH_DEFER_MS);

    return () => {
      window.clearTimeout(deferHandle);
      idleHandle?.cancel();
    };
  }, [caches, selectedItem, orderedPendingItems]);
};
