import { useEffect } from 'react';
import {
  CONSOLE_TAB_REFRESH_INTERVAL_MS,
  refreshProjectTabsToCache,
} from './useConsoleTabData';

export const useConsoleBackgroundTabRefresh = (
  activePjcode: string | null,
  activeTab: string | null,
  allPjcodes: string[],
  isForegroundLoading: boolean,
  enabled: boolean,
): void => {
  useEffect(() => {
    if (!enabled || isForegroundLoading) {
      return;
    }
    const backgroundPjcodes = allPjcodes.filter(
      (c) => c !== activePjcode && c !== activeTab,
    );
    if (backgroundPjcodes.length === 0) {
      return;
    }
    for (const pjcode of backgroundPjcodes) {
      refreshProjectTabsToCache(pjcode).catch(() => {});
    }
  }, [enabled, isForegroundLoading, activePjcode, activeTab, allPjcodes]);

  useEffect(() => {
    if (!enabled || isForegroundLoading) {
      return;
    }
    const backgroundPjcodes = allPjcodes.filter((c) => c !== activePjcode);
    if (backgroundPjcodes.length === 0) {
      return;
    }
    const timer = setInterval(() => {
      for (const pjcode of backgroundPjcodes) {
        refreshProjectTabsToCache(pjcode).catch(() => {});
      }
    }, CONSOLE_TAB_REFRESH_INTERVAL_MS);
    return () => {
      clearInterval(timer);
    };
  }, [enabled, isForegroundLoading, activePjcode, allPjcodes]);
};
