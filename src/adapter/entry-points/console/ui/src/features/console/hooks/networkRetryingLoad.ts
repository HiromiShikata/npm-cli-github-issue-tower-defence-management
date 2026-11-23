import { ConsoleNetworkError } from '../lib/consoleApi';

const NETWORK_RETRY_INITIAL_DELAY_MS = 1000;
const NETWORK_RETRY_MAX_DELAY_MS = 30000;

export type NetworkRetryingLoadOptions<T> = {
  load: () => Promise<T>;
  onSuccess: (value: T) => void;
  onFailure: (cause: unknown) => void;
};

export const startLoadWithNetworkRetry = <T>(
  options: NetworkRetryingLoadOptions<T>,
): (() => void) => {
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
    options.load().then(
      (value) => {
        if (cancelled || attempt !== latestAttempt) {
          return;
        }
        networkFailed = false;
        options.onSuccess(value);
      },
      (cause: unknown) => {
        if (cancelled || attempt !== latestAttempt) {
          return;
        }
        networkFailed = cause instanceof ConsoleNetworkError;
        options.onFailure(cause);
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

  load();
  window.addEventListener('online', reloadWhileNetworkFailed);
  document.addEventListener('visibilitychange', handleVisibilityChange);
  return () => {
    cancelled = true;
    clearRetryTimer();
    window.removeEventListener('online', reloadWhileNetworkFailed);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
};
