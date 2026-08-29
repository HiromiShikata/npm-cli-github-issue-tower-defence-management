import { act, renderHook, waitFor } from '@testing-library/react';
import {
  type AirplaneSnapshot,
  readAirplaneModeFlag,
  writeAirplaneModeFlag,
} from '../lib/airplaneSnapshot';
import { useAirplaneMode } from './useAirplaneMode';

const makeMinimalSnapshot = (
  overrides: Partial<AirplaneSnapshot> = {},
): AirplaneSnapshot => ({
  capturedAt: '2026-01-01T00:00:00Z',
  tabs: {},
  items: {},
  failures: [],
  ...overrides,
});

const encodeSseEvent = (data: unknown): string =>
  `data: ${JSON.stringify(data)}\n\n`;

const buildSseBody = (events: unknown[]): ReadableStream<Uint8Array> => {
  const encoder = new TextEncoder();
  const chunks = events.map((e) => encoder.encode(encodeSseEvent(e)));
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk);
      }
      controller.close();
    },
  });
};

const mockFetchSse = (events: unknown[]): void => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    body: buildSseBody(events),
  });
};

const mockCacheApi = (): {
  stored: AirplaneSnapshot | null;
  cacheStore: Map<string, string>;
} => {
  let stored: AirplaneSnapshot | null = null;
  const cacheStore = new Map<string, string>();

  const mockCache = {
    put: jest.fn(async (_key: string, response: Response) => {
      const text = await response.text();
      cacheStore.set('snapshot', text);
      stored = JSON.parse(text) as AirplaneSnapshot;
    }),
    match: jest.fn(async () => {
      if (!cacheStore.has('snapshot')) {
        return undefined;
      }
      return new Response(cacheStore.get('snapshot'), {
        headers: { 'Content-Type': 'application/json' },
      });
    }),
    delete: jest.fn(),
  };

  Object.defineProperty(global, 'caches', {
    writable: true,
    value: {
      open: jest.fn().mockResolvedValue(mockCache),
      delete: jest.fn().mockResolvedValue(true),
    },
  });

  return { stored: stored, cacheStore };
};

