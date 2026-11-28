import { useCallback, useEffect, useRef, useState } from 'react';
import type { AirplaneSnapshot } from '../lib/airplaneSnapshot';
import {
  ConsoleNetworkError,
  fetchResponseOrNetworkError,
} from '../lib/consoleApi';
import type {
  ConsoleFieldOption,
  ConsoleListItem,
  ConsoleStoryColorSource,
  ConsoleStoryEntry,
  ConsoleTabName,
} from '../logic/types';
import { CONSOLE_TABS } from '../logic/types';
import { startLoadWithNetworkRetry } from './networkRetryingLoad';

export type ConsoleTabSnapshot = {
  items: ConsoleListItem[];
  generatedAt: string;
  statusOptions: ConsoleFieldOption[];
  agentOptions: ConsoleFieldOption[];
  storyOptions: ConsoleFieldOption[];
  storyColors: ConsoleStoryColorSource;
  stories: ConsoleStoryEntry[];
  defaultNameWithOwner: string | null;
  fromCache: boolean;
  storyOrder: string[];
  timerEndsAt: string | null;
  timerTotalSeconds: number | null;
};

export type ConsoleTabDataState = {
  snapshots: Record<ConsoleTabName, ConsoleTabSnapshot | null>;
  isLoading: boolean;
  error: string | null;
  refreshSingleTab: (tabName: ConsoleTabName) => Promise<void>;
};

export type ConsoleTabDataVisibleState = {
  pjcode: string | null;
  snapshots: Record<ConsoleTabName, ConsoleTabSnapshot | null>;
};

type FetchSnapshotsResult = {
  snapshots: Record<ConsoleTabName, ConsoleTabSnapshot | null>;
  firstError: Error | null;
  networkFailed: boolean;
};

class ListNetworkFailure extends ConsoleNetworkError {
  readonly result: FetchSnapshotsResult;

  constructor(result: FetchSnapshotsResult) {
    super(result.firstError?.message ?? 'Failed to load list');
    this.result = result;
  }
}

export const applyTabSnapshotToVisibleState = (
  state: ConsoleTabDataVisibleState,
  pjcode: string,
  tabName: ConsoleTabName,
  snapshot: ConsoleTabSnapshot,
): ConsoleTabDataVisibleState =>
  state.pjcode !== pjcode
    ? state
    : { pjcode, snapshots: { ...state.snapshots, [tabName]: snapshot } };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const parseStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];

const parseItemsArray = (value: unknown): ConsoleListItem[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(isRecord).map(
    (item) =>
      ({
        ...item,
        relatedOpenPullRequestUrls: parseStringArray(
          item.relatedOpenPullRequestUrls,
        ),
      }) as unknown as ConsoleListItem,
  );
};

const parseItems = (payload: unknown): ConsoleListItem[] => {
  if (!isRecord(payload) || !Array.isArray(payload.items)) {
    return [];
  }
  return parseItemsArray(payload.items);
};

const parseOptions = (value: unknown): ConsoleFieldOption[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(isRecord) as unknown as ConsoleFieldOption[];
};

const parseStoryEntries = (value: unknown): ConsoleStoryEntry[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(isRecord).map(
    (entry) =>
      ({
        ...entry,
        items: parseItemsArray(entry.items),
      }) as unknown as ConsoleStoryEntry,
  );
};

const parseSnapshotData = (
  payload: unknown,
): Omit<ConsoleTabSnapshot, 'fromCache'> => ({
  items: parseItems(payload),
  generatedAt:
    isRecord(payload) && typeof payload.generatedAt === 'string'
      ? payload.generatedAt
      : '',
  statusOptions: isRecord(payload) ? parseOptions(payload.statusOptions) : [],
  agentOptions: isRecord(payload) ? parseOptions(payload.agentOptions) : [],
  storyOptions: isRecord(payload) ? parseOptions(payload.storyOptions) : [],
  storyColors:
    isRecord(payload) && isRecord(payload.storyColors)
      ? (payload.storyColors as ConsoleStoryColorSource)
      : {},
  stories: isRecord(payload) ? parseStoryEntries(payload.stories) : [],
  defaultNameWithOwner:
    isRecord(payload) && typeof payload.defaultNameWithOwner === 'string'
      ? payload.defaultNameWithOwner
      : null,
  storyOrder: isRecord(payload) ? parseStringArray(payload.storyOrder) : [],
  timerEndsAt:
    isRecord(payload) && typeof payload.timerEndsAt === 'string'
      ? payload.timerEndsAt
      : null,
  timerTotalSeconds:
    isRecord(payload) &&
    typeof payload.timerTotalSeconds === 'number' &&
    payload.timerTotalSeconds > 0
      ? payload.timerTotalSeconds
      : null,
});

