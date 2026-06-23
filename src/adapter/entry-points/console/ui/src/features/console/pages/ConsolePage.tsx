import { useCallback, useEffect, useMemo, useRef } from 'react';
import { ConsoleTabList } from '../components/layout/ConsoleTabList';
import { ConsoleItemList } from '../components/list/ConsoleItemList';
import { ConsoleUndoToast } from '../components/operations/ConsoleUndoToast';
import { useConsoleActionQueue } from '../hooks/useConsoleActionQueue';
import { useConsoleCaches } from '../hooks/useConsoleCaches';
import { useConsoleNavigation } from '../hooks/useConsoleNavigation';
import { useConsoleOperations } from '../hooks/useConsoleOperations';
import { useConsoleOverlay } from '../hooks/useConsoleOverlay';
import { useConsolePjcode } from '../hooks/useConsolePjcode';
import { useConsoleSwipeNavigation } from '../hooks/useConsoleSwipeNavigation';
import { useConsoleTabData } from '../hooks/useConsoleTabData';
import {
  actionAdvances,
  actionToastColor,
  formatActionToast,
} from '../logic/actionToast';
import { buildConsoleListRows, resolveItemStory } from '../logic/grouping';
import {
  nextPendingKeyAfter,
  nextPendingKeyBrowse,
  previousPendingKeyBefore,
} from '../logic/navigation';
import {
  countPendingItems,
  filterPendingItems,
  overlayKeyForItem,
} from '../logic/overlay';
import type { ConsoleSwipeDirection } from '../logic/swipe';
import { findNextNonEmptyTabToRight } from '../logic/tabAdvance';
import type {
  ConsoleListItem,
  ConsoleOverlayStatus,
  ConsoleTabName,
} from '../logic/types';
import { CONSOLE_TABS } from '../logic/types';
import {
  ConsoleItemDetailContainer,
  type ConsoleQueueActionInput,
} from './ConsoleItemDetailContainer';

const emptyCounts = (): Record<ConsoleTabName, number> => {
  const result = {} as Record<ConsoleTabName, number>;
  for (const tab of CONSOLE_TABS) {
    result[tab.name] = 0;
  }
  return result;
};

const OVERLAY_NAMESPACE_FALLBACK = 'console';

