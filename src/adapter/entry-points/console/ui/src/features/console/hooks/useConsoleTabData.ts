import { useEffect, useState } from 'react';
import type {
  ConsoleFieldOption,
  ConsoleListItem,
  ConsoleStoryColorSource,
  ConsoleStoryEntry,
  ConsoleTabName,
} from '../logic/types';
import { CONSOLE_TABS } from '../logic/types';

export type ConsoleTabSnapshot = {
  items: ConsoleListItem[];
  generatedAt: string;
  statusOptions: ConsoleFieldOption[];
  storyOptions: ConsoleFieldOption[];
  storyColors: ConsoleStoryColorSource;
  stories: ConsoleStoryEntry[];
  defaultNameWithOwner: string | null;
  fromCache: boolean;
  storyOrder: string[];
};

export type ConsoleTabDataState = {
  snapshots: Record<ConsoleTabName, ConsoleTabSnapshot | null>;
  isLoading: boolean;
  error: string | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const parseStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];

const parseItems = (payload: unknown): ConsoleListItem[] => {
  if (!isRecord(payload) || !Array.isArray(payload.items)) {
    return [];
  }
  return payload.items.filter(isRecord).map(
    (item) =>
      ({
        ...item,
        relatedOpenPullRequestUrls: parseStringArray(
          item.relatedOpenPullRequestUrls,
        ),
      }) as unknown as ConsoleListItem,
  );
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
  return value.filter(isRecord) as unknown as ConsoleStoryEntry[];
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

const fetchSingleSnapshot = async (
  pjcode: string,
  tabName: ConsoleTabName,
): Promise<{ snapshot: ConsoleTabSnapshot | null; error: Error | null }> => {
  const url = buildListUrl(pjcode, tabName);
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload: unknown = await response.json();
    persistListSnapshot(url, payload);
    return {
      snapshot: { ...parseSnapshotData(payload), fromCache: false },
      error: null,
    };
  } catch (e: unknown) {
    const cached = await loadListSnapshotFromCache(url);
    if (cached !== null) {
      return { snapshot: cached, error: null };
    }
    return {
      snapshot: null,
      error: e instanceof Error ? e : new Error(String(e)),
    };
  }
};

const fetchSnapshots = async (
  pjcode: string,
): Promise<{
  snapshots: Record<ConsoleTabName, ConsoleTabSnapshot | null>;
  firstError: Error | null;
}> => {
  const results = await Promise.all(
    CONSOLE_TABS.map(async (tab) => {
      const { snapshot, error } = await fetchSingleSnapshot(pjcode, tab.name);
      return { tabName: tab.name, snapshot, error };
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
  return {
    snapshots,
    firstError: allNull ? firstError : null,
  };
};

export const useConsoleTabData = (
  pjcode: string | null,
): ConsoleTabDataState => {
  const [snapshots, setSnapshots] =
    useState<Record<ConsoleTabName, ConsoleTabSnapshot | null>>(emptySnapshots);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    if (pjcode === null) {
      setSnapshots(emptySnapshots());
      setIsLoading(false);
      setError('No project specified in the URL path.');
      return () => {
        cancelled = true;
      };
    }

    const load = (): void => {
      fetchSnapshots(pjcode)
        .then(({ snapshots: next, firstError }) => {
          if (cancelled) {
            return;
          }
          setSnapshots(next);
          setError(firstError !== null ? firstError.message : null);
          setIsLoading(false);
        })
        .catch((cause: unknown) => {
          if (cancelled) {
            return;
          }
          setError(cause instanceof Error ? cause.message : String(cause));
          setIsLoading(false);
        });
    };

    load();
    const timer = setInterval(load, CONSOLE_TAB_REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [pjcode]);

  return { snapshots, isLoading, error };
};
