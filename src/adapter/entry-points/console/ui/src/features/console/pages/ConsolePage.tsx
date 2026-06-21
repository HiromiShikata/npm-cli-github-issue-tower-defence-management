import { useMemo } from 'react';
import { ConsoleTabList } from '../components/layout/ConsoleTabList';
import { ConsoleItemList } from '../components/list/ConsoleItemList';
import { useConsoleCaches } from '../hooks/useConsoleCaches';
import { useConsoleNavigation } from '../hooks/useConsoleNavigation';
import { useConsoleOperations } from '../hooks/useConsoleOperations';
import { useConsoleOverlay } from '../hooks/useConsoleOverlay';
import { useConsolePjcode } from '../hooks/useConsolePjcode';
import { useConsoleTabData } from '../hooks/useConsoleTabData';
import { buildConsoleListRows, resolveItemStory } from '../logic/grouping';
import {
  countPendingItems,
  filterPendingItems,
  overlayKeyForItem,
} from '../logic/overlay';
import type {
  ConsoleListItem,
  ConsoleOverlayStatus,
  ConsoleTabName,
} from '../logic/types';
import { CONSOLE_TABS } from '../logic/types';
import { ConsoleItemDetailContainer } from './ConsoleItemDetailContainer';

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
  const { activeTab, selectedItemKey } = navigation;

  const overlayState = useConsoleOverlay(pjcode ?? OVERLAY_NAMESPACE_FALLBACK);
  const caches = useConsoleCaches();
  const operations = useConsoleOperations(pjcode, activeTab, overlayState);
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

  return (
    <main className="console-app">
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
        <div className="console-detail-screen">
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
          />
        </div>
      )}
    </main>
  );
};
