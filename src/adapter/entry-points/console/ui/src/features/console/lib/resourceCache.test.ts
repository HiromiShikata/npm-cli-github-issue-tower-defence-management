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
