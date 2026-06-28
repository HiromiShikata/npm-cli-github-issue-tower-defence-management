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
  story: 'Story',
  status: null,
  nextActionDate: null,
  nextActionHour: null,
  dependedIssueUrls: [],
  labels: [],
  createdAt: '2026-06-10T00:00:00.000Z',
};

const issueItem: ConsoleListItem = {
  ...prItem,
  isPr: false,
  url: 'https://github.com/o/r/issues/2',
  number: 2,
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

describe('useConsoleItemDetailData', () => {
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

  it('returns defaults when no item is selected', () => {
    const caches = buildCaches([]);
    const { result } = renderHook(() => useConsoleItemDetailData(caches, null));
    expect(result.current.body).toBe('');
    expect(result.current.relatedPullRequests).toEqual([]);
  });
});
