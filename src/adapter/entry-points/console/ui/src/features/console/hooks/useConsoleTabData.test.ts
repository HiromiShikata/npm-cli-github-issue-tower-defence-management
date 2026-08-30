import { act, renderHook, waitFor } from '@testing-library/react';
import type { AirplaneSnapshot } from '../lib/airplaneSnapshot';
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

  it('parses storyOrder from the snapshot payload', async () => {
    const fetchMock = jest.fn(async (url: string) => ({
      ok: true,
      status: 200,
      json: async () => ({
        pjcode: 'acme',
        generatedAt: '2026-06-19T00:00:00.000Z',
        statusOptions: [],
        storyColors: {},
        storyOrder: url.includes('/prs/') ? ['Alpha', 'Beta'] : [],
        items: [],
      }),
    }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const { result } = renderHook(() => useConsoleTabData('acme'));
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.snapshots.prs?.storyOrder).toEqual(['Alpha', 'Beta']);
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

  it('renders board items from airplane snapshot without fetching when network rejects', async () => {
    const fetchMock = jest.fn().mockRejectedValue(new Error('network down'));
    global.fetch = fetchMock as unknown as typeof fetch;

    const airplaneSnapshot: AirplaneSnapshot = {
      capturedAt: '2026-08-01T10:00:00Z',
      failures: [],
      items: {},
      tabs: {
        acme: {
          prs: {
            generatedAt: '2026-08-01T10:00:00Z',
            statusOptions: [],
            agentOptions: [],
            storyOptions: [],
            storyColors: {},
            stories: [],
            defaultNameWithOwner: null,
            fromCache: false,
            storyOrder: [],
            items: [
              {
                number: 1,
                title: 'Offline PR',
                url: 'https://github.com/o/r/pull/1',
                repo: 'o/r',
                nameWithOwner: 'o/r',
                projectItemId: 'PVTI_1',
                itemId: 'PVTI_1',
                isPr: true,
                story: 'regular',
                status: 'Awaiting Quality Check',
                nextActionDate: null,
                nextActionHour: null,
                dependedIssueUrls: [],
                labels: [],
                createdAt: '2026-08-01T00:00:00Z',
                relatedOpenPullRequestUrls: [],
                agent: null,
              },
            ],
          },
          'workflow-blocker': {
            generatedAt: '2026-08-01T10:00:00Z',
            statusOptions: [],
            agentOptions: [],
            storyOptions: [],
            storyColors: {},
            items: [],
            stories: [],
            defaultNameWithOwner: null,
            fromCache: false,
            storyOrder: [],
          },
          'failed-preparation': {
            generatedAt: '2026-08-01T10:00:00Z',
            statusOptions: [],
            agentOptions: [],
            storyOptions: [],
            storyColors: {},
            items: [],
            stories: [],
            defaultNameWithOwner: null,
            fromCache: false,
            storyOrder: [],
          },
          'todo-by-human': {
            generatedAt: '2026-08-01T10:00:00Z',
            statusOptions: [],
            agentOptions: [],
            storyOptions: [],
            storyColors: {},
            items: [],
            stories: [],
            defaultNameWithOwner: null,
            fromCache: false,
            storyOrder: [],
          },
          'todo-by-agent': {
            generatedAt: '2026-08-01T10:00:00Z',
            statusOptions: [],
            agentOptions: [],
            storyOptions: [],
            storyColors: {},
            items: [],
            stories: [],
            defaultNameWithOwner: null,
            fromCache: false,
            storyOrder: [],
          },
          queued: {
            generatedAt: '2026-08-01T10:00:00Z',
            statusOptions: [],
            agentOptions: [],
            storyOptions: [],
            storyColors: {},
            items: [],
            stories: [],
            defaultNameWithOwner: null,
            fromCache: false,
            storyOrder: [],
          },
          stories: {
            generatedAt: '2026-08-01T10:00:00Z',
            statusOptions: [],
            agentOptions: [],
            storyOptions: [],
            storyColors: {},
            items: [],
            stories: [],
            defaultNameWithOwner: null,
            fromCache: false,
            storyOrder: [],
          },
        },
      },
    };

    const { result } = renderHook(() =>
      useConsoleTabData('acme', airplaneSnapshot),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.error).toBeNull();
    expect(result.current.snapshots.prs?.items).toHaveLength(1);
    expect(result.current.snapshots.prs?.items[0].title).toBe('Offline PR');
    expect(result.current.snapshots.prs?.generatedAt).toBe(
      '2026-08-01T10:00:00Z',
    );
  });

  it('stops the 60-second periodic refresh while an airplane snapshot is in use', async () => {
    jest.useFakeTimers();
    const fetchMock = jest.fn().mockRejectedValue(new Error('network down'));
    global.fetch = fetchMock as unknown as typeof fetch;

    const airplaneSnapshot: AirplaneSnapshot = {
      capturedAt: '2026-08-01T10:00:00Z',
      failures: [],
      items: {},
      tabs: {
        acme: {
          prs: {
            generatedAt: '2026-08-01T10:00:00Z',
            statusOptions: [],
            agentOptions: [],
            storyOptions: [],
            storyColors: {},
            items: [],
            stories: [],
            defaultNameWithOwner: null,
            fromCache: false,
            storyOrder: [],
          },
          'workflow-blocker': {
            generatedAt: '2026-08-01T10:00:00Z',
            statusOptions: [],
            agentOptions: [],
            storyOptions: [],
            storyColors: {},
            items: [],
            stories: [],
            defaultNameWithOwner: null,
            fromCache: false,
            storyOrder: [],
          },
          'failed-preparation': {
            generatedAt: '2026-08-01T10:00:00Z',
            statusOptions: [],
            agentOptions: [],
            storyOptions: [],
            storyColors: {},
            items: [],
            stories: [],
            defaultNameWithOwner: null,
            fromCache: false,
            storyOrder: [],
          },
          'todo-by-human': {
            generatedAt: '2026-08-01T10:00:00Z',
            statusOptions: [],
            agentOptions: [],
            storyOptions: [],
            storyColors: {},
            items: [],
            stories: [],
            defaultNameWithOwner: null,
            fromCache: false,
            storyOrder: [],
          },
          'todo-by-agent': {
            generatedAt: '2026-08-01T10:00:00Z',
            statusOptions: [],
            agentOptions: [],
            storyOptions: [],
            storyColors: {},
            items: [],
            stories: [],
            defaultNameWithOwner: null,
            fromCache: false,
            storyOrder: [],
          },
          queued: {
            generatedAt: '2026-08-01T10:00:00Z',
            statusOptions: [],
            agentOptions: [],
            storyOptions: [],
            storyColors: {},
            items: [],
            stories: [],
            defaultNameWithOwner: null,
            fromCache: false,
            storyOrder: [],
          },
          stories: {
            generatedAt: '2026-08-01T10:00:00Z',
            statusOptions: [],
            agentOptions: [],
            storyOptions: [],
            storyColors: {},
            items: [],
            stories: [],
            defaultNameWithOwner: null,
            fromCache: false,
            storyOrder: [],
          },
        },
      },
    };

    const { result } = renderHook(() =>
      useConsoleTabData('acme', airplaneSnapshot),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      jest.advanceTimersByTime(CONSOLE_TAB_REFRESH_INTERVAL_MS * 3);
    });

    expect(fetchMock).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('parses agentOptions from the snapshot payload', async () => {
    const agentOptions = [
      { id: 'ag1', name: 'developer', color: 'GRAY' },
      { id: 'ag2', name: 'chore', color: 'GRAY' },
    ];
    const fetchMock = jest.fn(async (url: string) => ({
      ok: true,
      status: 200,
      json: async () => ({
        pjcode: 'acme',
        generatedAt: '2026-06-19T00:00:00.000Z',
        statusOptions: [],
        storyColors: {},
        items: [],
        agentOptions: url.includes('/queued/') ? agentOptions : [],
      }),
    }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const { result } = renderHook(() => useConsoleTabData('acme'));
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.snapshots.queued?.agentOptions).toEqual(agentOptions);
  });

  it('defaults agentOptions to empty array when missing from payload', async () => {
    installNetworkFetch();
    const { result } = renderHook(() => useConsoleTabData('acme'));
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.snapshots.prs?.agentOptions).toEqual([]);
  });
});
