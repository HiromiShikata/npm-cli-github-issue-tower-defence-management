export type ResourceFetcher<T> = (url: string) => Promise<T>;

export class ResourceCache<T> {
  private readonly cache = new Map<string, T>();
  private readonly inFlight = new Map<string, Promise<T>>();
  private readonly prefetchInFlight = new Set<string>();

  constructor(private readonly fetcher: ResourceFetcher<T>) {}

  peek = (key: string): T | undefined => this.cache.get(key);

  has = (key: string): boolean => this.cache.has(key);

  load = (key: string, url: string): Promise<T> => {
    const cached = this.cache.get(key);
    if (cached !== undefined) {
      return Promise.resolve(cached);
    }
    const pending = this.inFlight.get(key);
    if (pending !== undefined) {
      return pending;
    }
    const promise = this.fetcher(url)
      .then((value) => {
        this.cache.set(key, value);
        return value;
      })
      .finally(() => {
        this.inFlight.delete(key);
      });
    this.inFlight.set(key, promise);
    return promise;
  };

  prefetch = (key: string, url: string): void => {
    if (
      this.cache.has(key) ||
      this.inFlight.has(key) ||
      this.prefetchInFlight.has(key)
    ) {
      return;
    }
    this.prefetchInFlight.add(key);
    this.fetcher(url)
      .then((value) => {
        this.cache.set(key, value);
      })
      .catch(() => {})
      .finally(() => {
        this.prefetchInFlight.delete(key);
      });
  };

  invalidate = (key: string): void => {
    this.cache.delete(key);
  };
}

export const runWithConcurrency = async (
  tasks: (() => Promise<unknown>)[],
  limit: number,
): Promise<void> => {
  let index = 0;
  const workers = Array.from(
    { length: Math.min(limit, tasks.length) },
    async () => {
      while (index < tasks.length) {
        const current = tasks[index];
        index += 1;
        await current();
      }
    },
  );
  await Promise.all(workers);
};
