import { useCallback, useEffect, useState } from 'react';
import { CONSOLE_TABS, type ConsoleTabName } from '../logic/types';

const TAB_NAMES = new Set<string>(CONSOLE_TABS.map((tab) => tab.name));

export const parseTabFromPath = (pathname: string): ConsoleTabName | null => {
  const segments = pathname.split('/').filter((segment) => segment.length > 0);
  if (segments.length < 3 || segments[0] !== 'projects') {
    return null;
  }
  const candidate = segments[2];
  return TAB_NAMES.has(candidate) ? (candidate as ConsoleTabName) : null;
};

export const parseItemKeyFromHash = (hash: string): string | null => {
  const prefix = '#item/';
  if (!hash.startsWith(prefix)) {
    return null;
  }
  const encoded = hash.slice(prefix.length);
  if (encoded.length === 0) {
    return null;
  }
  return decodeURIComponent(encoded);
};

export type ConsoleNavigation = {
  activeTab: ConsoleTabName;
  selectedItemKey: string | null;
  tabHref: (tab: ConsoleTabName) => string;
  selectTab: (tab: ConsoleTabName) => void;
  openItem: (itemKey: string) => void;
  closeItem: () => void;
};

export const useConsoleNavigation = (
  pjcode: string | null,
): ConsoleNavigation => {
  const readState = useCallback((): {
    activeTab: ConsoleTabName;
    selectedItemKey: string | null;
  } => {
    if (typeof window === 'undefined') {
      return { activeTab: CONSOLE_TABS[0].name, selectedItemKey: null };
    }
    return {
      activeTab:
        parseTabFromPath(window.location.pathname) ?? CONSOLE_TABS[0].name,
      selectedItemKey: parseItemKeyFromHash(window.location.hash),
    };
  }, []);

  const [state, setState] = useState(readState);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const sync = (): void => {
      setState(readState());
    };
    window.addEventListener('popstate', sync);
    window.addEventListener('hashchange', sync);
    return () => {
      window.removeEventListener('popstate', sync);
      window.removeEventListener('hashchange', sync);
    };
  }, [readState]);

  const tabHref = useCallback(
    (tab: ConsoleTabName): string =>
      pjcode === null ? `#${tab}` : `/projects/${pjcode}/${tab}`,
    [pjcode],
  );

  const selectTab = useCallback(
    (tab: ConsoleTabName): void => {
      if (typeof window === 'undefined') {
        setState({ activeTab: tab, selectedItemKey: null });
        return;
      }
      window.history.pushState({}, '', tabHref(tab));
      setState({ activeTab: tab, selectedItemKey: null });
    },
    [tabHref],
  );

  const openItem = useCallback((itemKey: string): void => {
    if (typeof window !== 'undefined') {
      window.location.hash = `#item/${encodeURIComponent(itemKey)}`;
    }
    setState((current) => ({ ...current, selectedItemKey: itemKey }));
  }, []);

  const closeItem = useCallback((): void => {
    if (typeof window !== 'undefined' && window.location.hash !== '') {
      const url = `${window.location.pathname}${window.location.search}`;
      window.history.pushState({}, '', url);
    }
    setState((current) => ({ ...current, selectedItemKey: null }));
  }, []);

  return {
    activeTab: state.activeTab,
    selectedItemKey: state.selectedItemKey,
    tabHref,
    selectTab,
    openItem,
    closeItem,
  };
};
