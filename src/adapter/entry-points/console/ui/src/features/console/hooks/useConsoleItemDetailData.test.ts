import { renderHook, waitFor } from '@testing-library/react';
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

  it('returns defaults when no item is selected', () => {
    const caches = buildCaches([]);
    const { result } = renderHook(() => useConsoleItemDetailData(caches, null));
    expect(result.current.body).toBe('');
    expect(result.current.relatedPullRequests).toEqual([]);
  });
});
