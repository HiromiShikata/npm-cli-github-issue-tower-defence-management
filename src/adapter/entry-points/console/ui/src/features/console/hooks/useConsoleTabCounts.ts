import { useEffect, useState } from 'react';
import {
  type ConsoleProcessedOverlay,
  type ConsoleTabCounts,
  countPendingItems,
  emptyTabCounts,
} from '../overlay';
import {
  CONSOLE_TABS,
  type ConsoleListItem,
  type ConsoleTabName,
} from '../types';
import { useConsoleToken } from './useConsoleToken';

const buildListUrl = (tab: ConsoleTabName): string => `./${tab}/list.json`;

const fetchTabItems = async (
  appendToken: (url: string) => string,
  tab: ConsoleTabName,
): Promise<ConsoleListItem[]> => {
  const response = await fetch(appendToken(buildListUrl(tab)), {
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const payload = (await response.json()) as Record<string, unknown>;
  return Array.isArray(payload.items)
    ? (payload.items as ConsoleListItem[])
    : [];
};

export type ConsoleTabCountsState = {
  counts: ConsoleTabCounts;
};

export const useConsoleTabCounts = (
  overlay: ConsoleProcessedOverlay,
  activeTab: ConsoleTabName,
  activeTabCount: number,
): ConsoleTabCountsState => {
  const { appendToken } = useConsoleToken();
  const [counts, setCounts] = useState<ConsoleTabCounts>(emptyTabCounts);

  useEffect(() => {
    let cancelled = false;
    const otherTabs = CONSOLE_TABS.map((tab) => tab.name).filter(
      (name) => name !== activeTab,
    );

    Promise.all(
      otherTabs.map(async (tab) => {
        const items = await fetchTabItems(appendToken, tab).catch(
          () => [] as ConsoleListItem[],
        );
        return [tab, countPendingItems(items, overlay)] as const;
      }),
    ).then((entries) => {
      if (cancelled) {
        return;
      }
      setCounts((current) => {
        const next: ConsoleTabCounts = {
          ...current,
          [activeTab]: activeTabCount,
        };
        for (const [tab, count] of entries) {
          next[tab] = count;
        }
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [appendToken, overlay, activeTab, activeTabCount]);

  return { counts };
};
