import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ConsoleProjectTimerBar } from '../components/layout/ConsoleProjectTimerBar';
import { ConsoleTabList } from '../components/layout/ConsoleTabList';
import { ConsoleTimerSettingsModalDialog } from '../components/layout/ConsoleTimerSettingsModalDialog';
import { ConsoleItemList } from '../components/list/ConsoleItemList';
import { ConsoleQueuedList } from '../components/list/ConsoleQueuedList';
import { ConsoleStoryList } from '../components/list/ConsoleStoryList';
import {
  type ConsoleOfflinePendingActionItem,
  ConsoleOfflinePendingActionsPanel,
} from '../components/operations/ConsoleOfflinePendingActionsPanel';
import {
  ConsoleErrorToast,
  ConsoleUndoToast,
} from '../components/operations/ConsoleUndoToast';
import { useAirplaneMode } from '../hooks/useAirplaneMode';
import { useConsoleActionQueue } from '../hooks/useConsoleActionQueue';
import { useConsoleCaches } from '../hooks/useConsoleCaches';
import { useConsoleDetailPrefetch } from '../hooks/useConsoleDetailPrefetch';
import { useConsoleFeaturesConfig } from '../hooks/useConsoleFeaturesConfig';
import { useConsoleNavigation } from '../hooks/useConsoleNavigation';
import { useConsoleOperations } from '../hooks/useConsoleOperations';
import { useConsoleOverlay } from '../hooks/useConsoleOverlay';
import { useConsolePjcode } from '../hooks/useConsolePjcode';
import { useConsoleProjectList } from '../hooks/useConsoleProjectList';
import { useConsoleProjectTimer } from '../hooks/useConsoleProjectTimer';
import { useConsoleSwipeNavigation } from '../hooks/useConsoleSwipeNavigation';
import { useConsoleTabData } from '../hooks/useConsoleTabData';
import { useConsoleTimerSettings } from '../hooks/useConsoleTimerSettings';
import {
  postConsoleAddStory,
  postConsoleCreateIssue,
  postConsoleDeleteStory,
  postConsoleReorderStory,
  postConsoleStoryColor,
} from '../lib/consoleApi';
import { navigateAssign, navigateReplace } from '../lib/navigation';
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
import { findNextPjcodeWithMinutes } from '../logic/timerSettings';
import type {
  ConsoleColor,
  ConsoleIssueState,
  ConsoleListItem,
  ConsoleOverlayStatus,
  ConsolePullRequestStatus,
  ConsoleStoryEntry,
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
  const featuresConfig = useConsoleFeaturesConfig();
  const airplaneMode = useAirplaneMode();
  const airplaneSnapshot =
    airplaneMode.status === 'on' ? airplaneMode.snapshot : null;
  const { snapshots, isLoading, error } = useConsoleTabData(
    pjcode,
    airplaneSnapshot,
  );
  const {
    timerMode,
    projectMinutes,
    isOpen: isSettingsOpen,
    draftTimerMode,
    draftProjectMinutes,
    openSettings,
    closeSettings,
    saveSettings,
    toggleDraftTimerMode,
    changeDraftMinutes,
  } = useConsoleTimerSettings();
  const {
    pjcodes,
    workflowImprovementIssueUrl,
    isLoading: isLoadingPjcodes,
  } = useConsoleProjectList();
  const { isTimerExpired } = useConsoleProjectTimer(pjcode);
  const overlayState = useConsoleOverlay(pjcode ?? OVERLAY_NAMESPACE_FALLBACK);

  const counts = useMemo(() => {
    const result = emptyCounts();
    for (const tab of CONSOLE_TABS) {
      const snapshot = snapshots[tab.name];
      if (snapshot === null) {
        continue;
      }
      if (tab.name === 'stories') {
        result[tab.name] = snapshot.stories.filter(
          (s) => s.color !== 'GRAY',
        ).length;
      } else {
        result[tab.name] = countPendingItems(
          snapshot.items,
          overlayEntriesActedSinceSnapshot(
            overlayState.overlay,
            snapshot.generatedAt,
          ),
          tab.name,
        );
      }
    }
    return result;
  }, [snapshots, overlayState.overlay]);

  const navigation = useConsoleNavigation(pjcode, counts);
  const { activeTab, selectedItemKey, openItem, closeItem, selectTab } =
    navigation;

  const commentDrafts = useRef(new Map<string, string>());
  const handleCommentDraftChange = useCallback(
    (draft: string) => {
      if (selectedItemKey === null) return;
      if (draft) {
        commentDrafts.current.set(selectedItemKey, draft);
      } else {
        commentDrafts.current.delete(selectedItemKey);
      }
    },
    [selectedItemKey],
  );

  const caches = useConsoleCaches(airplaneSnapshot);
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
      if (offlineItemStates.has(action.id) || offlineFetchErrors.has(action.id))
        continue;
      setOfflineItemStates((prev) => new Map(prev).set(action.id, null));
      caches.client
        .fetchIssueState(action.itemUrl)
        .then((state) => {
          setOfflineItemStates((prev) => new Map(prev).set(action.id, state));
          if (action.isPr) {
            setOfflinePrStatuses((prev) => new Map(prev).set(action.id, null));
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
      activeTab,
    );
  }, [activeSnapshot, overlayState.overlay, activeTab]);

  const orderedPendingKeys = useMemo(
    () => pendingItems.map((item) => overlayKeyForItem(item)),
    [pendingItems],
  );

  const storyOrder = activeSnapshot?.storyOrder ?? [];

  const rows = useMemo(
    () =>
      buildConsoleListRows(
        pendingItems,
        overlayState.overlay,
        storyOrder,
        activeSnapshot?.generatedAt ?? null,
      ),
    [pendingItems, overlayState.overlay, storyOrder, activeSnapshot],
  );

  const storyColors = activeSnapshot?.storyColors ?? {};
  const statusOptions = activeSnapshot?.statusOptions ?? [];
  const agentOptions = activeSnapshot?.agentOptions ?? [];
  const generatedAt = activeSnapshot?.generatedAt ?? null;
  const fromCache = activeSnapshot?.fromCache ?? false;

  const [localStoryEntriesOverride, setLocalStoryEntriesOverride] = useState<{
    generatedAt: string | undefined;
    stories: ConsoleStoryEntry[];
  } | null>(null);

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

  useEffect(() => {
    if (pjcode === null && timerMode && pjcodes.length > 0) {
      const firstPjcode = findNextPjcodeWithMinutes(
        pjcodes,
        null,
        projectMinutes,
      );
      if (firstPjcode !== null) {
        navigateReplace(`/projects/${firstPjcode}`);
      }
    }
  }, [pjcode, timerMode, pjcodes, projectMinutes]);

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
      ? resolveItemStory(
          selectedItem,
          overlayState.overlay,
          snapshots[activeTab]?.generatedAt ?? null,
        )
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
      if (airplaneMode.status === 'on') {
        actionQueue.showError(
          'Airplane mode',
          'This action requires a network connection. Turn off airplane mode and try again.',
        );
        return;
      }
      const actedKey = overlayKeyForItem(input.item);
      actionQueue.enqueue({
        message: formatActionToast(input.kind, input.item, activeTab),
        color: actionToastColor(input.kind),
        commit: input.commit,
        offline: input.offline,
        advance: () => {
          if (actionAdvances(input.kind, activeTab)) {
            if (
              timerMode &&
              isTimerExpired(projectMinutes[pjcode ?? ''] ?? 0)
            ) {
              const nextPjcode = findNextPjcodeWithMinutes(
                pjcodes,
                pjcode,
                projectMinutes,
              );
              if (nextPjcode !== null) {
                navigateAssign(`/projects/${nextPjcode}`);
              }
            } else {
              advanceToNext(actedKey);
            }
          }
        },
      });
    },
    [
      actionQueue,
      activeTab,
      advanceToNext,
      airplaneMode.status,
      timerMode,
      isTimerExpired,
      projectMinutes,
      pjcode,
      pjcodes,
    ],
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

  const [showGray, setShowGray] = useState(
    () => localStorage.getItem('console-story-show-gray') === 'true',
  );

  const handleToggleGray = useCallback((): void => {
    setShowGray((prev) => {
      const next = !prev;
      localStorage.setItem('console-story-show-gray', String(next));
      return next;
    });
  }, []);

  const storiesSnapshot = snapshots.stories;
  const rawStoryEntries = storiesSnapshot?.stories ?? [];
  const storyEntries =
    localStoryEntriesOverride !== null &&
    localStoryEntriesOverride.generatedAt === storiesSnapshot?.generatedAt
      ? localStoryEntriesOverride.stories
      : rawStoryEntries;
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

  const handleReorderStory = useCallback(
    async (storyOptionId: string, direction: 'up' | 'down'): Promise<void> => {
      if (pjcode === null) {
        throw new Error('No project specified in the URL path.');
      }
      await postConsoleReorderStory({ pjcode, storyOptionId, direction });
      const entryIndex = storyEntries.findIndex(
        (e) => e.storyOptionId === storyOptionId,
      );
      if (entryIndex !== -1) {
        const entrySwapIndex = entryIndex + (direction === 'up' ? -1 : 1);
        if (entrySwapIndex >= 0 && entrySwapIndex < storyEntries.length) {
          const nextEntries = [...storyEntries];
          const entryTemp = nextEntries[entryIndex];
          nextEntries[entryIndex] = nextEntries[entrySwapIndex];
          nextEntries[entrySwapIndex] = entryTemp;
          setLocalStoryEntriesOverride({
            generatedAt: storiesSnapshot?.generatedAt,
            stories: nextEntries,
          });
        }
      }
    },
    [pjcode, storyEntries, storiesSnapshot?.generatedAt],
  );

  const handleStoryAdd = useCallback(
    async (storyName: string): Promise<void> => {
      if (pjcode === null) {
        throw new Error('No project specified in the URL path.');
      }
      await postConsoleAddStory({ pjcode, storyName });
    },
    [pjcode],
  );

  const [storyOptimisticColors, setStoryOptimisticColors] = useState<
    Record<string, ConsoleColor>
  >({});
  const [storyColorChangeInFlight, setStoryColorChangeInFlight] = useState<
    string | null
  >(null);
  const [storyColorErrors, setStoryColorErrors] = useState<
    Record<string, string>
  >({});

  const handleSelectColor = useCallback(
    (storyOptionId: string, newColor: ConsoleColor): void => {
      const originalEntry = storyEntries.find(
        (e) => e.storyOptionId === storyOptionId,
      );
      const originalColor = originalEntry?.color;
      setStoryColorChangeInFlight(storyOptionId);
      setStoryOptimisticColors((prev) => ({
        ...prev,
        [storyOptionId]: newColor,
      }));
      setStoryColorErrors((prev) => {
        const next = { ...prev };
        delete next[storyOptionId];
        return next;
      });
      if (pjcode === null || defaultNameWithOwner === null) {
        setStoryOptimisticColors((prev) =>
          originalColor !== undefined
            ? { ...prev, [storyOptionId]: originalColor }
            : prev,
        );
        setStoryColorErrors((prev) => ({
          ...prev,
          [storyOptionId]: 'No project or repository configured.',
        }));
        setStoryColorChangeInFlight((current) =>
          current === storyOptionId ? null : current,
        );
        return;
      }
      postConsoleStoryColor({
        pjcode,
        storyOptionId,
        newColor,
        nameWithOwner: defaultNameWithOwner,
      })
        .catch((err: unknown) => {
          setStoryOptimisticColors((prev) =>
            originalColor !== undefined
              ? { ...prev, [storyOptionId]: originalColor }
              : prev,
          );
          setStoryColorErrors((prev) => ({
            ...prev,
            [storyOptionId]: err instanceof Error ? err.message : String(err),
          }));
        })
        .finally(() => {
          setStoryColorChangeInFlight((current) =>
            current === storyOptionId ? null : current,
          );
        });
    },
    [pjcode, defaultNameWithOwner, storyEntries],
  );

  const handleStoryDelete = useCallback(
    async (storyOptionId: string): Promise<void> => {
      if (pjcode === null) {
        throw new Error('No project specified in the URL path.');
      }
      await postConsoleDeleteStory({ pjcode, storyOptionId });
      setLocalStoryEntriesOverride({
        generatedAt: storiesSnapshot?.generatedAt,
        stories: storyEntries.filter((e) => e.storyOptionId !== storyOptionId),
      });
    },
    [pjcode, storyEntries, storiesSnapshot?.generatedAt],
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
          title={actionQueue.error.message}
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
        pjcodes={pjcodes}
        generatedAt={generatedAt}
        fromCache={fromCache}
        tabHref={navigation.tabHref}
        onSelectTab={navigation.selectTab}
        onSelectProject={(code) => navigateAssign(`/projects/${code}`)}
        settingsButton={
          <ConsoleTimerSettingsModalDialog
            isOpen={isSettingsOpen}
            timerMode={draftTimerMode}
            projectMinutes={draftProjectMinutes}
            pjcodes={pjcodes}
            isLoadingPjcodes={isLoadingPjcodes}
            onOpen={openSettings}
            onToggleTimerMode={toggleDraftTimerMode}
            onChangeMinutes={changeDraftMinutes}
            onSave={saveSettings}
            onClose={closeSettings}
          />
        }
        airplaneModeEnabled={featuresConfig.airplaneMode}
        airplaneModeStatus={airplaneMode.status}
        airplaneModeProgress={airplaneMode.progress}
        airplaneModeCapturedAt={airplaneSnapshot?.capturedAt ?? null}
        airplaneModeFailures={airplaneMode.failures}
        onAirplaneModeStartSync={airplaneMode.startSync}
        onAirplaneModeTurnOff={airplaneMode.turnOff}
        workflowImprovementIssueUrl={workflowImprovementIssueUrl}
      />
      <ConsoleProjectTimerBar
        timerEndsAt={activeSnapshot?.timerEndsAt ?? null}
        timerTotalSeconds={activeSnapshot?.timerTotalSeconds ?? null}
        now={now}
      />
      {activeTab === 'stories' ? (
        <ConsoleStoryList
          stories={storyEntries}
          isLoading={isLoading}
          error={error}
          showGray={showGray}
          onCreateIssue={handleCreateIssue}
          onAddStory={handleStoryAdd}
          onSelectColor={handleSelectColor}
          onToggleGray={handleToggleGray}
          onReorderStory={handleReorderStory}
          onDeleteStory={handleStoryDelete}
          optimisticColors={storyOptimisticColors}
          colorChangeInFlight={storyColorChangeInFlight}
          colorErrors={storyColorErrors}
        />
      ) : selectedItem === null ? (
        activeTab === 'queued' ? (
          <ConsoleQueuedList
            rows={rows}
            storyColors={storyColors}
            statusOptions={statusOptions}
            agentOptions={agentOptions}
            activeItemId={null}
            isLoading={isLoading}
            error={error}
            onSelectItem={(item) => navigation.openItem(item.projectItemId)}
          />
        ) : (
          <ConsoleItemList
            rows={rows}
            storyColors={storyColors}
            statusOptions={statusOptions}
            activeItemId={null}
            now={now}
            isLoading={isLoading}
            error={error}
            onSelectItem={(item) => navigation.openItem(item.projectItemId)}
          />
        )
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
            storyColors={storyColors}
            storyName={storyNameForSelected}
            overlayStatus={overlayStatusForSelected}
            now={now}
            initialCommentDraft={
              commentDrafts.current.get(selectedItem.projectItemId) ?? ''
            }
            onCommentDraftChange={handleCommentDraftChange}
            onQueueAction={handleQueueAction}
          />
        </div>
      )}
    </main>
  );
};
