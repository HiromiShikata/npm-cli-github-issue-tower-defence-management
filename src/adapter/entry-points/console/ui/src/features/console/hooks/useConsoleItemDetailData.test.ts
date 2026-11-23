import { act, renderHook, waitFor } from '@testing-library/react';
import { ConsoleNetworkError } from '../lib/consoleApi';
import { ResourceCache } from '../lib/resourceCache';
import type {
  ConsoleChangedFile,
  ConsoleComment,
  ConsoleCommit,
  ConsoleIssueState,
  ConsoleListItem,
  ConsolePullRequestStatus,
  ConsoleRelatedPullRequest,
} from '../logic/types';
import type { ConsoleCaches } from './useConsoleCaches';
import { useConsoleItemDetailData } from './useConsoleItemDetailData';

const prItem: ConsoleListItem = {
  number: 1,
  title: 'PR',
  url: 'https://github.com/o/r/pull/1',
  repo: 'o/r',
  nameWithOwner: 'o/r',
  projectItemId: 'PVTI_1',
  itemId: 'PVTI_1',
  isPr: true,
  relatedOpenPullRequestUrls: [],
  story: 'Story',
  status: null,
  agent: null,
  nextActionDate: null,
  nextActionHour: null,
  dependedIssueUrls: [],
  labels: [],
  createdAt: '2026-06-10T00:00:00.000Z',
};

const issueItem: ConsoleListItem = {
  ...prItem,
  isPr: false,
  relatedOpenPullRequestUrls: ['https://github.com/o/r/pull/9'],
  url: 'https://github.com/o/r/issues/2',
  number: 2,
};

const issueItemWithoutRelatedPullRequests: ConsoleListItem = {
  ...issueItem,
  relatedOpenPullRequestUrls: [],
  url: 'https://github.com/o/r/issues/3',
  number: 3,
};

const buildCaches = (related: ConsoleRelatedPullRequest[]): ConsoleCaches => {
  const client = {
    fetchItemBody: async () => 'body',
    fetchComments: async (): Promise<ConsoleComment[]> => [],
    fetchPrFiles: async (): Promise<ConsoleChangedFile[]> => [
      {
        path: 'a.ts',
        additions: 1,
        deletions: 0,
        status: 'added',
        patch: null,
        rawUrl: null,
      },
    ],
    fetchPrCommits: async (): Promise<ConsoleCommit[]> => [
      {
        sha: 'abc',
        message: 'm',
        author: 'a',
        authoredAt: '2026-06-10T00:00:00.000Z',
      },
    ],
    fetchRelatedPrs: async (): Promise<ConsoleRelatedPullRequest[]> => related,
    fetchIssueState: async (): Promise<ConsoleIssueState> => ({
      state: 'open',
      merged: false,
      isPullRequest: true,
      title: 'Console item detail fixture title',
      stateReason: '',
    }),
    fetchPullRequestStatus: async (): Promise<ConsolePullRequestStatus> => ({
      found: true,
      isConflicted: true,
      mergeableStatus: 'CONFLICTING',
      isPassedAllCiJob: false,
      isCiStateSuccess: false,
      isBranchOutOfDate: true,
      missingRequiredCheckNames: ['build'],
    }),
  };
  return {
    client,
    body: new ResourceCache(client.fetchItemBody),
    comments: new ResourceCache(client.fetchComments),
    files: new ResourceCache(client.fetchPrFiles),
    commits: new ResourceCache(client.fetchPrCommits),
    relatedPrs: new ResourceCache(client.fetchRelatedPrs),
    state: new ResourceCache(client.fetchIssueState),
    prStatus: new ResourceCache(client.fetchPullRequestStatus),
  };
};

const buildFailingCaches = (): ConsoleCaches => {
  const caches = buildCaches([]);
  return {
    ...caches,
    relatedPrs: new ResourceCache<ConsoleRelatedPullRequest[]>(() =>
      Promise.reject(new Error('related pull request read failed')),
    ),
    state: new ResourceCache<ConsoleIssueState>(() =>
      Promise.reject(new Error('state read failed')),
    ),
    prStatus: new ResourceCache<ConsolePullRequestStatus>(() =>
      Promise.reject(new Error('pull request status read failed')),
    ),
  };
};

