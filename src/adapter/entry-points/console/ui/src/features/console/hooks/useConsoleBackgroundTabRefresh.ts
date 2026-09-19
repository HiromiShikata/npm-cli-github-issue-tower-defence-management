import { useEffect } from 'react';
import {
  CONSOLE_TAB_REFRESH_INTERVAL_MS,
  refreshProjectTabsToCache,
} from './useConsoleTabData';

export const useConsoleBackgroundTabRefresh = (
  activePjcode: string | null,
  allPjcodes: string[],
  enabled: boolean,
): void => {
  useEffect(() => {
    if (!enabled) {
      return;
    }
    const backgroundPjcodes = allPjcodes.filter((c) => c !== activePjcode);
    if (backgroundPjcodes.length === 0) {
      return;
    }

    const refresh = (): void => {
      for (const pjcode of backgroundPjcodes) {
        refreshProjectTabsToCache(pjcode).catch(() => {});
      }
    };

    refresh();
    const timer = setInterval(refresh, CONSOLE_TAB_REFRESH_INTERVAL_MS);
    return () => {
      clearInterval(timer);
    };
  }, [enabled, activePjcode, allPjcodes]);
};
