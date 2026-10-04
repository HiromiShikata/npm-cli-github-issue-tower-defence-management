import { act, renderHook } from '@testing-library/react';
import {
  ConsoleActionPartiallySentError,
  type ConsoleActionQueue,
  consoleActionStepsRun,
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
  nameWithOwner: 'o/r',
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
  nameWithOwner: 'o/r',
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

const COMMENT_SUCCESS_RESPONSE_BODY = {
  ok: true,
  comment: {
    id: 9001,
    author: 'octocat',
    body: 'Checked during the flight.',
    createdAt: '2026-10-04T12:00:00Z',
  },
};

const installCommentSuccessFetch = (): jest.Mock => {
  const fetchMock = jest.fn(async (_url: string, _init?: RequestInit) => ({
    ok: true,
    status: 200,
    json: async () => COMMENT_SUCCESS_RESPONSE_BODY,
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
        nameWithOwner: 'o/r',
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

  it('rejects a pre-deploy offline-queued action payload that satisfies every previously-checked field but lacks the now-required nameWithOwner field', () => {
    const preDeployShapedPayloadMissingNameWithOwner = {
      id: 'pre-deploy-1',
      message: 'Approved — PR #851',
      color: 'green',
      enqueuedAt: 1,
      itemUrl: 'https://github.com/o/r/pull/851',
      projectItemId: 'PVTI_1',
      itemNumber: 851,
      repo: 'o/r',
      isPr: true,
      apiPath: '/api/review',
      requestBody: { action: 'approve' },
    };
    localStorage.setItem(
      OFFLINE_QUEUE_STORAGE_KEY,
      JSON.stringify([preDeployShapedPayloadMissingNameWithOwner]),
    );
    const { result } = renderHook(() => useConsoleActionQueue());
    expect(result.current.offlineActions).toHaveLength(0);
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
    const fetchMock = installCommentSuccessFetch();
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

  it('surfaces a host rejection of an action carrying two offline payloads and holds neither payload', async () => {
    const { result } = renderHook(() => useConsoleActionQueue());
    const action = makeAction({
      message: 'OK & Close — #866',
      color: 'red',
      commit: jest
        .fn<Promise<void>, []>()
        .mockRejectedValue(new Error('HTTP 500 close refused')),
      offline: [commentOfflinePayload, closeOfflinePayload],
    });
    act(() => {
      result.current.enqueue(action);
    });
    await act(async () => {
      jest.advanceTimersByTime(5000);
      await flushMicrotasks();
    });
    expect(action.commit).toHaveBeenCalledTimes(1);
    expect(result.current.error).toMatchObject({
      message: 'OK & Close — #866',
      reason: 'HTTP 500 close refused',
    });
    expect(result.current.offlineActions).toEqual([]);
    expect(readStoredOfflineQueue()).toEqual([]);
    expect(result.current.writeState).toEqual({
      status: 'failed',
      attempt: 1,
    });
  });

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
    const fetchMock = installCommentSuccessFetch();
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

  describe('confirmOfflineAction replaying a queued /api/comment action', () => {
    const enqueueHeldComment = (queue: {
      current: ConsoleActionQueue;
    }): string => {
      act(() => {
        queue.current.offlineActionsCreate({
          payloads: [commentOfflinePayload],
          message: 'Comment — #866',
          color: 'blue',
        });
      });
      return queue.current.offlineActions[0].id;
    };

    it.each([
      {
        bodyShapeKind: 'without a rate limit reset time',
        responseBody: { ok: false, error: 'GitHub rate limit exceeded' },
        expectedReasonParts: ['GitHub rate limit exceeded'],
      },
      {
        bodyShapeKind: 'with a rate limit reset time',
        responseBody: {
          ok: false,
          error: 'GitHub rate limit exceeded',
          rateLimitResetAt: '2026-10-05T00:00:00Z',
        },
        expectedReasonParts: [
          'GitHub rate limit exceeded',
          'Rate limit resets at 2026-10-05T00:00:00Z.',
        ],
      },
    ])(
      'keeps the comment held and surfaces the upstream reason $bodyShapeKind when the response is HTTP 200 reporting ok: false',
      async ({ responseBody, expectedReasonParts }) => {
        const fetchMock = jest.fn(async () => ({
          ok: true,
          status: 200,
          json: async () => responseBody,
        }));
        global.fetch = fetchMock as unknown as typeof fetch;
        const { result } = renderHook(() => useConsoleActionQueue());
        const id = enqueueHeldComment(result);

        await act(async () => {
          await result.current.confirmOfflineAction(id);
        });

        expect(result.current.offlineActions).toHaveLength(1);
        expect(readStoredOfflineQueue()).toHaveLength(1);
        for (const expectedReasonPart of expectedReasonParts) {
          expect(result.current.error?.reason).toContain(expectedReasonPart);
        }
      },
    );

    it('removes the comment from the queue when the response is HTTP 200 with a realistic success body', async () => {
      const fetchMock = installCommentSuccessFetch();
      const { result } = renderHook(() => useConsoleActionQueue());
      const id = enqueueHeldComment(result);

      await act(async () => {
        await result.current.confirmOfflineAction(id);
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(result.current.offlineActions).toEqual([]);
      expect(readStoredOfflineQueue()).toEqual([]);
    });

    it('keeps the comment held with the still-offline reason when the fetch call itself fails because the network is unavailable', async () => {
      const fetchMock = jest
        .fn()
        .mockRejectedValue(new TypeError('Failed to fetch'));
      global.fetch = fetchMock as unknown as typeof fetch;
      const { result } = renderHook(() => useConsoleActionQueue());
      const id = enqueueHeldComment(result);

      await act(async () => {
        await result.current.confirmOfflineAction(id);
      });

      expect(result.current.error).toEqual({
        message: 'Comment — #866',
        reason: 'Still offline — action is still held in the queue',
      });
      expect(result.current.offlineActions).toHaveLength(1);
      expect(readStoredOfflineQueue()).toHaveLength(1);
    });
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

  describe('enqueueSequence', () => {
    it('starts at zero before any action is enqueued', () => {
      const { result } = renderHook(() => useConsoleActionQueue());
      expect(result.current.enqueueSequence).toBe(0);
    });

    it('increments to one immediately when enqueue is called, before writeState moves away from idle and before the commit is attempted', () => {
      const { result } = renderHook(() => useConsoleActionQueue());
      const action = makeAction();
      act(() => {
        result.current.enqueue(action);
      });
      expect(result.current.enqueueSequence).toBe(1);
      expect(result.current.writeState).toEqual({
        status: 'idle',
        attempt: 0,
      });
      expect(action.commit).not.toHaveBeenCalled();
    });

    it('increments by exactly one on every subsequent call to enqueue', () => {
      const { result } = renderHook(() => useConsoleActionQueue());
      act(() => {
        result.current.enqueue(makeAction({ message: 'first' }));
      });
      expect(result.current.enqueueSequence).toBe(1);

      act(() => {
        result.current.enqueue(makeAction({ message: 'second' }));
      });
      expect(result.current.enqueueSequence).toBe(2);

      act(() => {
        result.current.enqueue(makeAction({ message: 'third' }));
      });
      expect(result.current.enqueueSequence).toBe(3);
    });

    it.each([
      {
        writeOutcome: 'succeeds',
        buildCommit: (): jest.Mock<Promise<void>, []> =>
          jest.fn<Promise<void>, []>().mockResolvedValue(undefined),
      },
      {
        writeOutcome: 'fails with a non-network error',
        buildCommit: (): jest.Mock<Promise<void>, []> =>
          jest
            .fn<Promise<void>, []>()
            .mockRejectedValue(
              new Error('HTTP 422 review cannot be requested'),
            ),
      },
      {
        writeOutcome: 'is held offline because the network is unavailable',
        buildCommit: (): jest.Mock<Promise<void>, []> =>
          jest
            .fn<Promise<void>, []>()
            .mockRejectedValue(new TypeError('Failed to fetch')),
      },
    ])(
      'already carries the incremented value right after enqueue returns, before the undo-grace countdown starts and before the write is attempted, whatever the write later $writeOutcome',
      async ({ buildCommit }) => {
        const { result } = renderHook(() => useConsoleActionQueue());
        const action = makeAction({
          commit: buildCommit(),
          offline: [offlinePayload],
        });

        act(() => {
          result.current.enqueue(action);
        });

        expect(result.current.enqueueSequence).toBe(1);
        expect(action.commit).not.toHaveBeenCalled();
        expect(result.current.pending?.remainingSeconds).toBe(5);

        await act(async () => {
          jest.advanceTimersByTime(5000);
          await flushMicrotasks();
        });

        expect(action.commit).toHaveBeenCalledTimes(1);
        expect(result.current.enqueueSequence).toBe(1);
      },
    );

    it('does not change when the countdown elapses and the write is sent, only when enqueue itself is called again', async () => {
      const { result } = renderHook(() => useConsoleActionQueue());
      act(() => {
        result.current.enqueue(makeAction());
      });
      expect(result.current.enqueueSequence).toBe(1);

      await act(async () => {
        jest.advanceTimersByTime(5000);
        await flushMicrotasks();
      });
      expect(result.current.writeState.status).toBe('succeeded');
      expect(result.current.enqueueSequence).toBe(1);

      act(() => {
        result.current.enqueue(makeAction({ message: 'next action' }));
      });
      expect(result.current.enqueueSequence).toBe(2);
    });

    it('increments again when a new action is enqueued while the previous action is still pending in its undo-grace window', () => {
      const { result } = renderHook(() => useConsoleActionQueue());
      act(() => {
        result.current.enqueue(makeAction({ message: 'first' }));
      });
      expect(result.current.enqueueSequence).toBe(1);

      act(() => {
        jest.advanceTimersByTime(1000);
        result.current.enqueue(makeAction({ message: 'second' }));
      });
      expect(result.current.enqueueSequence).toBe(2);
    });
  });
});

describe('ConsoleActionPartiallySentError', () => {
  it.each([
    {
      causeKind: 'a network TypeError',
      sentStepCount: 1,
      cause: new TypeError('Failed to fetch'),
      expectedMessage: 'Failed to fetch',
    },
    {
      causeKind: 'a host rejection Error',
      sentStepCount: 2,
      cause: new Error('HTTP 500 close refused'),
      expectedMessage: 'HTTP 500 close refused',
    },
    {
      causeKind: 'a string',
      sentStepCount: 1,
      cause: 'status refused',
      expectedMessage: 'status refused',
    },
    {
      causeKind: 'a number',
      sentStepCount: 3,
      cause: 503,
      expectedMessage: '503',
    },
  ])(
    'is an Error carrying the sent step count, the cause and the message of $causeKind',
    ({ sentStepCount, cause, expectedMessage }) => {
      const partiallySentError = new ConsoleActionPartiallySentError(
        sentStepCount,
        cause,
      );

      expect(partiallySentError).toBeInstanceOf(Error);
      expect(partiallySentError).toBeInstanceOf(
        ConsoleActionPartiallySentError,
      );
      expect(partiallySentError).not.toBeInstanceOf(TypeError);
      expect(partiallySentError.sentStepCount).toBe(sentStepCount);
      expect(partiallySentError.cause).toBe(cause);
      expect(partiallySentError.message).toBe(expectedMessage);
    },
  );
});

describe('consoleActionStepsRun', () => {
  const settledRejection = (stepsRun: Promise<void>): Promise<unknown> =>
    stepsRun.then(
      () => null,
      (error: unknown) => error,
    );

  const buildSteps = (
    stepCount: number,
    rejectingStepIndex: number | null,
    stepFailure: unknown,
  ): jest.Mock<Promise<void>, []>[] =>
    Array.from({ length: stepCount }, (_unusedStep, stepIndex) =>
      stepIndex === rejectingStepIndex
        ? jest.fn<Promise<void>, []>().mockRejectedValue(stepFailure)
        : jest.fn<Promise<void>, []>().mockResolvedValue(undefined),
    );

  it('starts the second step only after the first step resolves and resolves once every step resolves', async () => {
    let resolveFirstStep: () => void = () => undefined;
    const firstStep = jest.fn<Promise<void>, []>(
      () =>
        new Promise<void>((resolve) => {
          resolveFirstStep = resolve;
        }),
    );
    const secondStep = jest
      .fn<Promise<void>, []>()
      .mockResolvedValue(undefined);

    const stepsRun = consoleActionStepsRun([firstStep, secondStep]);
    await flushMicrotasks();

    expect(firstStep).toHaveBeenCalledTimes(1);
    expect(secondStep).not.toHaveBeenCalled();

    resolveFirstStep();
    await expect(stepsRun).resolves.toBeUndefined();
    expect(secondStep).toHaveBeenCalledTimes(1);
  });

  it.each([
    {
      stepCount: 2,
      stepFailure: new TypeError('Failed to fetch'),
      expectedStepCallCounts: [1, 0],
    },
    {
      stepCount: 3,
      stepFailure: new Error('HTTP 500 comment refused'),
      expectedStepCallCounts: [1, 0, 0],
    },
  ])(
    'rejects with the first step error unchanged and runs no later step when the first of $stepCount steps rejects',
    async ({ stepCount, stepFailure, expectedStepCallCounts }) => {
      const steps = buildSteps(stepCount, 0, stepFailure);

      const rejection = await settledRejection(consoleActionStepsRun(steps));

      expect(rejection).toBe(stepFailure);
      expect(steps.map((step) => step.mock.calls.length)).toEqual(
        expectedStepCallCounts,
      );
    },
  );

  it.each([
    {
      stepCount: 2,
      rejectingStepIndex: 1,
      stepFailure: new TypeError('Failed to fetch'),
      expectedSentStepCount: 1,
      expectedStepCallCounts: [1, 1],
    },
    {
      stepCount: 3,
      rejectingStepIndex: 1,
      stepFailure: new Error('HTTP 500 close refused'),
      expectedSentStepCount: 1,
      expectedStepCallCounts: [1, 1, 0],
    },
    {
      stepCount: 3,
      rejectingStepIndex: 2,
      stepFailure: new TypeError('Failed to fetch'),
      expectedSentStepCount: 2,
      expectedStepCallCounts: [1, 1, 1],
    },
  ])(
    'rejects with a partially sent error counting $expectedSentStepCount sent steps and runs no later step when step index $rejectingStepIndex of $stepCount steps rejects',
    async ({
      stepCount,
      rejectingStepIndex,
      stepFailure,
      expectedSentStepCount,
      expectedStepCallCounts,
    }) => {
      const steps = buildSteps(stepCount, rejectingStepIndex, stepFailure);

      const rejection = await settledRejection(consoleActionStepsRun(steps));

      expect(rejection).toBeInstanceOf(ConsoleActionPartiallySentError);
      const partiallySentError = rejection as ConsoleActionPartiallySentError;
      expect(partiallySentError.sentStepCount).toBe(expectedSentStepCount);
      expect(partiallySentError.cause).toBe(stepFailure);
      expect(steps.map((step) => step.mock.calls.length)).toEqual(
        expectedStepCallCounts,
      );
    },
  );

  it.each([
    { stepCount: 2, sentStepCount: 0, expectedStepCallCounts: [1, 1] },
    { stepCount: 2, sentStepCount: 1, expectedStepCallCounts: [0, 1] },
    { stepCount: 3, sentStepCount: 1, expectedStepCallCounts: [0, 1, 1] },
    { stepCount: 3, sentStepCount: 2, expectedStepCallCounts: [0, 0, 1] },
    { stepCount: 2, sentStepCount: 2, expectedStepCallCounts: [0, 0] },
  ])(
    'runs only the steps from index $sentStepCount of $stepCount steps, never an earlier one, and resolves once they resolve',
    async ({ stepCount, sentStepCount, expectedStepCallCounts }) => {
      const steps = buildSteps(stepCount, null, null);

      await expect(
        consoleActionStepsRun(steps, sentStepCount),
      ).resolves.toBeUndefined();

      expect(steps.map((step) => step.mock.calls.length)).toEqual(
        expectedStepCallCounts,
      );
    },
  );

  it('runs the steps in order starting at the index of the sent step count', async () => {
    const stepRunOrder: string[] = [];
    const steps = ['comment', 'close', 'set status'].map(
      (stepName) => async (): Promise<void> => {
        stepRunOrder.push(stepName);
      },
    );

    await consoleActionStepsRun(steps, 1);

    expect(stepRunOrder).toEqual(['close', 'set status']);
  });

  it.each([
    {
      stepCount: 2,
      sentStepCount: 1,
      rejectingStepIndex: 1,
      stepFailure: new Error('HTTP 500 close refused'),
      expectedSentStepCount: 1,
      expectedStepCallCounts: [0, 1],
    },
    {
      stepCount: 2,
      sentStepCount: 1,
      rejectingStepIndex: 1,
      stepFailure: new TypeError('Failed to fetch'),
      expectedSentStepCount: 1,
      expectedStepCallCounts: [0, 1],
    },
    {
      stepCount: 3,
      sentStepCount: 1,
      rejectingStepIndex: 1,
      stepFailure: new Error('HTTP 500 close refused'),
      expectedSentStepCount: 1,
      expectedStepCallCounts: [0, 1, 0],
    },
    {
      stepCount: 3,
      sentStepCount: 1,
      rejectingStepIndex: 2,
      stepFailure: new Error('HTTP 500 status refused'),
      expectedSentStepCount: 2,
      expectedStepCallCounts: [0, 1, 1],
    },
    {
      stepCount: 3,
      sentStepCount: 2,
      rejectingStepIndex: 2,
      stepFailure: new TypeError('Failed to fetch'),
      expectedSentStepCount: 2,
      expectedStepCallCounts: [0, 0, 1],
    },
  ])(
    'rejects with a partially sent error counting $expectedSentStepCount sent steps and runs no earlier or later step when started at index $sentStepCount of $stepCount steps and step index $rejectingStepIndex rejects',
    async ({
      stepCount,
      sentStepCount,
      rejectingStepIndex,
      stepFailure,
      expectedSentStepCount,
      expectedStepCallCounts,
    }) => {
      const steps = buildSteps(stepCount, rejectingStepIndex, stepFailure);

      const rejection = await settledRejection(
        consoleActionStepsRun(steps, sentStepCount),
      );

      expect(rejection).toBeInstanceOf(ConsoleActionPartiallySentError);
      const partiallySentError = rejection as ConsoleActionPartiallySentError;
      expect(partiallySentError.sentStepCount).toBe(expectedSentStepCount);
      expect(partiallySentError.cause).toBe(stepFailure);
      expect(steps.map((step) => step.mock.calls.length)).toEqual(
        expectedStepCallCounts,
      );
    },
  );

  it('rejects with the first step error unchanged when started explicitly at index 0 and the first step rejects', async () => {
    const stepFailure = new Error('HTTP 500 comment refused');
    const steps = buildSteps(2, 0, stepFailure);

    const rejection = await settledRejection(consoleActionStepsRun(steps, 0));

    expect(rejection).toBe(stepFailure);
    expect(steps.map((step) => step.mock.calls.length)).toEqual([1, 0]);
  });
});

describe('useConsoleActionQueue with a partially sent two-step action', () => {
  const setStatusOfflinePayload = {
    ...heldItemFields,
    apiPath: '/api/triage',
    requestBody: {
      pjcode: 'acme',
      action: 'set_status',
      issueUrl: 'https://github.com/o/r/issues/866',
      projectItemId: 'PVTI_2',
      statusName: 'Awaiting Workspace',
    },
  };

  beforeEach(() => {
    jest.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    jest.useRealTimers();
    localStorage.clear();
  });

  const commitAfterUndoWindow = async (
    queue: { current: ConsoleActionQueue },
    action: ReturnType<typeof makeAction>,
  ): Promise<void> => {
    act(() => {
      queue.current.enqueue(action);
    });
    await act(async () => {
      jest.advanceTimersByTime(5000);
      await flushMicrotasks();
    });
  };

  it.each([
    {
      sentStepCount: 1,
      offline: [commentOfflinePayload, closeOfflinePayload],
      expectedHeldPayloads: [closeOfflinePayload],
    },
    {
      sentStepCount: 1,
      offline: [
        commentOfflinePayload,
        closeOfflinePayload,
        setStatusOfflinePayload,
      ],
      expectedHeldPayloads: [closeOfflinePayload, setStatusOfflinePayload],
    },
    {
      sentStepCount: 2,
      offline: [
        commentOfflinePayload,
        closeOfflinePayload,
        setStatusOfflinePayload,
      ],
      expectedHeldPayloads: [setStatusOfflinePayload],
    },
  ])(
    'holds only the offline payloads after the $sentStepCount sent steps, each as its own entry in order, without an error when the unsent step fails because the network is unavailable',
    async ({ sentStepCount, offline, expectedHeldPayloads }) => {
      const { result } = renderHook(() => useConsoleActionQueue());
      const action = makeAction({
        message: 'OK & Close — #866',
        color: 'red',
        commit: jest
          .fn<Promise<void>, []>()
          .mockRejectedValue(
            new ConsoleActionPartiallySentError(
              sentStepCount,
              new TypeError('Failed to fetch'),
            ),
          ),
        offline,
      });

      await commitAfterUndoWindow(result, action);

      const expectedHeld = expectedHeldPayloads.map((heldPayload) =>
        expect.objectContaining({
          ...heldPayload,
          message: 'OK & Close — #866',
          color: 'red',
        }),
      );
      expect(action.commit).toHaveBeenCalledTimes(1);
      expect(result.current.offlineActions).toEqual(expectedHeld);
      expect(readStoredOfflineQueue()).toEqual(expectedHeld);
      expect(
        new Set(result.current.offlineActions.map((held) => held.id)).size,
      ).toBe(expectedHeldPayloads.length);
      expect(result.current.error).toBeNull();
      expect(result.current.writeState).toEqual({
        status: 'offline',
        attempt: 1,
      });
    },
  );

  it('sends only the held close and never the comment when the held entries of an action whose comment was already sent are confirmed', async () => {
    const fetchMock = installOperationFetch();
    const { result } = renderHook(() => useConsoleActionQueue());
    const action = makeAction({
      message: 'OK & Close — #866',
      color: 'red',
      commit: jest
        .fn<Promise<void>, []>()
        .mockRejectedValue(
          new ConsoleActionPartiallySentError(
            1,
            new TypeError('Failed to fetch'),
          ),
        ),
      offline: [commentOfflinePayload, closeOfflinePayload],
    });
    await commitAfterUndoWindow(result, action);

    for (const held of result.current.offlineActions) {
      await act(async () => {
        await result.current.confirmOfflineAction(held.id);
      });
    }

    expect(
      fetchMock.mock.calls.map(([url, init]) => ({
        url,
        requestBody: JSON.parse(String(init?.body)),
      })),
    ).toEqual([
      {
        url: expect.stringMatching(/\/api\/triage$/),
        requestBody: closeOfflinePayload.requestBody,
      },
    ]);
    expect(result.current.offlineActions).toEqual([]);
    expect(readStoredOfflineQueue()).toEqual([]);
  });

  it.each([
    {
      failureKind: 'the unsent step is rejected by the host',
      cause: new Error('HTTP 500 close refused'),
      offline: [commentOfflinePayload, closeOfflinePayload],
      expectedReason: 'HTTP 500 close refused',
    },
    {
      failureKind:
        'the unsent step fails because the network is unavailable but the action carries no offline payload',
      cause: new TypeError('Failed to fetch'),
      offline: undefined,
      expectedReason: 'Failed to fetch',
    },
  ])(
    'surfaces the failure and holds nothing when $failureKind',
    async ({ cause, offline, expectedReason }) => {
      const { result } = renderHook(() => useConsoleActionQueue());
      const action = makeAction({
        message: 'OK & Close — #866',
        color: 'red',
        commit: jest
          .fn<Promise<void>, []>()
          .mockRejectedValue(new ConsoleActionPartiallySentError(1, cause)),
        offline,
      });

      await commitAfterUndoWindow(result, action);

      expect(action.commit).toHaveBeenCalledTimes(1);
      expect(result.current.error).toMatchObject({
        message: 'OK & Close — #866',
        reason: expectedReason,
      });
      expect(result.current.offlineActions).toEqual([]);
      expect(readStoredOfflineQueue()).toEqual([]);
      expect(result.current.writeState).toEqual({
        status: 'failed',
        attempt: 1,
      });
    },
  );

  const retryFromErrorToast = async (queue: {
    current: ConsoleActionQueue;
  }): Promise<void> => {
    const retry = queue.current.error?.retry;
    act(() => {
      queue.current.dismissError();
    });
    await act(async () => {
      retry?.();
      await flushMicrotasks();
    });
  };

  const renderQueueWithAirplaneModeSwitch = () =>
    renderHook(
      ({ isAirplaneModeOn }: { isAirplaneModeOn: boolean }) =>
        useConsoleActionQueue({ isAirplaneModeOn }),
      { initialProps: { isAirplaneModeOn: false } },
    );

  const heldCloseOnly = [
    expect.objectContaining({
      ...closeOfflinePayload,
      message: 'OK & Close — #866',
      color: 'red',
    }),
  ];

  const heldCommentAndClose = [
    expect.objectContaining({
      ...commentOfflinePayload,
      message: 'OK & Close — #866',
      color: 'red',
    }),
    expect.objectContaining({
      ...closeOfflinePayload,
      message: 'OK & Close — #866',
      color: 'red',
    }),
  ];

  it('retries an action whose comment was sent by sending only the close, never the comment again, when the host rejected the close while online', async () => {
    const { result } = renderHook(() => useConsoleActionQueue());
    const commentStep = jest
      .fn<Promise<void>, []>()
      .mockResolvedValue(undefined);
    const closeStep = jest
      .fn<Promise<void>, []>()
      .mockRejectedValueOnce(new Error('HTTP 500 close refused'))
      .mockResolvedValue(undefined);
    const commit = jest.fn((sentStepCount: number) =>
      consoleActionStepsRun([commentStep, closeStep], sentStepCount),
    );
    const action = makeAction({
      message: 'OK & Close — #866',
      color: 'red',
      commit,
      offline: [commentOfflinePayload, closeOfflinePayload],
    });
    await commitAfterUndoWindow(result, action);
    expect(result.current.error).toMatchObject({
      message: 'OK & Close — #866',
      reason: 'HTTP 500 close refused',
    });

    await retryFromErrorToast(result);

    expect(commit.mock.calls).toEqual([[0], [1]]);
    expect(commentStep).toHaveBeenCalledTimes(1);
    expect(closeStep).toHaveBeenCalledTimes(2);
    expect(result.current.error).toBeNull();
    expect(result.current.offlineActions).toEqual([]);
    expect(readStoredOfflineQueue()).toEqual([]);
    expect(result.current.writeState).toEqual({
      status: 'succeeded',
      attempt: 2,
    });
  });

  it.each([
    {
      retryFailureKind: 'a host rejection that is not a partially sent error',
      retryFailure: new Error('HTTP 502 status refused'),
      expectedReason: 'HTTP 502 status refused',
      expectedCommitCalls: [[0], [1], [1]],
    },
    {
      retryFailureKind: 'a partially sent error counting 2 sent steps',
      retryFailure: new ConsoleActionPartiallySentError(
        2,
        new Error('HTTP 502 status refused'),
      ),
      expectedReason: 'HTTP 502 status refused',
      expectedCommitCalls: [[0], [1], [2]],
    },
  ])(
    'commits each retry from the sent step count the latest failure leaves when the first retry fails with $retryFailureKind',
    async ({ retryFailure, expectedReason, expectedCommitCalls }) => {
      const { result } = renderHook(() => useConsoleActionQueue());
      const commit = jest
        .fn<Promise<void>, [number]>()
        .mockRejectedValueOnce(
          new ConsoleActionPartiallySentError(
            1,
            new Error('HTTP 500 close refused'),
          ),
        )
        .mockRejectedValueOnce(retryFailure)
        .mockResolvedValue(undefined);
      const action = makeAction({
        message: 'OK & Close — #866',
        color: 'red',
        commit,
        offline: [
          commentOfflinePayload,
          closeOfflinePayload,
          setStatusOfflinePayload,
        ],
      });
      await commitAfterUndoWindow(result, action);

      await retryFromErrorToast(result);

      expect(result.current.error).toMatchObject({
        message: 'OK & Close — #866',
        reason: expectedReason,
      });
      expect(result.current.writeState).toEqual({
        status: 'failed',
        attempt: 2,
      });

      await retryFromErrorToast(result);

      expect(commit.mock.calls).toEqual(expectedCommitCalls);
      expect(result.current.error).toBeNull();
      expect(result.current.offlineActions).toEqual([]);
      expect(result.current.writeState).toEqual({
        status: 'succeeded',
        attempt: 3,
      });
    },
  );

  it.each([
    {
      retryFailureKind:
        'a partially sent error caused by an unavailable network',
      retryFailure: new ConsoleActionPartiallySentError(
        1,
        new TypeError('Failed to fetch'),
      ),
    },
    {
      retryFailureKind: 'an unavailable network',
      retryFailure: new TypeError('Failed to fetch'),
    },
  ])(
    'holds only the unsent close as one entry without an error when the retry of an action whose comment was sent fails with $retryFailureKind',
    async ({ retryFailure }) => {
      const { result } = renderHook(() => useConsoleActionQueue());
      const commit = jest
        .fn<Promise<void>, [number]>()
        .mockRejectedValueOnce(
          new ConsoleActionPartiallySentError(
            1,
            new Error('HTTP 500 close refused'),
          ),
        )
        .mockRejectedValueOnce(retryFailure);
      const action = makeAction({
        message: 'OK & Close — #866',
        color: 'red',
        commit,
        offline: [commentOfflinePayload, closeOfflinePayload],
      });
      await commitAfterUndoWindow(result, action);

      await retryFromErrorToast(result);

      expect(commit.mock.calls).toEqual([[0], [1]]);
      expect(result.current.offlineActions).toEqual(heldCloseOnly);
      expect(readStoredOfflineQueue()).toEqual(heldCloseOnly);
      expect(result.current.error).toBeNull();
      expect(result.current.writeState).toEqual({
        status: 'offline',
        attempt: 2,
      });
    },
  );

  it('holds only the unsent close without committing, sending or an airplane mode error when airplane mode is turned on before retrying an action whose comment was sent', async () => {
    const fetchMock = installOperationFetch();
    const { result, rerender } = renderQueueWithAirplaneModeSwitch();
    const commit = jest
      .fn<Promise<void>, [number]>()
      .mockRejectedValueOnce(
        new ConsoleActionPartiallySentError(
          1,
          new Error('HTTP 500 close refused'),
        ),
      )
      .mockResolvedValue(undefined);
    const revertAdvance = jest.fn();
    const action = makeAction({
      message: 'OK & Close — #866',
      color: 'red',
      commit,
      revertAdvance,
      offline: [commentOfflinePayload, closeOfflinePayload],
    });
    await commitAfterUndoWindow(result, action);
    rerender({ isAirplaneModeOn: true });

    await retryFromErrorToast(result);

    expect(commit.mock.calls).toEqual([[0]]);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(revertAdvance).not.toHaveBeenCalled();
    expect(result.current.offlineActions).toEqual(heldCloseOnly);
    expect(readStoredOfflineQueue()).toEqual(heldCloseOnly);
    expect(result.current.error).toBeNull();
    expect(result.current.writeState).toEqual({
      status: 'offline',
      attempt: 2,
    });
  });

  it('shows the airplane mode error, reverts the advance and commits nothing when airplane mode is turned on before retrying a partially sent action that carries no offline payload', async () => {
    const { result, rerender } = renderQueueWithAirplaneModeSwitch();
    const commit = jest
      .fn<Promise<void>, [number]>()
      .mockRejectedValueOnce(
        new ConsoleActionPartiallySentError(
          1,
          new Error('HTTP 500 close refused'),
        ),
      )
      .mockResolvedValue(undefined);
    const revertAdvance = jest.fn();
    const action = makeAction({
      message: 'OK & Close — #866',
      color: 'red',
      commit,
      revertAdvance,
    });
    await commitAfterUndoWindow(result, action);
    rerender({ isAirplaneModeOn: true });

    await retryFromErrorToast(result);

    expect(commit).toHaveBeenCalledTimes(1);
    expect(revertAdvance).toHaveBeenCalledTimes(1);
    expect(result.current.offlineActions).toEqual([]);
    expect(result.current.error).toEqual({
      message: 'Airplane mode',
      reason:
        'This action requires a network connection. Turn off airplane mode and try again.',
    });
    expect(result.current.writeState).toEqual({
      status: 'failed',
      attempt: 2,
    });
  });

  it('retries an action whose first request was rejected by sending every request again starting with the comment', async () => {
    const { result } = renderHook(() => useConsoleActionQueue());
    const commentStep = jest
      .fn<Promise<void>, []>()
      .mockRejectedValueOnce(new Error('HTTP 500 comment refused'))
      .mockResolvedValue(undefined);
    const closeStep = jest.fn<Promise<void>, []>().mockResolvedValue(undefined);
    const commit = jest.fn((sentStepCount: number) =>
      consoleActionStepsRun([commentStep, closeStep], sentStepCount),
    );
    const action = makeAction({
      message: 'OK & Close — #866',
      color: 'red',
      commit,
      offline: [commentOfflinePayload, closeOfflinePayload],
    });
    await commitAfterUndoWindow(result, action);
    expect(result.current.error).toMatchObject({
      message: 'OK & Close — #866',
      reason: 'HTTP 500 comment refused',
    });

    await retryFromErrorToast(result);

    expect(commit).toHaveBeenCalledTimes(2);
    expect(commentStep).toHaveBeenCalledTimes(2);
    expect(closeStep).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBeNull();
    expect(result.current.offlineActions).toEqual([]);
    expect(result.current.writeState).toEqual({
      status: 'succeeded',
      attempt: 2,
    });
  });

  it('holds every payload of an action whose first request was rejected when its retry fails because the network is unavailable', async () => {
    const { result } = renderHook(() => useConsoleActionQueue());
    const commentStep = jest
      .fn<Promise<void>, []>()
      .mockRejectedValueOnce(new Error('HTTP 500 comment refused'))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const closeStep = jest.fn<Promise<void>, []>().mockResolvedValue(undefined);
    const commit = jest.fn((sentStepCount: number) =>
      consoleActionStepsRun([commentStep, closeStep], sentStepCount),
    );
    const action = makeAction({
      message: 'OK & Close — #866',
      color: 'red',
      commit,
      offline: [commentOfflinePayload, closeOfflinePayload],
    });
    await commitAfterUndoWindow(result, action);

    await retryFromErrorToast(result);

    expect(commentStep).toHaveBeenCalledTimes(2);
    expect(closeStep).not.toHaveBeenCalled();
    expect(result.current.offlineActions).toEqual(heldCommentAndClose);
    expect(readStoredOfflineQueue()).toEqual(heldCommentAndClose);
    expect(result.current.error).toBeNull();
    expect(result.current.writeState).toEqual({
      status: 'offline',
      attempt: 2,
    });
  });

  it('holds every payload without sending anything when airplane mode is turned on before retrying an action whose first request was rejected', async () => {
    const { result, rerender } = renderQueueWithAirplaneModeSwitch();
    const commentStep = jest
      .fn<Promise<void>, []>()
      .mockRejectedValueOnce(new Error('HTTP 500 comment refused'))
      .mockResolvedValue(undefined);
    const closeStep = jest.fn<Promise<void>, []>().mockResolvedValue(undefined);
    const commit = jest.fn((sentStepCount: number) =>
      consoleActionStepsRun([commentStep, closeStep], sentStepCount),
    );
    const action = makeAction({
      message: 'OK & Close — #866',
      color: 'red',
      commit,
      offline: [commentOfflinePayload, closeOfflinePayload],
    });
    await commitAfterUndoWindow(result, action);
    rerender({ isAirplaneModeOn: true });

    await retryFromErrorToast(result);

    expect(commit).toHaveBeenCalledTimes(1);
    expect(commentStep).toHaveBeenCalledTimes(1);
    expect(closeStep).not.toHaveBeenCalled();
    expect(result.current.offlineActions).toEqual(heldCommentAndClose);
    expect(readStoredOfflineQueue()).toEqual(heldCommentAndClose);
    expect(result.current.error).toBeNull();
    expect(result.current.writeState).toEqual({
      status: 'offline',
      attempt: 2,
    });
  });
});
