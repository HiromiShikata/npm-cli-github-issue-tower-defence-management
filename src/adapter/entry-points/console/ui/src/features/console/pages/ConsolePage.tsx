import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ConsoleListView } from '../components/ConsoleListView';
import { ConsoleTabBar } from '../components/ConsoleTabBar';
import { prefetchConsoleItems } from '../hooks/consolePrefetch';
import { useConsoleClient } from '../hooks/useConsoleClient';
import { useConsoleList } from '../hooks/useConsoleList';
import { useConsoleTabCounts } from '../hooks/useConsoleTabCounts';
import {
  type ConsoleProcessedOverlay,
  countPendingItems,
  markItemProcessed,
  subtractProcessedItems,
} from '../overlay';
import {
  CONSOLE_TABS,
  type ConsoleListItem,
  type ConsoleTabName,
} from '../types';
import { ConsoleItemDetailContainer } from './ConsoleItemDetailContainer';

export const ConsolePage = () => {
  const { client, cache } = useConsoleClient();
  const [activeTab, setActiveTab] = useState<ConsoleTabName>(
    CONSOLE_TABS[0].name,
  );
  const [overlay, setOverlay] = useState<ConsoleProcessedOverlay>({});
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const { items, statusOptions, storyOptions, storyColors, isLoading, error } =
    useConsoleList(activeTab);

  const pendingItems = useMemo(
    () => subtractProcessedItems(items, overlay),
    [items, overlay],
  );
  const activeTabCount = pendingItems.length;

  const { counts } = useConsoleTabCounts(overlay, activeTab, activeTabCount);

  useEffect(() => {
    if (pendingItems.length === 0) {
      return;
    }
    void prefetchConsoleItems(cache, pendingItems);
  }, [cache, pendingItems]);

  const selectedItem =
    pendingItems.find((item) => item.itemId === selectedItemId) ?? null;

  const tabCounts = {
    ...counts,
    [activeTab]: countPendingItems(items, overlay),
  };

  return (
    <main className="mx-auto flex max-w-3xl flex-col">
      <ConsoleTabBar
        activeTab={activeTab}
        counts={tabCounts}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          setSelectedItemId(null);
        }}
      />
      {selectedItem === null ? (
        <ConsoleListView
          items={pendingItems}
          storyColors={storyColors}
          selectedItemId={selectedItemId}
          onSelectItem={(item) => setSelectedItemId(item.itemId)}
          isLoading={isLoading}
          error={error}
        />
      ) : (
        <div className="flex flex-col">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="self-start"
            onClick={() => setSelectedItemId(null)}
          >
            Back to list
          </Button>
          <ConsoleItemDetailContainer
            tab={activeTab}
            item={selectedItem}
            client={client}
            cache={cache}
            statusOptions={statusOptions}
            storyOptions={storyOptions}
            onProcessed={(item: ConsoleListItem) =>
              setOverlay((current) => markItemProcessed(current, item))
            }
            onAdvance={() => setSelectedItemId(null)}
          />
        </div>
      )}
    </main>
  );
};