describe('useConsoleItemDetailData', () => {
  it('exposes the related pull request read failure for an issue item', async () => {
    const caches = buildFailingCaches();
    const { result } = renderHook(() =>
      useConsoleItemDetailData(caches, issueItem),
    );
    await waitFor(() => {
      expect(result.current.relatedPullRequestsError).toBe(
        'related pull request read failed',
      );
    });
    expect(result.current.relatedPullRequests).toEqual([]);
    expect(result.current.stateError).toBe('state read failed');
  });

  it('exposes the pull request status read failure for a PR item', async () => {
    const caches = buildFailingCaches();
    const { result } = renderHook(() =>
      useConsoleItemDetailData(caches, prItem),
    );
    await waitFor(() => {
      expect(result.current.pullRequestStatusError).toBe(
        'pull request status read failed',
      );
    });
  });

  it('loads body, files and commits for a PR item', async () => {
    const caches = buildCaches([]);
    const { result } = renderHook(() =>
      useConsoleItemDetailData(caches, prItem),
    );
    await waitFor(() => {
      expect(result.current.body).toBe('body');
      expect(result.current.files.length).toBe(1);
      expect(result.current.commits.length).toBe(1);
      expect(result.current.pullRequestStatus?.found).toBe(true);
      expect(result.current.pullRequestStatus?.isConflicted).toBe(true);
    });
  });

  it('does not expose pull request status for an issue item', () => {
    const caches = buildCaches([]);
    const { result } = renderHook(() =>
      useConsoleItemDetailData(caches, issueItem),
    );
    expect(result.current.pullRequestStatus).toBeNull();
  });

  it('loads related pull request views for an issue item', async () => {
    const related: ConsoleRelatedPullRequest[] = [
      {
        url: 'https://github.com/o/r/pull/9',
        branchName: 'feat',
        createdAt: '2026-06-10T00:00:00.000Z',
        isDraft: false,
        isConflicted: false,
        mergeableStatus: 'MERGEABLE',
        isPassedAllCiJob: true,
        isCiStateSuccess: true,
        isResolvedAllReviewComments: true,
        isBranchOutOfDate: false,
        missingRequiredCheckNames: [],
        ciStatusAvailability: 'AVAILABLE',
        summary: {
          title: 'Linked PR',
          body: 'body',
          additions: 5,
          deletions: 1,
          changedFiles: 2,
        },
      },
    ];
    const caches = buildCaches(related);
    const { result } = renderHook(() =>
      useConsoleItemDetailData(caches, issueItem),
    );
    await waitFor(() => {
      expect(result.current.relatedPullRequests.length).toBe(1);
      expect(result.current.relatedPullRequests[0].filesAreLoading).toBe(false);
    });
    expect(result.current.relatedPullRequests[0].files.length).toBe(1);
  });

  it('reads no related pull requests for an issue the board lists no open pull request for', async () => {
    const fetchRelatedPrs = jest.fn(
      async (): Promise<ConsoleRelatedPullRequest[]> => [],
    );
    const caches: ConsoleCaches = {
      ...buildCaches([]),
      relatedPrs: new ResourceCache<ConsoleRelatedPullRequest[]>(
        fetchRelatedPrs,
      ),
    };
    const { result } = renderHook(() =>
      useConsoleItemDetailData(caches, issueItemWithoutRelatedPullRequests),
    );

    await waitFor(() => {
      expect(result.current.body).toBe('body');
    });

    expect(fetchRelatedPrs).not.toHaveBeenCalled();
    expect(result.current.relatedPullRequests).toEqual([]);
    expect(result.current.relatedPullRequestsError).toBeNull();
  });

  it('reads related pull requests for a prs-tab item even when the board lists none', async () => {
    const fetchRelatedPrs = jest.fn(
      async (): Promise<ConsoleRelatedPullRequest[]> => [],
    );
    const caches: ConsoleCaches = {
      ...buildCaches([]),
      relatedPrs: new ResourceCache<ConsoleRelatedPullRequest[]>(
        fetchRelatedPrs,
      ),
    };
    const { result } = renderHook(() =>
      useConsoleItemDetailData(
        caches,
        issueItemWithoutRelatedPullRequests,
        'prs',
      ),
    );

    await waitFor(() => {
      expect(result.current.body).toBe('body');
    });

    expect(fetchRelatedPrs).toHaveBeenCalled();
    expect(result.current.relatedPullRequests).toEqual([]);
    expect(result.current.relatedPullRequestsError).toBeNull();
  });

  it('returns defaults when no item is selected', () => {
    const caches = buildCaches([]);
    const { result } = renderHook(() => useConsoleItemDetailData(caches, null));
    expect(result.current.body).toBe('');
    expect(result.current.relatedPullRequests).toEqual([]);
    expect(result.current.state).toEqual({
      state: 'open',
      merged: false,
      isPullRequest: false,
      title: '',
      stateReason: '',
    });
  });
});

