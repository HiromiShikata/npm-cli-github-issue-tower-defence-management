import { renderHook } from '@testing-library/react';
import { ResourceCache } from '../lib/resourceCache';
import type { ConsoleListItem } from '../logic/types';
import type { ConsoleCaches } from './useConsoleCaches';
import { useConsoleDetailPrefetch } from './useConsoleDetailPrefetch';

const makeItem = (
  number: number,
  overrides: Partial<ConsoleListItem> = {},
): ConsoleListItem => ({
  number,
  title: `Item ${number}`,
  url: `https://github.com/o/r/issues/${number}`,
  repo: 'o/r',
  nameWithOwner: 'o/r',
  projectItemId: `PVTI_${number}`,
  itemId: `PVTI_${number}`,
  isPr: false,
  story: 'Story',
  status: null,
  nextActionDate: null,
  nextActionHour: null,
  dependedIssueUrls: [],
  labels: [],
  createdAt: '2026-06-10T00:00:00.000Z',
  ...overrides,
});

const buildCaches = (): ConsoleCaches => {
  const never = () => new Promise<never>(() => {});
  return {
    client: {} as ConsoleCaches['client'],
    body: new ResourceCache<string>(never),
    comments: new ResourceCache(never),
    files: new ResourceCache(never),
    commits: new ResourceCache(never),
    relatedPrs: new ResourceCache(never),
    state: new ResourceCache(never),
    prStatus: new ResourceCache(never),
  };
};

describe('useConsoleDetailPrefetch', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    const idleWindow = window as unknown as Record<string, unknown>;
    idleWindow.requestIdleCallback = undefined;
    idleWindow.cancelIdleCallback = undefined;
  });

  afterEach(() => {
    jest.runAllTimers();
    jest.useRealTimers();
  });

  it('prefetches the next items after the idle defer elapses', () => {
    const caches = buildCaches();
    const bodyPrefetch = jest.spyOn(caches.body, 'prefetch');
    const relatedPrefetch = jest.spyOn(caches.relatedPrs, 'prefetch');
    const items = [makeItem(1), makeItem(2), makeItem(3)];
    renderHook(() => useConsoleDetailPrefetch(caches, items[0], items));

    expect(bodyPrefetch).not.toHaveBeenCalled();
    jest.runAllTimers();

    expect(bodyPrefetch).toHaveBeenCalledWith('o/r#2', items[1].url);
    expect(bodyPrefetch).toHaveBeenCalledWith('o/r#3', items[2].url);
    expect(relatedPrefetch).toHaveBeenCalledWith('o/r#2', items[1].url);
  });

  it('prefetches PR resources for pull request items', () => {
    const caches = buildCaches();
    const filesPrefetch = jest.spyOn(caches.files, 'prefetch');
    const prStatusPrefetch = jest.spyOn(caches.prStatus, 'prefetch');
    const items = [
      makeItem(1),
      makeItem(2, { isPr: true, url: 'https://github.com/o/r/pull/2' }),
    ];
    renderHook(() => useConsoleDetailPrefetch(caches, items[0], items));
    jest.runAllTimers();

    expect(filesPrefetch).toHaveBeenCalledWith('o/r#2', items[1].url);
    expect(prStatusPrefetch).toHaveBeenCalledWith('o/r#2', items[1].url);
  });

  it('limits prefetch to the next ten items', () => {
    const caches = buildCaches();
    const bodyPrefetch = jest.spyOn(caches.body, 'prefetch');
    const items = Array.from({ length: 15 }, (_unused, index) =>
      makeItem(index + 1),
    );
    renderHook(() => useConsoleDetailPrefetch(caches, items[0], items));
    jest.runAllTimers();

    expect(bodyPrefetch).toHaveBeenCalledTimes(10);
  });

  it('does nothing when no item is selected', () => {
    const caches = buildCaches();
    const bodyPrefetch = jest.spyOn(caches.body, 'prefetch');
    const items = [makeItem(1), makeItem(2)];
    renderHook(() => useConsoleDetailPrefetch(caches, null, items));
    jest.runAllTimers();

    expect(bodyPrefetch).not.toHaveBeenCalled();
  });

  it('does not prefetch when the selected item is the last in the list', () => {
    const caches = buildCaches();
    const bodyPrefetch = jest.spyOn(caches.body, 'prefetch');
    const items = [makeItem(1), makeItem(2)];
    renderHook(() => useConsoleDetailPrefetch(caches, items[1], items));
    jest.runAllTimers();

    expect(bodyPrefetch).not.toHaveBeenCalled();
  });
});
