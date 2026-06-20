import { useEffect, useState } from 'react';
import type { ResourceCache } from '../lib/resourceCache';

export type ConsoleResourceState<T> = {
  data: T;
  isLoading: boolean;
  error: string | null;
};

export const useConsoleResource = <T>(
  cache: ResourceCache<T>,
  key: string | null,
  url: string | null,
  fallback: T,
): ConsoleResourceState<T> => {
  const cached = key !== null ? cache.peek(key) : undefined;
  const [data, setData] = useState<T>(cached ?? fallback);
  const [isLoading, setIsLoading] = useState<boolean>(
    key !== null && cached === undefined,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (key === null || url === null) {
      return;
    }
    const existing = cache.peek(key);
    if (existing !== undefined) {
      setData(existing);
      setIsLoading(false);
      setError(null);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    cache
      .load(key, url)
      .then((value) => {
        if (!cancelled) {
          setData(value);
          setIsLoading(false);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : String(cause));
          setIsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [cache, key, url]);

  return { data, isLoading, error };
};
