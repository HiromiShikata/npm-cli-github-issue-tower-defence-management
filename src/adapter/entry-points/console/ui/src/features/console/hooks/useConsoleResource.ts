import { useEffect, useState } from 'react';
import { ConsoleNetworkError } from '../lib/consoleApi';
import type { ResourceCache } from '../lib/resourceCache';

export type ConsoleResourceState<T> = {
  data: T;
  isLoading: boolean;
  error: string | null;
};

const NETWORK_RETRY_INITIAL_DELAY_MS = 1000;
const NETWORK_RETRY_MAX_DELAY_MS = 30000;

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
    let latestAttempt = 0;
    let networkFailed = false;
    let retryDelayMs = NETWORK_RETRY_INITIAL_DELAY_MS;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const clearRetryTimer = (): void => {
      if (retryTimer !== undefined) {
        clearTimeout(retryTimer);
        retryTimer = undefined;
      }
    };

    const scheduleRetry = (): void => {
      clearRetryTimer();
      retryTimer = setTimeout(() => {
        retryTimer = undefined;
        load();
      }, retryDelayMs);
      retryDelayMs = Math.min(retryDelayMs * 2, NETWORK_RETRY_MAX_DELAY_MS);
    };

    const load = (): void => {
      clearRetryTimer();
      latestAttempt += 1;
      const attempt = latestAttempt;
      cache.load(key, url).then(
        (value) => {
          if (cancelled || attempt !== latestAttempt) {
            return;
          }
          networkFailed = false;
          setData(value);
          setError(null);
          setIsLoading(false);
        },
        (cause: unknown) => {
          if (cancelled || attempt !== latestAttempt) {
            return;
          }
          setError(cause instanceof Error ? cause.message : String(cause));
          setIsLoading(false);
          networkFailed = cause instanceof ConsoleNetworkError;
          if (networkFailed) {
            scheduleRetry();
          }
        },
      );
    };

    const reloadWhileNetworkFailed = (): void => {
      if (networkFailed) {
        load();
      }
    };

    const handleVisibilityChange = (): void => {
      if (document.visibilityState === 'visible') {
        reloadWhileNetworkFailed();
      }
    };

    setIsLoading(true);
    setError(null);
    load();
    window.addEventListener('online', reloadWhileNetworkFailed);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      cancelled = true;
      clearRetryTimer();
      window.removeEventListener('online', reloadWhileNetworkFailed);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [cache, key, url]);

  return { data, isLoading, error };
};
