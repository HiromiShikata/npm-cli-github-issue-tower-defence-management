import { renderHook } from '@testing-library/react';
import { navigatePush } from '../lib/navigation';
import { useConsoleAwaitingOwnerTimerNavigation } from './useConsoleAwaitingOwnerTimerNavigation';

jest.mock('../lib/navigation', () => ({
  navigatePush: jest.fn(),
}));

describe('useConsoleAwaitingOwnerTimerNavigation', () => {
  beforeEach(() => {
    (navigatePush as jest.Mock).mockClear();
  });

  it('navigates to the next project when timer mode is on and prs count drops to zero', () => {
    const { rerender } = renderHook(
      ({ prsCount }: { prsCount: number }) =>
        useConsoleAwaitingOwnerTimerNavigation(
          true,
          prsCount,
          'acme',
          ['acme', 'beta'],
          { acme: 30, beta: 30 },
        ),
      { initialProps: { prsCount: 1 } },
    );
    rerender({ prsCount: 0 });
    expect(navigatePush).toHaveBeenCalledWith('/projects/beta');
  });

  it('does not navigate when timer mode is off', () => {
    const { rerender } = renderHook(
      ({ prsCount }: { prsCount: number }) =>
        useConsoleAwaitingOwnerTimerNavigation(
          false,
          prsCount,
          'acme',
          ['acme', 'beta'],
          { acme: 30, beta: 30 },
        ),
      { initialProps: { prsCount: 1 } },
    );
    rerender({ prsCount: 0 });
    expect(navigatePush).not.toHaveBeenCalled();
  });

  it('does not navigate when no other project has minutes configured', () => {
    const { rerender } = renderHook(
      ({ prsCount }: { prsCount: number }) =>
        useConsoleAwaitingOwnerTimerNavigation(
          true,
          prsCount,
          'acme',
          ['acme'],
          { acme: 30 },
        ),
      { initialProps: { prsCount: 1 } },
    );
    rerender({ prsCount: 0 });
    expect(navigatePush).not.toHaveBeenCalled();
  });

  it('does not navigate when prs count was already zero before the render', () => {
    const { rerender } = renderHook(
      ({ prsCount }: { prsCount: number }) =>
        useConsoleAwaitingOwnerTimerNavigation(
          true,
          prsCount,
          'acme',
          ['acme', 'beta'],
          { acme: 30, beta: 30 },
        ),
      { initialProps: { prsCount: 0 } },
    );
    rerender({ prsCount: 0 });
    expect(navigatePush).not.toHaveBeenCalled();
  });

  it('does not navigate when pjcode changes even if prs count drops to zero', () => {
    const { rerender } = renderHook(
      ({ prsCount, pjcode }: { prsCount: number; pjcode: string }) =>
        useConsoleAwaitingOwnerTimerNavigation(
          true,
          prsCount,
          pjcode,
          ['acme', 'beta', 'gamma'],
          { acme: 30, beta: 30, gamma: 30 },
        ),
      { initialProps: { prsCount: 1, pjcode: 'acme' } },
    );
    rerender({ prsCount: 0, pjcode: 'beta' });
    expect(navigatePush).not.toHaveBeenCalled();
  });

  it('navigates again when prs count drops to zero a second time after recovering', () => {
    const { rerender } = renderHook(
      ({ prsCount }: { prsCount: number }) =>
        useConsoleAwaitingOwnerTimerNavigation(
          true,
          prsCount,
          'acme',
          ['acme', 'beta'],
          { acme: 30, beta: 30 },
        ),
      { initialProps: { prsCount: 1 } },
    );
    rerender({ prsCount: 0 });
    expect(navigatePush).toHaveBeenCalledTimes(1);
    expect(navigatePush).toHaveBeenCalledWith('/projects/beta');

    (navigatePush as jest.Mock).mockClear();
    rerender({ prsCount: 2 });
    rerender({ prsCount: 0 });
    expect(navigatePush).toHaveBeenCalledTimes(1);
    expect(navigatePush).toHaveBeenCalledWith('/projects/beta');
  });

  it('does not navigate when snapshot reset clears prs count after project selector navigation', () => {
    const { rerender } = renderHook(
      ({ prsCount, pjcode }: { prsCount: number; pjcode: string }) =>
        useConsoleAwaitingOwnerTimerNavigation(
          true,
          prsCount,
          pjcode,
          ['acme', 'beta', 'gamma'],
          { acme: 30, beta: 30, gamma: 30 },
        ),
      { initialProps: { prsCount: 3, pjcode: 'acme' } },
    );
    rerender({ prsCount: 3, pjcode: 'beta' });
    rerender({ prsCount: 0, pjcode: 'beta' });
    expect(navigatePush).not.toHaveBeenCalled();
  });

  it('does not navigate when stale cache data transitions to fresh data with zero prs count', () => {
    const { rerender } = renderHook(
      ({
        prsCount,
        pjcode,
        prsSnapshotFromCache,
      }: {
        prsCount: number;
        pjcode: string;
        prsSnapshotFromCache: boolean;
      }) =>
        useConsoleAwaitingOwnerTimerNavigation(
          true,
          prsCount,
          pjcode,
          ['acme', 'beta', 'gamma'],
          { acme: 30, beta: 30, gamma: 30 },
          prsSnapshotFromCache,
        ),
      { initialProps: { prsCount: 0, pjcode: 'beta', prsSnapshotFromCache: false } },
    );
    rerender({ prsCount: 3, pjcode: 'beta', prsSnapshotFromCache: true });
    rerender({ prsCount: 0, pjcode: 'beta', prsSnapshotFromCache: false });
    expect(navigatePush).not.toHaveBeenCalled();
  });

  it('still navigates when user processes all prs after stale-to-fresh transition', () => {
    const { rerender } = renderHook(
      ({
        prsCount,
        pjcode,
        prsSnapshotFromCache,
      }: {
        prsCount: number;
        pjcode: string;
        prsSnapshotFromCache: boolean;
      }) =>
        useConsoleAwaitingOwnerTimerNavigation(
          true,
          prsCount,
          pjcode,
          ['acme', 'beta', 'gamma'],
          { acme: 30, beta: 30, gamma: 30 },
          prsSnapshotFromCache,
        ),
      { initialProps: { prsCount: 0, pjcode: 'beta', prsSnapshotFromCache: false } },
    );
    rerender({ prsCount: 3, pjcode: 'beta', prsSnapshotFromCache: true });
    rerender({ prsCount: 3, pjcode: 'beta', prsSnapshotFromCache: false });
    rerender({ prsCount: 0, pjcode: 'beta', prsSnapshotFromCache: false });
    expect(navigatePush).toHaveBeenCalledWith('/projects/gamma');
  });
});