const linkedPullRequest: ConsoleRelatedPullRequest = {
  url: 'https://github.com/o/r/pull/9',
  branchName: 'feat',
  createdAt: '2026-06-10T00:00:00.000Z',
  isDraft: false,
  isConflicted: false,
  mergeableStatus: 'MERGEABLE',
  isPassedAllCiJob: true,
  isCiStateSuccess: true,
  isResolvedAllReviewComments: true,
  isBranchOutOfDate: false,
  missingRequiredCheckNames: [],
  ciStatusAvailability: 'AVAILABLE',
  summary: {
    title: 'Linked PR',
    body: 'body',
    additions: 5,
    deletions: 1,
    changedFiles: 2,
  },
};

const changedFileFixture: ConsoleChangedFile[] = [
  {
    path: 'a.ts',
    additions: 1,
    deletions: 0,
    status: 'added',
    patch: null,
    rawUrl: null,
  },
];

const commitFixture: ConsoleCommit[] = [
  {
    sha: 'abc',
    message: 'm',
    author: 'a',
    authoredAt: '2026-06-10T00:00:00.000Z',
  },
];

const networkFailureMessage = 'Failed to fetch';

const buildRelatedReadCaches = (
  fetchPrFiles: (url: string) => Promise<ConsoleChangedFile[]>,
  fetchPrCommits: (url: string) => Promise<ConsoleCommit[]>,
): ConsoleCaches => ({
  ...buildCaches([linkedPullRequest]),
  files: new ResourceCache<ConsoleChangedFile[]>(fetchPrFiles),
  commits: new ResourceCache<ConsoleCommit[]>(fetchPrCommits),
});

const advanceTimersBy = async (ms: number): Promise<void> => {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
};

