import { ResourceCache, runWithConcurrency } from './resourceCache';

describe('ResourceCache', () => {
  it('fetches once and caches the result', async () => {
    const fetcher = jest.fn(async (url: string) => `value:${url}`);
    const cache = new ResourceCache(fetcher);
    expect(await cache.load('k', 'u')).toBe('value:u');
    expect(await cache.load('k', 'u')).toBe('value:u');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(cache.peek('k')).toBe('value:u');
  });

  it('de-duplicates concurrent in-flight requests', async () => {
    let resolveFetch: (value: string) => void = () => {};
    const fetcher = jest.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveFetch = resolve;
        }),
    );
    const cache = new ResourceCache(fetcher);
    const first = cache.load('k', 'u');
    const second = cache.load('k', 'u');
    resolveFetch('shared');
    expect(await first).toBe('shared');
    expect(await second).toBe('shared');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('allows a retry after a failed fetch', async () => {
    const fetcher = jest
      .fn<Promise<string>, [string]>()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce('ok');
    const cache = new ResourceCache(fetcher);
    await expect(cache.load('k', 'u')).rejects.toThrow('boom');
    expect(await cache.load('k', 'u')).toBe('ok');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('prefetches into the cache and serves the next load from it', async () => {
    const fetcher = jest.fn(async (url: string) => `value:${url}`);
    const cache = new ResourceCache(fetcher);
    cache.prefetch('k', 'u');
    await Promise.resolve();
    await Promise.resolve();
    expect(cache.peek('k')).toBe('value:u');
    expect(await cache.load('k', 'u')).toBe('value:u');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('does not prefetch a key that is already cached', async () => {
    const fetcher = jest.fn(async (url: string) => `value:${url}`);
    const cache = new ResourceCache(fetcher);
    await cache.load('k', 'u');
    cache.prefetch('k', 'u');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('does not start a second prefetch while one is in flight', async () => {
    const fetcher = jest.fn(() => new Promise<string>(() => {}));
    const cache = new ResourceCache(fetcher);
    cache.prefetch('k', 'u');
    cache.prefetch('k', 'u');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('swallows prefetch errors and leaves the key uncached', async () => {
    const fetcher = jest
      .fn<Promise<string>, [string]>()
      .mockRejectedValue(new Error('boom'));
    const cache = new ResourceCache(fetcher);
    cache.prefetch('k', 'u');
    await Promise.resolve();
    await Promise.resolve();
    expect(cache.peek('k')).toBeUndefined();
  });

  it('invalidate removes a cached value so the next load refetches', async () => {
    const fetcher = jest.fn(async (url: string) => `value:${url}`);
    const cache = new ResourceCache(fetcher);
    await cache.load('k', 'u');
    cache.invalidate('k');
    expect(cache.peek('k')).toBeUndefined();
    await cache.load('k', 'u');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

describe('runWithConcurrency', () => {
  it('never exceeds the concurrency limit', async () => {
    let active = 0;
    let maxActive = 0;
    const makeTask = () => async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
    };
    const tasks = Array.from({ length: 6 }, makeTask);
    await runWithConcurrency(tasks, 2);
    expect(maxActive).toBeLessThanOrEqual(2);
  });
});
