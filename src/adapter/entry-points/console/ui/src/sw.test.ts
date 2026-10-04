import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { MessageChannel, MessagePort } from 'node:worker_threads';

type GlobalWithMessaging = {
  MessagePort?: unknown;
  MessageChannel?: unknown;
};

(globalThis as GlobalWithMessaging).MessagePort = MessagePort;
(globalThis as GlobalWithMessaging).MessageChannel = MessageChannel;

import { Response as UndiciResponse } from 'undici';

const swSourceCode = fs.readFileSync(
  path.join(__dirname, '../public/sw.js'),
  'utf-8',
);

type FakeFetchRequest = {
  method: string;
  url: string;
  mode: string;
};

type FetchListenerEvent = {
  request: FakeFetchRequest;
  respondWith: jest.Mock;
  waitUntil: jest.Mock;
};

type CacheKeyable = FakeFetchRequest | string;

type MockCacheEntry = {
  store: Map<string, unknown>;
  put: jest.Mock;
  match: jest.Mock;
  add: jest.Mock;
};

type MockCacheStorage = {
  open: jest.Mock;
  match: jest.Mock;
  keys: jest.Mock;
  delete: jest.Mock;
};

type ServiceWorkerListeners = Partial<
  Record<'install' | 'activate' | 'fetch', (event: unknown) => void>
>;

type SwHarness = {
  listeners: ServiceWorkerListeners;
  mockCacheStorage: MockCacheStorage;
  mockFetch: jest.Mock;
  getCacheEntry: (cacheName: string) => MockCacheEntry;
  seedCacheEntry: (
    cacheName: string,
    key: CacheKeyable,
    response: unknown,
  ) => void;
};

function cacheKeyFor(key: CacheKeyable): string {
  return typeof key === 'string' ? key : key.url;
}

function createMockCacheStorage(): {
  cacheStorage: MockCacheStorage;
  getCacheEntry: (cacheName: string) => MockCacheEntry;
  seedCacheEntry: (
    cacheName: string,
    key: CacheKeyable,
    response: unknown,
  ) => void;
} {
  const namedCaches = new Map<string, MockCacheEntry>();

  function getOrCreateCacheEntry(cacheName: string): MockCacheEntry {
    const existingEntry = namedCaches.get(cacheName);
    if (existingEntry !== undefined) {
      return existingEntry;
    }
    const store = new Map<string, unknown>();
    const newEntry: MockCacheEntry = {
      store,
      put: jest.fn((key: CacheKeyable, response: unknown) => {
        store.set(cacheKeyFor(key), response);
        return Promise.resolve(undefined);
      }),
      match: jest.fn((key: CacheKeyable) =>
        Promise.resolve(store.get(cacheKeyFor(key))),
      ),
      add: jest.fn((key: CacheKeyable) => {
        store.set(cacheKeyFor(key), undefined);
        return Promise.resolve(undefined);
      }),
    };
    namedCaches.set(cacheName, newEntry);
    return newEntry;
  }

  const cacheStorage: MockCacheStorage = {
    open: jest.fn((cacheName: string) =>
      Promise.resolve(getOrCreateCacheEntry(cacheName)),
    ),
    match: jest.fn((key: CacheKeyable) => {
      const targetKey = cacheKeyFor(key);
      for (const entry of namedCaches.values()) {
        if (entry.store.has(targetKey)) {
          return Promise.resolve(entry.store.get(targetKey));
        }
      }
      return Promise.resolve(undefined);
    }),
    keys: jest.fn(() => Promise.resolve(Array.from(namedCaches.keys()))),
    delete: jest.fn((cacheName: string) =>
      Promise.resolve(namedCaches.delete(cacheName)),
    ),
  };

  return {
    cacheStorage,
    getCacheEntry: getOrCreateCacheEntry,
    seedCacheEntry: (
      cacheName: string,
      key: CacheKeyable,
      response: unknown,
    ) => {
      getOrCreateCacheEntry(cacheName).store.set(cacheKeyFor(key), response);
    },
  };
}

function createSwHarness(): SwHarness {
  const listeners: ServiceWorkerListeners = {};
  const mockSelf = {
    addEventListener: (
      eventName: 'install' | 'activate' | 'fetch',
      handler: (event: unknown) => void,
    ) => {
      listeners[eventName] = handler;
    },
    location: { origin: 'http://localhost' },
    clients: { claim: jest.fn() },
    skipWaiting: jest.fn(),
  };
  const { cacheStorage, getCacheEntry, seedCacheEntry } =
    createMockCacheStorage();
  const mockFetch = jest.fn();

  const sandbox = vm.createContext({
    self: mockSelf,
    caches: cacheStorage,
    fetch: mockFetch,
    URL,
    Response: UndiciResponse,
    console,
  });
  vm.runInContext(swSourceCode, sandbox);

  return {
    listeners,
    mockCacheStorage: cacheStorage,
    mockFetch,
    getCacheEntry,
    seedCacheEntry,
  };
}

function createFetchEvent(request: FakeFetchRequest): FetchListenerEvent {
  return {
    request,
    respondWith: jest.fn(),
    waitUntil: jest.fn(),
  };
}

function dispatchFetchEvent(
  harness: SwHarness,
  request: FakeFetchRequest,
): FetchListenerEvent {
  const event = createFetchEvent(request);
  const handler = harness.listeners.fetch;
  if (handler === undefined) {
    throw new Error('sw.js did not register a fetch listener');
  }
  handler(event);
  return event;
}

async function flushMicrotasks(): Promise<void> {
  for (let tick = 0; tick < 10; tick += 1) {
    await Promise.resolve();
  }
}

const SHELL_CACHE_NAME = 'console-shell-v1';
const ORIGIN = 'http://localhost';

