import { act, renderHook } from '@testing-library/react';
import {
  type ConsoleActionQueue,
  useConsoleActionQueue,
} from './useConsoleActionQueue';

const COMMENT_EXPANDED_PREFIX = 'console-comment-expanded:';

const seedCommentExpandedState = (): void => {
  localStorage.setItem(
    `${COMMENT_EXPANDED_PREFIX}https://github.com/owner/repo/issues/1`,
    JSON.stringify(['key-a']),
  );
};

const OFFLINE_QUEUE_STORAGE_KEY = 'console-offline-action-queue';

const offlinePayload = {
  itemUrl: 'https://github.com/o/r/pull/851',
  projectItemId: 'PVTI_1',
  itemNumber: 851,
  repo: 'o/r',
  isPr: true,
  apiPath: '/api/review',
  requestBody: {
    pjcode: 'acme',
    action: 'approve',
    prUrl: 'https://github.com/o/r/pull/851',
    projectItemId: 'PVTI_1',
  },
};

const heldItemFields = {
  itemUrl: 'https://github.com/o/r/issues/866',
  projectItemId: 'PVTI_2',
  itemNumber: 866,
  repo: 'o/r',
  isPr: false,
};

const commentOfflinePayload = {
  ...heldItemFields,
  apiPath: '/api/comment',
  requestBody: {
    pjcode: 'acme',
    url: 'https://github.com/o/r/issues/866',
    body: 'Checked during the flight.',
  },
};

const closeOfflinePayload = {
  ...heldItemFields,
  apiPath: '/api/triage',
  requestBody: {
    pjcode: 'acme',
    action: 'close',
    issueUrl: 'https://github.com/o/r/issues/866',
    projectItemId: 'PVTI_2',
  },
};

const readStoredOfflineQueue = (): Record<string, unknown>[] =>
  JSON.parse(localStorage.getItem(OFFLINE_QUEUE_STORAGE_KEY) ?? '[]');

const installOperationFetch = (): jest.Mock => {
  const fetchMock = jest.fn(async (_url: string, _init?: RequestInit) => ({
    ok: true,
    status: 200,
    json: async () => ({}),
  }));
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
};

const makeAction = (
  overrides: Partial<
    Parameters<ReturnType<typeof useConsoleActionQueue>['enqueue']>[0]
  > = {},
) => ({
  message: 'Approved — PR #851',
  color: 'green' as const,
  commit: jest.fn<Promise<void>, []>().mockResolvedValue(undefined),
  advance: jest.fn(),
  ...overrides,
});

const flushMicrotasks = (): Promise<void> =>
  Promise.resolve().then(() => undefined);

