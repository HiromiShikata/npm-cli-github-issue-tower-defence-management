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
  window.history.replaceState({}, '', '/projects/acme/prs?k=token');
  return renderHook(() => {
    const overlay = useConsoleOverlay('acme');
    const operations = useConsoleOperations('acme', 'prs', overlay);
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
      pjcode: 'acme',
      action: 'close',
      prUrl: prItem.url,
      issueUrl: prItem.url,
      commentBody: 'totally wrong',
    });
  });

  it('posts an unnecessary review carrying the item url so the server can label it chore', async () => {
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
      action: 'unnecessary',
      issueUrl: prItem.url,
      commentBody: 'This pull request is unnecessary.',
    });
  });

  it('posts an unnecessary review carrying the comment the linked issue receives', async () => {
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
      issueCommentBody: `The pull request for this issue was unnecessary and has been closed: ${prItem.url}\n\nDo not create it again.`,
    });
  });

  it('posts an approve review and marks the item done in the overlay', async () => {
    captureFetch();
    const { result } = setup();
    await act(async () => {
      await result.current.operations.reviewPullRequest(
        prItem,
        prItem.url,
        'approve_and_merge',
      );
    });
    const stored = JSON.parse(
      localStorage.getItem(overlayStorageKey('acme')) ?? '{}',
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
      pjcode: 'acme',
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
      pjcode: 'acme',
      action: 'close',
      issueUrl: prItem.url,
    });
    expect(prItem.url).toContain('/pull/');
    const stored = JSON.parse(
      localStorage.getItem(overlayStorageKey('acme')) ?? '{}',
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
      localStorage.getItem(overlayStorageKey('acme')) ?? '{}',
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
      pjcode: 'acme',
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
      localStorage.getItem(overlayStorageKey('acme')) ?? '{}',
    );
    expect(stored[issueItem.projectItemId].done).toBe(true);
  });

  it('marks done on snooze in the todo-by-human tab so the item is skipped', async () => {
    captureFetch();
    localStorage.clear();
    window.history.replaceState({}, '', '/projects/acme/todo-by-human?k=token');
    const { result } = renderHook(() => {
      const overlay = useConsoleOverlay('acme');
      const operations = useConsoleOperations('acme', 'todo-by-human', overlay);
      return { overlay, operations };
    });
    await act(async () => {
      await result.current.operations.setNextActionDate(
        issueItem,
        'snooze_1week',
      );
    });
    const stored = JSON.parse(
      localStorage.getItem(overlayStorageKey('acme')) ?? '{}',
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
      pjcode: 'acme',
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
      pjcode: 'acme',
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
      pjcode: 'acme',
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
    window.history.replaceState({}, '', '/projects/acme/prs?k=token');
    const caches = buildOperationCaches();
    const bodyInvalidate = jest.spyOn(caches.body, 'invalidate');
    const commentsInvalidate = jest.spyOn(caches.comments, 'invalidate');
    const { result } = renderHook(() => {
      const overlay = useConsoleOverlay('acme');
      const operations = useConsoleOperations('acme', 'prs', overlay, caches);
      return { overlay, operations };
    });
    await act(async () => {
      await result.current.operations.reviewPullRequest(
        prItem,
        prItem.url,
        'approve_and_merge',
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
    window.history.replaceState({}, '', '/projects/acme/prs?k=token');
    const caches = buildOperationCaches();
    const commentsInvalidate = jest.spyOn(caches.comments, 'invalidate');
    const { result } = renderHook(() => {
      const overlay = useConsoleOverlay('acme');
      const operations = useConsoleOperations('acme', 'prs', overlay, caches);
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
        'approve_and_merge',
      ),
    ).rejects.toThrow('No project specified in the URL path.');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('posts an ok comment then sets status to awaiting workspace in order', async () => {
    let callCount = 0;
    const calls: Array<[string, unknown]> = [];
    global.fetch = jest.fn(async (url: unknown, opts: unknown) => {
      calls.push([url as string, opts]);
      callCount += 1;
      if (callCount === 1) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            comment: {
              author: 'bot',
              body: 'ok',
              createdAt: '2026-01-01T00:00:00Z',
            },
          }),
        };
      }
      return { ok: true, status: 200, json: async () => ({ ok: true }) };
    }) as unknown as typeof fetch;
    const { result } = setup();
    const [option] = consoleStatusOptionsFixture.filter(
      (o) => o.name.toLowerCase() === 'awaiting workspace',
    );
    await act(async () => {
      await result.current.operations.okAndMoveToAwaitingWorkspace(
        issueItem,
        option,
      );
    });
    expect(calls[0][0]).toBe('/api/comment');
    expect(JSON.parse((calls[0][1] as { body: string }).body)).toMatchObject({
      pjcode: 'acme',
      url: issueItem.url,
      body: 'ok',
    });
    expect(calls[1][0]).toBe('/api/triage');
    expect(JSON.parse((calls[1][1] as { body: string }).body)).toMatchObject({
      pjcode: 'acme',
      action: 'set_status',
      issueUrl: issueItem.url,
      statusName: option.name,
    });
  });

  it('does not call the status endpoint when the comment post fails', async () => {
    let callCount = 0;
    global.fetch = jest.fn(async () => {
      callCount += 1;
      if (callCount === 1) {
        return { ok: false, status: 500, text: async () => 'error' };
      }
      return { ok: true, status: 200, json: async () => ({ ok: true }) };
    }) as unknown as typeof fetch;
    const { result } = setup();
    const [option] = consoleStatusOptionsFixture.filter(
      (o) => o.name.toLowerCase() === 'awaiting workspace',
    );
    await expect(
      act(async () => {
        await result.current.operations.okAndMoveToAwaitingWorkspace(
          issueItem,
          option,
        );
      }),
    ).rejects.toThrow();
    expect(callCount).toBe(1);
  });

  it('marks setStatus overlay done before the API call resolves', async () => {
    let resolveApi!: () => void;
    global.fetch = jest.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveApi = () =>
            resolve({
              ok: true,
              status: 200,
              json: async () => ({ ok: true }),
            } as unknown as Response);
        }),
    ) as unknown as typeof fetch;
    const { result } = setup();
    const option = consoleStatusOptionsFixture[1];

    act(() => {
      void result.current.operations.setStatus(issueItem, option);
    });

    const stored = JSON.parse(
      localStorage.getItem(overlayStorageKey('acme')) ?? '{}',
    );
    expect(stored[issueItem.projectItemId]?.done).toBe(true);

    await act(async () => {
      resolveApi();
      await Promise.resolve();
    });
  });

  it('marks reviewPullRequest overlay done after the API call resolves', async () => {
    let resolveApi!: () => void;
    global.fetch = jest.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveApi = () =>
            resolve({
              ok: true,
              status: 200,
              json: async () => ({ ok: true }),
            } as unknown as Response);
        }),
    ) as unknown as typeof fetch;
    const { result } = setup();

    act(() => {
      void result.current.operations.reviewPullRequest(
        prItem,
        prItem.url,
        'approve_and_merge',
      );
    });

    const storedBefore = JSON.parse(
      localStorage.getItem(overlayStorageKey('acme')) ?? '{}',
    );
    expect(storedBefore[prItem.projectItemId]?.done).not.toBe(true);

    await act(async () => {
      resolveApi();
      await Promise.resolve();
    });

    const storedAfter = JSON.parse(
      localStorage.getItem(overlayStorageKey('acme')) ?? '{}',
    );
    expect(storedAfter[prItem.projectItemId]?.done).toBe(true);
  });

  it('does not mark reviewPullRequest overlay done when the API call fails', async () => {
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 400,
      text: async () =>
        "Cannot merge: this pull request modifies workflow files and the configured token lacks 'workflow' scope. Please merge this pull request manually.",
    })) as unknown as typeof fetch;
    const { result } = setup();

    await act(async () => {
      await expect(
        result.current.operations.reviewPullRequest(
          prItem,
          prItem.url,
          'approve_and_merge',
        ),
      ).rejects.toThrow();
    });

    const stored = JSON.parse(
      localStorage.getItem(overlayStorageKey('acme')) ?? '{}',
    );
    expect(stored[prItem.projectItemId]?.done).not.toBe(true);
  });

  it('marks closeIssue overlay done before the API call resolves', async () => {
    let resolveApi!: () => void;
    global.fetch = jest.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveApi = () =>
            resolve({
              ok: true,
              status: 200,
              json: async () => ({ ok: true }),
            } as unknown as Response);
        }),
    ) as unknown as typeof fetch;
    const { result } = setup();

    act(() => {
      void result.current.operations.closeIssue(issueItem, 'close_not_planned');
    });

    const stored = JSON.parse(
      localStorage.getItem(overlayStorageKey('acme')) ?? '{}',
    );
    expect(stored[issueItem.projectItemId]?.done).toBe(true);

    await act(async () => {
      resolveApi();
      await Promise.resolve();
    });
  });

  it('marks okAndMoveToAwaitingWorkspace overlay done before API calls resolve', async () => {
    let resolveApi!: () => void;
    global.fetch = jest.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveApi = () =>
            resolve({
              ok: true,
              status: 200,
              json: async () => ({
                ok: true,
                comment: {
                  author: 'bot',
                  body: 'ok',
                  createdAt: '2026-01-01T00:00:00Z',
                },
              }),
            } as unknown as Response);
        }),
    ) as unknown as typeof fetch;
    const { result } = setup();
    const [option] = consoleStatusOptionsFixture.filter(
      (o) => o.name.toLowerCase() === 'awaiting workspace',
    );

    act(() => {
      void result.current.operations.okAndMoveToAwaitingWorkspace(
        issueItem,
        option,
      );
    });

    const stored = JSON.parse(
      localStorage.getItem(overlayStorageKey('acme')) ?? '{}',
    );
    expect(stored[issueItem.projectItemId]?.done).toBe(true);

    await act(async () => {
      resolveApi();
      await Promise.resolve();
      resolveApi();
      await Promise.resolve();
    });
  });

  it('calls onAfterMoveToAwaitingWorkspace after the triage API call completes', async () => {
    const apiCallUrls: string[] = [];
    let callbackCalledAfterTriageCount = 0;
    global.fetch = jest.fn(async (url: string) => {
      apiCallUrls.push(url as string);
      if ((url as string).includes('/api/comment')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            comment: {
              author: 'bot',
              body: 'ok',
              createdAt: '2026-01-01T00:00:00Z',
            },
          }),
        };
      }
      return { ok: true, status: 200, json: async () => ({ ok: true }) };
    }) as unknown as typeof fetch;
    const onAfterMoveToAwaitingWorkspace = jest.fn(async () => {
      callbackCalledAfterTriageCount = apiCallUrls.filter((u) =>
        u.includes('/api/triage'),
      ).length;
    });
    localStorage.clear();
    window.history.replaceState({}, '', '/projects/acme/prs?k=token');
    const { result } = renderHook(() => {
      const overlay = useConsoleOverlay('acme');
      const operations = useConsoleOperations(
        'acme',
        'prs',
        overlay,
        undefined,
        onAfterMoveToAwaitingWorkspace,
      );
      return { overlay, operations };
    });
    const [option] = consoleStatusOptionsFixture.filter(
      (o) => o.name.toLowerCase() === 'awaiting workspace',
    );
    await act(async () => {
      await result.current.operations.okAndMoveToAwaitingWorkspace(
        issueItem,
        option,
      );
    });
    expect(onAfterMoveToAwaitingWorkspace).toHaveBeenCalledTimes(1);
    expect(callbackCalledAfterTriageCount).toBe(1);
  });
});