describe('sw.js fetch listener requests left to the normal network fetch', () => {
  const cases: { name: string; request: FakeFetchRequest }[] = [
    {
      name: 'a non-GET request',
      request: { method: 'POST', url: `${ORIGIN}/`, mode: 'navigate' },
    },
    {
      name: 'a GET request whose URL origin differs from self.location.origin',
      request: {
        method: 'GET',
        url: 'http://other-origin.example.com/',
        mode: 'navigate',
      },
    },
    {
      name: 'a GET request under /api/',
      request: { method: 'GET', url: `${ORIGIN}/api/review`, mode: 'cors' },
    },
    {
      name: 'a non-navigation GET request to a /projects/ data endpoint',
      request: {
        method: 'GET',
        url: `${ORIGIN}/projects/acme/prs/list.json`,
        mode: 'cors',
      },
    },
  ];

  it.each(cases)('$name is never passed to respondWith', ({ request }) => {
    const harness = createSwHarness();
    const event = dispatchFetchEvent(harness, request);
    expect(event.respondWith).not.toHaveBeenCalled();
  });
});

it('serves the fresh network response for GET / and updates the shell cache on success', async () => {
  const harness = createSwHarness();
  const request: FakeFetchRequest = {
    method: 'GET',
    url: `${ORIGIN}/`,
    mode: 'navigate',
  };
  const networkResponse = new UndiciResponse('network-body', { status: 200 });
  harness.mockFetch.mockImplementation(() => Promise.resolve(networkResponse));

  const event = dispatchFetchEvent(harness, request);

  expect(event.respondWith).toHaveBeenCalledTimes(1);
  const resolvedResponse = await event.respondWith.mock.calls[0][0];
  expect(resolvedResponse).toBe(networkResponse);
  await flushMicrotasks();
  const shellCacheEntry = harness.getCacheEntry(SHELL_CACHE_NAME);
  expect(shellCacheEntry.put).toHaveBeenCalledTimes(1);
  expect(shellCacheEntry.put.mock.calls[0][0]).toBe(request);
});

it('resolves to the exact cached match for GET / when offline, ignoring the root fallback', async () => {
  const harness = createSwHarness();
  const request: FakeFetchRequest = {
    method: 'GET',
    url: `${ORIGIN}/`,
    mode: 'navigate',
  };
  harness.mockFetch.mockImplementation(() =>
    Promise.reject(new Error('offline')),
  );
  const exactMatchResponse = new UndiciResponse('exact-match-body');
  const rootFallbackResponse = new UndiciResponse('root-fallback-body');
  harness.seedCacheEntry(SHELL_CACHE_NAME, request, exactMatchResponse);
  harness.seedCacheEntry(SHELL_CACHE_NAME, '/', rootFallbackResponse);

  const event = dispatchFetchEvent(harness, request);

  expect(event.respondWith).toHaveBeenCalledTimes(1);
  const resolvedResponse = await event.respondWith.mock.calls[0][0];
  expect(resolvedResponse).toBe(exactMatchResponse);
});

it('falls back to the cached root response for GET / when offline with no exact match cached', async () => {
  const harness = createSwHarness();
  const request: FakeFetchRequest = {
    method: 'GET',
    url: `${ORIGIN}/`,
    mode: 'navigate',
  };
  harness.mockFetch.mockImplementation(() =>
    Promise.reject(new Error('offline')),
  );
  const rootFallbackResponse = new UndiciResponse('root-fallback-body');
  harness.seedCacheEntry(SHELL_CACHE_NAME, '/', rootFallbackResponse);

  const event = dispatchFetchEvent(harness, request);

  expect(event.respondWith).toHaveBeenCalledTimes(1);
  const resolvedResponse = await event.respondWith.mock.calls[0][0];
  expect(resolvedResponse).toBe(rootFallbackResponse);
});

it('resolves to a Response.error() result for GET / when offline with nothing cached', async () => {
  const harness = createSwHarness();
  const request: FakeFetchRequest = {
    method: 'GET',
    url: `${ORIGIN}/`,
    mode: 'navigate',
  };
  harness.mockFetch.mockImplementation(() =>
    Promise.reject(new Error('offline')),
  );

  const event = dispatchFetchEvent(harness, request);

  expect(event.respondWith).toHaveBeenCalledTimes(1);
  const resolvedResponse = (await event.respondWith.mock
    .calls[0][0]) as UndiciResponse;
  expect(resolvedResponse.type).toBe('error');
  expect(resolvedResponse.status).toBe(0);
  expect(resolvedResponse.ok).toBe(false);
});

describe('direct navigation to a /projects/ app route (bug fix acceptance criteria)', () => {
  const navigationCases: { name: string; path: string }[] = [
    {
      name: 'a 3-segment /projects/{pjcode}/{tab} route',
      path: '/projects/acme/prs',
    },
    {
      name: 'a 2-segment /projects/{pjcode} route',
      path: '/projects/acme',
    },
  ];

  it.each(navigationCases)(
    '$name is intercepted and served the cached shell when offline',
    async ({ path: navigationPath }) => {
      const harness = createSwHarness();
      harness.mockFetch.mockImplementation(() =>
        Promise.reject(new Error('offline')),
      );
      const cachedShellResponse = new UndiciResponse('cached-shell-body');
      harness.seedCacheEntry(SHELL_CACHE_NAME, '/', cachedShellResponse);
      const request: FakeFetchRequest = {
        method: 'GET',
        url: `${ORIGIN}${navigationPath}`,
        mode: 'navigate',
      };

      const event = dispatchFetchEvent(harness, request);

      expect(event.respondWith).toHaveBeenCalledTimes(1);
      const resolvedResponse = await event.respondWith.mock.calls[0][0];
      expect(resolvedResponse).toBe(cachedShellResponse);
    },
  );
});
