import { act, renderHook } from '@testing-library/react';
import { navigatePush } from '../lib/navigation';
import { ACTION_TOAST_DELAY_MS } from '../logic/actionToast';
import { useConsoleActionQueue } from './useConsoleActionQueue';
import { useConsoleAutomaticProjectNavigation } from './useConsoleAutomaticProjectNavigation';

jest.mock('../lib/navigation', () => ({
  navigatePush: jest.fn(),
}));

const isTimerNeverExpired = (): boolean => false;
const isTimerAlwaysExpired = (): boolean => true;

const defaultArgs = {
  timerMode: true,
  isTimerExpired: isTimerNeverExpired,
  prsCount: 0,
  todoByHumanCount: 0,
  pjcode: 'acme' as string | null,
  pjcodes: ['acme', 'beta'],
  projectMinutes: { acme: 30, beta: 30 },
  prsSnapshotLoaded: true,
  todoByHumanSnapshotLoaded: true,
  prsSnapshotFromCache: false,
  todoByHumanSnapshotFromCache: false,
  explicitlySelectedPjcode: null as string | null,
  enqueueSequence: 0,
};

describe('useConsoleAutomaticProjectNavigation', () => {
  beforeEach(() => {
    (navigatePush as jest.Mock).mockClear();
  });

  it('navigates to next project when prs and todo-by-human are both zero on arrival', () => {
    renderHook(() =>
      useConsoleAutomaticProjectNavigation(
        defaultArgs.timerMode,
        defaultArgs.isTimerExpired,
        defaultArgs.prsCount,
        defaultArgs.todoByHumanCount,
        defaultArgs.pjcode,
        defaultArgs.pjcodes,
        defaultArgs.projectMinutes,
        defaultArgs.prsSnapshotLoaded,
        defaultArgs.todoByHumanSnapshotLoaded,
        defaultArgs.prsSnapshotFromCache,
        defaultArgs.todoByHumanSnapshotFromCache,
        defaultArgs.explicitlySelectedPjcode,
        defaultArgs.enqueueSequence,
        null,
      ),
    );
    expect(navigatePush).toHaveBeenCalledWith('/projects/beta/todo-by-human');
  });

  it('does not navigate when timer mode is off', () => {
    renderHook(() =>
      useConsoleAutomaticProjectNavigation(
        false,
        isTimerNeverExpired,
        0,
        0,
        'acme',
        ['acme', 'beta'],
        { acme: 30, beta: 30 },
        true,
        true,
        false,
        false,
        null,
        0,
        null,
      ),
    );
    expect(navigatePush).not.toHaveBeenCalled();
  });

  it('does not navigate when prs count is greater than zero', () => {
    renderHook(() =>
      useConsoleAutomaticProjectNavigation(
        true,
        isTimerNeverExpired,
        1,
        0,
        'acme',
        ['acme', 'beta'],
        { acme: 30, beta: 30 },
        true,
        true,
        false,
        false,
        null,
        0,
        null,
      ),
    );
    expect(navigatePush).not.toHaveBeenCalled();
  });

  it('does not navigate when todo-by-human count is greater than zero', () => {
    renderHook(() =>
      useConsoleAutomaticProjectNavigation(
        true,
        isTimerNeverExpired,
        0,
        1,
        'acme',
        ['acme', 'beta'],
        { acme: 30, beta: 30 },
        true,
        true,
        false,
        false,
        null,
        0,
        null,
      ),
    );
    expect(navigatePush).not.toHaveBeenCalled();
  });

  it('does not navigate when prs snapshot is not yet loaded', () => {
    renderHook(() =>
      useConsoleAutomaticProjectNavigation(
        true,
        isTimerNeverExpired,
        0,
        0,
        'acme',
        ['acme', 'beta'],
        { acme: 30, beta: 30 },
        false,
        true,
        false,
        false,
        null,
        0,
        null,
      ),
    );
    expect(navigatePush).not.toHaveBeenCalled();
  });

  it('does not navigate when todo-by-human snapshot is not yet loaded', () => {
    renderHook(() =>
      useConsoleAutomaticProjectNavigation(
        true,
        isTimerNeverExpired,
        0,
        0,
        'acme',
        ['acme', 'beta'],
        { acme: 30, beta: 30 },
        true,
        false,
        false,
        false,
        null,
        0,
        null,
      ),
    );
    expect(navigatePush).not.toHaveBeenCalled();
  });

  it('does not navigate when prs snapshot is from cache', () => {
    renderHook(() =>
      useConsoleAutomaticProjectNavigation(
        true,
        isTimerNeverExpired,
        0,
        0,
        'acme',
        ['acme', 'beta'],
        { acme: 30, beta: 30 },
        true,
        true,
        true,
        false,
        null,
        0,
        null,
      ),
    );
    expect(navigatePush).not.toHaveBeenCalled();
  });

  it('does not navigate when todo-by-human snapshot is from cache', () => {
    renderHook(() =>
      useConsoleAutomaticProjectNavigation(
        true,
        isTimerNeverExpired,
        0,
        0,
        'acme',
        ['acme', 'beta'],
        { acme: 30, beta: 30 },
        true,
        true,
        false,
        true,
        null,
        0,
        null,
      ),
    );
    expect(navigatePush).not.toHaveBeenCalled();
  });

  it('does not navigate when no other project has minutes configured', () => {
    renderHook(() =>
      useConsoleAutomaticProjectNavigation(
        true,
        isTimerNeverExpired,
        0,
        0,
        'acme',
        ['acme'],
        { acme: 30 },
        true,
        true,
        false,
        false,
        null,
        0,
        null,
      ),
    );
    expect(navigatePush).not.toHaveBeenCalled();
  });

  it('does not navigate when pjcode is null', () => {
    renderHook(() =>
      useConsoleAutomaticProjectNavigation(
        true,
        isTimerNeverExpired,
        0,
        0,
        null,
        ['acme', 'beta'],
        { acme: 30, beta: 30 },
        true,
        true,
        false,
        false,
        null,
        0,
        null,
      ),
    );
    expect(navigatePush).not.toHaveBeenCalled();
  });

  it('does not re-navigate for the same pjcode on re-render', () => {
    const { rerender } = renderHook(() =>
      useConsoleAutomaticProjectNavigation(
        true,
        isTimerNeverExpired,
        0,
        0,
        'acme',
        ['acme', 'beta'],
        { acme: 30, beta: 30 },
        true,
        true,
        false,
        false,
        null,
        0,
        null,
      ),
    );
    rerender();
    expect(navigatePush).toHaveBeenCalledTimes(1);
  });

  it('stops skipping after all projects with minutes are exhausted', () => {
    const { rerender } = renderHook(
      ({ pjcode }: { pjcode: string }) =>
        useConsoleAutomaticProjectNavigation(
          true,
          isTimerNeverExpired,
          0,
          0,
          pjcode,
          ['acme', 'beta'],
          { acme: 30, beta: 30 },
          true,
          true,
          false,
          false,
          null,
          0,
          null,
        ),
      { initialProps: { pjcode: 'acme' } },
    );
    expect(navigatePush).toHaveBeenCalledWith('/projects/beta/todo-by-human');
    (navigatePush as jest.Mock).mockClear();

    rerender({ pjcode: 'beta' });
    expect(navigatePush).not.toHaveBeenCalled();
  });

  it('never oscillates back and forth between two projects that both keep nonzero remaining minutes forever, across many periodic re-evaluations with nothing else changing', () => {
    const navigatePushMock = navigatePush as jest.Mock;
    const extractPjcodeFromNavigatedUrl = (url: string): string =>
      url.split('/')[2];
    const { rerender } = renderHook(
      ({ pjcode }: { pjcode: string }) =>
        useConsoleAutomaticProjectNavigation(
          true,
          isTimerNeverExpired,
          0,
          0,
          pjcode,
          ['acme', 'beta'],
          { acme: 30, beta: 30 },
          true,
          true,
          false,
          false,
          null,
          0,
          null,
        ),
      { initialProps: { pjcode: 'acme' } },
    );

    let currentPjcode = 'acme';
    for (
      let periodicReEvaluation = 0;
      periodicReEvaluation < 20;
      periodicReEvaluation++
    ) {
      if (navigatePushMock.mock.calls.length > 0) {
        const lastCall =
          navigatePushMock.mock.calls[navigatePushMock.mock.calls.length - 1];
        currentPjcode = extractPjcodeFromNavigatedUrl(lastCall[0] as string);
      }
      rerender({ pjcode: currentPjcode });
    }

    expect(navigatePushMock.mock.calls.length).toBeLessThanOrEqual(1);
  });

  it('resets skip counter and navigates again when arriving at a project with items', () => {
    const { rerender } = renderHook(
      ({ pjcode, prsCount }: { pjcode: string; prsCount: number }) =>
        useConsoleAutomaticProjectNavigation(
          true,
          isTimerNeverExpired,
          prsCount,
          0,
          pjcode,
          ['acme', 'beta', 'gamma'],
          { acme: 30, beta: 30, gamma: 30 },
          true,
          true,
          false,
          false,
          null,
          0,
          null,
        ),
      { initialProps: { pjcode: 'acme', prsCount: 0 } },
    );
    expect(navigatePush).toHaveBeenCalledWith('/projects/beta/todo-by-human');
    (navigatePush as jest.Mock).mockClear();

    rerender({ pjcode: 'beta', prsCount: 1 });
    expect(navigatePush).not.toHaveBeenCalled();
    (navigatePush as jest.Mock).mockClear();

    rerender({ pjcode: 'gamma', prsCount: 0 });
    expect(navigatePush).toHaveBeenCalledWith('/projects/acme/todo-by-human');
  });

  it('navigates to next project including unconfigured ones that use DEFAULT_TIMER_MINUTES', () => {
    renderHook(() =>
      useConsoleAutomaticProjectNavigation(
        true,
        isTimerNeverExpired,
        0,
        0,
        'acme',
        ['acme', 'no-timer', 'beta'],
        { acme: 30, beta: 30 },
        true,
        true,
        false,
        false,
        null,
        0,
        null,
      ),
    );
    expect(navigatePush).toHaveBeenCalledWith(
      '/projects/no-timer/todo-by-human',
    );
  });

  it('completes full skip cycle through unconfigured projects', () => {
    const { rerender } = renderHook(
      ({ pjcode }: { pjcode: string }) =>
        useConsoleAutomaticProjectNavigation(
          true,
          isTimerNeverExpired,
          0,
          0,
          pjcode,
          ['acme', 'no-timer', 'beta'],
          { acme: 30, beta: 30 },
          true,
          true,
          false,
          false,
          null,
          0,
          null,
        ),
      { initialProps: { pjcode: 'acme' } },
    );
    expect(navigatePush).toHaveBeenCalledWith(
      '/projects/no-timer/todo-by-human',
    );
    (navigatePush as jest.Mock).mockClear();

    rerender({ pjcode: 'no-timer' });
    expect(navigatePush).toHaveBeenCalledWith('/projects/beta/todo-by-human');
    (navigatePush as jest.Mock).mockClear();

    rerender({ pjcode: 'beta' });
    expect(navigatePush).not.toHaveBeenCalled();
  });

  it('navigates when pjcodes loads after snapshots (race condition)', () => {
    const { rerender } = renderHook(
      ({ pjcodes }: { pjcodes: string[] }) =>
        useConsoleAutomaticProjectNavigation(
          true,
          isTimerNeverExpired,
          0,
          0,
          'beta',
          pjcodes,
          { acme: 30, beta: 30 },
          true,
          true,
          false,
          false,
          null,
          0,
          null,
        ),
      { initialProps: { pjcodes: [] as string[] } },
    );
    expect(navigatePush).not.toHaveBeenCalled();

    rerender({ pjcodes: ['acme', 'beta'] });
    expect(navigatePush).toHaveBeenCalledWith('/projects/acme/todo-by-human');
  });

  it('navigates to next project when counts drop to zero from non-zero while already on a project', () => {
    const { rerender } = renderHook(
      ({ prsCount }: { prsCount: number }) =>
        useConsoleAutomaticProjectNavigation(
          true,
          isTimerNeverExpired,
          prsCount,
          0,
          'acme',
          ['acme', 'beta'],
          { acme: 30, beta: 30 },
          true,
          true,
          false,
          false,
          null,
          0,
          null,
        ),
      { initialProps: { prsCount: 1 } },
    );
    expect(navigatePush).not.toHaveBeenCalled();

    rerender({ prsCount: 0 });
    expect(navigatePush).toHaveBeenCalledWith('/projects/beta/todo-by-human');
  });

  it('navigates to next project when todo-by-human count drops to zero from non-zero while already on a project', () => {
    const { rerender } = renderHook(
      ({ todoByHumanCount }: { todoByHumanCount: number }) =>
        useConsoleAutomaticProjectNavigation(
          true,
          isTimerNeverExpired,
          0,
          todoByHumanCount,
          'acme',
          ['acme', 'beta'],
          { acme: 30, beta: 30 },
          true,
          true,
          false,
          false,
          null,
          0,
          null,
        ),
      { initialProps: { todoByHumanCount: 3 } },
    );
    expect(navigatePush).not.toHaveBeenCalled();

    rerender({ todoByHumanCount: 0 });
    expect(navigatePush).toHaveBeenCalledWith('/projects/beta/todo-by-human');
  });

  it('navigates from a previously-skipped project when returning after visiting a project with tasks', () => {
    const { rerender } = renderHook(
      ({ pjcode, prsCount }: { pjcode: string; prsCount: number }) =>
        useConsoleAutomaticProjectNavigation(
          true,
          isTimerNeverExpired,
          prsCount,
          0,
          pjcode,
          ['acme', 'beta'],
          { acme: 30, beta: 30 },
          true,
          true,
          false,
          false,
          null,
          0,
          null,
        ),
      { initialProps: { pjcode: 'acme', prsCount: 0 } },
    );
    expect(navigatePush).toHaveBeenCalledWith('/projects/beta/todo-by-human');
    (navigatePush as jest.Mock).mockClear();

    rerender({ pjcode: 'beta', prsCount: 1 });
    expect(navigatePush).not.toHaveBeenCalled();
    (navigatePush as jest.Mock).mockClear();

    rerender({ pjcode: 'acme', prsCount: 0 });
    expect(navigatePush).toHaveBeenCalledWith('/projects/beta/todo-by-human');
  });

  it('does not navigate when explicitlySelectedPjcode matches current pjcode', () => {
    renderHook(() =>
      useConsoleAutomaticProjectNavigation(
        true,
        isTimerNeverExpired,
        0,
        0,
        'acme',
        ['acme', 'beta'],
        { acme: 30, beta: 30 },
        true,
        true,
        false,
        false,
        'acme',
        0,
        null,
      ),
    );
    expect(navigatePush).toHaveBeenCalledWith('/projects/beta/todo-by-human');
  });

  it('does not navigate when explicitlySelectedPjcode matches current pjcode and no other project has remaining minutes', () => {
    renderHook(() =>
      useConsoleAutomaticProjectNavigation(
        true,
        isTimerNeverExpired,
        0,
        0,
        'acme',
        ['acme', 'beta'],
        { acme: 30, beta: 0 },
        true,
        true,
        false,
        false,
        'acme',
        0,
        null,
      ),
    );
    expect(navigatePush).not.toHaveBeenCalled();
  });

  it('navigates when explicitlySelectedPjcode is null', () => {
    renderHook(() =>
      useConsoleAutomaticProjectNavigation(
        true,
        isTimerNeverExpired,
        0,
        0,
        'acme',
        ['acme', 'beta'],
        { acme: 30, beta: 30 },
        true,
        true,
        false,
        false,
        null,
        0,
        null,
      ),
    );
    expect(navigatePush).toHaveBeenCalledWith('/projects/beta/todo-by-human');
  });

  it('navigates when explicitlySelectedPjcode is set to a different project than current pjcode', () => {
    renderHook(() =>
      useConsoleAutomaticProjectNavigation(
        true,
        isTimerNeverExpired,
        0,
        0,
        'acme',
        ['acme', 'beta'],
        { acme: 30, beta: 30 },
        true,
        true,
        false,
        false,
        'beta',
        0,
        null,
      ),
    );
    expect(navigatePush).toHaveBeenCalledWith('/projects/beta/todo-by-human');
  });

  it('does not navigate when the user has a task open, even when prs and todo-by-human are both zero (#32963)', () => {
    renderHook(() =>
      useConsoleAutomaticProjectNavigation(
        defaultArgs.timerMode,
        defaultArgs.isTimerExpired,
        defaultArgs.prsCount,
        defaultArgs.todoByHumanCount,
        defaultArgs.pjcode,
        defaultArgs.pjcodes,
        defaultArgs.projectMinutes,
        defaultArgs.prsSnapshotLoaded,
        defaultArgs.todoByHumanSnapshotLoaded,
        defaultArgs.prsSnapshotFromCache,
        defaultArgs.todoByHumanSnapshotFromCache,
        defaultArgs.explicitlySelectedPjcode,
        defaultArgs.enqueueSequence,
        'some-task-item-key',
      ),
    );
    expect(navigatePush).not.toHaveBeenCalled();
  });

  describe('enqueueSequence drives navigation evaluation with no write-confirmation wait', () => {
    it('navigates via the timer-elapsed path as soon as enqueueSequence reflects a newly enqueued action, on the very first render, with no later render standing in for write confirmation', () => {
      renderHook(() =>
        useConsoleAutomaticProjectNavigation(
          true,
          isTimerAlwaysExpired,
          1,
          1,
          'acme',
          ['acme', 'beta'],
          { acme: 30, beta: 30 },
          true,
          true,
          false,
          false,
          null,
          1,
          null,
        ),
      );
      expect(navigatePush).toHaveBeenCalledWith('/projects/beta/todo-by-human');
    });

    it('does not navigate via the timer-elapsed path when the timer has elapsed but enqueueSequence has not changed since the last evaluation', () => {
      const { rerender } = renderHook(
        ({ enqueueSequence }: { enqueueSequence: number }) =>
          useConsoleAutomaticProjectNavigation(
            true,
            isTimerAlwaysExpired,
            1,
            1,
            'acme',
            ['acme', 'beta'],
            { acme: 30, beta: 30 },
            true,
            true,
            false,
            false,
            null,
            enqueueSequence,
            null,
          ),
        { initialProps: { enqueueSequence: 0 } },
      );
      expect(navigatePush).not.toHaveBeenCalled();

      rerender({ enqueueSequence: 0 });
      expect(navigatePush).not.toHaveBeenCalled();
    });

    it('does not navigate again on a second render with the same enqueueSequence (dedup)', () => {
      const { rerender } = renderHook(
        ({ enqueueSequence }: { enqueueSequence: number }) =>
          useConsoleAutomaticProjectNavigation(
            true,
            isTimerAlwaysExpired,
            1,
            1,
            'acme',
            ['acme', 'beta'],
            { acme: 30, beta: 30 },
            true,
            true,
            false,
            false,
            null,
            enqueueSequence,
            null,
          ),
        { initialProps: { enqueueSequence: 1 } },
      );
      expect(navigatePush).toHaveBeenCalledTimes(1);
      expect(navigatePush).toHaveBeenCalledWith('/projects/beta/todo-by-human');

      rerender({ enqueueSequence: 1 });
      expect(navigatePush).toHaveBeenCalledTimes(1);
    });

    it('navigates again once a new enqueueSequence arrives after a prior one was already handled', () => {
      const { rerender } = renderHook(
        ({ enqueueSequence }: { enqueueSequence: number }) =>
          useConsoleAutomaticProjectNavigation(
            true,
            isTimerAlwaysExpired,
            1,
            1,
            'acme',
            ['acme', 'beta'],
            { acme: 30, beta: 30 },
            true,
            true,
            false,
            false,
            null,
            enqueueSequence,
            null,
          ),
        { initialProps: { enqueueSequence: 1 } },
      );
      expect(navigatePush).toHaveBeenCalledTimes(1);

      rerender({ enqueueSequence: 1 });
      expect(navigatePush).toHaveBeenCalledTimes(1);

      rerender({ enqueueSequence: 2 });
      expect(navigatePush).toHaveBeenCalledTimes(2);
    });

    it('navigates via the timer-elapsed path even while a task is open, because taskOpen does not suppress this path', () => {
      renderHook(() =>
        useConsoleAutomaticProjectNavigation(
          true,
          isTimerAlwaysExpired,
          1,
          1,
          'acme',
          ['acme', 'beta'],
          { acme: 30, beta: 30 },
          true,
          true,
          false,
          false,
          null,
          1,
          'some-task-item-key',
        ),
      );
      expect(navigatePush).toHaveBeenCalledWith('/projects/beta/todo-by-human');
    });

    it('navigates exactly once to the next project when both the timer-elapsed and remaining-count-zero conditions hold for the same newly enqueued action', () => {
      renderHook(() =>
        useConsoleAutomaticProjectNavigation(
          true,
          isTimerAlwaysExpired,
          0,
          0,
          'acme',
          ['acme', 'beta'],
          { acme: 30, beta: 30 },
          true,
          true,
          false,
          false,
          null,
          1,
          null,
        ),
      );
      expect(navigatePush).toHaveBeenCalledTimes(1);
      expect(navigatePush).toHaveBeenCalledWith('/projects/beta/todo-by-human');
    });
  });

  describe('the automatic project switch made for a newly enqueued action stays in place whatever the outcome of that action write', () => {
    const pjcodesWithTimers = ['acme', 'beta'];
    const projectMinutesByPjcode = { acme: 30, beta: 30 };
    const switchedToBetaUrl = '/projects/beta/todo-by-human';
    const approvedActionMessage = 'Approved — PR #851';

    const approveReviewOfflinePayload = {
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

    const flushMicrotasks = (): Promise<void> =>
      Promise.resolve().then(() => undefined);

    const renderActionQueueWithAutomaticProjectNavigation = () =>
      renderHook(
        ({ pjcode }: { pjcode: string }) => {
          const actionQueue = useConsoleActionQueue();
          useConsoleAutomaticProjectNavigation(
            true,
            isTimerAlwaysExpired,
            1,
            1,
            pjcode,
            pjcodesWithTimers,
            projectMinutesByPjcode,
            true,
            true,
            false,
            false,
            null,
            actionQueue.enqueueSequence,
            null,
          );
          return actionQueue;
        },
        { initialProps: { pjcode: 'acme' } },
      );

    beforeEach(() => {
      jest.useFakeTimers();
      localStorage.clear();
    });

    afterEach(() => {
      jest.useRealTimers();
      localStorage.clear();
    });

    it('does not revert the switch and keeps the same error content and a working retry when the write is confirmed failed', async () => {
      const { result, rerender } =
        renderActionQueueWithAutomaticProjectNavigation();
      expect(navigatePush).not.toHaveBeenCalled();

      const commit = jest
        .fn<Promise<void>, [number]>()
        .mockRejectedValueOnce(new Error('HTTP 422 review cannot be requested'))
        .mockRejectedValueOnce(new Error('HTTP 500 internal server error'));
      const revertAdvance = jest.fn();
      const revertOptimistic = jest.fn();
      act(() => {
        result.current.enqueue({
          message: approvedActionMessage,
          color: 'green',
          commit,
          advance: jest.fn(),
          revertAdvance,
          optimistic: jest.fn(),
          revertOptimistic,
        });
      });
      expect((navigatePush as jest.Mock).mock.calls).toEqual([
        [switchedToBetaUrl],
      ]);

      rerender({ pjcode: 'beta' });
      await act(async () => {
        jest.advanceTimersByTime(ACTION_TOAST_DELAY_MS);
        await flushMicrotasks();
      });

      expect(commit.mock.calls).toEqual([[0]]);
      expect(result.current.writeState).toEqual({
        status: 'failed',
        attempt: 1,
      });
      expect(result.current.error).toEqual({
        message: approvedActionMessage,
        reason: 'HTTP 422 review cannot be requested',
        retry: expect.any(Function),
      });
      expect(result.current.offlineActions).toEqual([]);
      expect(revertAdvance).not.toHaveBeenCalled();
      expect(revertOptimistic).not.toHaveBeenCalled();
      expect((navigatePush as jest.Mock).mock.calls).toEqual([
        [switchedToBetaUrl],
      ]);

      const retry = result.current.error?.retry;
      await act(async () => {
        retry?.();
        await flushMicrotasks();
      });

      expect(commit.mock.calls).toEqual([[0], [0]]);
      expect(result.current.writeState).toEqual({
        status: 'failed',
        attempt: 2,
      });
      expect(result.current.error).toEqual({
        message: approvedActionMessage,
        reason: 'HTTP 500 internal server error',
        retry: expect.any(Function),
      });
      expect(result.current.offlineActions).toEqual([]);
      expect(revertAdvance).not.toHaveBeenCalled();
      expect(revertOptimistic).not.toHaveBeenCalled();
      expect((navigatePush as jest.Mock).mock.calls).toEqual([
        [switchedToBetaUrl],
      ]);
    });

    it('does not revert the switch and keeps the same offline-pending entry when the write is queued offline after a network error', async () => {
      const { result, rerender } =
        renderActionQueueWithAutomaticProjectNavigation();
      expect(navigatePush).not.toHaveBeenCalled();

      const commit = jest
        .fn<Promise<void>, [number]>()
        .mockRejectedValue(new TypeError('Failed to fetch'));
      const revertAdvance = jest.fn();
      const revertOptimistic = jest.fn();
      act(() => {
        result.current.enqueue({
          message: approvedActionMessage,
          color: 'green',
          commit,
          advance: jest.fn(),
          revertAdvance,
          optimistic: jest.fn(),
          revertOptimistic,
          offline: [approveReviewOfflinePayload],
        });
      });
      expect((navigatePush as jest.Mock).mock.calls).toEqual([
        [switchedToBetaUrl],
      ]);

      rerender({ pjcode: 'beta' });
      await act(async () => {
        jest.advanceTimersByTime(ACTION_TOAST_DELAY_MS);
        await flushMicrotasks();
      });

      expect(commit.mock.calls).toEqual([[0]]);
      expect(result.current.writeState).toEqual({
        status: 'offline',
        attempt: 1,
      });
      expect(result.current.error).toBeNull();
      expect(result.current.offlineActions).toEqual([
        {
          ...approveReviewOfflinePayload,
          id: expect.any(String),
          message: approvedActionMessage,
          color: 'green',
          enqueuedAt: expect.any(Number),
        },
      ]);
      expect(revertAdvance).not.toHaveBeenCalled();
      expect(revertOptimistic).not.toHaveBeenCalled();
      expect((navigatePush as jest.Mock).mock.calls).toEqual([
        [switchedToBetaUrl],
      ]);

      const heldActionId = result.current.offlineActions[0].id;
      act(() => {
        result.current.discardOfflineAction(heldActionId);
      });

      expect(result.current.offlineActions).toEqual([]);
      expect(result.current.error).toBeNull();
      expect(revertAdvance).not.toHaveBeenCalled();
      expect(revertOptimistic).not.toHaveBeenCalled();
      expect((navigatePush as jest.Mock).mock.calls).toEqual([
        [switchedToBetaUrl],
      ]);
    });
  });
});
