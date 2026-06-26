import { act, renderHook } from '@testing-library/react';
import { useConsoleActionQueue } from './useConsoleActionQueue';

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
  });

  afterEach(() => {
    jest.useRealTimers();
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
    expect(result.current.error).toEqual({
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
    expect(result.current.error).toEqual({
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
});