const emptySnapshots = (): Record<
  ConsoleTabName,
  ConsoleTabSnapshot | null
> => {
  const result = {} as Record<ConsoleTabName, ConsoleTabSnapshot | null>;
  for (const tab of CONSOLE_TABS) {
    result[tab.name] = null;
  }
  return result;
};

const buildListUrl = (pjcode: string, tab: ConsoleTabName): string =>
  `/projects/${pjcode}/${tab}/list.json`;

export const CONSOLE_TAB_REFRESH_INTERVAL_MS = 60000;

const CONSOLE_LIST_CACHE_NAME = 'console-list-v1';

const persistListSnapshot = (url: string, payload: unknown): void => {
  try {
    if (!('caches' in globalThis)) {
      return;
    }
    globalThis.caches
      .open(CONSOLE_LIST_CACHE_NAME)
      .then((cache) =>
        cache.put(
          url,
          new Response(JSON.stringify(payload), {
            headers: { 'Content-Type': 'application/json' },
          }),
        ),
      )
      .catch((e: unknown) => {
        console.warn('Failed to persist tab snapshot to cache:', e);
      });
  } catch (e: unknown) {
    console.warn('Failed to access cache storage:', e);
  }
};

const loadListSnapshotFromCache = async (
  url: string,
): Promise<ConsoleTabSnapshot | null> => {
  if (!('caches' in globalThis)) {
    return null;
  }
  try {
    const cache = await globalThis.caches.open(CONSOLE_LIST_CACHE_NAME);
    const cached = await cache.match(url);
    if (cached === undefined) {
      return null;
    }
    const payload: unknown = await cached.json();
    return { ...parseSnapshotData(payload), fromCache: true };
  } catch {
    return null;
  }
};

const loadAllSnapshotsFromCache = async (
  pjcode: string,
): Promise<Record<ConsoleTabName, ConsoleTabSnapshot | null>> => {
  const results = await Promise.all(
    CONSOLE_TABS.map(async (tab) => ({
      tabName: tab.name,
      snapshot: await loadListSnapshotFromCache(buildListUrl(pjcode, tab.name)),
    })),
  );
  const cached = emptySnapshots();
  for (const { tabName, snapshot } of results) {
    cached[tabName] = snapshot;
  }
  return cached;
};

