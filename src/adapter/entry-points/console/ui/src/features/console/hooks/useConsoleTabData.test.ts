import { act, renderHook, waitFor } from '@testing-library/react';
import { CONSOLE_TABS } from '../logic/types';
import {
  CONSOLE_TAB_REFRESH_INTERVAL_MS,
  useConsoleTabData,
} from './useConsoleTabData';

const makeTabPayload = (overrides: Record<string, unknown> = {}) => ({
  pjcode: 'acme',
  generatedAt: '2026-06-19T00:00:00.000Z',
  statusOptions: [{ id: 's1', name: 'Unread', color: 'ORANGE' }],
  storyColors: {},
  items: [],
  ...overrides,
});

const installNetworkFetch = (
  perTabItems: (url: string) => unknown[] = () => [],
): jest.Mock => {
  const fetchMock = jest.fn(async (url: string) => ({
    ok: true,
    status: 200,
    json: async () =>
      makeTabPayload({
        items: url.includes('/prs/') ? perTabItems(url) : [],
      }),
  }));
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
};

type MockCacheEntry = { json: jest.Mock };
type MockCache = {
  match: jest.Mock<Promise<MockCacheEntry | undefined>>;
  put: jest.Mock<Promise<void>>;
};

const installMockCaches = (
  matchResult: MockCacheEntry | undefined,
): MockCache => {
  const mockCache: MockCache = {
    match: jest.fn(async () => matchResult),
    put: jest.fn(async () => undefined),
  };
  Object.defineProperty(global, 'caches', {
    value: { open: jest.fn(async () => mockCache) },
    writable: true,
    configurable: true,
  });
  return mockCache;
};

const removeMockCaches = (): void => {
  Reflect.deleteProperty(global as Record<string, unknown>, 'caches');
};

describe('useConsoleTabData', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, '', '/?k=token');
    removeMockCaches();
  });

  afterEach(() => {
    removeMockCaches();
  });

  it('fetches every tab once at startup and parses snapshots', async () => {
    const fetchMock = installNetworkFetch((url) =>
      url.includes('/prs/')
        ? [{ number: 1, itemId: 'PVTI_1', projectItemId: 'PVTI_1' }]
        : [],
    );

    const { result } = renderHook(() => useConsoleTabData('acme'));
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(fetchMock).toHaveBeenCalledTimes(CONSOLE_TABS.length);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/projects/acme/prs/list.json'),
    );
    expect(result.current.snapshots.prs?.items.length).toBe(1);
    expect(result.current.snapshots.prs?.generatedAt).toBe(
      '2026-06-19T00:00:00.000Z',
    );
  });

  it('sets fromCache false when data is loaded from the network', async () => {
    installNetworkFetch();
    const { result } = renderHook(() => useConsoleTabData('acme'));
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.snapshots.prs?.fromCache).toBe(false);
  });

  it('normalizes relatedOpenPullRequestUrls for a snapshot written before the field existed', async () => {
    const fetchMock = jest.fn(async (url: string) => ({
      ok: true,
      status: 200,
      json: async () => ({
        pjcode: 'acme',
        generatedAt: '2026-06-19T00:00:00.000Z',
        statusOptions: [],
        storyColors: {},
        items: url.includes('/prs/')
          ? [
              { number: 1, itemId: 'PVTI_1', projectItemId: 'PVTI_1' },
              {
                number: 2,
                itemId: 'PVTI_2',
                projectItemId: 'PVTI_2',
                relatedOpenPullRequestUrls: [
                  'https://github.com/demo/repo/pull/7',
                  9,
                ],
              },
            ]
          : [],
      }),
    }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const { result } = renderHook(() => useConsoleTabData('acme'));
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(
      result.current.snapshots.prs?.items[0].relatedOpenPullRequestUrls,
    ).toEqual([]);
    expect(
      result.current.snapshots.prs?.items[1].relatedOpenPullRequestUrls,
    ).toEqual(['https://github.com/demo/repo/pull/7']);
  });

  it('drops an item that disappeared from the snapshot after the refresh interval', async () => {
    jest.useFakeTimers();
    let closed = false;
    const fetchMock = jest.fn(async (url: string) => ({
      ok: true,
      status: 200,
      json: async () => ({
        pjcode: 'acme',
        generatedAt: '2026-06-19T00:00:00.000Z',
        statusOptions: [],
        storyColors: {},
        items:
          url.includes('/prs/') && !closed
            ? [{ number: 1, itemId: 'PVTI_1', projectItemId: 'PVTI_1' }]
            : [],
      }),
    }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const { result } = renderHook(() => useConsoleTabData('acme'));
    await waitFor(() => {
      expect(result.current.snapshots.prs?.items.length).toBe(1);
    });

    closed = true;
    await act(async () => {
      jest.advanceTimersByTime(CONSOLE_TAB_REFRESH_INTERVAL_MS);
    });

    await waitFor(() => {
      expect(result.current.snapshots.prs?.items.length).toBe(0);
    });
    expect(fetchMock.mock.calls.length).toBe(CONSOLE_TABS.length * 2);
    jest.useRealTimers();
  });

  it('surfaces an error when a tab fetch fails and no cache is available', async () => {
    const fetchMock = jest.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({}),
    }));
    global.fetch = fetchMock as unknown as typeof fetch;
    const { result } = renderHook(() => useConsoleTabData('acme'));
    await waitFor(() => {
      expect(result.current.error).toBe('HTTP 500');
    });
  });

  it('serves board data from cache and sets fromCache true when every network fetch rejects', async () => {
    const cachedPayload = makeTabPayload({
      generatedAt: '2026-06-10T00:00:00.000Z',
      items: [{ number: 1, itemId: 'PVTI_1', projectItemId: 'PVTI_1' }],
    });
    const cacheEntry = { json: jest.fn(async () => cachedPayload) };
    installMockCaches(cacheEntry);

    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error('Network error')) as unknown as typeof fetch;

    const { result } = renderHook(() => useConsoleTabData('acme'));
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.snapshots.prs?.fromCache).toBe(true);
    expect(result.current.snapshots.prs?.generatedAt).toBe(
      '2026-06-10T00:00:00.000Z',
    );
    expect(result.current.snapshots.prs?.items.length).toBe(1);
  });

  it('surfaces an error when network rejects and no cache entry exists', async () => {
    installMockCaches(undefined);
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error('offline')) as unknown as typeof fetch;

    const { result } = renderHook(() => useConsoleTabData('acme'));
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe('offline');
    expect(
      Object.values(result.current.snapshots).every((s) => s === null),
    ).toBe(true);
  });

  it('reports an error and fetches nothing when no pjcode is in the URL', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    const { result } = renderHook(() => useConsoleTabData(null));
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.error).toBe('No project specified in the URL path.');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