describe('useConsoleActionQueue', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    jest.useRealTimers();
    localStorage.clear();
  });

  it('advances immediately but only commits after the five second window', () => {
    const { result } = renderHook(() => useConsoleActionQueue());
    const action = makeAction();
    act(() => {
      result.current.enqueue(action);
    });
    expect(action.advance).toHaveBeenCalledTimes(1);
    expect(action.commit).not.toHaveBeenCalled();
    expect(result.current.pending?.message).toBe('Approved — PR #851');
    expect(result.current.pending?.remainingSeconds).toBe(5);

    act(() => {
      jest.advanceTimersByTime(4900);
    });
    expect(action.commit).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(200);
    });
    expect(action.commit).toHaveBeenCalledTimes(1);
    expect(result.current.pending).toBeNull();
  });

  it('counts the remaining seconds down during the window', () => {
    const { result } = renderHook(() => useConsoleActionQueue());
    act(() => {
      result.current.enqueue(makeAction());
    });
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(result.current.pending?.remainingSeconds).toBe(3);
    expect(result.current.pending?.progress).toBeCloseTo(0.6, 1);
  });

  it('cancels the command when undo is called within the window', () => {
    const { result } = renderHook(() => useConsoleActionQueue());
    const action = makeAction();
    act(() => {
      result.current.enqueue(action);
    });
    act(() => {
      jest.advanceTimersByTime(2000);
      result.current.undo();
    });
    expect(result.current.pending).toBeNull();
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(action.commit).not.toHaveBeenCalled();
  });

  it('flushes the previous pending action when a new one is enqueued', () => {
    const { result } = renderHook(() => useConsoleActionQueue());
    const first = makeAction({ message: 'Approved — PR #851' });
    const second = makeAction({
      message: 'Rejected — PR #853',
      color: 'amber',
    });
    act(() => {
      result.current.enqueue(first);
    });
    act(() => {
      jest.advanceTimersByTime(1000);
      result.current.enqueue(second);
    });
    expect(first.commit).toHaveBeenCalledTimes(1);
    expect(second.commit).not.toHaveBeenCalled();
    expect(result.current.pending?.message).toBe('Rejected — PR #853');
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(second.commit).toHaveBeenCalledTimes(1);
  });

  it('does not commit twice if the window elapses after a manual flush', () => {
    const { result } = renderHook(() => useConsoleActionQueue());
    const first = makeAction();
    const second = makeAction({ message: 'Closed — #845', color: 'red' });
    act(() => {
      result.current.enqueue(first);
    });
    act(() => {
      result.current.enqueue(second);
    });
    expect(first.commit).toHaveBeenCalledTimes(1);
    act(() => {
      jest.advanceTimersByTime(6000);
    });
    expect(first.commit).toHaveBeenCalledTimes(1);
    expect(second.commit).toHaveBeenCalledTimes(1);
  });

  it('surfaces the failure reason when the timer commit rejects', async () => {
    const { result } = renderHook(() => useConsoleActionQueue());
    const action = makeAction({
      commit: jest
        .fn<Promise<void>, []>()
        .mockRejectedValue(new Error('HTTP 422 review cannot be requested')),
    });
    act(() => {
      result.current.enqueue(action);
    });
    expect(result.current.error).toBeNull();
    await act(async () => {
      jest.advanceTimersByTime(5000);
      await flushMicrotasks();
    });
    expect(action.commit).toHaveBeenCalledTimes(1);
    expect(result.current.error).toMatchObject({
      message: 'Approved — PR #851',
      reason: 'HTTP 422 review cannot be requested',
    });
  });

  it('surfaces the failure reason when the previous action commit rejects on enqueue', async () => {
    const { result } = renderHook(() => useConsoleActionQueue());
    const first = makeAction({
      commit: jest
        .fn<Promise<void>, []>()
        .mockRejectedValue(new Error('network down')),
    });
    const second = makeAction({
      message: 'Rejected — PR #853',
      color: 'amber',
    });
    act(() => {
      result.current.enqueue(first);
    });
    await act(async () => {
      jest.advanceTimersByTime(1000);
      result.current.enqueue(second);
      await flushMicrotasks();
    });
    expect(first.commit).toHaveBeenCalledTimes(1);
    expect(result.current.error).toMatchObject({
      message: 'Approved — PR #851',
      reason: 'network down',
    });
  });

  it('clears the surfaced error when dismissError is called', async () => {
    const { result } = renderHook(() => useConsoleActionQueue());
    const action = makeAction({
      commit: jest.fn<Promise<void>, []>().mockRejectedValue(new Error('boom')),
    });
    act(() => {
      result.current.enqueue(action);
    });
    await act(async () => {
      jest.advanceTimersByTime(5000);
      await flushMicrotasks();
    });
    expect(result.current.error).not.toBeNull();
    act(() => {
      result.current.dismissError();
    });
    expect(result.current.error).toBeNull();
  });

  it('does not surface an error when the commit resolves', async () => {
    const { result } = renderHook(() => useConsoleActionQueue());
    const action = makeAction();
    act(() => {
      result.current.enqueue(action);
    });
    await act(async () => {
      jest.advanceTimersByTime(5000);
      await flushMicrotasks();
    });
    expect(result.current.error).toBeNull();
  });

  it('showError sets the error state without touching pending', () => {
    const { result } = renderHook(() => useConsoleActionQueue());
    act(() => {
      result.current.showError(
        'Airplane mode',
        'This action requires a network connection.',
      );
    });
    expect(result.current.error).toEqual({
      message: 'Airplane mode',
      reason: 'This action requires a network connection.',
    });
    expect(result.current.pending).toBeNull();
  });
  it('adds the action to the offline queue when the commit rejects with a network error', async () => {
    const { result } = renderHook(() => useConsoleActionQueue());
    const action = makeAction({
      commit: jest
        .fn<Promise<void>, []>()
        .mockRejectedValue(new TypeError('Failed to fetch')),
      offline: [offlinePayload],
    });
    act(() => {
      result.current.enqueue(action);
    });
    await act(async () => {
      jest.advanceTimersByTime(5000);
      await flushMicrotasks();
    });
    expect(result.current.error).toBeNull();
    expect(result.current.offlineActions).toHaveLength(1);
    expect(result.current.offlineActions[0].message).toBe('Approved — PR #851');
    expect(result.current.offlineActions[0].apiPath).toBe('/api/review');
  });

  it('surfaces a server error as an error rather than queuing it offline', async () => {
    const { result } = renderHook(() => useConsoleActionQueue());
    const action = makeAction({
      commit: jest
        .fn<Promise<void>, []>()
        .mockRejectedValue(new Error('HTTP 422 review cannot be requested')),
      offline: [offlinePayload],
    });
    act(() => {
      result.current.enqueue(action);
    });
    await act(async () => {
      jest.advanceTimersByTime(5000);
      await flushMicrotasks();
    });
    expect(result.current.error).toMatchObject({
      message: 'Approved — PR #851',
      reason: 'HTTP 422 review cannot be requested',
    });
    expect(result.current.offlineActions).toHaveLength(0);
  });

  it('keeps the offline queue in localStorage so it survives a remount', async () => {
    const { result, unmount } = renderHook(() => useConsoleActionQueue());
    const action = makeAction({
      commit: jest
        .fn<Promise<void>, []>()
        .mockRejectedValue(new TypeError('Failed to fetch')),
      offline: [offlinePayload],
    });
    act(() => {
      result.current.enqueue(action);
    });
    await act(async () => {
      jest.advanceTimersByTime(5000);
      await flushMicrotasks();
    });
    expect(result.current.offlineActions).toHaveLength(1);
    unmount();

    const { result: result2 } = renderHook(() => useConsoleActionQueue());
    expect(result2.current.offlineActions).toHaveLength(1);
    expect(result2.current.offlineActions[0].message).toBe(
      'Approved — PR #851',
    );
  });

  it('does not send anything before confirmOfflineAction is called', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    const { result } = renderHook(() => useConsoleActionQueue());
    const action = makeAction({
      commit: jest
        .fn<Promise<void>, []>()
        .mockRejectedValue(new TypeError('Failed to fetch')),
      offline: [offlinePayload],
    });
    act(() => {
      result.current.enqueue(action);
    });
    await act(async () => {
      jest.advanceTimersByTime(5000);
      await flushMicrotasks();
    });
    expect(result.current.offlineActions).toHaveLength(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends the stored request and removes the action when confirmOfflineAction is called', async () => {
    const fetchMock = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({}),
    }));
    global.fetch = fetchMock as unknown as typeof fetch;
    const { result } = renderHook(() => useConsoleActionQueue());
    const action = makeAction({
      commit: jest
        .fn<Promise<void>, []>()
        .mockRejectedValue(new TypeError('Failed to fetch')),
      offline: [offlinePayload],
    });
    act(() => {
      result.current.enqueue(action);
    });
    await act(async () => {
      jest.advanceTimersByTime(5000);
      await flushMicrotasks();
    });
    const id = result.current.offlineActions[0].id;
    await act(async () => {
      await result.current.confirmOfflineAction(id);
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/review',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(result.current.offlineActions).toHaveLength(0);
    expect(result.current.error).toBeNull();
  });

  it('sets an error and keeps the action when confirmOfflineAction encounters a network error', async () => {
    const fetchMock = jest
      .fn()
      .mockRejectedValue(new TypeError('Failed to fetch'));
    global.fetch = fetchMock as unknown as typeof fetch;
    const { result } = renderHook(() => useConsoleActionQueue());
    const action = makeAction({
      commit: jest
        .fn<Promise<void>, []>()
        .mockRejectedValue(new TypeError('Failed to fetch')),
      offline: [offlinePayload],
    });
    act(() => {
      result.current.enqueue(action);
    });
    await act(async () => {
      jest.advanceTimersByTime(5000);
      await flushMicrotasks();
    });
    const id = result.current.offlineActions[0].id;
    await act(async () => {
      await result.current.confirmOfflineAction(id);
    });
    expect(result.current.error).toEqual({
      message: 'Approved — PR #851',
      reason: 'Still offline — action is still held in the queue',
    });
    expect(result.current.offlineActions).toHaveLength(1);
  });

  it('surfaces a server rejection from confirmOfflineAction as an error and removes the action', async () => {
    const fetchMock = jest.fn(async () => ({
      ok: false,
      status: 422,
      text: async () => 'review cannot be requested',
    }));
    global.fetch = fetchMock as unknown as typeof fetch;
    const { result } = renderHook(() => useConsoleActionQueue());
    const action = makeAction({
      commit: jest
        .fn<Promise<void>, []>()
        .mockRejectedValue(new TypeError('Failed to fetch')),
      offline: [offlinePayload],
    });
    act(() => {
      result.current.enqueue(action);
    });
    await act(async () => {
      jest.advanceTimersByTime(5000);
      await flushMicrotasks();
    });
    const id = result.current.offlineActions[0].id;
    await act(async () => {
      await result.current.confirmOfflineAction(id);
    });
    expect(result.current.error).not.toBeNull();
    expect(result.current.offlineActions).toHaveLength(0);
  });

  it('generates a stable action id in non-secure contexts where crypto.randomUUID is unavailable', async () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(
      crypto,
      'randomUUID',
    );
    Object.defineProperty(crypto, 'randomUUID', {
      value: undefined,
      configurable: true,
    });
    try {
      const { result } = renderHook(() => useConsoleActionQueue());
      const action = makeAction({
        commit: jest
          .fn<Promise<void>, []>()
          .mockRejectedValue(new TypeError('Failed to fetch')),
        offline: [offlinePayload],
      });
      act(() => {
        result.current.enqueue(action);
      });
      await act(async () => {
        jest.advanceTimersByTime(5000);
        await flushMicrotasks();
      });
      expect(result.current.offlineActions).toHaveLength(1);
      expect(typeof result.current.offlineActions[0].id).toBe('string');
      expect(result.current.offlineActions[0].id.length).toBeGreaterThan(0);
    } finally {
      if (originalDescriptor !== undefined) {
        Object.defineProperty(crypto, 'randomUUID', originalDescriptor);
      }
    }
  });

  it('skips malformed entries when loading the offline queue from localStorage', () => {
    const malformed = [
      { id: 'a', message: 'ok' },
      {
        id: 'b',
        message: 'valid',
        color: 'green',
        enqueuedAt: 1,
        itemUrl: 'https://github.com/o/r/pull/1',
        projectItemId: 'PVTI_1',
        itemNumber: 1,
        repo: 'o/r',
        isPr: true,
        apiPath: '/api/review',
        requestBody: { action: 'approve' },
      },
      null,
    ];
    localStorage.setItem(OFFLINE_QUEUE_STORAGE_KEY, JSON.stringify(malformed));
    const { result } = renderHook(() => useConsoleActionQueue());
    expect(result.current.offlineActions).toHaveLength(1);
    expect(result.current.offlineActions[0].id).toBe('b');
  });

  it('calls revertAdvance when undo is called within the window', () => {
    const { result } = renderHook(() => useConsoleActionQueue());
    const revertAdvance = jest.fn();
    const action = makeAction({ revertAdvance });
    act(() => {
      result.current.enqueue(action);
    });
    act(() => {
      result.current.undo();
    });
    expect(revertAdvance).toHaveBeenCalledTimes(1);
  });

  it('commits the pending action when the component unmounts before the countdown elapses', async () => {
    const { result, unmount } = renderHook(() => useConsoleActionQueue());
    const action = makeAction();
    act(() => {
      result.current.enqueue(action);
    });
    expect(action.commit).not.toHaveBeenCalled();

    await act(async () => {
      unmount();
      await flushMicrotasks();
    });

    expect(action.commit).toHaveBeenCalledTimes(1);
  });

  it('does not commit on unmount when undo was called before unmount', async () => {
    const { result, unmount } = renderHook(() => useConsoleActionQueue());
    const action = makeAction();
    act(() => {
      result.current.enqueue(action);
    });
    act(() => {
      result.current.undo();
    });
    await act(async () => {
      unmount();
      await flushMicrotasks();
    });
    expect(action.commit).not.toHaveBeenCalled();
  });

  it('calls optimistic immediately on enqueue alongside advance', () => {
    const { result } = renderHook(() => useConsoleActionQueue());
    const optimistic = jest.fn();
    const action = makeAction({ optimistic });
    act(() => {
      result.current.enqueue(action);
    });
    expect(optimistic).toHaveBeenCalledTimes(1);
    expect(action.advance).toHaveBeenCalledTimes(1);
  });

  it('calls revertOptimistic when undo is called within the window', () => {
    const { result } = renderHook(() => useConsoleActionQueue());
    const revertOptimistic = jest.fn();
    const action = makeAction({ revertOptimistic });
    act(() => {
      result.current.enqueue(action);
    });
    act(() => {
      result.current.undo();
    });
    expect(revertOptimistic).toHaveBeenCalledTimes(1);
  });

  it('does not call revertOptimistic when the timer commits the action', () => {
    const { result } = renderHook(() => useConsoleActionQueue());
    const revertOptimistic = jest.fn();
    const action = makeAction({ revertOptimistic });
    act(() => {
      result.current.enqueue(action);
    });
    act(() => {
      jest.advanceTimersByTime(6000);
    });
    expect(revertOptimistic).not.toHaveBeenCalled();
  });

  it('does not call revertOptimistic when commit fails after the undo window', async () => {
    const { result } = renderHook(() => useConsoleActionQueue());
    const revertOptimistic = jest.fn();
    const action = makeAction({
      revertOptimistic,
      commit: jest
        .fn<Promise<void>, []>()
        .mockRejectedValue(new Error('HTTP 422')),
    });
    act(() => {
      result.current.enqueue(action);
    });
    await act(async () => {
      jest.advanceTimersByTime(6000);
      await Promise.resolve();
    });
    expect(revertOptimistic).not.toHaveBeenCalled();
  });

  it('does not call revertAdvance when the timer commits the action', () => {
    const { result } = renderHook(() => useConsoleActionQueue());
    const revertAdvance = jest.fn();
    const action = makeAction({ revertAdvance });
    act(() => {
      result.current.enqueue(action);
    });
    act(() => {
      jest.advanceTimersByTime(6000);
    });
    expect(revertAdvance).not.toHaveBeenCalled();
  });

  it('removes the action from localStorage when discardOfflineAction is called', async () => {
    const { result } = renderHook(() => useConsoleActionQueue());
    const action = makeAction({
      commit: jest
        .fn<Promise<void>, []>()
        .mockRejectedValue(new TypeError('Failed to fetch')),
      offline: [offlinePayload],
    });
    act(() => {
      result.current.enqueue(action);
    });
    await act(async () => {
      jest.advanceTimersByTime(5000);
      await flushMicrotasks();
    });
    const id = result.current.offlineActions[0].id;
    act(() => {
      result.current.discardOfflineAction(id);
    });
    expect(result.current.offlineActions).toHaveLength(0);
    const stored: unknown[] = JSON.parse(
      localStorage.getItem(OFFLINE_QUEUE_STORAGE_KEY) ?? '[]',
    );
    expect(stored).toHaveLength(0);
  });

  it('clears comment expanded states when the timer commits the action', () => {
    seedCommentExpandedState();
    expect(
      localStorage.getItem(
        `${COMMENT_EXPANDED_PREFIX}https://github.com/owner/repo/issues/1`,
      ),
    ).not.toBeNull();
    const { result } = renderHook(() => useConsoleActionQueue());
    act(() => {
      result.current.enqueue(makeAction());
    });
    act(() => {
      jest.advanceTimersByTime(5100);
    });
    expect(
      localStorage.getItem(
        `${COMMENT_EXPANDED_PREFIX}https://github.com/owner/repo/issues/1`,
      ),
    ).toBeNull();
  });

  it('error from runCommit includes a callable retry function', async () => {
    const { result } = renderHook(() => useConsoleActionQueue());
    const action = makeAction({
      commit: jest
        .fn<Promise<void>, []>()
        .mockRejectedValue(new Error('HTTP 422')),
    });
    act(() => {
      result.current.enqueue(action);
    });
    await act(async () => {
      jest.advanceTimersByTime(5000);
      await flushMicrotasks();
    });
    expect(result.current.error?.retry).toBeDefined();
    expect(typeof result.current.error?.retry).toBe('function');
  });

  it('calling retry re-invokes commit', async () => {
    const { result } = renderHook(() => useConsoleActionQueue());
    const commit = jest
      .fn<Promise<void>, []>()
      .mockRejectedValueOnce(new Error('HTTP 422'))
      .mockResolvedValue(undefined);
    const action = makeAction({ commit });
    act(() => {
      result.current.enqueue(action);
    });
    await act(async () => {
      jest.advanceTimersByTime(5000);
      await flushMicrotasks();
    });
    expect(result.current.error).not.toBeNull();
    const retry = result.current.error?.retry;
    await act(async () => {
      retry?.();
      await flushMicrotasks();
    });
    expect(commit).toHaveBeenCalledTimes(2);
  });

  it('dismissing the error then calling retry leaves error null when the commit succeeds', async () => {
    const { result } = renderHook(() => useConsoleActionQueue());
    const commit = jest
      .fn<Promise<void>, []>()
      .mockRejectedValueOnce(new Error('HTTP 422'))
      .mockResolvedValue(undefined);
    const action = makeAction({ commit });
    act(() => {
      result.current.enqueue(action);
    });
    await act(async () => {
      jest.advanceTimersByTime(5000);
      await flushMicrotasks();
    });
    expect(result.current.error).not.toBeNull();
    const retry = result.current.error?.retry;
    act(() => {
      result.current.dismissError();
    });
    await act(async () => {
      retry?.();
      await flushMicrotasks();
    });
    expect(result.current.error).toBeNull();
    expect(commit).toHaveBeenCalledTimes(2);
  });

  it('calling retry sets a new error when the retry commit also fails', async () => {
    const { result } = renderHook(() => useConsoleActionQueue());
    const commit = jest
      .fn<Promise<void>, []>()
      .mockRejectedValueOnce(new Error('HTTP 422'))
      .mockRejectedValueOnce(new Error('HTTP 500'));
    const action = makeAction({ commit });
    act(() => {
      result.current.enqueue(action);
    });
    await act(async () => {
      jest.advanceTimersByTime(5000);
      await flushMicrotasks();
    });
    expect(result.current.error?.reason).toBe('HTTP 422');
    const retry = result.current.error?.retry;
    await act(async () => {
      retry?.();
      await flushMicrotasks();
    });
    expect(result.current.error?.reason).toBe('HTTP 500');
    expect(result.current.error?.retry).toBeDefined();
  });

  it('clears comment expanded states when a new action flushes the pending one', () => {
    seedCommentExpandedState();
    expect(
      localStorage.getItem(
        `${COMMENT_EXPANDED_PREFIX}https://github.com/owner/repo/issues/1`,
      ),
    ).not.toBeNull();
    const { result } = renderHook(() => useConsoleActionQueue());
    const first = makeAction({ message: 'Approved — PR #851' });
    const second = makeAction({
      message: 'Rejected — PR #853',
      color: 'amber',
    });
    act(() => {
      result.current.enqueue(first);
    });
    act(() => {
      jest.advanceTimersByTime(1000);
      result.current.enqueue(second);
    });
    expect(
      localStorage.getItem(
        `${COMMENT_EXPANDED_PREFIX}https://github.com/owner/repo/issues/1`,
      ),
    ).toBeNull();
  });

  it('dismiss commits the pending action once', () => {
    const { result } = renderHook(() => useConsoleActionQueue());
    const action = makeAction();
    act(() => {
      result.current.enqueue(action);
    });
    act(() => {
      result.current.dismiss();
    });
    expect(action.commit).toHaveBeenCalledTimes(1);
    expect(result.current.pending).toBeNull();
  });

  it('dismiss then timer firing does not double-commit', () => {
    const { result } = renderHook(() => useConsoleActionQueue());
    const action = makeAction();
    act(() => {
      result.current.enqueue(action);
    });
    act(() => {
      result.current.dismiss();
    });
    expect(action.commit).toHaveBeenCalledTimes(1);
    act(() => {
      jest.advanceTimersByTime(6000);
    });
    expect(action.commit).toHaveBeenCalledTimes(1);
  });

  it('dismiss with no pending action is a no-op', () => {
    const { result } = renderHook(() => useConsoleActionQueue());
    expect(() => {
      act(() => {
        result.current.dismiss();
      });
    }).not.toThrow();
    expect(result.current.pending).toBeNull();
  });

  it('surfaces a network error as an error and holds nothing when the action carries no offline payload', async () => {
    const { result } = renderHook(() => useConsoleActionQueue());
    const action = makeAction({
      commit: jest
        .fn<Promise<void>, []>()
        .mockRejectedValue(new TypeError('Failed to fetch')),
    });
    act(() => {
      result.current.enqueue(action);
    });
    await act(async () => {
      jest.advanceTimersByTime(5000);
      await flushMicrotasks();
    });
    expect(result.current.error).toMatchObject({
      message: 'Approved — PR #851',
      reason: 'Failed to fetch',
    });
    expect(result.current.offlineActions).toHaveLength(0);
    expect(readStoredOfflineQueue()).toHaveLength(0);
  });

  it('keeps the optimistic overlay and the advance when a network error moves the action to the offline queue', async () => {
    const { result } = renderHook(() => useConsoleActionQueue());
    const optimistic = jest.fn();
    const revertOptimistic = jest.fn();
    const revertAdvance = jest.fn();
    const action = makeAction({
      commit: jest
        .fn<Promise<void>, []>()
        .mockRejectedValue(new TypeError('Failed to fetch')),
      offline: [offlinePayload],
      optimistic,
      revertOptimistic,
      revertAdvance,
    });
    act(() => {
      result.current.enqueue(action);
    });
    await act(async () => {
      jest.advanceTimersByTime(5000);
      await flushMicrotasks();
    });
    expect(result.current.offlineActions).toHaveLength(1);
    expect(action.advance).toHaveBeenCalledTimes(1);
    expect(optimistic).toHaveBeenCalledTimes(1);
    expect(revertOptimistic).not.toHaveBeenCalled();
    expect(revertAdvance).not.toHaveBeenCalled();
  });

  it('stores a held action in localStorage with its payload, message and color', async () => {
    const { result } = renderHook(() => useConsoleActionQueue());
    const action = makeAction({
      commit: jest
        .fn<Promise<void>, []>()
        .mockRejectedValue(new TypeError('Failed to fetch')),
      offline: [offlinePayload],
    });
    act(() => {
      result.current.enqueue(action);
    });
    await act(async () => {
      jest.advanceTimersByTime(5000);
      await flushMicrotasks();
    });
    const stored = readStoredOfflineQueue();
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      ...offlinePayload,
      message: 'Approved — PR #851',
      color: 'green',
    });
    expect(typeof stored[0].id).toBe('string');
    expect(typeof stored[0].enqueuedAt).toBe('number');
  });

  it('lists a held comment without sending it and sends exactly one /api/comment request with its request body when it is confirmed', async () => {
    const fetchMock = installOperationFetch();
    localStorage.setItem(
      OFFLINE_QUEUE_STORAGE_KEY,
      JSON.stringify([
        {
          id: 'held-close',
          message: 'Closed — #866',
          color: 'red',
          enqueuedAt: 1,
          ...closeOfflinePayload,
        },
        {
          id: 'held-comment',
          message: 'Comment — #866',
          color: 'blue',
          enqueuedAt: 2,
          ...commentOfflinePayload,
        },
      ]),
    );
    const { result } = renderHook(() => useConsoleActionQueue());
    act(() => {
      jest.advanceTimersByTime(10000);
    });
    expect(result.current.offlineActions.map((held) => held.apiPath)).toEqual([
      '/api/triage',
      '/api/comment',
    ]);
    expect(fetchMock).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.confirmOfflineAction('held-comment');
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url.endsWith('/api/comment')).toBe(true);
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual(
      commentOfflinePayload.requestBody,
    );
    expect(result.current.offlineActions.map((held) => held.id)).toEqual([
      'held-close',
    ]);
  });

  it.each([
    {
      commitTrigger: 'the undo window elapses',
      triggerCommit: (_queue: ConsoleActionQueue): void => {
        jest.advanceTimersByTime(5000);
      },
    },
    {
      commitTrigger: 'the undo toast is dismissed',
      triggerCommit: (queue: ConsoleActionQueue): void => {
        queue.dismiss();
      },
    },
  ])(
    'holds the action in the offline queue without committing, sending or reverting it when airplane mode is on and $commitTrigger',
    async ({ triggerCommit }) => {
      const fetchMock = installOperationFetch();
      const { result } = renderHook(() =>
        useConsoleActionQueue({ isAirplaneModeOn: true }),
      );
      const optimistic = jest.fn();
      const revertOptimistic = jest.fn();
      const revertAdvance = jest.fn();
      const action = makeAction({
        offline: [offlinePayload],
        optimistic,
        revertOptimistic,
        revertAdvance,
      });
      act(() => {
        result.current.enqueue(action);
      });
      await act(async () => {
        triggerCommit(result.current);
        await flushMicrotasks();
      });
      expect(action.commit).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
      expect(action.advance).toHaveBeenCalledTimes(1);
      expect(optimistic).toHaveBeenCalledTimes(1);
      expect(revertOptimistic).not.toHaveBeenCalled();
      expect(revertAdvance).not.toHaveBeenCalled();
      expect(result.current.error).toBeNull();
      const expectedHeld = [
        expect.objectContaining({
          ...offlinePayload,
          message: 'Approved — PR #851',
          color: 'green',
        }),
      ];
      expect(result.current.offlineActions).toEqual(expectedHeld);
      expect(readStoredOfflineQueue()).toEqual(expectedHeld);
    },
  );

  it.each([
    {
      switchDirection: 'switched on',
      isAirplaneModeOnAtEnqueue: false,
      isAirplaneModeOnAtCommit: true,
      expectedCommitCalls: 0,
      expectedHeldCount: 1,
    },
    {
      switchDirection: 'switched off',
      isAirplaneModeOnAtEnqueue: true,
      isAirplaneModeOnAtCommit: false,
      expectedCommitCalls: 1,
      expectedHeldCount: 0,
    },
  ])(
    'decides by the airplane mode value at commit time when airplane mode is $switchDirection during the undo window',
    async ({
      isAirplaneModeOnAtEnqueue,
      isAirplaneModeOnAtCommit,
      expectedCommitCalls,
      expectedHeldCount,
    }) => {
      const { result, rerender } = renderHook(
        ({ isAirplaneModeOn }: { isAirplaneModeOn: boolean }) =>
          useConsoleActionQueue({ isAirplaneModeOn }),
        { initialProps: { isAirplaneModeOn: isAirplaneModeOnAtEnqueue } },
      );
      const action = makeAction({ offline: [offlinePayload] });
      act(() => {
        result.current.enqueue(action);
      });
      act(() => {
        jest.advanceTimersByTime(2000);
      });
      rerender({ isAirplaneModeOn: isAirplaneModeOnAtCommit });
      await act(async () => {
        jest.advanceTimersByTime(3000);
        await flushMicrotasks();
      });
      expect(action.commit).toHaveBeenCalledTimes(expectedCommitCalls);
      expect(result.current.offlineActions).toHaveLength(expectedHeldCount);
      expect(readStoredOfflineQueue()).toHaveLength(expectedHeldCount);
      expect(result.current.error).toBeNull();
    },
  );

  it('holds a pending action that a newer action flushes while airplane mode is on and keeps the newer one pending', async () => {
    const { result } = renderHook(() =>
      useConsoleActionQueue({ isAirplaneModeOn: true }),
    );
    const first = makeAction({ offline: [offlinePayload] });
    const second = makeAction({
      message: 'Closed — #866',
      color: 'red',
      offline: [closeOfflinePayload],
    });
    act(() => {
      result.current.enqueue(first);
    });
    await act(async () => {
      result.current.enqueue(second);
      await flushMicrotasks();
    });
    expect(first.commit).not.toHaveBeenCalled();
    expect(second.commit).not.toHaveBeenCalled();
    expect(result.current.offlineActions.map((held) => held.apiPath)).toEqual([
      '/api/review',
    ]);
    expect(result.current.pending?.message).toBe('Closed — #866');
    expect(result.current.error).toBeNull();
  });

  it.each([
    {
      holdReason: 'airplane mode is on',
      isAirplaneModeOn: true,
      buildCommit: () =>
        jest.fn<Promise<void>, []>().mockResolvedValue(undefined),
    },
    {
      holdReason: 'the commit fails because the network is unavailable',
      isAirplaneModeOn: false,
      buildCommit: () =>
        jest
          .fn<Promise<void>, []>()
          .mockRejectedValue(new TypeError('Failed to fetch')),
    },
  ])(
    'holds each offline payload of one action as its own entry in order when $holdReason',
    async ({ isAirplaneModeOn, buildCommit }) => {
      const { result } = renderHook(() =>
        useConsoleActionQueue({ isAirplaneModeOn }),
      );
      const action = makeAction({
        message: 'OK & Close — #866',
        color: 'red',
        commit: buildCommit(),
        offline: [commentOfflinePayload, closeOfflinePayload],
      });
      act(() => {
        result.current.enqueue(action);
      });
      await act(async () => {
        jest.advanceTimersByTime(5000);
        await flushMicrotasks();
      });
      const expectedHeld = [
        expect.objectContaining(commentOfflinePayload),
        expect.objectContaining(closeOfflinePayload),
      ];
      expect(result.current.offlineActions).toEqual(expectedHeld);
      expect(readStoredOfflineQueue()).toEqual(expectedHeld);
      expect(
        new Set(result.current.offlineActions.map((held) => held.id)).size,
      ).toBe(2);
      expect(result.current.error).toBeNull();
    },
  );

  it('adds the entries passed to offlineActionsCreate immediately and in order, persists them, and sends nothing', async () => {
    const fetchMock = installOperationFetch();
    const { result } = renderHook(() => useConsoleActionQueue());
    act(() => {
      result.current.offlineActionsCreate({
        payloads: [commentOfflinePayload, closeOfflinePayload],
        message: 'Comment — #866',
        color: 'blue',
      });
    });
    const expectedHeld = [
      expect.objectContaining({
        ...commentOfflinePayload,
        message: 'Comment — #866',
        color: 'blue',
      }),
      expect.objectContaining({
        ...closeOfflinePayload,
        message: 'Comment — #866',
        color: 'blue',
      }),
    ];
    expect(result.current.offlineActions).toEqual(expectedHeld);
    expect(readStoredOfflineQueue()).toEqual(expectedHeld);
    expect(result.current.pending).toBeNull();
    await act(async () => {
      jest.advanceTimersByTime(10000);
      await flushMicrotasks();
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.offlineActions).toEqual(expectedHeld);
  });

  it('keeps an entry added by offlineActionsCreate across a remount', () => {
    const firstMount = renderHook(() => useConsoleActionQueue());
    act(() => {
      firstMount.result.current.offlineActionsCreate({
        payloads: [commentOfflinePayload],
        message: 'Comment — #866',
        color: 'blue',
      });
    });
    firstMount.unmount();
    const { result } = renderHook(() => useConsoleActionQueue());
    expect(result.current.offlineActions).toEqual([
      expect.objectContaining({
        ...commentOfflinePayload,
        message: 'Comment — #866',
        color: 'blue',
      }),
    ]);
  });

  it('sends exactly one /api/comment request with the stored request body when an entry added by offlineActionsCreate is confirmed', async () => {
    const fetchMock = installOperationFetch();
    const { result } = renderHook(() => useConsoleActionQueue());
    act(() => {
      result.current.offlineActionsCreate({
        payloads: [commentOfflinePayload],
        message: 'Comment — #866',
        color: 'blue',
      });
    });
    const [held] = result.current.offlineActions;
    await act(async () => {
      await result.current.confirmOfflineAction(held.id);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url.endsWith('/api/comment')).toBe(true);
    expect(JSON.parse(String(init?.body))).toEqual(
      commentOfflinePayload.requestBody,
    );
    expect(result.current.offlineActions).toEqual([]);
    expect(readStoredOfflineQueue()).toEqual([]);
  });

  describe('writeState', () => {
    it('starts idle with attempt zero before any action is enqueued', () => {
      const { result } = renderHook(() => useConsoleActionQueue());
      expect(result.current.writeState).toEqual({
        status: 'idle',
        attempt: 0,
      });
    });

    it('becomes unconfirmed with attempt one as soon as the commit is triggered, before it resolves', () => {
      const { result } = renderHook(() => useConsoleActionQueue());
      const action = makeAction();
      act(() => {
        result.current.enqueue(action);
      });
      expect(result.current.writeState).toEqual({
        status: 'idle',
        attempt: 0,
      });

      act(() => {
        result.current.dismiss();
      });
      expect(action.commit).toHaveBeenCalledTimes(1);
      expect(result.current.writeState).toEqual({
        status: 'unconfirmed',
        attempt: 1,
      });
    });

    it('becomes succeeded with attempt one once the commit resolves', async () => {
      const { result } = renderHook(() => useConsoleActionQueue());
      const action = makeAction();
      act(() => {
        result.current.enqueue(action);
      });
      await act(async () => {
        result.current.dismiss();
        await flushMicrotasks();
      });
      expect(result.current.writeState).toEqual({
        status: 'succeeded',
        attempt: 1,
      });
    });

    it('becomes failed with attempt one when the commit rejects with a non-network error', async () => {
      const { result } = renderHook(() => useConsoleActionQueue());
      const action = makeAction({
        commit: jest
          .fn<Promise<void>, []>()
          .mockRejectedValue(new Error('HTTP 422 review cannot be requested')),
      });
      act(() => {
        result.current.enqueue(action);
      });
      await act(async () => {
        jest.advanceTimersByTime(5000);
        await flushMicrotasks();
      });
      expect(result.current.writeState).toEqual({
        status: 'failed',
        attempt: 1,
      });
    });

    it('becomes offline with attempt one when the commit rejects with a network error and an offline payload is provided', async () => {
      const { result } = renderHook(() => useConsoleActionQueue());
      const action = makeAction({
        commit: jest
          .fn<Promise<void>, []>()
          .mockRejectedValue(new TypeError('Failed to fetch')),
        offline: [offlinePayload],
      });
      act(() => {
        result.current.enqueue(action);
      });
      await act(async () => {
        jest.advanceTimersByTime(5000);
        await flushMicrotasks();
      });
      expect(result.current.writeState).toEqual({
        status: 'offline',
        attempt: 1,
      });
    });

    it('increments attempt on retry and becomes succeeded when the retry commit resolves', async () => {
      const { result } = renderHook(() => useConsoleActionQueue());
      const commit = jest
        .fn<Promise<void>, []>()
        .mockRejectedValueOnce(new Error('HTTP 422'))
        .mockResolvedValue(undefined);
      const action = makeAction({ commit });
      act(() => {
        result.current.enqueue(action);
      });
      await act(async () => {
        jest.advanceTimersByTime(5000);
        await flushMicrotasks();
      });
      expect(result.current.writeState).toEqual({
        status: 'failed',
        attempt: 1,
      });

      const retry = result.current.error?.retry;
      await act(async () => {
        retry?.();
        await flushMicrotasks();
      });
      expect(commit).toHaveBeenCalledTimes(2);
      expect(result.current.writeState).toEqual({
        status: 'succeeded',
        attempt: 2,
      });
    });

    it('increments attempt on retry and stays failed with the new attempt when the retry commit also rejects', async () => {
      const { result } = renderHook(() => useConsoleActionQueue());
      const commit = jest
        .fn<Promise<void>, []>()
        .mockRejectedValueOnce(new Error('HTTP 422'))
        .mockRejectedValueOnce(new Error('HTTP 500'));
      const action = makeAction({ commit });
      act(() => {
        result.current.enqueue(action);
      });
      await act(async () => {
        jest.advanceTimersByTime(5000);
        await flushMicrotasks();
      });
      expect(result.current.writeState).toEqual({
        status: 'failed',
        attempt: 1,
      });

      const retry = result.current.error?.retry;
      await act(async () => {
        retry?.();
        await flushMicrotasks();
      });
      expect(commit).toHaveBeenCalledTimes(2);
      expect(result.current.writeState).toEqual({
        status: 'failed',
        attempt: 2,
      });
    });
  });
});
