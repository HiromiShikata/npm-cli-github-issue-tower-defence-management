import { useMemo, useState } from 'react';
import { ConsoleProjectSummary } from '../components/layout/ConsoleProjectSummary';
import { ConsoleTabList } from '../components/layout/ConsoleTabList';
import { ConsoleItemList } from '../components/list/ConsoleItemList';
import { useConsoleCaches } from '../hooks/useConsoleCaches';
import { useConsoleOperations } from '../hooks/useConsoleOperations';
import { useConsoleOverlay } from '../hooks/useConsoleOverlay';
import { useConsolePjcode } from '../hooks/useConsolePjcode';
import { useConsoleTabData } from '../hooks/useConsoleTabData';
import { buildConsoleListRows, resolveItemStory } from '../logic/grouping';
import {
  countPendingItems,
  filterPendingItems,
  overlayKeyForItem,
  parseGeneratedAtMs,
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
  const [activeTab, setActiveTab] = useState<ConsoleTabName>(
    CONSOLE_TABS[0].name,
  );
  const [selectedItem, setSelectedItem] = useState<ConsoleListItem | null>(
    null,
  );

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
        parseGeneratedAtMs(snapshot.generatedAt),
        tab.name,
      );
    }
    return result;
  }, [snapshots, overlayState.overlay]);

  const activeSnapshot = snapshots[activeTab];
  const pendingItems = useMemo(() => {
    if (activeSnapshot === null) {
      return [];
    }
    return filterPendingItems(
      activeSnapshot.items,
      overlayState.overlay,
      parseGeneratedAtMs(activeSnapshot.generatedAt),
      activeTab,
    );
  }, [activeSnapshot, overlayState.overlay, activeTab]);

  const rows = useMemo(
    () => buildConsoleListRows(pendingItems, overlayState.overlay),
    [pendingItems, overlayState.overlay],
  );

  const storyColors = activeSnapshot?.storyColors ?? {};
  const statusOptions = activeSnapshot?.statusOptions ?? [];
  const storyOptions = activeSnapshot?.storyOptions ?? [];

  const selectTab = (tab: ConsoleTabName): void => {
    setActiveTab(tab);
    setSelectedItem(null);
  };

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
      <ConsoleProjectSummary pjcode={pjcode} />
      <ConsoleTabList
        activeTab={activeTab}
        counts={counts}
        onSelectTab={selectTab}
      />
      {selectedItem === null ? (
        <ConsoleItemList
          rows={rows}
          storyColors={storyColors}
          activeItemId={null}
          isLoading={isLoading}
          error={error}
          onSelectItem={setSelectedItem}
        />
      ) : (
        <div className="console-detail-screen">
          <button
            type="button"
            className="console-back-button"
            onClick={() => setSelectedItem(null)}
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
          />
        </div>
      )}
    </main>
  );
};
