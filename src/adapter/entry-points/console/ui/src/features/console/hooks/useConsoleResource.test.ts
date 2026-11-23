import { act, renderHook, waitFor } from '@testing-library/react';
import { ConsoleNetworkError } from '../lib/consoleApi';
import { ResourceCache } from '../lib/resourceCache';
import { useConsoleResource } from './useConsoleResource';

describe('useConsoleResource', () => {
  it('loads the resource and exposes loading then data', async () => {
    const cache = new ResourceCache<string>(async () => 'loaded');
    const { result } = renderHook(() =>
      useConsoleResource(cache, 'k', 'u', 'fallback'),
    );
    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBe('fallback');
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.data).toBe('loaded');
    expect(result.current.error).toBeNull();
  });

  it('stays idle with the fallback when the key is null', () => {
    const cache = new ResourceCache<string>(async () => 'loaded');
    const { result } = renderHook(() =>
      useConsoleResource(cache, null, null, 'fallback'),
    );
    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBe('fallback');
  });

  it('surfaces a fetch error', async () => {
    const cache = new ResourceCache<string>(async () => {
      throw new Error('boom');
    });
    const { result } = renderHook(() =>
      useConsoleResource(cache, 'k', 'u', 'fallback'),
    );
    await waitFor(() => {
      expect(result.current.error).toBe('boom');
    });
    expect(result.current.isLoading).toBe(false);
  });
});

type UrlFetcher = jest.Mock<Promise<string>, [string]>;

const flushAsync = async (milliseconds: number): Promise<void> => {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(milliseconds);
  });
};

const dispatchEventInAct = async (
  target: Window | Document,
  event: Event,
): Promise<void> => {
  await act(async () => {
    target.dispatchEvent(event);
    await jest.advanceTimersByTimeAsync(0);
  });
};

const setDocumentVisibility = (state: DocumentVisibilityState): void => {
  Object.defineProperty(document, 'visibilityState', {
    value: state,
    configurable: true,
  });
};

const requestedUrls = (fetcher: UrlFetcher): string[] =>
  fetcher.mock.calls.map(([url]) => url);

const networkFailure = (): ConsoleNetworkError =>
  new ConsoleNetworkError('Failed to fetch');

const BACKOFF_CHECKPOINTS: { elapsedMs: number; expectedCalls: number }[] = [
  { elapsedMs: 0, expectedCalls: 1 },
  { elapsedMs: 999, expectedCalls: 1 },
  { elapsedMs: 1000, expectedCalls: 2 },
  { elapsedMs: 2999, expectedCalls: 2 },
  { elapsedMs: 3000, expectedCalls: 3 },
  { elapsedMs: 6999, expectedCalls: 3 },
  { elapsedMs: 7000, expectedCalls: 4 },
  { elapsedMs: 14999, expectedCalls: 4 },
  { elapsedMs: 15000, expectedCalls: 5 },
  { elapsedMs: 30999, expectedCalls: 5 },
  { elapsedMs: 31000, expectedCalls: 6 },
  { elapsedMs: 60999, expectedCalls: 6 },
  { elapsedMs: 61000, expectedCalls: 7 },
  { elapsedMs: 90999, expectedCalls: 7 },
  { elapsedMs: 91000, expectedCalls: 8 },
];

