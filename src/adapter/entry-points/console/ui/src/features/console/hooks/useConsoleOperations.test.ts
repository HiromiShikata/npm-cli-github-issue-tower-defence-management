import { act, renderHook } from '@testing-library/react';
import { ResourceCache } from '../lib/resourceCache';
import { overlayStorageKey } from '../logic/overlay';
import {
  consoleListItemsFixture,
  consoleStatusOptionsFixture,
} from '../testing/fixtures';
import type { ConsoleCaches } from './useConsoleCaches';
import { useConsoleOperations } from './useConsoleOperations';
import { useConsoleOverlay } from './useConsoleOverlay';

const prItem = consoleListItemsFixture[0];
const issueItem = consoleListItemsFixture[2];

const buildOperationCaches = (): ConsoleCaches => {
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

const captureFetch = (): jest.Mock => {
  const fetchMock = jest.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ ok: true }),
  }));
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
};

const lastBody = (fetchMock: jest.Mock): Record<string, unknown> => {
  const lastCall = fetchMock.mock.calls.at(-1);
  if (!lastCall) throw new Error('No fetch calls found');
  return JSON.parse((lastCall[1] as { body: string }).body);
};

const setup = () => {
  localStorage.clear();
  window.history.replaceState({}, '', '/projects/umino/prs?k=token');
  return renderHook(() => {
    const overlay = useConsoleOverlay('umino');
    const operations = useConsoleOperations('umino', 'prs', overlay);
    return { overlay, operations };
  });
};

