import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ConsoleTabList } from '../components/layout/ConsoleTabList';
import { ConsoleItemList } from '../components/list/ConsoleItemList';
import { ConsoleStoryList } from '../components/list/ConsoleStoryList';
import {
  type ConsoleOfflinePendingActionItem,
  ConsoleOfflinePendingActionsPanel,
} from '../components/operations/ConsoleOfflinePendingActionsPanel';
import {
  ConsoleErrorToast,
  ConsoleUndoToast,
} from '../components/operations/ConsoleUndoToast';
import { useConsoleActionQueue } from '../hooks/useConsoleActionQueue';
import { useConsoleCaches } from '../hooks/useConsoleCaches';
import { useConsoleDetailPrefetch } from '../hooks/useConsoleDetailPrefetch';
import { useConsoleNavigation } from '../hooks/useConsoleNavigation';
import { useConsoleOperations } from '../hooks/useConsoleOperations';
import { useConsoleOverlay } from '../hooks/useConsoleOverlay';
import { useConsolePjcode } from '../hooks/useConsolePjcode';
import { useConsoleSwipeNavigation } from '../hooks/useConsoleSwipeNavigation';
import { useConsoleTabData } from '../hooks/useConsoleTabData';
import { postConsoleCreateIssue } from '../lib/consoleApi';
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
  overlayEntriesActedSinceSnapshot,
  overlayKeyForItem,
  overlayStatusSinceSnapshot,
} from '../logic/overlay';
import type { ConsoleSwipeDirection } from '../logic/swipe';
import { findNextNonEmptyTabToRight } from '../logic/tabAdvance';
import type {
  ConsoleIssueState,
  ConsoleListItem,
  ConsoleOverlayStatus,
  ConsolePullRequestStatus,
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
  const overlayState = useConsoleOverlay(pjcode ?? OVERLAY_NAMESPACE_FALLBACK);

  const counts = useMemo(() => {
    const result = emptyCounts();
    for (const tab of CONSOLE_TABS) {
      const snapshot = snapshots[tab.name];
      if (snapshot === null) {
        continue;
      }
      if (tab.name === 'stories') {
        result[tab.name] = snapshot.stories.length;
      } else {
        result[tab.name] = countPendingItems(
          snapshot.items,
          overlayEntriesActedSinceSnapshot(
            overlayState.overlay,
            snapshot.generatedAt,
          ),
        );
      }
    }
    return result;
  }, [snapshots, overlayState.overlay]);

  const navigation = useConsoleNavigation(pjcode, counts);
  const { activeTab, selectedItemKey, openItem, closeItem, selectTab } =
    navigation;

  const caches = useConsoleCaches();
  const operations = useConsoleOperations(
    pjcode,
    activeTab,
    overlayState,
    caches,
  );
  const actionQueue = useConsoleActionQueue();
  const now = Date.now();

  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const handleOnline = (): void => setIsOnline(true);
    const handleOffline = (): void => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const [offlineItemStates, setOfflineItemStates] = useState<
    Map<string, ConsoleIssueState | null>
  >(new Map());

  const [offlinePrStatuses, setOfflinePrStatuses] = useState<
    Map<string, ConsolePullRequestStatus | null>
  >(new Map());

  const [offlineFetchErrors, setOfflineFetchErrors] = useState<Set<string>>(
    new Set(),
  );

  useEffect(() => {
    if (!isOnline || actionQueue.offlineActions.length === 0) return;
    for (const action of actionQueue.offlineActions) {
      if (
        offlineItemStates.has(action.id) ||
        offlineFetchErrors.has(action.id)
      )
        continue;
      setOfflineItemStates((prev) => new Map(prev).set(action.id, null));
      caches.client
        .fetchIssueState(action.itemUrl)
        .then((state) => {
          setOfflineItemStates((prev) => new Map(prev).set(action.id, state));
          if (action.isPr) {
            setOfflinePrStatuses((prev) =>
              new Map(prev).set(action.id, null),
            );
            caches.client
              .fetchPullRequestStatus(action.itemUrl)
              .then((prStatus) => {
                setOfflinePrStatuses((prev) =>
                  new Map(prev).set(action.id, prStatus),
                );
              })
              .catch((fetchError: unknown) => {
                console.warn(
                  'Failed to fetch PR status for offline action:',
                  fetchError,
                );
              });
          }
        })
        .catch((fetchError: unknown) => {
          console.warn(
            'Failed to fetch current state for offline action:',
            fetchError,
          );
          setOfflineFetchErrors((prev) => new Set(prev).add(action.id));
        });
    }
  }, [
    isOnline,
    actionQueue.offlineActions,
    caches.client,
    offlineItemStates,
    offlineFetchErrors,
  ]);

  const [isConfirmingOffline, setIsConfirmingOffline] = useState(false);

  const handleConfirmOffline = useCallback(
    async (id: string): Promise<void> => {
      setIsConfirmingOffline(true);
      try {
        await actionQueue.confirmOfflineAction(id);
      } finally {
        setIsConfirmingOffline(false);
      }
    },
    [actionQueue],
  );

  const offlinePanelActions = useMemo(
    (): ConsoleOfflinePendingActionItem[] =>
      actionQueue.offlineActions.map((a) => {
        const state = offlineItemStates.get(a.id) ?? null;
        const prStatus = offlinePrStatuses.get(a.id) ?? null;
        const fetchError = offlineFetchErrors.has(a.id);
        return {
          id: a.id,
          message: a.message,
          color: a.color,
          itemNumber: a.itemNumber,
          isPr: a.isPr,
          currentTitle: fetchError ? null : (state?.title ?? null),
          currentState: fetchError
            ? null
            : state === null
              ? null
              : state.merged
                ? 'closed'
                : (state.state as 'open' | 'closed'),
          currentPrStatus: prStatus,
          fetchError,
        };
      }),
    [
      actionQueue.offlineActions,
      offlineItemStates,
      offlinePrStatuses,
      offlineFetchErrors,
    ],
  );

  const activeSnapshot = snapshots[activeTab];
  const pendingItems = useMemo(() => {
    if (activeSnapshot === null) {
      return [];
    }
    return filterPendingItems(
      activeSnapshot.items,
      overlayEntriesActedSinceSnapshot(
        overlayState.overlay,
        activeSnapshot.generatedAt,
      ),
    );
  }, [activeSnapshot, overlayState.overlay]);

  const orderedPendingKeys = useMemo(
    () => pendingItems.map((item) => overlayKeyForItem(item)),
    [pendingItems],
  );

  const storyOrder = activeSnapshot?.storyOrder ?? [];

  const rows = useMemo(
    () => buildConsoleListRows(pendingItems, overlayState.overlay, storyOrder),
    [pendingItems, overlayState.overlay, storyOrder],
  );

  const storyColors = activeSnapshot?.storyColors ?? {};
  const statusOptions = activeSnapshot?.statusOptions ?? [];
  const storyOptions = activeSnapshot?.storyOptions ?? [];
  const generatedAt = activeSnapshot?.generatedAt ?? null;
  const fromCache = activeSnapshot?.fromCache ?? false;

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

  useConsoleDetailPrefetch(caches, selectedItem, pendingItems);

  useEffect(() => {
    if (selectedItemKey === null) {
      return;
    }
    window.scrollTo({ top: 0 });
  }, [selectedItemKey]);

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
    return overlayStatusSinceSnapshot(
      overlayState.overlay,
      selectedItem,
      snapshots[activeTab]?.generatedAt ?? null,
    );
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
        offline: input.offline,
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

  const storiesSnapshot = snapshots.stories;
  const storyEntries = storiesSnapshot?.stories ?? [];
  const defaultNameWithOwner = storiesSnapshot?.defaultNameWithOwner ?? null;

  const handleCreateIssue = useCallback(
    async (storyOptionId: string, title: string): Promise<void> => {
      if (pjcode === null) {
        throw new Error('No project specified in the URL path.');
      }
      if (defaultNameWithOwner === null) {
        throw new Error('No repository configured for this project.');
      }
      await postConsoleCreateIssue({
        pjcode,
        title,
        storyOptionId,
        nameWithOwner: defaultNameWithOwner,
      });
    },
    [pjcode, defaultNameWithOwner],
  );

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
      {actionQueue.error !== null && (
        <ConsoleErrorToast
          message={`Operation failed: ${actionQueue.error.reason}`}
          onDismiss={actionQueue.dismissError}
        />
      )}
      <ConsoleOfflinePendingActionsPanel
        actions={offlinePanelActions}
        isOnline={isOnline}
        isConfirming={isConfirmingOffline}
        onConfirm={handleConfirmOffline}
        onDiscard={actionQueue.discardOfflineAction}
      />
      <ConsoleTabList
        activeTab={activeTab}
        counts={counts}
        pjcode={pjcode}
        generatedAt={generatedAt}
        fromCache={fromCache}
        tabHref={navigation.tabHref}
        onSelectTab={navigation.selectTab}
      />
      {activeTab === 'stories' ? (
        <ConsoleStoryList
          stories={storyEntries}
          isLoading={isLoading}
          error={error}
          onCreateIssue={handleCreateIssue}
        />
      ) : selectedItem === null ? (
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
          <ConsoleItemDetailContainer
            key={selectedItem.projectItemId}
            tab={activeTab}
            item={selectedItem}
            caches={caches}
            operations={operations}
            pjcode={pjcode}
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
