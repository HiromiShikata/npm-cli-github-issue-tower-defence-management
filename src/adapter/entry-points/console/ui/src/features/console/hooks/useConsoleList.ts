import { useEffect, useState } from 'react';
import type { ConsoleListItem, ConsoleTabName } from '../types';
import { useConsoleToken } from './useConsoleToken';

const buildListUrl = (pjcode: string, tab: ConsoleTabName): string =>
  `/projects/${pjcode}/${tab}/list.json`;

const extractItems = (payload: unknown): ConsoleListItem[] => {
  if (
    payload !== null &&
    typeof payload === 'object' &&
    'items' in payload &&
    Array.isArray((payload as { items: unknown }).items)
  ) {
    return (payload as { items: ConsoleListItem[] }).items;
  }
  return [];
};

export type ConsoleListState = {
  items: ConsoleListItem[];
  isLoading: boolean;
  error: string | null;
};

export const useConsoleList = (
  pjcode: string | null,
  tab: ConsoleTabName,
): ConsoleListState => {
  const { appendToken } = useConsoleToken();
  const [items, setItems] = useState<ConsoleListItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    if (pjcode === null) {
      setItems([]);
      setIsLoading(false);
      setError('No project specified in the URL path.');
      return () => {
        cancelled = true;
      };
    }

    const url = appendToken(buildListUrl(pjcode, tab));
    fetch(url)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.json();
      })
      .then((payload: unknown) => {
        if (cancelled) {
          return;
        }
        setItems(extractItems(payload));
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
  }, [pjcode, tab, appendToken]);

  return { items, isLoading, error };
};
