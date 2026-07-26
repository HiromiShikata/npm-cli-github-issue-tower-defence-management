import { renderHook, waitFor } from '@testing-library/react';
import { ResourceCache } from '../lib/resourceCache';
import type { ConsoleIssueState } from '../logic/types';
import { useConsoleReferenceLink } from './useConsoleReferenceLink';

const buildState = (title: string): ConsoleIssueState => ({
  state: 'open',
  merged: false,
  isPullRequest: true,
  title,
});

describe('useConsoleReferenceLink', () => {
  const url = 'https://github.com/octo/repo/pull/7';

  it('returns null then the resolved state', async () => {
    const cache = new ResourceCache<ConsoleIssueState>(async () =>
      buildState('Decorate links'),
    );
    const { result } = renderHook(() => useConsoleReferenceLink(cache, url));
    expect(result.current).toBeNull();
    await waitFor(() => {
      expect(result.current?.title).toBe('Decorate links');
    });
  });

  it('returns null when the fetch fails', async () => {
    const cache = new ResourceCache<ConsoleIssueState>(async () => {
      throw new Error('boom');
    });
    const { result } = renderHook(() => useConsoleReferenceLink(cache, url));
    await waitFor(() => {
      expect(cache.has(url)).toBe(false);
    });
    expect(result.current).toBeNull();
  });

  it('reuses an already cached value without refetching', () => {
    const fetcher = jest.fn(async () => buildState('cached'));
    const cache = new ResourceCache<ConsoleIssueState>(fetcher);
    cache.load(url, url);
    return cache.load(url, url).then(() => {
      const { result } = renderHook(() => useConsoleReferenceLink(cache, url));
      expect(result.current?.title).toBe('cached');
      expect(fetcher).toHaveBeenCalledTimes(1);
    });
  });
});