describe('useConsoleOperations', () => {
  it('posts a totally wrong review as a close with the totally wrong comment body', async () => {
    const fetchMock = captureFetch();
    const { result } = setup();
    await act(async () => {
      await result.current.operations.reviewPullRequest(
        prItem,
        prItem.url,
        'totally_wrong',
      );
    });
    expect(fetchMock.mock.calls[0][0]).toBe('/api/review');
    expect(lastBody(fetchMock)).toMatchObject({
      pjcode: 'umino',
      action: 'close',
      prUrl: prItem.url,
      commentBody: 'totally wrong',
    });
  });

  it('posts an unnecessary review as a close with the unnecessary comment body', async () => {
    const fetchMock = captureFetch();
    const { result } = setup();
    await act(async () => {
      await result.current.operations.reviewPullRequest(
        prItem,
        prItem.url,
        'unnecessary',
      );
    });
    expect(lastBody(fetchMock)).toMatchObject({
      action: 'close',
      commentBody: 'This pull request is unnecessary.',
    });
  });

  it('posts an approve review and marks the item done in the overlay', async () => {
    captureFetch();
    const { result } = setup();
    await act(async () => {
      await result.current.operations.reviewPullRequest(
        prItem,
        prItem.url,
        'approve',
      );
    });
    const stored = JSON.parse(
      localStorage.getItem(overlayStorageKey('umino')) ?? '{}',
    );
    expect(stored[prItem.projectItemId].done).toBe(true);
  });

  it('posts a not-planned close through the triage endpoint', async () => {
    const fetchMock = captureFetch();
    const { result } = setup();
    await act(async () => {
      await result.current.operations.closeIssue(
        issueItem,
        'close_not_planned',
      );
    });
    expect(fetchMock.mock.calls[0][0]).toBe('/api/triage');
    expect(lastBody(fetchMock)).toMatchObject({
      pjcode: 'umino',
      action: 'close_not_planned',
      issueUrl: issueItem.url,
    });
  });

  it('posts a pull-request close through the triage endpoint with the pull-request url and resolves', async () => {
    const fetchMock = captureFetch();
    const { result } = setup();
    await act(async () => {
      await result.current.operations.closeIssue(prItem, 'close');
    });
    expect(fetchMock.mock.calls[0][0]).toBe('/api/triage');
    expect(lastBody(fetchMock)).toMatchObject({
      pjcode: 'umino',
      action: 'close',
      issueUrl: prItem.url,
    });
    expect(prItem.url).toContain('/pull/');
    const stored = JSON.parse(
      localStorage.getItem(overlayStorageKey('umino')) ?? '{}',
    );
    expect(stored[prItem.projectItemId].done).toBe(true);
  });

  it('posts set_status and records the overlay status', async () => {
    const fetchMock = captureFetch();
    const { result } = setup();
    const option = consoleStatusOptionsFixture[1];
    await act(async () => {
      await result.current.operations.setStatus(issueItem, option);
    });
    expect(lastBody(fetchMock)).toMatchObject({
      action: 'set_status',
      statusName: option.name,
    });
    const stored = JSON.parse(
      localStorage.getItem(overlayStorageKey('umino')) ?? '{}',
    );
    expect(stored[issueItem.projectItemId].status.name).toBe(option.name);
  });

  it('posts set_intmux through the intmux endpoint', async () => {
    const fetchMock = captureFetch();
    const { result } = setup();
    const option = consoleStatusOptionsFixture[5];
    await act(async () => {
      await result.current.operations.setInTmuxByHuman(issueItem, option);
    });
    expect(fetchMock.mock.calls[0][0]).toBe('/api/intmux');
    expect(lastBody(fetchMock)).toMatchObject({
      pjcode: 'umino',
      action: 'set_intmux',
    });
  });

  it('marks done on snooze outside the todo-by-human tab so the item disappears immediately', async () => {
    captureFetch();
    const { result } = setup();
    await act(async () => {
      await result.current.operations.setNextActionDate(
        issueItem,
        'snooze_1day',
      );
    });
    const stored = JSON.parse(
      localStorage.getItem(overlayStorageKey('umino')) ?? '{}',
    );
    expect(stored[issueItem.projectItemId].done).toBe(true);
  });

  it('marks done on snooze in the todo-by-human tab so the item is skipped', async () => {
    captureFetch();
    localStorage.clear();
    window.history.replaceState(
      {},
      '',
      '/projects/umino/todo-by-human?k=token',
    );
    const { result } = renderHook(() => {
      const overlay = useConsoleOverlay('umino');
      const operations = useConsoleOperations(
        'umino',
        'todo-by-human',
        overlay,
      );
      return { overlay, operations };
    });
    await act(async () => {
      await result.current.operations.setNextActionDate(
        issueItem,
        'snooze_1week',
      );
    });
    const stored = JSON.parse(
      localStorage.getItem(overlayStorageKey('umino')) ?? '{}',
    );
    expect(stored[issueItem.projectItemId].done).toBe(true);
  });

  it('posts a comment to the comment endpoint and returns the created comment', async () => {
    const fetchMock: jest.Mock = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        comment: {
          author: 'HiromiShikata',
          body: 'Thanks for the parity fix.',
          createdAt: '2026-06-18T03:21:00.000Z',
        },
      }),
    }));
    global.fetch = fetchMock as unknown as typeof fetch;
    const { result } = setup();
    let created: Awaited<
      ReturnType<typeof result.current.operations.addComment>
    > | null = null;
    await act(async () => {
      created = await result.current.operations.addComment(
        issueItem,
        'Thanks for the parity fix.',
      );
    });
    expect(fetchMock.mock.calls[0][0]).toBe('/api/comment');
    expect(lastBody(fetchMock)).toMatchObject({
      pjcode: 'umino',
      url: issueItem.url,
      body: 'Thanks for the parity fix.',
    });
    expect(created).toEqual({
      author: 'HiromiShikata',
      body: 'Thanks for the parity fix.',
      createdAt: '2026-06-18T03:21:00.000Z',
    });
  });

  it('posts a line-anchored inline review comment to the reviewcomment endpoint', async () => {
    const fetchMock = captureFetch();
    const { result } = setup();
    await act(async () => {
      await result.current.operations.addInlineReviewComment(
        prItem.url,
        'src/index.ts',
        42,
        'RIGHT',
        'Consider extracting this into a helper.',
      );
    });
    expect(fetchMock.mock.calls[0][0]).toBe('/api/reviewcomment');
    expect(lastBody(fetchMock)).toEqual({
      pjcode: 'umino',
      url: prItem.url,
      path: 'src/index.ts',
      line: 42,
      side: 'RIGHT',
      body: 'Consider extracting this into a helper.',
    });
  });

  it('sends the entered inline comment as the request-changes body and anchor', async () => {
    const fetchMock = captureFetch();
    const { result } = setup();
    await act(async () => {
      await result.current.operations.reviewPullRequest(
        prItem,
        prItem.url,
        'request_changes',
        [
          {
            path: 'src/index.ts',
            line: 17,
            side: 'RIGHT',
            body: 'Please rename this variable.',
          },
        ],
      );
    });
    expect(fetchMock.mock.calls[0][0]).toBe('/api/review');
    expect(lastBody(fetchMock)).toMatchObject({
      pjcode: 'umino',
      action: 'request_changes',
      prUrl: prItem.url,
      commentBody: 'src/index.ts:17 Please rename this variable.',
      changedFilePath: 'src/index.ts',
      line: 17,
      side: 'RIGHT',
    });
  });

  it('aggregates multiple entered inline comments into the request-changes body', async () => {
    const fetchMock = captureFetch();
    const { result } = setup();
    await act(async () => {
      await result.current.operations.reviewPullRequest(
        prItem,
        prItem.url,
        'request_changes',
        [
          {
            path: 'src/a.ts',
            line: 3,
            side: 'RIGHT',
            body: 'First concern.',
          },
          {
            path: 'src/b.ts',
            line: 9,
            side: 'LEFT',
            body: 'Second concern.',
          },
        ],
      );
    });
    expect(lastBody(fetchMock)).toMatchObject({
      action: 'request_changes',
      commentBody: 'src/a.ts:3 First concern.\n\nsrc/b.ts:9 Second concern.',
      changedFilePath: 'src/a.ts',
      line: 3,
      side: 'RIGHT',
    });
  });

  it('invalidates the operated item body and comments cache on a review', async () => {
    captureFetch();
    localStorage.clear();
    window.history.replaceState({}, '', '/projects/umino/prs?k=token');
    const caches = buildOperationCaches();
    const bodyInvalidate = jest.spyOn(caches.body, 'invalidate');
    const commentsInvalidate = jest.spyOn(caches.comments, 'invalidate');
    const { result } = renderHook(() => {
      const overlay = useConsoleOverlay('umino');
      const operations = useConsoleOperations('umino', 'prs', overlay, caches);
      return { overlay, operations };
    });
    await act(async () => {
      await result.current.operations.reviewPullRequest(
        prItem,
        prItem.url,
        'approve',
      );
    });
    const key = `${prItem.repo}#${prItem.number}`;
    expect(bodyInvalidate).toHaveBeenCalledWith(key);
    expect(commentsInvalidate).toHaveBeenCalledWith(key);
  });

  it('invalidates the operated item cache after posting a comment', async () => {
    const fetchMock: jest.Mock = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        comment: { author: 'a', body: 'b', createdAt: 'c' },
      }),
    }));
    global.fetch = fetchMock as unknown as typeof fetch;
    localStorage.clear();
    window.history.replaceState({}, '', '/projects/umino/prs?k=token');
    const caches = buildOperationCaches();
    const commentsInvalidate = jest.spyOn(caches.comments, 'invalidate');
    const { result } = renderHook(() => {
      const overlay = useConsoleOverlay('umino');
      const operations = useConsoleOperations('umino', 'prs', overlay, caches);
      return { overlay, operations };
    });
    await act(async () => {
      await result.current.operations.addComment(issueItem, 'hello');
    });
    expect(commentsInvalidate).toHaveBeenCalledWith(
      `${issueItem.repo}#${issueItem.number}`,
    );
  });

  it('rejects an operation and posts nothing when no pjcode is available', async () => {
    const fetchMock = captureFetch();
    localStorage.clear();
    window.history.replaceState({}, '', '/?k=token');
    const { result } = renderHook(() => {
      const overlay = useConsoleOverlay('console');
      const operations = useConsoleOperations(null, 'prs', overlay);
      return { overlay, operations };
    });
    await expect(
      result.current.operations.reviewPullRequest(
        prItem,
        prItem.url,
        'approve',
      ),
    ).rejects.toThrow('No project specified in the URL path.');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