describe('useConsoleItemDetailData related pull request read retry', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    Reflect.deleteProperty(document, 'visibilityState');
    jest.useRealTimers();
  });

  const retryBackoffCases: Array<{ retryNumber: number; delayMs: number }> = [
    { retryNumber: 1, delayMs: 1000 },
    { retryNumber: 2, delayMs: 2000 },
    { retryNumber: 3, delayMs: 4000 },
    { retryNumber: 4, delayMs: 8000 },
    { retryNumber: 5, delayMs: 16000 },
    { retryNumber: 6, delayMs: 30000 },
    { retryNumber: 7, delayMs: 30000 },
  ];

  it('retries failed related pull request file and commit reads on the backoff schedule capped at the maximum delay', async () => {
    const fetchPrFiles = jest
      .fn(async (): Promise<ConsoleChangedFile[]> => changedFileFixture)
      .mockRejectedValue(new ConsoleNetworkError(networkFailureMessage));
    const fetchPrCommits = jest
      .fn(async (): Promise<ConsoleCommit[]> => commitFixture)
      .mockRejectedValue(new ConsoleNetworkError(networkFailureMessage));
    const caches = buildRelatedReadCaches(fetchPrFiles, fetchPrCommits);
    const { result } = renderHook(() =>
      useConsoleItemDetailData(caches, issueItem),
    );
    await advanceTimersBy(0);

    expect(result.current.relatedPullRequests[0].filesError).toBe(
      networkFailureMessage,
    );
    expect(result.current.relatedPullRequests[0].commitsError).toBe(
      networkFailureMessage,
    );

    for (const retryCase of retryBackoffCases) {
      expect(fetchPrFiles).toHaveBeenCalledTimes(retryCase.retryNumber);
      expect(fetchPrCommits).toHaveBeenCalledTimes(retryCase.retryNumber);

      await advanceTimersBy(retryCase.delayMs - 1);
      expect(fetchPrFiles).toHaveBeenCalledTimes(retryCase.retryNumber);
      expect(fetchPrCommits).toHaveBeenCalledTimes(retryCase.retryNumber);

      await advanceTimersBy(1);
      expect(fetchPrFiles).toHaveBeenCalledTimes(retryCase.retryNumber + 1);
      expect(fetchPrCommits).toHaveBeenCalledTimes(retryCase.retryNumber + 1);
      expect(result.current.relatedPullRequests[0].filesError).toBe(
        networkFailureMessage,
      );
      expect(result.current.relatedPullRequests[0].commitsError).toBe(
        networkFailureMessage,
      );
    }
  });

  it('clears the errors and shows the data when a related pull request read succeeds on retry', async () => {
    const fetchPrFiles = jest
      .fn(async (): Promise<ConsoleChangedFile[]> => changedFileFixture)
      .mockRejectedValueOnce(new ConsoleNetworkError(networkFailureMessage));
    const fetchPrCommits = jest
      .fn(async (): Promise<ConsoleCommit[]> => commitFixture)
      .mockRejectedValueOnce(new ConsoleNetworkError(networkFailureMessage));
    const caches = buildRelatedReadCaches(fetchPrFiles, fetchPrCommits);
    const { result } = renderHook(() =>
      useConsoleItemDetailData(caches, issueItem),
    );
    await advanceTimersBy(0);
    expect(result.current.relatedPullRequests[0].filesError).toBe(
      networkFailureMessage,
    );

    await advanceTimersBy(1000);

    expect(fetchPrFiles).toHaveBeenCalledTimes(2);
    expect(fetchPrCommits).toHaveBeenCalledTimes(2);
    expect(result.current.relatedPullRequests[0].filesError).toBeNull();
    expect(result.current.relatedPullRequests[0].filesAreLoading).toBe(false);
    expect(result.current.relatedPullRequests[0].files.length).toBe(1);
    expect(result.current.relatedPullRequests[0].commitsError).toBeNull();
    expect(result.current.relatedPullRequests[0].commits.length).toBe(1);
  });

  it('re-fetches failed related pull request reads immediately when the window comes online', async () => {
    const fetchPrFiles = jest
      .fn(async (): Promise<ConsoleChangedFile[]> => changedFileFixture)
      .mockRejectedValueOnce(new ConsoleNetworkError(networkFailureMessage));
    const fetchPrCommits = jest
      .fn(async (): Promise<ConsoleCommit[]> => commitFixture)
      .mockRejectedValueOnce(new ConsoleNetworkError(networkFailureMessage));
    const caches = buildRelatedReadCaches(fetchPrFiles, fetchPrCommits);
    const { result } = renderHook(() =>
      useConsoleItemDetailData(caches, issueItem),
    );
    await advanceTimersBy(0);
    expect(result.current.relatedPullRequests[0].filesError).toBe(
      networkFailureMessage,
    );

    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    await advanceTimersBy(0);

    expect(fetchPrFiles).toHaveBeenCalledTimes(2);
    expect(fetchPrCommits).toHaveBeenCalledTimes(2);
    expect(result.current.relatedPullRequests[0].filesError).toBeNull();
    expect(result.current.relatedPullRequests[0].files.length).toBe(1);
    expect(result.current.relatedPullRequests[0].commitsError).toBeNull();
    expect(result.current.relatedPullRequests[0].commits.length).toBe(1);
  });

  const visibilityCases: Array<{
    visibilityState: DocumentVisibilityState;
    expectedFetchCalls: number;
  }> = [
    { visibilityState: 'hidden', expectedFetchCalls: 1 },
    { visibilityState: 'visible', expectedFetchCalls: 2 },
  ];

  it('re-fetches a failed related pull request read immediately when the document becomes visible and not when hidden', async () => {
    for (const visibilityCase of visibilityCases) {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => visibilityCase.visibilityState,
      });
      const fetchPrFiles = jest
        .fn(async (): Promise<ConsoleChangedFile[]> => changedFileFixture)
        .mockRejectedValueOnce(new ConsoleNetworkError(networkFailureMessage));
      const caches = buildRelatedReadCaches(fetchPrFiles, async () => commitFixture);
      const { result, unmount } = renderHook(() =>
        useConsoleItemDetailData(caches, issueItem),
      );
      await advanceTimersBy(0);
      expect(result.current.relatedPullRequests[0].filesError).toBe(
        networkFailureMessage,
      );

      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });
      await advanceTimersBy(0);

      expect(fetchPrFiles).toHaveBeenCalledTimes(visibilityCase.expectedFetchCalls);
      unmount();
      Reflect.deleteProperty(document, 'visibilityState');
    }
  });

  it('keeps a related pull request read error and does not retry it when the error is not a network error', async () => {
    const httpError = new Error('HTTP 502');
    const fetchPrFiles = jest.fn(async (): Promise<ConsoleChangedFile[]> => {
      throw httpError;
    });
    const fetchPrCommits = jest.fn(async (): Promise<ConsoleCommit[]> => {
      throw httpError;
    });
    const caches = buildRelatedReadCaches(fetchPrFiles, fetchPrCommits);
    const { result } = renderHook(() =>
      useConsoleItemDetailData(caches, issueItem),
    );
    await advanceTimersBy(0);
    expect(result.current.relatedPullRequests[0].filesError).toBe('HTTP 502');
    expect(result.current.relatedPullRequests[0].commitsError).toBe('HTTP 502');

    await advanceTimersBy(600000);

    expect(fetchPrFiles).toHaveBeenCalledTimes(1);
    expect(fetchPrCommits).toHaveBeenCalledTimes(1);
    expect(result.current.relatedPullRequests[0].filesError).toBe('HTTP 502');
    expect(result.current.relatedPullRequests[0].commitsError).toBe('HTTP 502');
  });

  it('stops the pending retries of related pull request reads when the component unmounts', async () => {
    const fetchPrFiles = jest
      .fn(async (): Promise<ConsoleChangedFile[]> => changedFileFixture)
      .mockRejectedValue(new ConsoleNetworkError(networkFailureMessage));
    const caches = buildRelatedReadCaches(fetchPrFiles, async () => commitFixture);
    const { unmount } = renderHook(() =>
      useConsoleItemDetailData(caches, issueItem),
    );
    await advanceTimersBy(0);
    await advanceTimersBy(1000);
    expect(fetchPrFiles).toHaveBeenCalledTimes(2);

    unmount();
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    await advanceTimersBy(600000);

    expect(fetchPrFiles).toHaveBeenCalledTimes(2);
  });

  it('stops the pending retries of related pull request reads when the item changes', async () => {
    const fetchPrFiles = jest
      .fn(async (): Promise<ConsoleChangedFile[]> => changedFileFixture)
      .mockRejectedValue(new ConsoleNetworkError(networkFailureMessage));
    const caches = buildRelatedReadCaches(fetchPrFiles, async () => commitFixture);
    const { rerender } = renderHook(
      ({ item }: { item: ConsoleListItem }) =>
        useConsoleItemDetailData(caches, item),
      { initialProps: { item: issueItem } },
    );
    await advanceTimersBy(0);
    await advanceTimersBy(1000);
    expect(fetchPrFiles).toHaveBeenCalledTimes(2);

    rerender({ item: issueItemWithoutRelatedPullRequests });
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    await advanceTimersBy(600000);

    expect(fetchPrFiles).toHaveBeenCalledTimes(2);
  });
});
