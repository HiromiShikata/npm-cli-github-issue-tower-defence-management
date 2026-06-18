import { renderHook, waitFor } from '@testing-library/react';
import {
  consoleItemBodyFixture,
  consoleListItemsFixture,
  consolePullRequestDetailFixture,
  consoleRelatedPullRequestsFixture,
} from '../fixtures';
import type { ConsoleItemCache } from './consoleItemCache';
import { useConsoleItemDetail } from './useConsoleItemDetail';

const createCache = (
  overrides: Partial<ConsoleItemCache> = {},
): ConsoleItemCache => ({
  getItemBody: jest.fn(async () => consoleItemBodyFixture),
  getComments: jest.fn(async () => consoleItemBodyFixture.comments),
  getRelatedPullRequests: jest.fn(async () => []),
  getPullRequestDetail: jest.fn(async () => null),
  ...overrides,
});

describe('useConsoleItemDetail', () => {
  it('loads body and comments for the selected item', async () => {
    const cache = createCache();
    const { result } = renderHook(() =>
      useConsoleItemDetail(cache, consoleListItemsFixture[2]),
    );
    await waitFor(() => expect(result.current.isBodyLoading).toBe(false));
    expect(result.current.body).toBe(consoleItemBodyFixture.body);
    expect(result.current.comments).toHaveLength(
      consoleItemBodyFixture.comments.length,
    );
  });

  it('loads the pull request detail directly for a PR item', async () => {
    const cache = createCache({
      getPullRequestDetail: jest.fn(async () => ({
        ...consolePullRequestDetailFixture,
        files: [],
        commits: [],
      })),
    });
    const { result } = renderHook(() =>
      useConsoleItemDetail(cache, consoleListItemsFixture[0]),
    );
    await waitFor(() =>
      expect(result.current.pullRequestDetail).not.toBeNull(),
    );
    expect(cache.getRelatedPullRequests).not.toHaveBeenCalled();
  });

  it('resolves the linked pull request for a task item with a related PR', async () => {
    const cache = createCache({
      getRelatedPullRequests: jest.fn(
        async () => consoleRelatedPullRequestsFixture,
      ),
      getPullRequestDetail: jest.fn(async () => ({
        ...consolePullRequestDetailFixture,
        files: [],
        commits: [],
      })),
    });
    const { result } = renderHook(() =>
      useConsoleItemDetail(cache, consoleListItemsFixture[1]),
    );
    await waitFor(() =>
      expect(result.current.relatedPullRequests).toHaveLength(1),
    );
    await waitFor(() =>
      expect(result.current.pullRequestDetail).not.toBeNull(),
    );
  });

  it('resets to the initial state when no item is selected', async () => {
    const cache = createCache();
    const { result } = renderHook(() => useConsoleItemDetail(cache, null));
    expect(result.current.body).toBe('');
    expect(cache.getItemBody).not.toHaveBeenCalled();
  });
});
