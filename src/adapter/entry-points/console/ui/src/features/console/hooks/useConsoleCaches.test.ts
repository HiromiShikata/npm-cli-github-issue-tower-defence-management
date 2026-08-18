import { renderHook } from '@testing-library/react';
import type { AirplaneSnapshot } from '../lib/airplaneSnapshot';
import { useConsoleCaches } from './useConsoleCaches';

describe('useConsoleCaches', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, '', '/?k=token');
  });

  it('exposes one cache per resource and a stable identity across renders', () => {
    const { result, rerender } = renderHook(() => useConsoleCaches());
    const first = result.current;
    expect(first.body).toBeDefined();
    expect(first.comments).toBeDefined();
    expect(first.files).toBeDefined();
    expect(first.commits).toBeDefined();
    expect(first.relatedPrs).toBeDefined();
    expect(first.state).toBeDefined();
    rerender();
    expect(result.current).toBe(first);
  });

  it('pre-seeds item detail caches from airplane snapshot so item detail renders with network rejecting', () => {
    const prUrl = 'https://github.com/owner/repo/pull/42';
    const airplaneSnapshot: AirplaneSnapshot = {
      capturedAt: '2026-08-01T10:00:00Z',
      failures: [],
      tabs: {},
      items: {
        [prUrl]: {
          body: 'PR body text',
          comments: [
            {
              author: 'alice',
              body: 'LGTM',
              createdAt: '2026-08-01T09:00:00Z',
            },
          ],
          state: {
            state: 'open',
            merged: false,
            isPullRequest: true,
            title: 'Offline PR',
          },
          files: [
            {
              path: 'src/foo.ts',
              additions: 3,
              deletions: 1,
              status: 'modified',
              patch: '@@ -1 +1 @@\n-old\n+new',
              rawUrl: null,
            },
          ],
          commits: [
            {
              sha: 'abc123',
              message: 'fix: something',
              author: 'alice',
              authoredAt: '2026-08-01T08:00:00Z',
            },
          ],
          prStatus: {
            found: true,
            isConflicted: false,
            mergeableStatus: 'MERGEABLE',
            isPassedAllCiJob: true,
            isCiStateSuccess: true,
            isBranchOutOfDate: false,
            missingRequiredCheckNames: [],
          },
          relatedPrs: null,
        },
      },
    };

    const { result } = renderHook(() => useConsoleCaches(airplaneSnapshot));

    const cacheKey = 'owner/repo#42';
    expect(result.current.body.peek(cacheKey)).toBe('PR body text');

    const comments = result.current.comments.peek(cacheKey);
    expect(comments).toHaveLength(1);
    expect(comments?.[0].author).toBe('alice');

    const files = result.current.files.peek(cacheKey);
    expect(files).toHaveLength(1);
    expect(files?.[0].path).toBe('src/foo.ts');

    const commits = result.current.commits.peek(cacheKey);
    expect(commits).toHaveLength(1);
    expect(commits?.[0].sha).toBe('abc123');

    const prStatus = result.current.prStatus.peek(cacheKey);
    expect(prStatus?.isPassedAllCiJob).toBe(true);
    expect(prStatus?.mergeableStatus).toBe('MERGEABLE');
  });
});