export const ConsolePage = () => {
  const pjcode = useConsolePjcode();
  const { snapshots, isLoading, error } = useConsoleTabData(pjcode);
  const navigation = useConsoleNavigation(pjcode);
  const { activeTab, selectedItemKey, openItem, closeItem, selectTab } =
    navigation;

  const overlayState = useConsoleOverlay(pjcode ?? OVERLAY_NAMESPACE_FALLBACK);
  const caches = useConsoleCaches();
  const operations = useConsoleOperations(pjcode, activeTab, overlayState);
  const actionQueue = useConsoleActionQueue();
  const now = Date.now();

  const counts = useMemo(() => {
    const result = emptyCounts();
    for (const tab of CONSOLE_TABS) {
      const snapshot = snapshots[tab.name];
      if (snapshot === null) {
        continue;
      }
      result[tab.name] = countPendingItems(
        snapshot.items,
        overlayState.overlay,
      );
    }
    return result;
  }, [snapshots, overlayState.overlay]);

  const activeSnapshot = snapshots[activeTab];
  const pendingItems = useMemo(() => {
    if (activeSnapshot === null) {
      return [];
    }
    return filterPendingItems(activeSnapshot.items, overlayState.overlay);
  }, [activeSnapshot, overlayState.overlay]);

  const orderedPendingKeys = useMemo(
    () => pendingItems.map((item) => overlayKeyForItem(item)),
    [pendingItems],
  );

  const rows = useMemo(
    () => buildConsoleListRows(pendingItems, overlayState.overlay),
    [pendingItems, overlayState.overlay],
  );

  const storyColors = activeSnapshot?.storyColors ?? {};
  const statusOptions = activeSnapshot?.statusOptions ?? [];
  const storyOptions = activeSnapshot?.storyOptions ?? [];
  const generatedAt = activeSnapshot?.generatedAt ?? null;

  const selectedItem = useMemo<ConsoleListItem | null>(() => {
    if (selectedItemKey === null || activeSnapshot === null) {
      return null;
    }
    return (
      activeSnapshot.items.find(
        (item) => item.projectItemId === selectedItemKey,
      ) ?? null
    );
  }, [selectedItemKey, activeSnapshot]);

  const activeCount = counts[activeTab];
  const previousActiveTabCountRef = useRef<{
    tab: ConsoleTabName;
    count: number;
  }>({ tab: activeTab, count: activeCount });
  useEffect(() => {
    const previous = previousActiveTabCountRef.current;
    previousActiveTabCountRef.current = { tab: activeTab, count: activeCount };
    if (previous.tab !== activeTab) {
      return;
    }
    if (previous.count > 0 && activeCount === 0) {
      const nextTab = findNextNonEmptyTabToRight(activeTab, counts);
      if (nextTab !== null) {
        selectTab(nextTab);
        closeItem();
      }
    }
  }, [activeTab, activeCount, counts, selectTab, closeItem]);

  const overlayStatusForSelected = ((): ConsoleOverlayStatus | null => {
    if (selectedItem === null) {
      return null;
    }
    const entry = overlayState.overlay[overlayKeyForItem(selectedItem)];
    return entry?.status ?? null;
  })();

  const storyNameForSelected =
    selectedItem !== null
      ? resolveItemStory(selectedItem, overlayState.overlay)
      : null;

  const advanceToNext = useCallback(
    (actedKey: string): void => {
      const nextKey = nextPendingKeyAfter(orderedPendingKeys, actedKey);
      if (nextKey !== null) {
        openItem(nextKey);
      } else {
        closeItem();
      }
    },
    [orderedPendingKeys, openItem, closeItem],
  );

  const handleQueueAction = useCallback(
    (input: ConsoleQueueActionInput): void => {
      const actedKey = overlayKeyForItem(input.item);
      actionQueue.enqueue({
        message: formatActionToast(input.kind, input.item, activeTab),
        color: actionToastColor(input.kind),
        commit: input.commit,
        advance: () => {
          if (actionAdvances(input.kind, activeTab)) {
            advanceToNext(actedKey);
          }
        },
      });
    },
    [actionQueue, activeTab, advanceToNext],
  );

  const handleSwipe = useCallback(
    (direction: ConsoleSwipeDirection): void => {
      if (selectedItemKey === null || direction === null) {
        return;
      }
      const targetKey =
        direction === 'next'
          ? nextPendingKeyBrowse(orderedPendingKeys, selectedItemKey)
          : previousPendingKeyBefore(orderedPendingKeys, selectedItemKey);
      if (targetKey !== null) {
        openItem(targetKey);
      }
    },
    [selectedItemKey, orderedPendingKeys, openItem],
  );

  const detailScreenRef = useConsoleSwipeNavigation(handleSwipe);

  return (
    <main className="console-app">
      {actionQueue.pending !== null && (
        <ConsoleUndoToast
          message={actionQueue.pending.message}
          color={actionQueue.pending.color}
          remainingSeconds={actionQueue.pending.remainingSeconds}
          progress={actionQueue.pending.progress}
          onUndo={actionQueue.undo}
        />
      )}
      <ConsoleTabList
        activeTab={activeTab}
        counts={counts}
        pjcode={pjcode}
        generatedAt={generatedAt}
        tabHref={navigation.tabHref}
        onSelectTab={navigation.selectTab}
      />
      {selectedItem === null ? (
        <ConsoleItemList
          rows={rows}
          storyColors={storyColors}
          activeItemId={null}
          now={now}
          isLoading={isLoading}
          error={error}
          onSelectItem={(item) => navigation.openItem(item.projectItemId)}
        />
      ) : (
        <div className="console-detail-screen" ref={detailScreenRef}>
          <button
            type="button"
            className="console-back-button"
            onClick={closeItem}
          >
            ← Back to list
          </button>
          <ConsoleItemDetailContainer
            tab={activeTab}
            item={selectedItem}
            caches={caches}
            operations={operations}
            statusOptions={statusOptions}
            storyOptions={storyOptions}
            storyColors={storyColors}
            storyName={storyNameForSelected}
            overlayStatus={overlayStatusForSelected}
            now={now}
            onQueueAction={handleQueueAction}
          />
        </div>
      )}
    </main>
  );
};
