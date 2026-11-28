import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
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

  it('parses timerEndsAt and timerTotalSeconds from the snapshot payload when present', async () => {
    const fetchMock = jest.fn(async (url: string) => ({
      ok: true,
      status: 200,
      json: async () => ({
        pjcode: 'acme',
        generatedAt: '2026-06-19T00:00:00.000Z',
        statusOptions: [],
        storyColors: {},
        items: [],
        timerEndsAt: url.includes('/prs/')
          ? '2026-08-30T10:30:00.000Z'
          : undefined,
        timerTotalSeconds: url.includes('/prs/') ? 1800 : undefined,
      }),
    }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const { result } = renderHook(() => useConsoleTabData('acme'));
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.snapshots.prs?.timerEndsAt).toBe(
      '2026-08-30T10:30:00.000Z',
    );
    expect(result.current.snapshots.prs?.timerTotalSeconds).toBe(1800);
  });

  it('defaults timerEndsAt and timerTotalSeconds to null when absent from payload', async () => {
    installNetworkFetch();
    const { result } = renderHook(() => useConsoleTabData('acme'));
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.snapshots.prs?.timerEndsAt).toBeNull();
    expect(result.current.snapshots.prs?.timerTotalSeconds).toBeNull();
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
            timerEndsAt: null,
            timerTotalSeconds: null,
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
                status: 'Awaiting Owner',
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
            timerEndsAt: null,
            timerTotalSeconds: null,
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
            timerEndsAt: null,
            timerTotalSeconds: null,
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
            timerEndsAt: null,
            timerTotalSeconds: null,
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
            timerEndsAt: null,
            timerTotalSeconds: null,
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
            timerEndsAt: null,
            timerTotalSeconds: null,
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
            timerEndsAt: null,
            timerTotalSeconds: null,
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
            timerEndsAt: null,
            timerTotalSeconds: null,
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
            timerEndsAt: null,
            timerTotalSeconds: null,
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
            timerEndsAt: null,
            timerTotalSeconds: null,
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
            timerEndsAt: null,
            timerTotalSeconds: null,
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
            timerEndsAt: null,
            timerTotalSeconds: null,
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

  it('refreshSingleTab fetches only the queued tab and updates its snapshot without altering other tabs', async () => {
    const fetchMock = installNetworkFetch();
    const { result } = renderHook(() => useConsoleTabData('acme'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const snapshotBefore = result.current.snapshots.prs;
    fetchMock.mockClear();
    fetchMock.mockImplementation(async (url: string) => ({
      ok: true,
      status: 200,
      json: async () =>
        makeTabPayload({
          generatedAt: '2026-07-01T00:00:00.000Z',
          items: url.includes('/queued/')
            ? [
                {
                  number: 999,
                  itemId: 'NEW_ITEM',
                  projectItemId: 'NEW_ITEM',
                  relatedOpenPullRequestUrls: [],
                },
              ]
            : [],
        }),
    }));
    await act(async () => {
      await result.current.refreshSingleTab('queued');
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/acme/queued/list.json'),
    );
    expect(result.current.snapshots.queued?.items).toHaveLength(1);
    expect(result.current.snapshots.queued?.generatedAt).toBe(
      '2026-07-01T00:00:00.000Z',
    );
    expect(result.current.snapshots.prs).toBe(snapshotBefore);
  });

  it('keeps a single-tab refresh started for project A out of project B and merges it into A entry', async () => {
    const ACME_GENERATED_AT = '2026-06-19T00:00:00.000Z';
    const BETA_GENERATED_AT = '2026-06-25T00:00:00.000Z';
    const REFRESHED_GENERATED_AT = '2026-07-01T00:00:00.000Z';
    let holdAcmeQueued = false;
    let releaseAcmeQueued: (payload: unknown) => void = () => undefined;
    const acmeQueuedRefresh = new Promise<unknown>((resolve) => {
      releaseAcmeQueued = resolve;
    });
    global.fetch = jest.fn(async (url: string) => {
      if (holdAcmeQueued && url.endsWith('/acme/queued/list.json')) {
        return { ok: true, status: 200, json: () => acmeQueuedRefresh };
      }
      const generatedAt = url.includes('/beta/')
        ? BETA_GENERATED_AT
        : ACME_GENERATED_AT;
      return {
        ok: true,
        status: 200,
        json: async () => makeTabPayload({ generatedAt }),
      };
    }) as unknown as typeof fetch;

    const { result, rerender } = renderHook(
      ({ pjcode }: { pjcode: string }) => useConsoleTabData(pjcode),
      { initialProps: { pjcode: 'acme' } },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const acmeSnapshots = result.current.snapshots;

    holdAcmeQueued = true;
    let refreshDone: Promise<void> = Promise.resolve();
    act(() => {
      refreshDone = result.current.refreshSingleTab('queued');
    });

    rerender({ pjcode: 'beta' });
    await waitFor(() =>
      expect(result.current.snapshots.prs?.generatedAt).toBe(BETA_GENERATED_AT),
    );
    const betaSnapshots = result.current.snapshots;

    await act(async () => {
      releaseAcmeQueued(
        makeTabPayload({
          generatedAt: REFRESHED_GENERATED_AT,
          items: [
            {
              number: 999,
              itemId: 'NEW_ITEM',
              projectItemId: 'NEW_ITEM',
              relatedOpenPullRequestUrls: [],
            },
          ],
        }),
      );
      await refreshDone;
    });

    expect(
      result.current.snapshots.queued?.items.map((item) => item.number),
    ).not.toContain(999);
    expect(result.current.snapshots).toEqual(betaSnapshots);

    rerender({ pjcode: 'acme' });
    expect(
      result.current.snapshots.queued?.items.map((item) => item.number),
    ).toEqual([999]);
    expect(result.current.snapshots.queued?.generatedAt).toBe(
      REFRESHED_GENERATED_AT,
    );
    expect({ ...result.current.snapshots, queued: null }).toEqual({
      ...acmeSnapshots,
      queued: null,
    });
  });

  it('keeps a single-tab result for project A out of project B once the switch to B has rendered', async () => {
    const ACME_GENERATED_AT = '2026-06-19T00:00:00.000Z';
    const BETA_GENERATED_AT = '2026-06-25T00:00:00.000Z';
    const REFRESHED_GENERATED_AT = '2026-07-01T00:00:00.000Z';
    let holdAcmeQueued = false;
    let releaseAcmeQueued: (payload: unknown) => void = () => undefined;
    const acmeQueuedRefresh = new Promise<unknown>((resolve) => {
      releaseAcmeQueued = resolve;
    });
    global.fetch = jest.fn(async (url: string) => {
      if (holdAcmeQueued && url.endsWith('/acme/queued/list.json')) {
        return { ok: true, status: 200, json: () => acmeQueuedRefresh };
      }
      const generatedAt = url.includes('/beta/')
        ? BETA_GENERATED_AT
        : ACME_GENERATED_AT;
      return {
        ok: true,
        status: 200,
        json: async () => makeTabPayload({ generatedAt }),
      };
    }) as unknown as typeof fetch;

    const { result, rerender } = renderHook(
      ({ pjcode }: { pjcode: string }) => useConsoleTabData(pjcode),
      { initialProps: { pjcode: 'acme' } },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const acmeSnapshots = result.current.snapshots;

    holdAcmeQueued = true;
    let refreshDone: Promise<void> = Promise.resolve();
    act(() => {
      refreshDone = result.current.refreshSingleTab('queued');
    });

    await act(async () => {
      rerender({ pjcode: 'beta' });
      releaseAcmeQueued(
        makeTabPayload({
          generatedAt: REFRESHED_GENERATED_AT,
          items: [
            {
              number: 999,
              itemId: 'NEW_ITEM',
              projectItemId: 'NEW_ITEM',
              relatedOpenPullRequestUrls: [],
            },
          ],
        }),
      );
      await refreshDone;
    });
    await waitFor(() =>
      expect(result.current.snapshots.prs?.generatedAt).toBe(BETA_GENERATED_AT),
    );

    expect(
      result.current.snapshots.queued?.items.map((item) => item.number),
    ).not.toContain(999);
    expect(result.current.snapshots.queued?.generatedAt).toBe(
      BETA_GENERATED_AT,
    );

    rerender({ pjcode: 'acme' });
    expect(
      result.current.snapshots.queued?.items.map((item) => item.number),
    ).toEqual([999]);
    expect(result.current.snapshots.queued?.generatedAt).toBe(
      REFRESHED_GENERATED_AT,
    );
    expect({ ...result.current.snapshots, queued: null }).toEqual({
      ...acmeSnapshots,
      queued: null,
    });
  });

  it('does not give project A a loaded state from a single-tab result when A has no registry entry', async () => {
    let holdAcme = true;
    const acmeReleases: Array<() => void> = [];
    global.fetch = jest.fn(async (url: string) => {
      const response = {
        ok: true,
        status: 200,
        json: async () => makeTabPayload({ generatedAt: url }),
      };
      if (holdAcme && url.includes('/acme/')) {
        return new Promise((resolve) => {
          acmeReleases.push(() => resolve(response));
        });
      }
      return response;
    }) as unknown as typeof fetch;

    const { result, rerender } = renderHook(
      ({ pjcode }: { pjcode: string }) => useConsoleTabData(pjcode),
      { initialProps: { pjcode: 'acme' } },
    );
    expect(result.current.isLoading).toBe(true);
    const refreshAcmeQueued = result.current.refreshSingleTab;
    let refreshDone: Promise<void> = Promise.resolve();
    act(() => {
      refreshDone = refreshAcmeQueued('queued');
    });

    rerender({ pjcode: 'beta' });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      for (const release of acmeReleases) {
        release();
      }
      await refreshDone;
    });

    rerender({ pjcode: 'acme' });
    await waitFor(() => expect(result.current.isLoading).toBe(true));
    expect(result.current.snapshots.prs).toBeNull();
    expect(result.current.snapshots.queued).toBeNull();
    holdAcme = false;
  });

  it('clears stale timer data from the previous project after switching when no cache exists for the new project', async () => {
    const fetchMock = jest.fn(async (url: string) => {
      if (url.includes('/acme/')) {
        return {
          ok: true,
          status: 200,
          json: async () =>
            makeTabPayload({
              timerEndsAt: '2026-09-09T10:00:00.000Z',
              timerTotalSeconds: 1800,
            }),
        };
      }
      return new Promise<never>(() => {});
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const { result, rerender } = renderHook(
      ({ pjcode }: { pjcode: string | null }) => useConsoleTabData(pjcode),
      { initialProps: { pjcode: 'acme' } },
    );

    await waitFor(() => {
      expect(result.current.snapshots.prs?.timerEndsAt).toBe(
        '2026-09-09T10:00:00.000Z',
      );
    });

    rerender({ pjcode: 'beta' });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(true);
    });
    expect(
      Object.values(result.current.snapshots).every((s) => s === null),
    ).toBe(true);
  });

  it('does not set isLoading to true when switching to a previously-visited project with cached data', async () => {
    installNetworkFetch();
    const { result, rerender } = renderHook(
      ({ pjcode }: { pjcode: string }) => useConsoleTabData(pjcode),
      { initialProps: { pjcode: 'acme' } },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let resolveCacheLoad!: () => void;
    const cacheGate = new Promise<void>((resolve) => {
      resolveCacheLoad = resolve;
    });
    const cachedPayload = makeTabPayload({
      generatedAt: '2026-06-10T00:00:00.000Z',
    });
    installMockCaches({
      json: jest.fn(async () => {
        await cacheGate;
        return cachedPayload;
      }),
    });
    global.fetch = jest.fn(
      () => new Promise<never>(() => undefined),
    ) as unknown as typeof fetch;

    rerender({ pjcode: 'beta' });

    expect(result.current.isLoading).toBe(false);

    await act(async () => {
      resolveCacheLoad();
      await cacheGate;
    });

    await waitFor(() =>
      expect(result.current.snapshots.prs?.fromCache).toBe(true),
    );
    expect(result.current.isLoading).toBe(false);
  });

  it('displays cached data immediately on project switch without waiting for the network response', async () => {
    const cachedPayload = makeTabPayload({
      generatedAt: '2026-01-01T00:00:00.000Z',
      items: [
        { number: 10, itemId: 'PVTI_CACHE', projectItemId: 'PVTI_CACHE' },
      ],
    });
    installMockCaches({ json: jest.fn(async () => cachedPayload) });
    global.fetch = jest.fn(
      () => new Promise(() => {}),
    ) as unknown as typeof fetch;

    const { result } = renderHook(() => useConsoleTabData('acme'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.snapshots.prs?.fromCache).toBe(true);
    expect(result.current.snapshots.prs?.items).toHaveLength(1);
    expect(result.current.error).toBeNull();
  });

  it('updates display with the network response after initial cache data is shown', async () => {
    const cachedGeneratedAt = '2026-01-01T00:00:00.000Z';
    const networkGeneratedAt = '2026-06-01T00:00:00.000Z';
    installMockCaches({
      json: jest.fn(async () =>
        makeTabPayload({ generatedAt: cachedGeneratedAt }),
      ),
    });
    type FetchResponse = {
      ok: boolean;
      status: number;
      json: () => Promise<unknown>;
    };
    const networkResolvers: Array<(v: FetchResponse) => void> = [];
    global.fetch = jest.fn(
      () =>
        new Promise<FetchResponse>((resolve) => networkResolvers.push(resolve)),
    ) as unknown as typeof fetch;

    const { result } = renderHook(() => useConsoleTabData('acme'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.snapshots.prs?.fromCache).toBe(true);
    });

    const networkPayload = makeTabPayload({ generatedAt: networkGeneratedAt });
    await act(async () => {
      for (const resolve of networkResolvers) {
        resolve({ ok: true, status: 200, json: async () => networkPayload });
      }
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.snapshots.prs?.fromCache).toBe(false);
      expect(result.current.snapshots.prs?.generatedAt).toBe(
        networkGeneratedAt,
      );
    });
  });

  it('does not overwrite fresh network data with a late-arriving cache result', async () => {
    const networkGeneratedAt = '2026-06-01T00:00:00.000Z';
    const cachedGeneratedAt = '2026-01-01T00:00:00.000Z';
    const networkPayload = makeTabPayload({ generatedAt: networkGeneratedAt });
    const cachedPayload = makeTabPayload({ generatedAt: cachedGeneratedAt });

    const cacheMatchResolvers: Array<(v: MockCacheEntry | undefined) => void> =
      [];
    const mockCacheDeferred: MockCache = {
      match: jest.fn(
        () =>
          new Promise<MockCacheEntry | undefined>((resolve) =>
            cacheMatchResolvers.push(resolve),
          ),
      ),
      put: jest.fn(async () => undefined),
    };
    Object.defineProperty(global, 'caches', {
      value: { open: jest.fn(async () => mockCacheDeferred) },
      writable: true,
      configurable: true,
    });
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => networkPayload,
    })) as unknown as typeof fetch;

    const { result } = renderHook(() => useConsoleTabData('acme'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.snapshots.prs?.fromCache).toBe(false);
      expect(result.current.snapshots.prs?.generatedAt).toBe(
        networkGeneratedAt,
      );
    });

    await act(async () => {
      for (const resolve of cacheMatchResolvers) {
        resolve({ json: jest.fn(async () => cachedPayload) });
      }
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.snapshots.prs?.fromCache).toBe(false);
    expect(result.current.snapshots.prs?.generatedAt).toBe(networkGeneratedAt);
  });

  it('keeps isLoading true when no cache entry exists until the network responds', async () => {
    installMockCaches(undefined);
    type FetchResponse = {
      ok: boolean;
      status: number;
      json: () => Promise<unknown>;
    };
    const networkResolvers: Array<(v: FetchResponse) => void> = [];
    global.fetch = jest.fn(
      () =>
        new Promise<FetchResponse>((resolve) => networkResolvers.push(resolve)),
    ) as unknown as typeof fetch;

    const { result } = renderHook(() => useConsoleTabData('acme'));

    await act(async () => {
      for (let i = 0; i < 4; i++) await Promise.resolve();
    });

    expect(result.current.isLoading).toBe(true);

    const networkPayload = makeTabPayload();
    await act(async () => {
      for (const resolve of networkResolvers) {
        resolve({ ok: true, status: 200, json: async () => networkPayload });
      }
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('retains cached display and reports no error when the network fails after cache data is shown', async () => {
    const cachedPayload = makeTabPayload({
      generatedAt: '2026-01-01T00:00:00.000Z',
    });
    installMockCaches({ json: jest.fn(async () => cachedPayload) });
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error('network error')) as unknown as typeof fetch;

    const { result } = renderHook(() => useConsoleTabData('acme'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.snapshots.prs?.fromCache).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('clears previous project snapshots in the same render when switching to an unvisited project', async () => {
    installNetworkFetch((url) =>
      url.includes('/acme/prs/')
        ? [{ number: 1, itemId: 'PVTI_1', projectItemId: 'PVTI_1' }]
        : [],
    );

    const { result, rerender } = renderHook(
      ({ pjcode }: { pjcode: string }) => useConsoleTabData(pjcode),
      { initialProps: { pjcode: 'acme' } },
    );

    await waitFor(() => {
      expect(result.current.snapshots.prs?.items).toHaveLength(1);
    });

    removeMockCaches();
    global.fetch = jest.fn(
      () => new Promise<never>(() => {}),
    ) as unknown as typeof fetch;

    rerender({ pjcode: 'beta' });

    expect(
      Object.values(result.current.snapshots).every((s) => s === null),
    ).toBe(true);
  });

  it('shows in-memory registry data synchronously when switching back to a previously-visited project without Cache API', async () => {
    installNetworkFetch((url) =>
      url.includes('/acme/prs/')
        ? [{ number: 2, itemId: 'PVTI_2', projectItemId: 'PVTI_2' }]
        : [],
    );

    const { result, rerender } = renderHook(
      ({ pjcode }: { pjcode: string }) => useConsoleTabData(pjcode),
      { initialProps: { pjcode: 'acme' } },
    );

    await waitFor(() => {
      expect(result.current.snapshots.prs?.items).toHaveLength(1);
    });

    removeMockCaches();
    global.fetch = jest.fn(
      () => new Promise<never>(() => {}),
    ) as unknown as typeof fetch;

    rerender({ pjcode: 'beta' });

    await waitFor(() => {
      expect(
        Object.values(result.current.snapshots).every((s) => s === null),
      ).toBe(true);
    });

    rerender({ pjcode: 'acme' });

    expect(result.current.snapshots.prs?.items).toHaveLength(1);
    expect(result.current.isLoading).toBe(false);
  });
});

const flushTabDataTimers = async (milliseconds: number): Promise<void> => {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(milliseconds);
  });
};

const dispatchTabDataEventInAct = async (
  target: Window | Document,
  event: Event,
): Promise<void> => {
  await act(async () => {
    target.dispatchEvent(event);
    await jest.advanceTimersByTimeAsync(0);
  });
};

const setTabDataVisibility = (state: DocumentVisibilityState): void => {
  Object.defineProperty(document, 'visibilityState', {
    value: state,
    configurable: true,
  });
};

const originalFetch = global.fetch;
const originalCachesDescriptor = Object.getOwnPropertyDescriptor(
  global,
  'caches',
);

describe('useConsoleTabData network retry', () => {
  let fakeTimersEnabled = false;

  beforeEach(() => {
    jest.useFakeTimers();
    fakeTimersEnabled = true;
  });

  afterEach(() => {
    cleanup();
    if (fakeTimersEnabled) {
      jest.clearAllTimers();
    }
    jest.useRealTimers();
    fakeTimersEnabled = false;
    Reflect.deleteProperty(document, 'visibilityState');
    global.fetch = originalFetch;
    if (originalCachesDescriptor) {
      Object.defineProperty(global, 'caches', originalCachesDescriptor);
    } else {
      removeMockCaches();
    }
  });

  it('surfaces the initial network error and shows the list after an automatic retry', async () => {
    let successful = false;
    installMockCaches(undefined);
    const fetchMock = jest.fn(async (url: string) => {
      if (!successful) {
        throw new TypeError('Failed to fetch');
      }
      return {
        ok: true,
        status: 200,
        json: async () =>
          makeTabPayload({
            items: url.includes('/prs/')
              ? [
                  {
                    number: 1,
                    itemId: 'RETRIED_ITEM',
                    projectItemId: 'RETRIED_ITEM',
                  },
                ]
              : [],
          }),
      };
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const { result } = renderHook(() => useConsoleTabData('acme'));
    await flushTabDataTimers(0);
    expect(result.current.error).toBe('Failed to fetch');
    expect(
      Object.values(result.current.snapshots).every((s) => s === null),
    ).toBe(true);

    successful = true;
    await flushTabDataTimers(1000);

    await waitFor(() => {
      expect(result.current.snapshots.prs?.items).toHaveLength(1);
    });
    expect(result.current.snapshots.prs?.items[0].itemId).toBe('RETRIED_ITEM');
    expect(result.current.error).toBeNull();
  });

  it('doubles network retry delays and caps the delay at 30 seconds', async () => {
    const requestTimes: number[] = [];
    const startTime = Date.now();
    const fetchMock = jest.fn(async (url: string) => {
      if (url.includes('/prs/')) {
        requestTimes.push(Date.now() - startTime);
      }
      throw new TypeError('Failed to fetch');
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    renderHook(() => useConsoleTabData('acme'));
    await flushTabDataTimers(0);
    for (const delay of [1000, 2000, 4000, 8000, 16000]) {
      await flushTabDataTimers(delay);
    }
    expect(requestTimes).toEqual([0, 1000, 3000, 7000, 15000, 31000]);

    await flushTabDataTimers(29_000);
    await flushTabDataTimers(1000);
    await flushTabDataTimers(30_000);

    expect(requestTimes).toEqual(
      expect.arrayContaining([
        0, 1000, 3000, 7000, 15000, 31000, 61_000, 91_000,
      ]),
    );
    expect(requestTimes.filter((requestTime) => requestTime >= 31_000)).toEqual(
      expect.arrayContaining([31_000, 60_000, 61_000, 91_000]),
    );
    expect([61_000 - 31_000, 91_000 - 61_000]).toEqual([30_000, 30_000]);
  });

  it('restarts the 1-second retry delay after the list recovers from a network failure', async () => {
    const requestTimes: number[] = [];
    const startTime = Date.now();
    let requestCount = 0;
    const fetchMock = jest.fn(async (url: string) => {
      if (url.includes('/prs/')) {
        requestTimes.push(Date.now() - startTime);
      }
      const requestRound = Math.floor(requestCount / CONSOLE_TABS.length);
      requestCount += 1;
      if (requestRound === 1 || requestRound === 2 || requestRound === 4) {
        throw new TypeError('Failed to fetch');
      }
      return {
        ok: true,
        status: 200,
        json: async () => makeTabPayload(),
      };
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    renderHook(() => useConsoleTabData('acme'));
    await flushTabDataTimers(0);
    await flushTabDataTimers(CONSOLE_TAB_REFRESH_INTERVAL_MS);
    await flushTabDataTimers(1000);
    await flushTabDataTimers(2000);
    await flushTabDataTimers(CONSOLE_TAB_REFRESH_INTERVAL_MS - 3000);

    expect(requestTimes).toContain(120_000);
    await flushTabDataTimers(1000);
    expect(requestTimes).toContain(121_000);
  });

  it.each([
    {
      eventName: 'online',
      dispatchEvent: async () =>
        dispatchTabDataEventInAct(window, new Event('online')),
    },
    {
      eventName: 'visible',
      dispatchEvent: async () => {
        setTabDataVisibility('visible');
        await dispatchTabDataEventInAct(
          document,
          new Event('visibilitychange'),
        );
      },
    },
  ])(
    'retries immediately when the page becomes $eventName during a network failure',
    async ({ dispatchEvent }) => {
      let attempts = 0;
      const fetchMock = jest.fn(async () => {
        attempts += 1;
        if (attempts <= CONSOLE_TABS.length) {
          throw new TypeError('Failed to fetch');
        }
        return {
          ok: true,
          status: 200,
          json: async () => makeTabPayload(),
        };
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      const { result } = renderHook(() => useConsoleTabData('acme'));
      await flushTabDataTimers(0);
      expect(fetchMock).toHaveBeenCalledTimes(CONSOLE_TABS.length);
      expect(result.current.error).toBe('Failed to fetch');

      await dispatchEvent();

      expect(fetchMock).toHaveBeenCalledTimes(CONSOLE_TABS.length * 2);
      expect(result.current.error).toBeNull();
    },
  );

  it('does not retry after online or visibility events when the list has loaded', async () => {
    const fetchMock = installNetworkFetch();
    const { result } = renderHook(() => useConsoleTabData('acme'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const initialFetchCount = fetchMock.mock.calls.length;

    setTabDataVisibility('visible');
    await dispatchTabDataEventInAct(window, new Event('online'));
    await dispatchTabDataEventInAct(document, new Event('visibilitychange'));

    expect(fetchMock).toHaveBeenCalledTimes(initialFetchCount);
  });

  it('keeps the displayed list during a failed refresh and replaces it after retry success', async () => {
    let refreshStarted = false;
    let retrySucceeded = false;
    const oldItem = {
      number: 1,
      itemId: 'OLD_ITEM',
      projectItemId: 'OLD_ITEM',
    };
    const newItem = {
      number: 2,
      itemId: 'NEW_ITEM',
      projectItemId: 'NEW_ITEM',
    };
    const fetchMock = jest.fn(async (url: string) => {
      if (refreshStarted && !retrySucceeded) {
        throw new TypeError('Failed to fetch');
      }
      return {
        ok: true,
        status: 200,
        json: async () =>
          makeTabPayload({
            items: url.includes('/prs/')
              ? retrySucceeded
                ? [newItem]
                : [oldItem]
              : [],
          }),
      };
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const { result } = renderHook(() => useConsoleTabData('acme'));
    await waitFor(() =>
      expect(result.current.snapshots.prs?.items).toHaveLength(1),
    );
    expect(result.current.snapshots.prs?.items[0].itemId).toBe('OLD_ITEM');

    refreshStarted = true;
    await flushTabDataTimers(CONSOLE_TAB_REFRESH_INTERVAL_MS);
    expect(result.current.snapshots.prs?.items[0].itemId).toBe('OLD_ITEM');

    retrySucceeded = true;
    await flushTabDataTimers(1000);
    await waitFor(() =>
      expect(result.current.snapshots.prs?.items[0].itemId).toBe('NEW_ITEM'),
    );
  });

  it('keeps the displayed list with no error during a failed refresh when no Cache API is available', async () => {
    removeMockCaches();
    expect('caches' in globalThis).toBe(false);
    let refreshStarted = false;
    let retrySucceeded = false;
    const oldItem = {
      number: 1,
      itemId: 'OLD_ITEM',
      projectItemId: 'OLD_ITEM',
    };
    const newItem = {
      number: 2,
      itemId: 'NEW_ITEM',
      projectItemId: 'NEW_ITEM',
    };
    const fetchMock = jest.fn(async (url: string) => {
      if (refreshStarted && !retrySucceeded) {
        throw new TypeError('Failed to fetch');
      }
      return {
        ok: true,
        status: 200,
        json: async () =>
          makeTabPayload({
            items: url.includes('/prs/')
              ? retrySucceeded
                ? [newItem]
                : [oldItem]
              : [],
          }),
      };
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const { result } = renderHook(() => useConsoleTabData('acme'));
    await waitFor(() =>
      expect(result.current.snapshots.prs?.items).toHaveLength(1),
    );
    expect(result.current.error).toBeNull();

    refreshStarted = true;
    await flushTabDataTimers(CONSOLE_TAB_REFRESH_INTERVAL_MS);
    expect(result.current.snapshots.prs?.items[0].itemId).toBe('OLD_ITEM');
    expect(result.current.error).toBeNull();

    retrySucceeded = true;
    await flushTabDataTimers(1000);
    await waitFor(() =>
      expect(result.current.snapshots.prs?.items[0].itemId).toBe('NEW_ITEM'),
    );
    expect(result.current.error).toBeNull();
  });

  it.each([{ networkTab: 'prs' }, { networkTab: 'todo-by-human' }] as const)(
    'shows the HTTP error and keeps the rows when $networkTab fails at the network level and every other tab returns HTTP 500',
    async ({ networkTab }) => {
      removeMockCaches();
      let refreshStarted = false;
      const oldItem = {
        number: 1,
        itemId: 'OLD_ITEM',
        projectItemId: 'OLD_ITEM',
      };
      const fetchMock = jest.fn(async (url: string) => {
        if (refreshStarted && url.includes(`/${networkTab}/`)) {
          throw new TypeError('Failed to fetch');
        }
        if (refreshStarted) {
          return { ok: false, status: 500, json: async () => ({}) };
        }
        return {
          ok: true,
          status: 200,
          json: async () =>
            makeTabPayload({
              items: url.includes(`/${networkTab}/`) ? [oldItem] : [],
            }),
        };
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      const { result } = renderHook(() => useConsoleTabData('acme'));
      await waitFor(() =>
        expect(result.current.snapshots[networkTab]?.items).toHaveLength(1),
      );

      refreshStarted = true;
      await flushTabDataTimers(CONSOLE_TAB_REFRESH_INTERVAL_MS);

      expect(result.current.error).toBe('HTTP 500');
      expect(result.current.snapshots[networkTab]?.items[0].itemId).toBe(
        'OLD_ITEM',
      );
    },
  );

  it('retries a network failure while the list is served from cache and keeps the cached list without an error', async () => {
    const cachedPayload = makeTabPayload({
      generatedAt: '2026-01-01T00:00:00.000Z',
      items: [
        { number: 1, itemId: 'CACHED_ITEM', projectItemId: 'CACHED_ITEM' },
      ],
    });
    const retryPayload = makeTabPayload({
      generatedAt: '2026-01-02T00:00:00.000Z',
      items: [
        { number: 2, itemId: 'RETRIED_ITEM', projectItemId: 'RETRIED_ITEM' },
      ],
    });
    installMockCaches({ json: jest.fn(async () => cachedPayload) });
    let initialRequests = 0;
    let periodicRefreshStarted = false;
    let periodicFailures = 0;
    const fetchMock = jest.fn(async () => {
      if (initialRequests < CONSOLE_TABS.length) {
        initialRequests += 1;
        throw new TypeError('Failed to fetch');
      }
      if (periodicRefreshStarted) {
        if (periodicFailures < CONSOLE_TABS.length) {
          periodicFailures += 1;
          throw new TypeError('Failed to fetch');
        }
        return {
          ok: true,
          status: 200,
          json: async () => retryPayload,
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => cachedPayload,
      };
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const renderedHook = renderHook(() => useConsoleTabData('acme'));
    const { result } = renderedHook;
    try {
      await flushTabDataTimers(0);
      expect(result.current.snapshots.prs?.items[0].itemId).toBe('CACHED_ITEM');
      expect(result.current.error).toBeNull();

      await flushTabDataTimers(1000);
      await waitFor(() =>
        expect(result.current.snapshots.prs?.items[0].itemId).toBe(
          'CACHED_ITEM',
        ),
      );

      periodicRefreshStarted = true;
      await flushTabDataTimers(CONSOLE_TAB_REFRESH_INTERVAL_MS - 1000);
      expect(result.current.snapshots.prs?.items[0].itemId).toBe('CACHED_ITEM');
      expect(result.current.error).toBeNull();
      const callsBeforeRetry = fetchMock.mock.calls.length;

      await flushTabDataTimers(1000);
      const retryCallCount = fetchMock.mock.calls.length;
      const retriedItemId = result.current.snapshots.prs?.items[0].itemId;
      expect(retryCallCount).toBe(callsBeforeRetry + CONSOLE_TABS.length);
      expect(retriedItemId).toBe('RETRIED_ITEM');
    } finally {
      await act(async () => {
        renderedHook.unmount();
      });
      global.fetch = originalFetch;
    }
  });

  it("keeps a tab's previously displayed snapshot and retries when only some tabs fail at the network level", async () => {
    const oldPayload = makeTabPayload({
      generatedAt: '2026-01-01T00:00:00.000Z',
      items: [{ number: 1, itemId: 'OLD_ITEM', projectItemId: 'OLD_ITEM' }],
    });
    const newPayload = makeTabPayload({
      generatedAt: '2026-01-02T00:00:00.000Z',
      items: [{ number: 2, itemId: 'NEW_ITEM', projectItemId: 'NEW_ITEM' }],
    });
    const failedTabRequests = new Map<string, number>();
    let periodicRefreshStarted = false;
    const fetchMock = jest.fn(async (url: string) => {
      const requestCount = (failedTabRequests.get(url) ?? 0) + 1;
      failedTabRequests.set(url, requestCount);
      if (requestCount === 1) {
        return {
          ok: true,
          status: 200,
          json: async () => oldPayload,
        };
      }
      if (!periodicRefreshStarted) {
        throw new Error('unexpected request before periodic refresh');
      }
      if (url.includes('/prs/') && requestCount === 2) {
        throw new TypeError('Failed to fetch');
      }
      return {
        ok: true,
        status: 200,
        json: async () => newPayload,
      };
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const renderedHook = renderHook(() => useConsoleTabData('acme'));
    const { result } = renderedHook;
    try {
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      const failedTab = CONSOLE_TABS.find((tab) => tab.name === 'prs')!.name;
      const oldSnapshots = result.current.snapshots;
      periodicRefreshStarted = true;

      await flushTabDataTimers(CONSOLE_TAB_REFRESH_INTERVAL_MS);

      expect(result.current.snapshots[failedTab]?.generatedAt).toBe(
        oldSnapshots[failedTab]?.generatedAt,
      );
      expect(result.current.snapshots[failedTab]?.items).not.toEqual([]);
      expect(result.current.snapshots[failedTab]).not.toBeNull();
      for (const tab of CONSOLE_TABS.filter((tab) => tab.name !== failedTab)) {
        expect(result.current.snapshots[tab.name]?.generatedAt).toBe(
          newPayload.generatedAt,
        );
      }
      expect(result.current.error).toBeNull();
      const callsBeforeRetry = fetchMock.mock.calls.length;

      await flushTabDataTimers(1000);
      const retryCallCount = fetchMock.mock.calls.length;
      const retriedGeneratedAt =
        result.current.snapshots[failedTab]?.generatedAt;
      expect(retryCallCount).toBe(callsBeforeRetry + CONSOLE_TABS.length);
      expect(retriedGeneratedAt).toBe(newPayload.generatedAt);
    } finally {
      await act(async () => {
        renderedHook.unmount();
      });
      global.fetch = originalFetch;
    }
  });

  it('does not retry HTTP errors and preserves the current error and empty data', async () => {
    const fetchMock = jest.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({}),
    }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const { result } = renderHook(() => useConsoleTabData('acme'));
    await flushTabDataTimers(0);
    const initialFetchCount = fetchMock.mock.calls.length;
    await flushTabDataTimers(31_000);

    expect(fetchMock).toHaveBeenCalledTimes(initialFetchCount);
    expect(result.current.error).toBe('HTTP 500');
    expect(
      Object.values(result.current.snapshots).every((s) => s === null),
    ).toBe(true);
  });

  it('uses the existing fetch error message for a network failure', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(
        new TypeError('Failed to fetch'),
      ) as unknown as typeof fetch;

    const { result } = renderHook(() => useConsoleTabData('acme'));
    await flushTabDataTimers(0);

    expect(result.current.error).toContain('Failed to fetch');
  });
});