const fetchSingleSnapshot = async (
  pjcode: string,
  tabName: ConsoleTabName,
): Promise<{
  snapshot: ConsoleTabSnapshot | null;
  error: Error | null;
  networkFailed: boolean;
}> => {
  const url = buildListUrl(pjcode, tabName);
  try {
    const response = await fetchResponseOrNetworkError(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload: unknown = await response.json();
    persistListSnapshot(url, payload);
    return {
      snapshot: { ...parseSnapshotData(payload), fromCache: false },
      error: null,
      networkFailed: false,
    };
  } catch (e: unknown) {
    const networkFailed = e instanceof ConsoleNetworkError;
    const cached = await loadListSnapshotFromCache(url);
    if (cached !== null) {
      return { snapshot: cached, error: null, networkFailed };
    }
    return {
      snapshot: null,
      error: e instanceof Error ? e : new Error(String(e)),
      networkFailed,
    };
  }
};

export const refreshProjectTabsToCache = async (
  pjcode: string,
): Promise<void> => {
  await Promise.all(
    CONSOLE_TABS.map(async (tab) => {
      const url = buildListUrl(pjcode, tab.name);
      try {
        const response = await fetch(url);
        if (!response.ok) {
          return;
        }
        const payload: unknown = await response.json();
        persistListSnapshot(url, payload);
      } catch {}
    }),
  );
};

const fetchSnapshots = async (
  pjcode: string,
  previous: Record<ConsoleTabName, ConsoleTabSnapshot | null> | undefined,
): Promise<FetchSnapshotsResult> => {
  const results = await Promise.all(
    CONSOLE_TABS.map(async (tab) => {
      const { snapshot, error, networkFailed } = await fetchSingleSnapshot(
        pjcode,
        tab.name,
      );
      return { tabName: tab.name, snapshot, error, networkFailed };
    }),
  );

  const snapshots = emptySnapshots();
  let firstError: Error | null = null;

  for (const { tabName, snapshot, error } of results) {
    snapshots[tabName] = snapshot;
    if (error !== null && firstError === null) {
      firstError = error;
    }
  }

  const allNull = Object.values(snapshots).every((s) => s === null);
  const networkFailed = results.some((result) => result.networkFailed);
  for (const {
    tabName,
    snapshot,
    networkFailed: tabNetworkFailed,
  } of results) {
    if (snapshot === null && tabNetworkFailed) {
      snapshots[tabName] = previous?.[tabName] ?? null;
    }
  }
  return {
    snapshots,
    firstError: allNull ? firstError : null,
    networkFailed,
  };
};

export const useConsoleTabData = (
  pjcode: string | null,
  airplaneSnapshot: AirplaneSnapshot | null = null,
): ConsoleTabDataState => {
  const snapshotRegistry = useRef<
    Map<string, Record<ConsoleTabName, ConsoleTabSnapshot | null>>
  >(new Map());
  const [visible, setVisible] = useState<ConsoleTabDataVisibleState>(() => ({
    pjcode,
    snapshots: emptySnapshots(),
  }));
  const snapshots = visible.snapshots;
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [trackedPjcode, setTrackedPjcode] = useState<string | null>(pjcode);

  if (trackedPjcode !== pjcode) {
    setTrackedPjcode(pjcode);
    const registryEntry =
      pjcode !== null ? (snapshotRegistry.current.get(pjcode) ?? null) : null;
    setVisible({ pjcode, snapshots: registryEntry ?? emptySnapshots() });
    if (registryEntry !== null) {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (airplaneSnapshot !== null && pjcode !== null) {
      const pjTabs = airplaneSnapshot.tabs[pjcode];
      if (pjTabs !== undefined) {
        const next = emptySnapshots();
        for (const tab of CONSOLE_TABS) {
          const stored = pjTabs[tab.name];
          if (stored !== undefined) {
            next[tab.name] = { ...stored };
          }
        }
        setVisible({ pjcode, snapshots: next });
        setIsLoading(false);
        setError(null);
        return;
      }
    }

    let cancelled = false;
    let freshDataReceived = false;
    setError(null);

    if (pjcode === null) {
      setVisible({ pjcode: null, snapshots: emptySnapshots() });
      setIsLoading(false);
      setError('No project specified in the URL path.');
      return () => {
        cancelled = true;
      };
    }

    const hasRegistryData = snapshotRegistry.current.has(pjcode);

    loadAllSnapshotsFromCache(pjcode).then((cached) => {
      if (cancelled) return;
      const hasAny = Object.values(cached).some((s) => s !== null);
      if (hasAny && !freshDataReceived) {
        snapshotRegistry.current.set(pjcode, cached);
        setVisible({ pjcode, snapshots: cached });
        setIsLoading(false);
      } else if (!hasAny && !freshDataReceived && !hasRegistryData) {
        setIsLoading(true);
        setVisible({ pjcode, snapshots: emptySnapshots() });
      }
    });

    const load = async (): Promise<FetchSnapshotsResult> => {
      const result = await fetchSnapshots(
        pjcode,
        snapshotRegistry.current.get(pjcode),
      );
      if (result.networkFailed) {
        throw new ListNetworkFailure(result);
      }
      return result;
    };

    const retrying = startLoadWithNetworkRetry({
      load,
      onSuccess: ({ snapshots: next, firstError }) => {
        if (cancelled) {
          return;
        }
        freshDataReceived = true;
        snapshotRegistry.current.set(pjcode, next);
        setVisible({ pjcode, snapshots: next });
        setError(firstError !== null ? firstError.message : null);
        setIsLoading(false);
      },
      onFailure: (cause: unknown) => {
        if (cancelled) {
          return;
        }
        freshDataReceived = true;
        if (cause instanceof ListNetworkFailure) {
          const { result } = cause;
          const hasSnapshot = Object.values(result.snapshots).some(
            (snapshot) => snapshot !== null,
          );
          if (hasSnapshot) {
            snapshotRegistry.current.set(pjcode, result.snapshots);
            setVisible({ pjcode, snapshots: result.snapshots });
          }
          setError(result.firstError?.message ?? null);
        } else {
          setError(cause instanceof Error ? cause.message : String(cause));
        }
        setIsLoading(false);
      },
    });
    const timer = setInterval(
      () => retrying.reload(),
      CONSOLE_TAB_REFRESH_INTERVAL_MS,
    );

    return () => {
      cancelled = true;
      clearInterval(timer);
      retrying.stop();
    };
  }, [pjcode, airplaneSnapshot]);

  const refreshSingleTab = useCallback(
    async (tabName: ConsoleTabName): Promise<void> => {
      if (pjcode === null) {
        return;
      }
      const { snapshot } = await fetchSingleSnapshot(pjcode, tabName);
      if (snapshot === null) {
        return;
      }
      const registryEntry = snapshotRegistry.current.get(pjcode);
      if (registryEntry !== undefined) {
        snapshotRegistry.current.set(pjcode, {
          ...registryEntry,
          [tabName]: snapshot,
        });
      }
      setVisible((prev) =>
        applyTabSnapshotToVisibleState(prev, pjcode, tabName, snapshot),
      );
    },
    [pjcode],
  );

  return { snapshots, isLoading, error, refreshSingleTab };
};
