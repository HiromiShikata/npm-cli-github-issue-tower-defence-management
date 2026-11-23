import { useEffect, useState } from 'react';
import type { ResourceCache } from '../lib/resourceCache';
import { startLoadWithNetworkRetry } from './networkRetryingLoad';

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
    setIsLoading(true);
    setError(null);
    return startLoadWithNetworkRetry<T>({
      load: () => cache.load(key, url),
      onSuccess: (value) => {
        setData(value);
        setError(null);
        setIsLoading(false);
      },
      onFailure: (cause) => {
        setError(cause instanceof Error ? cause.message : String(cause));
        setIsLoading(false);
      },
    });
  }, [cache, key, url]);

  return { data, isLoading, error };
};