describe('useAirplaneMode', () => {
  beforeEach(() => {
    localStorage.clear();
    mockCacheApi();
  });

  it('starts in off status', () => {
    const { result } = renderHook(() => useAirplaneMode());
    expect(result.current.status).toBe('off');
    expect(result.current.snapshot).toBeNull();
    expect(result.current.progress).toBeNull();
    expect(result.current.failures).toEqual([]);
  });

  it('does not report on while a fetch is outstanding', async () => {
    let resolveStream!: () => void;
    const streamBlocked = new Promise<void>((res) => {
      resolveStream = res;
    });

    const encoder = new TextEncoder();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              encodeSseEvent({ type: 'progress', fetched: 0, total: 5 }),
            ),
          );
          streamBlocked
            .then(() => {
              controller.close();
            })
            .catch(() => {});
        },
      }),
    });

    const { result } = renderHook(() => useAirplaneMode());

    act(() => {
      result.current.startSync();
    });

    await waitFor(() => {
      expect(result.current.status).toBe('syncing');
    });

    expect(result.current.status).not.toBe('on');

    resolveStream();
  });

  it('transitions to on only after the done event with no failures', async () => {
    const snapshot = makeMinimalSnapshot();
    mockFetchSse([
      { type: 'progress', fetched: 0, total: 1 },
      { type: 'progress', fetched: 1, total: 1 },
      { type: 'done', snapshot },
    ]);

    const { result } = renderHook(() => useAirplaneMode());

    act(() => {
      result.current.startSync();
    });

    await waitFor(() => {
      expect(result.current.status).toBe('on');
    });

    expect(result.current.snapshot).not.toBeNull();
    expect(result.current.snapshot?.capturedAt).toBe('2026-01-01T00:00:00Z');
    expect(result.current.failures).toEqual([]);
  });

  it('sets status to error and does not turn on when the done event has failures', async () => {
    const snapshot = makeMinimalSnapshot({
      failures: ['https://github.com/o/r/issues/99'],
    });
    mockFetchSse([
      { type: 'progress', fetched: 0, total: 1 },
      { type: 'done', snapshot },
    ]);

    const { result } = renderHook(() => useAirplaneMode());

    act(() => {
      result.current.startSync();
    });

    await waitFor(() => {
      expect(result.current.status).toBe('error');
    });

    expect(result.current.status).toBe('error');
    expect(result.current.failures).toContain(
      'https://github.com/o/r/issues/99',
    );
    expect(result.current.snapshot).toBeNull();
  });

  it('sets status to error when fetch fails', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network down'));

    const { result } = renderHook(() => useAirplaneMode());

    act(() => {
      result.current.startSync();
    });

    await waitFor(() => {
      expect(result.current.status).toBe('error');
    });

    expect(result.current.failures).toContain('network down');
  });

  it('turnOff resets to off and clears snapshot', async () => {
    const snapshot = makeMinimalSnapshot();
    mockFetchSse([
      { type: 'progress', fetched: 0, total: 0 },
      { type: 'done', snapshot },
    ]);

    const { result } = renderHook(() => useAirplaneMode());

    act(() => {
      result.current.startSync();
    });

    await waitFor(() => {
      expect(result.current.status).toBe('on');
    });

    act(() => {
      result.current.turnOff();
    });

    expect(result.current.status).toBe('off');
    expect(result.current.snapshot).toBeNull();
    expect(result.current.failures).toEqual([]);
  });

  it('loads stored snapshot from Cache API when flag is on at mount', async () => {
    const snapshot = makeMinimalSnapshot({
      capturedAt: '2025-06-01T00:00:00Z',
    });
    writeAirplaneModeFlag(true);

    const cacheStore = new Map<string, string>();
    cacheStore.set('snapshot', JSON.stringify(snapshot));

    const mockCache = {
      put: jest.fn(),
      match: jest.fn().mockResolvedValue(
        new Response(cacheStore.get('snapshot'), {
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    };
    Object.defineProperty(global, 'caches', {
      writable: true,
      value: {
        open: jest.fn().mockResolvedValue(mockCache),
        delete: jest.fn().mockResolvedValue(true),
      },
    });

    const { result } = renderHook(() => useAirplaneMode());

    await waitFor(() => {
      expect(result.current.status).toBe('on');
    });

    expect(result.current.snapshot?.capturedAt).toBe('2025-06-01T00:00:00Z');
  });

  it('advances progress events during sync', async () => {
    mockFetchSse([
      { type: 'progress', fetched: 0, total: 2 },
      { type: 'progress', fetched: 1, total: 2 },
      { type: 'progress', fetched: 2, total: 2 },
      { type: 'done', snapshot: makeMinimalSnapshot() },
    ]);

    const { result } = renderHook(() => useAirplaneMode());

    act(() => {
      result.current.startSync();
    });

    await waitFor(() => {
      expect(result.current.progress?.total).toBe(2);
    });

    await waitFor(() => {
      expect(result.current.status).toBe('on');
    });
  });

  it('sets status to error and does not write the flag when storeAirplaneSnapshot rejects', async () => {
    Object.defineProperty(global, 'caches', {
      writable: true,
      value: {
        open: jest.fn().mockRejectedValue(new Error('Cache API unavailable')),
        delete: jest.fn().mockResolvedValue(true),
      },
    });
    mockFetchSse([{ type: 'done', snapshot: makeMinimalSnapshot() }]);

    const { result } = renderHook(() => useAirplaneMode());

    act(() => {
      result.current.startSync();
    });

    await waitFor(() => {
      expect(result.current.status).toBe('error');
    });

    expect(readAirplaneModeFlag()).toBe(false);
    expect(result.current.snapshot).toBeNull();
  });
});
