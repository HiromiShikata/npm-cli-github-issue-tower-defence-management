import { consoleListItemsFixture } from '../fixtures';
import type { ConsoleItemCache } from './consoleItemCache';
import {
  CONSOLE_PREFETCH_CONCURRENCY,
  prefetchConsoleItems,
} from './consolePrefetch';

const createTrackingCache = (): {
  cache: ConsoleItemCache;
  peakConcurrency: () => number;
  bodyKeys: () => string[];
} => {
  let active = 0;
  let peak = 0;
  const bodyKeys: string[] = [];
  const cache: ConsoleItemCache = {
    getItemBody: jest.fn(async (repo: string, number: number) => {
      active += 1;
      peak = Math.max(peak, active);
      bodyKeys.push(`${repo}#${number}`);
      await Promise.resolve();
      active -= 1;
      return {
        body: '',
        labels: [],
        createdAt: '',
        comments: [],
        state: 'open' as const,
        stateReason: '' as const,
      };
    }),
    getComments: jest.fn(async () => []),
    getRelatedPullRequests: jest.fn(async () => []),
    getPullRequestDetail: jest.fn(async () => null),
  };
  return { cache, peakConcurrency: () => peak, bodyKeys: () => bodyKeys };
};

describe('prefetchConsoleItems', () => {
  it('warms every item body', async () => {
    const { cache, bodyKeys } = createTrackingCache();
    await prefetchConsoleItems(cache, consoleListItemsFixture);
    expect(bodyKeys()).toHaveLength(consoleListItemsFixture.length);
  });

  it('never exceeds the bounded concurrency', async () => {
    const { cache, peakConcurrency } = createTrackingCache();
    await prefetchConsoleItems(cache, consoleListItemsFixture);
    expect(peakConcurrency()).toBeLessThanOrEqual(CONSOLE_PREFETCH_CONCURRENCY);
  });

  it('continues the queue when a single item prefetch fails', async () => {
    const warn = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    const getItemBody = jest
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValue({
        body: '',
        labels: [],
        createdAt: '',
        comments: [],
        state: 'open',
        stateReason: '',
      });
    const cache: ConsoleItemCache = {
      getItemBody,
      getComments: jest.fn(async () => []),
      getRelatedPullRequests: jest.fn(async () => []),
      getPullRequestDetail: jest.fn(async () => null),
    };
    await prefetchConsoleItems(cache, consoleListItemsFixture, 1);
    expect(getItemBody).toHaveBeenCalledTimes(consoleListItemsFixture.length);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
