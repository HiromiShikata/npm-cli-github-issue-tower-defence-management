import { renderHook } from '@testing-library/react';
import { navigatePush } from '../lib/navigation';
import { useConsoleTimerProjectSkipNavigation } from './useConsoleTimerProjectSkipNavigation';

jest.mock('../lib/navigation', () => ({
  navigatePush: jest.fn(),
}));

const defaultArgs = {
  timerMode: true,
  prsCount: 0,
  todoByHumanCount: 0,
  pjcode: 'acme' as string | null,
  pjcodes: ['acme', 'beta'],
  projectMinutes: { acme: 30, beta: 30 },
  prsSnapshotLoaded: true,
  todoByHumanSnapshotLoaded: true,
  prsSnapshotFromCache: false,
  todoByHumanSnapshotFromCache: false,
};

describe('useConsoleTimerProjectSkipNavigation', () => {
  beforeEach(() => {
    (navigatePush as jest.Mock).mockClear();
  });

  it('navigates to next project when prs and todo-by-human are both zero on arrival', () => {
    renderHook(() =>
      useConsoleTimerProjectSkipNavigation(
        defaultArgs.timerMode,
        defaultArgs.prsCount,
        defaultArgs.todoByHumanCount,
        defaultArgs.pjcode,
        defaultArgs.pjcodes,
        defaultArgs.projectMinutes,
        defaultArgs.prsSnapshotLoaded,
        defaultArgs.todoByHumanSnapshotLoaded,
        defaultArgs.prsSnapshotFromCache,
        defaultArgs.todoByHumanSnapshotFromCache,
      ),
    );
    expect(navigatePush).toHaveBeenCalledWith('/projects/beta');
  });

  it('does not navigate when timer mode is off', () => {
    renderHook(() =>
      useConsoleTimerProjectSkipNavigation(
        false,
        0,
        0,
        'acme',
        ['acme', 'beta'],
        { acme: 30, beta: 30 },
        true,
        true,
        false,
        false,
      ),
    );
    expect(navigatePush).not.toHaveBeenCalled();
  });

  it('does not navigate when prs count is greater than zero', () => {
    renderHook(() =>
      useConsoleTimerProjectSkipNavigation(
        true,
        1,
        0,
        'acme',
        ['acme', 'beta'],
        { acme: 30, beta: 30 },
        true,
        true,
        false,
        false,
      ),
    );
    expect(navigatePush).not.toHaveBeenCalled();
  });

  it('does not navigate when todo-by-human count is greater than zero', () => {
    renderHook(() =>
      useConsoleTimerProjectSkipNavigation(
        true,
        0,
        1,
        'acme',
        ['acme', 'beta'],
        { acme: 30, beta: 30 },
        true,
        true,
        false,
        false,
      ),
    );
    expect(navigatePush).not.toHaveBeenCalled();
  });

  it('does not navigate when prs snapshot is not yet loaded', () => {
    renderHook(() =>
      useConsoleTimerProjectSkipNavigation(
        true,
        0,
        0,
        'acme',
        ['acme', 'beta'],
        { acme: 30, beta: 30 },
        false,
        true,
        false,
        false,
      ),
    );
    expect(navigatePush).not.toHaveBeenCalled();
  });

  it('does not navigate when todo-by-human snapshot is not yet loaded', () => {
    renderHook(() =>
      useConsoleTimerProjectSkipNavigation(
        true,
        0,
        0,
        'acme',
        ['acme', 'beta'],
        { acme: 30, beta: 30 },
        true,
        false,
        false,
        false,
      ),
    );
    expect(navigatePush).not.toHaveBeenCalled();
  });

  it('does not navigate when prs snapshot is from cache', () => {
    renderHook(() =>
      useConsoleTimerProjectSkipNavigation(
        true,
        0,
        0,
        'acme',
        ['acme', 'beta'],
        { acme: 30, beta: 30 },
        true,
        true,
        true,
        false,
      ),
    );
    expect(navigatePush).not.toHaveBeenCalled();
  });

  it('does not navigate when todo-by-human snapshot is from cache', () => {
    renderHook(() =>
      useConsoleTimerProjectSkipNavigation(
        true,
        0,
        0,
        'acme',
        ['acme', 'beta'],
        { acme: 30, beta: 30 },
        true,
        true,
        false,
        true,
      ),
    );
    expect(navigatePush).not.toHaveBeenCalled();
  });

  it('does not navigate when no other project has minutes configured', () => {
    renderHook(() =>
      useConsoleTimerProjectSkipNavigation(
        true,
        0,
        0,
        'acme',
        ['acme'],
        { acme: 30 },
        true,
        true,
        false,
        false,
      ),
    );
    expect(navigatePush).not.toHaveBeenCalled();
  });

  it('does not navigate when pjcode is null', () => {
    renderHook(() =>
      useConsoleTimerProjectSkipNavigation(
        true,
        0,
        0,
        null,
        ['acme', 'beta'],
        { acme: 30, beta: 30 },
        true,
        true,
        false,
        false,
      ),
    );
    expect(navigatePush).not.toHaveBeenCalled();
  });

  it('does not re-navigate for the same pjcode on re-render', () => {
    const { rerender } = renderHook(() =>
      useConsoleTimerProjectSkipNavigation(
        true,
        0,
        0,
        'acme',
        ['acme', 'beta'],
        { acme: 30, beta: 30 },
        true,
        true,
        false,
        false,
      ),
    );
    rerender();
    expect(navigatePush).toHaveBeenCalledTimes(1);
  });

  it('stops skipping after all projects with minutes are exhausted', () => {
    const { rerender } = renderHook(
      ({ pjcode }: { pjcode: string }) =>
        useConsoleTimerProjectSkipNavigation(
          true,
          0,
          0,
          pjcode,
          ['acme', 'beta'],
          { acme: 30, beta: 30 },
          true,
          true,
          false,
          false,
        ),
      { initialProps: { pjcode: 'acme' } },
    );
    expect(navigatePush).toHaveBeenCalledWith('/projects/beta');
    (navigatePush as jest.Mock).mockClear();

    rerender({ pjcode: 'beta' });
    expect(navigatePush).not.toHaveBeenCalled();
  });

  it('resets skip counter and navigates again when arriving at a project with items', () => {
    const { rerender } = renderHook(
      ({ pjcode, prsCount }: { pjcode: string; prsCount: number }) =>
        useConsoleTimerProjectSkipNavigation(
          true,
          prsCount,
          0,
          pjcode,
          ['acme', 'beta', 'gamma'],
          { acme: 30, beta: 30, gamma: 30 },
          true,
          true,
          false,
          false,
        ),
      { initialProps: { pjcode: 'acme', prsCount: 0 } },
    );
    expect(navigatePush).toHaveBeenCalledWith('/projects/beta');
    (navigatePush as jest.Mock).mockClear();

    rerender({ pjcode: 'beta', prsCount: 1 });
    expect(navigatePush).not.toHaveBeenCalled();
    (navigatePush as jest.Mock).mockClear();

    rerender({ pjcode: 'gamma', prsCount: 0 });
    expect(navigatePush).toHaveBeenCalledWith('/projects/acme');
  });

  it('navigates to next project with minutes configured when current next has no minutes', () => {
    renderHook(() =>
      useConsoleTimerProjectSkipNavigation(
        true,
        0,
        0,
        'acme',
        ['acme', 'no-timer', 'beta'],
        { acme: 30, beta: 30 },
        true,
        true,
        false,
        false,
      ),
    );
    expect(navigatePush).toHaveBeenCalledWith('/projects/beta');
  });
});