describe('useConsoleResource network retry', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    Reflect.deleteProperty(document, 'visibilityState');
  });

  it('succeeds on first attempt with one fetch and no retry timers', async () => {
    const fetcher: UrlFetcher = jest.fn().mockResolvedValue('loaded');
    const cache = new ResourceCache<string>(fetcher);
    const { result } = renderHook(() =>
      useConsoleResource(cache, 'k', 'u', 'fallback'),
    );
    await flushAsync(0);
    expect(result.current.data).toBe('loaded');
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    await flushAsync(10 * 60 * 1000);
    expect(requestedUrls(fetcher)).toEqual(['u']);
  });

  it('keeps an HTTP failure visible and never retries it', async () => {
    const fetcher: UrlFetcher = jest
      .fn()
      .mockRejectedValue(new Error('HTTP 502'));
    const cache = new ResourceCache<string>(fetcher);
    const { result } = renderHook(() =>
      useConsoleResource(cache, 'k', 'u', 'fallback'),
    );
    await flushAsync(0);
    expect(result.current.error).toBe('HTTP 502');
    expect(result.current.isLoading).toBe(false);
    await flushAsync(10 * 60 * 1000);
    expect(requestedUrls(fetcher)).toEqual(['u']);
    expect(result.current.error).toBe('HTTP 502');
  });

  it('retries a network failure on the backoff schedule capped at 30000 ms', async () => {
    const fetcher: UrlFetcher = jest.fn().mockRejectedValue(networkFailure());
    const cache = new ResourceCache<string>(fetcher);
    renderHook(() => useConsoleResource(cache, 'k', 'u', 'fallback'));
    let elapsedMs = 0;
    for (const checkpoint of BACKOFF_CHECKPOINTS) {
      await flushAsync(checkpoint.elapsedMs - elapsedMs);
      elapsedMs = checkpoint.elapsedMs;
      expect({
        elapsedMs,
        calls: fetcher.mock.calls.length,
      }).toEqual({
        elapsedMs: checkpoint.elapsedMs,
        calls: checkpoint.expectedCalls,
      });
    }
  });

  it('keeps the network error visible while retrying and clears it on a successful retry', async () => {
    const fetcher: UrlFetcher = jest
      .fn()
      .mockRejectedValueOnce(networkFailure())
      .mockResolvedValueOnce('loaded');
    const cache = new ResourceCache<string>(fetcher);
    const { result } = renderHook(() =>
      useConsoleResource(cache, 'k', 'u', 'fallback'),
    );
    await flushAsync(0);
    expect(result.current.error).toBe('Failed to fetch');
    await flushAsync(1000);
    expect(requestedUrls(fetcher)).toEqual(['u', 'u']);
    expect(result.current.error).toBeNull();
    expect(result.current.data).toBe('loaded');
    expect(result.current.isLoading).toBe(false);
  });

  it('re-fetches immediately when the window comes online during a network failure', async () => {
    const fetcher: UrlFetcher = jest
      .fn()
      .mockRejectedValueOnce(networkFailure())
      .mockResolvedValue('loaded');
    const cache = new ResourceCache<string>(fetcher);
    const { result } = renderHook(() =>
      useConsoleResource(cache, 'k', 'u', 'fallback'),
    );
    await flushAsync(0);
    expect(result.current.error).toBe('Failed to fetch');
    await dispatchEventInAct(window, new Event('online'));
    expect(requestedUrls(fetcher)).toEqual(['u', 'u']);
    expect(result.current.error).toBeNull();
    expect(result.current.data).toBe('loaded');
  });

  it('re-fetches immediately when the document becomes visible during a network failure', async () => {
    const fetcher: UrlFetcher = jest
      .fn()
      .mockRejectedValueOnce(networkFailure())
      .mockResolvedValue('loaded');
    const cache = new ResourceCache<string>(fetcher);
    const { result } = renderHook(() =>
      useConsoleResource(cache, 'k', 'u', 'fallback'),
    );
    await flushAsync(0);
    expect(result.current.error).toBe('Failed to fetch');
    setDocumentVisibility('visible');
    await dispatchEventInAct(document, new Event('visibilitychange'));
    expect(requestedUrls(fetcher)).toEqual(['u', 'u']);
    expect(result.current.error).toBeNull();
    expect(result.current.data).toBe('loaded');
  });

  it('does not re-fetch on visibility change while the document is hidden', async () => {
    const fetcher: UrlFetcher = jest
      .fn()
      .mockRejectedValueOnce(networkFailure())
      .mockResolvedValue('loaded');
    const cache = new ResourceCache<string>(fetcher);
    const { result } = renderHook(() =>
      useConsoleResource(cache, 'k', 'u', 'fallback'),
    );
    await flushAsync(0);
    expect(result.current.error).toBe('Failed to fetch');
    setDocumentVisibility('hidden');
    await dispatchEventInAct(document, new Event('visibilitychange'));
    expect(requestedUrls(fetcher)).toEqual(['u']);
    expect(result.current.error).toBe('Failed to fetch');
  });

  it('does not re-fetch on online or visible events when the resource has loaded', async () => {
    const fetcher: UrlFetcher = jest.fn().mockResolvedValue('loaded');
    const cache = new ResourceCache<string>(fetcher);
    const { result } = renderHook(() =>
      useConsoleResource(cache, 'k', 'u', 'fallback'),
    );
    await flushAsync(0);
    expect(result.current.data).toBe('loaded');
    setDocumentVisibility('visible');
    await dispatchEventInAct(window, new Event('online'));
    await dispatchEventInAct(document, new Event('visibilitychange'));
    expect(requestedUrls(fetcher)).toEqual(['u']);
  });

  it('discards the previous key pending retry when the key switches', async () => {
    const fetcher: UrlFetcher = jest
      .fn()
      .mockRejectedValueOnce(networkFailure())
      .mockRejectedValueOnce(networkFailure())
      .mockResolvedValue('second');
    const cache = new ResourceCache<string>(fetcher);
    const { result, rerender } = renderHook(
      ({ resourceKey, url }: { resourceKey: string; url: string }) =>
        useConsoleResource(cache, resourceKey, url, 'fallback'),
      { initialProps: { resourceKey: 'k', url: 'u' } },
    );
    await flushAsync(0);
    await flushAsync(1000);
    expect(requestedUrls(fetcher)).toEqual(['u', 'u']);
    rerender({ resourceKey: 'k2', url: 'u2' });
    await flushAsync(0);
    expect(result.current.data).toBe('second');
    expect(result.current.error).toBeNull();
    await flushAsync(60000);
    expect(requestedUrls(fetcher)).toEqual(['u', 'u', 'u2']);
  });

  it('stops timers and ignores online and visibility events after unmount', async () => {
    const fetcher: UrlFetcher = jest
      .fn()
      .mockRejectedValueOnce(networkFailure())
      .mockRejectedValueOnce(networkFailure())
      .mockResolvedValue('late');
    const cache = new ResourceCache<string>(fetcher);
    const { unmount } = renderHook(() =>
      useConsoleResource(cache, 'k', 'u', 'fallback'),
    );
    await flushAsync(0);
    await flushAsync(1000);
    expect(requestedUrls(fetcher)).toEqual(['u', 'u']);
    unmount();
    setDocumentVisibility('visible');
    await dispatchEventInAct(window, new Event('online'));
    await dispatchEventInAct(document, new Event('visibilitychange'));
    await flushAsync(60000);
    expect(requestedUrls(fetcher)).toEqual(['u', 'u']);
  });
});
