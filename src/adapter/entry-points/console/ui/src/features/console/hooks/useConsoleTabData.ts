import { useEffect, useState } from 'react';
import type {
  ConsoleFieldOption,
  ConsoleListItem,
  ConsoleStoryColorSource,
  ConsoleTabName,
} from '../types';
import { CONSOLE_TABS } from '../types';
import { useConsoleToken } from './useConsoleToken';

export type ConsoleTabSnapshot = {
  items: ConsoleListItem[];
  generatedAt: string;
  statusOptions: ConsoleFieldOption[];
  storyOptions: ConsoleFieldOption[];
  storyColors: ConsoleStoryColorSource;
};

export type ConsoleTabDataState = {
  snapshots: Record<ConsoleTabName, ConsoleTabSnapshot | null>;
  isLoading: boolean;
  error: string | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const parseItems = (payload: unknown): ConsoleListItem[] => {
  if (!isRecord(payload) || !Array.isArray(payload.items)) {
    return [];
  }
  return payload.items.filter(isRecord) as unknown as ConsoleListItem[];
};

const parseOptions = (value: unknown): ConsoleFieldOption[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(isRecord) as unknown as ConsoleFieldOption[];
};

const parseSnapshot = (payload: unknown): ConsoleTabSnapshot => ({
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

export const useConsoleTabData = (
  pjcode: string | null,
): ConsoleTabDataState => {
  const { appendToken } = useConsoleToken();
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

    Promise.all(
      CONSOLE_TABS.map(async (tab) => {
        const url = appendToken(buildListUrl(pjcode, tab.name));
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const payload: unknown = await response.json();
        return [tab.name, parseSnapshot(payload)] as const;
      }),
    )
      .then((entries) => {
        if (cancelled) {
          return;
        }
        const next = emptySnapshots();
        for (const [name, snapshot] of entries) {
          next[name] = snapshot;
        }
        setSnapshots(next);
        setIsLoading(false);
      })
      .catch((cause: unknown) => {
        if (cancelled) {
          return;
        }
        setError(cause instanceof Error ? cause.message : String(cause));
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [pjcode, appendToken]);

  return { snapshots, isLoading, error };
};
