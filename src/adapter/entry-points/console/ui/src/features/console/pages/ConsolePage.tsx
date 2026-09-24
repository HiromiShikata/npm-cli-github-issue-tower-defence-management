import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ConsoleProjectSettingsModalScreen } from '../components/layout/ConsoleProjectSettingsModalScreen';
import { ConsoleProjectTimerBar } from '../components/layout/ConsoleProjectTimerBar';
import { ConsoleTabList } from '../components/layout/ConsoleTabList';
import { ConsoleTimerSettingsModalDialog } from '../components/layout/ConsoleTimerSettingsModalDialog';
import {
  type IssueCreateDraft,
  IssueCreateModalDialog,
  type IssueCreateParams,
} from '../components/layout/IssueCreateModalDialog';
import { ConsoleItemList } from '../components/list/ConsoleItemList';
import { ConsolePrsAgentFilter } from '../components/list/ConsolePrsAgentFilter';
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
import { useConsoleBackgroundTabRefresh } from '../hooks/useConsoleBackgroundTabRefresh';
import { useConsoleCaches } from '../hooks/useConsoleCaches';
import { useConsoleDetailPrefetch } from '../hooks/useConsoleDetailPrefetch';
import { useConsoleExplicitProjectSelection } from '../hooks/useConsoleExplicitProjectSelection';
import { useConsoleFeaturesConfig } from '../hooks/useConsoleFeaturesConfig';
import { useConsoleNavigation } from '../hooks/useConsoleNavigation';
import { useConsoleOperations } from '../hooks/useConsoleOperations';
import { useConsoleOverlay } from '../hooks/useConsoleOverlay';
import { useConsolePjcode } from '../hooks/useConsolePjcode';
import { useConsoleProjectList } from '../hooks/useConsoleProjectList';
import { useConsoleProjectSelectHandler } from '../hooks/useConsoleProjectSelectHandler';
import { useConsoleProjectSettings } from '../hooks/useConsoleProjectSettings';
import { useConsoleProjectTimer } from '../hooks/useConsoleProjectTimer';
import { useConsolePrsTabSummaries } from '../hooks/useConsolePrsTabSummaries';
import { useConsoleSwipeNavigation } from '../hooks/useConsoleSwipeNavigation';
import { useConsoleTabData } from '../hooks/useConsoleTabData';
import { useConsoleTabSelectHandler } from '../hooks/useConsoleTabSelectHandler';
import { useConsoleTimerFirstItemAutoOpen } from '../hooks/useConsoleTimerFirstItemAutoOpen';
import { useConsoleTimerProjectSkipNavigation } from '../hooks/useConsoleTimerProjectSkipNavigation';
import { useConsoleTimerSettings } from '../hooks/useConsoleTimerSettings';
import {
  encodeAttachmentContent,
  postConsoleAddStory,
  postConsoleAttachment,
  postConsoleComment,
  postConsoleCreateIssue,
  postConsoleDeleteStory,
  postConsoleReorderStory,
  postConsoleStoryColor,
  postConsoleStoryRename,
  postConsoleUpdateStoryDescription,
} from '../lib/consoleApi';
import { navigatePush, navigateReplaceState } from '../lib/navigation';
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
  computeEffectiveOverlay,
  countPendingItems,
  filterPendingItems,
  overlayKeyForItem,
  overlayStatusSinceSnapshot,
} from '../logic/overlay';
import type { ConsoleSwipeDirection } from '../logic/swipe';
import { findNextNonEmptyTabToRight } from '../logic/tabAdvance';
import {
  DEFAULT_TIMER_MINUTES,
  findNextPjcodeWithMinutes,
} from '../logic/timerSettings';
import type {
  ConsoleColor,
  ConsoleFieldOption,
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
  const { snapshots, isLoading, error, refreshSingleTab } = useConsoleTabData(
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
    projectUrls,
    fleetTaskCreateUrl,
    nameWithOwnerByPjcode,
    isLoading: isLoadingPjcodes,
  } = useConsoleProjectList();
  const { isTimerExpired } = useConsoleProjectTimer(pjcode);
  const overlayState = useConsoleOverlay(pjcode ?? OVERLAY_NAMESPACE_FALLBACK);

  const projectSettings = useConsoleProjectSettings(pjcodes);

  const effectiveOverlay = useMemo(
    () => computeEffectiveOverlay(overlayState.overlay, snapshots),
    [overlayState.overlay, snapshots],
  );

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
          effectiveOverlay,
          tab.name,
        );
      }
    }
    return result;
  }, [snapshots, effectiveOverlay]);

  const loadedTabs = useMemo(() => {
    const result = new Set<ConsoleTabName>();
    for (const tab of CONSOLE_TABS) {
      const snapshot = snapshots[tab.name];
      if (snapshot !== null && !snapshot.fromCache) {
        result.add(tab.name);
      }
    }
    return result;
  }, [snapshots]);

  const snapshotCounts = useMemo(() => {
    const result = emptyCounts();
    for (const tab of CONSOLE_TABS) {
      const snapshot = snapshots[tab.name];
      if (snapshot === null) {
        continue;
      }
      result[tab.name] =
        tab.name === 'stories'
          ? snapshot.stories.filter((s) => s.color !== 'GRAY').length
          : snapshot.items.length;
    }
    return result;
  }, [snapshots]);

  const navigation = useConsoleNavigation(
    pjcode,
    counts,
    loadedTabs,
    snapshotCounts,
  );
  const { activeTab, selectedItemKey, openItem, closeItem } = navigation;
  const selectTab = useConsoleTabSelectHandler(navigation.selectTab);
  const { explicitlySelectedPjcode, notifyExplicitSelection } =
    useConsoleExplicitProjectSelection(pjcode);
  const navigateToProject = useCallback(
    (code: string) => {
      notifyExplicitSelection(code);
      navigatePush(`/projects/${code}`);
    },
    [notifyExplicitSelection],
  );
  const selectProject = useConsoleProjectSelectHandler(navigateToProject);

  useConsoleBackgroundTabRefresh(
    pjcode,
    activeTab,
    pjcodes,
    isLoading,
    timerMode && airplaneSnapshot === null,
  );

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
  const refreshQueuedTab = useCallback(
    () => refreshSingleTab('queued'),
    [refreshSingleTab],
  );
  const operations = useConsoleOperations(pjcode, caches, refreshQueuedTab);
  const actionQueue = useConsoleActionQueue();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => {
      clearInterval(id);
    };
  }, []);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isFleetTaskCreateDialogOpen, setIsFleetTaskCreateDialogOpen] =
    useState(false);
  const [fleetDialogDraft, setFleetDialogDraft] = useState<IssueCreateDraft>({
    title: '',
    body: null,
    storyName: null,
    agentOptionId: null,
  });
  const [dialogDraft, setDialogDraft] = useState<IssueCreateDraft>({
    title: '',
    body: null,
    storyName: null,
    agentOptionId: null,
  });

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
      effectiveOverlay,
      activeTab,
    );
  }, [activeSnapshot, effectiveOverlay, activeTab]);

  const [prsAgentFilter, setPrsAgentFilter] = useState<string | null>(null);

  const prsAgentCounts = useMemo((): Record<string, number> => {
    if (activeTab !== 'prs') return {};
    const counts: Record<string, number> = {};
    for (const item of pendingItems) {
      if (item.agent !== null && item.agent !== '') {
        counts[item.agent] = (counts[item.agent] ?? 0) + 1;
      }
    }
    return counts;
  }, [pendingItems, activeTab]);

  useEffect(() => {
    if (
      activeTab === 'prs' &&
      prsAgentFilter !== null &&
      (prsAgentCounts[prsAgentFilter] ?? 0) === 0
    ) {
      setPrsAgentFilter(null);
    }
  }, [prsAgentCounts, prsAgentFilter, activeTab]);

  const agentFilteredPendingItems = useMemo(() => {
    if (activeTab !== 'prs' || prsAgentFilter === null) {
      return pendingItems;
    }
    return pendingItems.filter((item) => item.agent === prsAgentFilter);
  }, [pendingItems, activeTab, prsAgentFilter]);

  const orderedPendingKeys = useMemo(
    () => agentFilteredPendingItems.map((item) => overlayKeyForItem(item)),
    [agentFilteredPendingItems],
  );

  const storyOrder = activeSnapshot?.storyOrder ?? [];

  const rows = useMemo(
    () =>
      buildConsoleListRows(
        agentFilteredPendingItems,
        overlayState.overlay,
        storyOrder,
        activeSnapshot?.generatedAt ?? null,
      ),
    [
      agentFilteredPendingItems,
      overlayState.overlay,
      storyOrder,
      activeSnapshot,
    ],
  );

  const storyColors = activeSnapshot?.storyColors ?? {};
  const statusOptions = activeSnapshot?.statusOptions ?? [];
  const agentOptions = activeSnapshot?.agentOptions ?? [];
  const storyOptions = activeSnapshot?.storyOptions ?? [];
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
        navigateReplaceState(`/projects/${firstPjcode}/todo-by-human`);
      }
    }
  }, [pjcode, timerMode, pjcodes, projectMinutes]);

  useConsoleTimerProjectSkipNavigation(
    timerMode,
    counts.prs,
    counts['todo-by-human'],
    pjcode,
    pjcodes,
    projectMinutes,
    snapshots.prs !== null,
    snapshots['todo-by-human'] !== null,
    snapshots.prs?.fromCache ?? false,
    snapshots['todo-by-human']?.fromCache ?? false,
    explicitlySelectedPjcode,
  );

  useConsoleTimerFirstItemAutoOpen(
    timerMode,
    pjcode,
    agentFilteredPendingItems,
    selectedItemKey,
    navigation.openItem,
  );

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
      const overlayPatch = input.overlayPatch;
      actionQueue.enqueue({
        message: formatActionToast(input.kind, input.item, activeTab),
        color: actionToastColor(input.kind),
        commit: input.commit,
        offline: input.offline,
        revertAdvance: input.revertAdvance,
        optimistic:
          overlayPatch !== undefined
            ? () => overlayState.patchOverlay(actedKey, overlayPatch, activeTab)
            : undefined,
        revertOptimistic:
          overlayPatch !== undefined
            ? () => overlayState.revertOverlayEntry(actedKey)
            : undefined,
        advance: () => {
          input.onAdvance?.();
          if (!input.skipAdvance && actionAdvances(input.kind, activeTab)) {
            if (
              timerMode &&
              isTimerExpired(
                projectMinutes[pjcode ?? ''] ?? DEFAULT_TIMER_MINUTES,
              )
            ) {
              const nextPjcode = findNextPjcodeWithMinutes(
                pjcodes,
                pjcode,
                projectMinutes,
              );
              if (nextPjcode !== null) {
                navigatePush(`/projects/${nextPjcode}/todo-by-human`);
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
      overlayState,
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
  const newIssueUrl =
    defaultNameWithOwner !== null
      ? `https://github.com/${defaultNameWithOwner}/issues/new`
      : null;

  const selectedItemStoryEntry = useMemo<ConsoleStoryEntry | null>(() => {
    if (selectedItem === null) return null;
    if (!selectedItem.labels.includes('story')) return null;
    return storyEntries.find((e) => e.storyName === selectedItem.story) ?? null;
  }, [selectedItem, storyEntries]);

  const handleCreateIssue = useCallback(
    async (storyName: string, title: string): Promise<void> => {
      if (pjcode === null) {
        throw new Error('No project specified in the URL path.');
      }
      if (defaultNameWithOwner === null) {
        throw new Error('No repository configured for this project.');
      }
      await postConsoleCreateIssue({
        pjcode,
        title,
        storyName,
        nameWithOwner: defaultNameWithOwner,
      });
    },
    [pjcode, defaultNameWithOwner],
  );

  const handleCreateIssueFromDialog = useCallback(
    ({
      storyName,
      agentOptionId,
      title,
      body,
      files,
    }: IssueCreateParams): Promise<void> => {
      if (pjcode === null || defaultNameWithOwner === null) {
        return Promise.resolve();
      }
      const capturedPjcode = pjcode;
      const capturedNameWithOwner = defaultNameWithOwner;
      actionQueue.enqueue({
        message: `Task created — "${title}"`,
        color: 'blue',
        commit: async () => {
          const issueUrl = await postConsoleCreateIssue({
            pjcode: capturedPjcode,
            title,
            storyName: storyName ?? '',
            nameWithOwner: capturedNameWithOwner,
            agentOptionId: agentOptionId ?? null,
            body: body ?? null,
          });
          if (files.length > 0) {
            const markdownParts = await Promise.all(
              files.map(async (file) => {
                const bytes = new Uint8Array(await file.arrayBuffer());
                const contentBase64 = encodeAttachmentContent(bytes);
                return postConsoleAttachment({
                  pjcode: capturedPjcode,
                  url: issueUrl,
                  fileName: file.name,
                  contentBase64,
                });
              }),
            );
            const commentResult = await postConsoleComment({
              pjcode: capturedPjcode,
              url: issueUrl,
              body: markdownParts.join('\n\n'),
            });
            if (!commentResult.posted) {
              throw new Error(commentResult.error);
            }
          }
        },
        advance: () => {},
      });
      setDialogDraft({
        title: '',
        body: null,
        storyName: null,
        agentOptionId: null,
      });
      return Promise.resolve();
    },
    [pjcode, defaultNameWithOwner, actionQueue],
  );

  const handleCreateFleetTaskFromDialog = useCallback(
    ({
      title,
      body,
      storyName,
      agentOptionId,
      files,
    }: IssueCreateParams): Promise<void> => {
      if (fleetTaskCreateUrl === null || pjcode === null) {
        return Promise.resolve();
      }
      const match = fleetTaskCreateUrl.match(/github\.com\/([^/]+\/[^/]+)/);
      if (match === null) {
        return Promise.resolve();
      }
      const nameWithOwner = match[1];
      const capturedPjcode = pjcode;
      actionQueue.enqueue({
        message: `Task created — "${title}"`,
        color: 'blue',
        commit: async () => {
          const issueUrl = await postConsoleCreateIssue({
            pjcode: capturedPjcode,
            title,
            storyName: storyName ?? '',
            nameWithOwner,
            agentOptionId: agentOptionId ?? null,
            body: body ?? null,
          });
          if (files.length > 0) {
            const markdownParts = await Promise.all(
              files.map(async (file) => {
                const bytes = new Uint8Array(await file.arrayBuffer());
                const contentBase64 = encodeAttachmentContent(bytes);
                return postConsoleAttachment({
                  pjcode: capturedPjcode,
                  url: issueUrl,
                  fileName: file.name,
                  contentBase64,
                });
              }),
            );
            const commentResult = await postConsoleComment({
              pjcode: capturedPjcode,
              url: issueUrl,
              body: markdownParts.join('\n\n'),
            });
            if (!commentResult.posted) {
              throw new Error(commentResult.error);
            }
          }
        },
        advance: () => {},
      });
      setFleetDialogDraft({
        title: '',
        body: null,
        storyName: null,
        agentOptionId: null,
      });
      return Promise.resolve();
    },
    [fleetTaskCreateUrl, pjcode, actionQueue],
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
      const returnedStories = await postConsoleAddStory({ pjcode, storyName });
      if (returnedStories.length > 0) {
        const nextEntries: ConsoleStoryEntry[] = returnedStories.map((api) => {
          const existing = storyEntries.find((e) => e.storyOptionId === api.id);
          return {
            storyOptionId: api.id,
            storyName: api.name,
            color: api.color as ConsoleColor,
            description: existing?.description ?? '',
            openItemCount: existing?.openItemCount ?? 0,
            storyViewUrl: existing?.storyViewUrl ?? null,
            items: existing?.items ?? [],
          };
        });
        setLocalStoryEntriesOverride({
          generatedAt: storiesSnapshot?.generatedAt,
          stories: nextEntries,
        });
      }
    },
    [pjcode, storyEntries, storiesSnapshot?.generatedAt],
  );

  const handleStoryTaskCreateEdit = useCallback(
    (storyName: string, title: string): void => {
      setDialogDraft({ title, body: null, storyName, agentOptionId: null });
      setIsDialogOpen(true);
    },
    [],
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
    async (storyOptionId: string, deleteChildTasks: boolean): Promise<void> => {
      if (pjcode === null) {
        throw new Error('No project specified in the URL path.');
      }
      await postConsoleDeleteStory({ pjcode, storyOptionId, deleteChildTasks });
      setLocalStoryEntriesOverride({
        generatedAt: storiesSnapshot?.generatedAt,
        stories: storyEntries.filter((e) => e.storyOptionId !== storyOptionId),
      });
    },
    [pjcode, storyEntries, storiesSnapshot?.generatedAt],
  );

  const handleStoryRename = useCallback(
    async (storyOptionId: string, newName: string): Promise<void> => {
      if (pjcode === null) {
        throw new Error('No project specified in the URL path.');
      }
      await postConsoleStoryRename({ pjcode, storyOptionId, newName });
      const updatedEntries = storyEntries.map((e) =>
        e.storyOptionId === storyOptionId ? { ...e, storyName: newName } : e,
      );
      setLocalStoryEntriesOverride({
        generatedAt: storiesSnapshot?.generatedAt,
        stories: updatedEntries,
      });
    },
    [pjcode, storyEntries, storiesSnapshot?.generatedAt],
  );

  const handleStoryUpdateDescription = useCallback(
    async (storyOptionId: string, newDescription: string): Promise<void> => {
      if (pjcode === null) {
        throw new Error('No project specified in the URL path.');
      }
      await postConsoleUpdateStoryDescription({
        pjcode,
        storyOptionId,
        description: newDescription,
      });
      const updatedEntries = storyEntries.map((e) =>
        e.storyOptionId === storyOptionId
          ? { ...e, description: newDescription }
          : e,
      );
      setLocalStoryEntriesOverride({
        generatedAt: storiesSnapshot?.generatedAt,
        stories: updatedEntries,
      });
    },
    [pjcode, storyEntries, storiesSnapshot?.generatedAt],
  );

  const prsTabSummaries = useConsolePrsTabSummaries(
    pendingItems,
    caches.comments,
    activeTab === 'prs',
  );

  const handleOkAndAwaitingWorkspaceFromList = useCallback(
    (item: ConsoleListItem, option: ConsoleFieldOption): void => {
      handleQueueAction({
        kind: { type: 'ok_and_awaiting_workspace' },
        item,
        commit: () => operations.okAndMoveToAwaitingWorkspace(item, option),
        skipAdvance: true,
        overlayPatch: {
          done: true,
          status: { name: option.name, color: option.color },
        },
      });
    },
    [handleQueueAction, operations],
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
          onRetry={
            actionQueue.error.retry !== undefined
              ? () => {
                  actionQueue.dismissError();
                  actionQueue.error?.retry?.();
                }
              : undefined
          }
        />
      )}
      <ConsoleOfflinePendingActionsPanel
        actions={offlinePanelActions}
        isOnline={isOnline}
        isConfirming={isConfirmingOffline}
        onConfirm={handleConfirmOffline}
        onDiscard={actionQueue.discardOfflineAction}
      />
      {projectSettings.isOpen && (
        <ConsoleProjectSettingsModalScreen
          pjcodes={pjcodes}
          inputValues={projectSettings.inputValues}
          onChangeInput={projectSettings.changeInput}
          isLoading={projectSettings.isLoading}
          isSaving={projectSettings.isSaving}
          error={projectSettings.error}
          nameWithOwnerByPjcode={nameWithOwnerByPjcode}
          onSave={projectSettings.save}
          onClose={projectSettings.close}
        />
      )}
      <ConsoleTabList
        activeTab={activeTab}
        counts={counts}
        pjcode={pjcode}
        pjcodes={pjcodes}
        generatedAt={generatedAt}
        fromCache={fromCache}
        tabHref={navigation.tabHref}
        onSelectTab={selectTab}
        onSelectProject={selectProject}
        settingsButton={
          <>
            <ConsoleTimerSettingsModalDialog
              isOpen={isSettingsOpen}
              isTimerActive={timerMode}
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
            <button
              type="button"
              className="console-tab-settings-button"
              aria-label="Open max settings"
              onClick={projectSettings.open}
            >
              ⚙
            </button>
            {pjcode !== null && (
              <>
                <button
                  type="button"
                  className="console-task-create-button"
                  disabled={
                    defaultNameWithOwner === null || storyEntries.length === 0
                  }
                  onClick={() => setIsDialogOpen(true)}
                  aria-label="Create new task"
                  title="Create new task"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.375 2.625a2.121 2.121 0 0 1 3 3L7 18l-4 1 1-4Z" />
                  </svg>
                </button>
                {isDialogOpen && (
                  <IssueCreateModalDialog
                    storyEntries={storyEntries}
                    agentOptions={agentOptions}
                    onSubmit={handleCreateIssueFromDialog}
                    onClose={() => setIsDialogOpen(false)}
                    initialDraft={dialogDraft}
                    onDraftChange={setDialogDraft}
                    fleetTaskCreateUrl={fleetTaskCreateUrl}
                    newIssueUrl={newIssueUrl}
                  />
                )}
              </>
            )}
          </>
        }
        airplaneModeEnabled={featuresConfig.airplaneMode}
        airplaneModeStatus={airplaneMode.status}
        airplaneModeProgress={airplaneMode.progress}
        airplaneModeCapturedAt={airplaneSnapshot?.capturedAt ?? null}
        airplaneModeFailures={airplaneMode.failures}
        onAirplaneModeStartSync={airplaneMode.startSync}
        onAirplaneModeTurnOff={airplaneMode.turnOff}
        onAirplaneModeRetryFailed={airplaneMode.retryFailed}
        projectUrl={pjcode !== null ? (projectUrls?.[pjcode] ?? null) : null}
        onFleetTaskCreate={
          fleetTaskCreateUrl !== null
            ? () => setIsFleetTaskCreateDialogOpen(true)
            : null
        }
        now={now}
      />
      {isFleetTaskCreateDialogOpen && (
        <IssueCreateModalDialog
          storyEntries={storyEntries}
          agentOptions={agentOptions}
          initialDraft={fleetDialogDraft}
          onDraftChange={setFleetDialogDraft}
          onSubmit={handleCreateFleetTaskFromDialog}
          onClose={() => setIsFleetTaskCreateDialogOpen(false)}
          containerClassName="console-fleet-task-create-dialog-container"
        />
      )}
      <ConsoleProjectTimerBar
        timerEndsAt={activeSnapshot?.timerEndsAt ?? null}
        timerTotalSeconds={activeSnapshot?.timerTotalSeconds ?? null}
        now={now}
      />
      {activeTab === 'stories' ? (
        <div className="console-list-screen">
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
            onRenameStory={handleStoryRename}
            onUpdateDescription={handleStoryUpdateDescription}
            onStoryTaskCreateEdit={handleStoryTaskCreateEdit}
            optimisticColors={storyOptimisticColors}
            colorChangeInFlight={storyColorChangeInFlight}
            colorErrors={storyColorErrors}
          />
        </div>
      ) : selectedItem === null ? (
        activeTab === 'queued' ? (
          <div className="console-list-screen">
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
          </div>
        ) : activeTab === 'prs' ? (
          <div className="console-list-screen">
            <ConsolePrsAgentFilter
              agentOptions={agentOptions}
              agentCounts={prsAgentCounts}
              selectedAgent={prsAgentFilter}
              onAgentChange={setPrsAgentFilter}
            />
            <ConsoleItemList
              rows={rows}
              storyColors={storyColors}
              statusOptions={statusOptions}
              activeItemId={null}
              now={now}
              isLoading={isLoading}
              error={error}
              onSelectItem={(item) => navigation.openItem(item.projectItemId)}
              executiveSummaries={prsTabSummaries}
              onOkAndAwaitingWorkspace={handleOkAndAwaitingWorkspaceFromList}
            />
          </div>
        ) : (
          <div className="console-list-screen">
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
          </div>
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
            storyOptions={storyOptions}
            agentOptions={agentOptions}
            storyEntries={storyEntries}
            storyColors={storyColors}
            storyName={storyNameForSelected}
            overlayStatus={overlayStatusForSelected}
            now={now}
            initialCommentDraft={
              commentDrafts.current.get(selectedItem.projectItemId) ?? ''
            }
            onCommentDraftChange={handleCommentDraftChange}
            onQueueAction={handleQueueAction}
            onCommentError={(message, reason) =>
              actionQueue.showError(message, reason)
            }
            onDeleteStory={
              selectedItemStoryEntry !== null
                ? async (deleteChildTasks: boolean) => {
                    await handleStoryDelete(
                      selectedItemStoryEntry.storyOptionId,
                      deleteChildTasks,
                    );
                    closeItem();
                  }
                : null
            }
            storyNameForDeletion={selectedItemStoryEntry?.storyName ?? null}
            onCreateIssueFromComment={
              fleetTaskCreateUrl !== null
                ? handleCreateFleetTaskFromDialog
                : undefined
            }
          />
        </div>
      )}
    </main>
  );
};
