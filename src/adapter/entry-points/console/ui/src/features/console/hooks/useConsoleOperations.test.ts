import { act, renderHook } from '@testing-library/react';
import { overlayStorageKey } from '../logic/overlay';
import {
  consoleListItemsFixture,
  consoleStatusOptionsFixture,
} from '../testing/fixtures';
import { useConsoleOperations } from './useConsoleOperations';
import { useConsoleOverlay } from './useConsoleOverlay';

const prItem = consoleListItemsFixture[0];
const issueItem = consoleListItemsFixture[2];

const captureFetch = (): jest.Mock => {
  const fetchMock = jest.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ ok: true }),
  }));
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
};

const lastBody = (fetchMock: jest.Mock): Record<string, unknown> =>
  JSON.parse((fetchMock.mock.calls.at(-1)?.[1] as { body: string }).body);

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
    expect(fetchMock.mock.calls[0][0]).toBe('/api/review?k=token');
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
    expect(fetchMock.mock.calls[0][0]).toBe('/api/triage?k=token');
    expect(lastBody(fetchMock)).toMatchObject({
      pjcode: 'umino',
      action: 'close_not_planned',
      issueUrl: issueItem.url,
    });
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
    expect(fetchMock.mock.calls[0][0]).toBe('/api/intmux?k=token');
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
    expect(fetchMock.mock.calls[0][0]).toBe('/api/comment?k=token');
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
    expect(fetchMock.mock.calls[0][0]).toBe('/api/reviewcomment?k=token');
    expect(lastBody(fetchMock)).toEqual({
      pjcode: 'umino',
      url: prItem.url,
      path: 'src/index.ts',
      line: 42,
      side: 'RIGHT',
      body: 'Consider extracting this into a helper.',
    });
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
