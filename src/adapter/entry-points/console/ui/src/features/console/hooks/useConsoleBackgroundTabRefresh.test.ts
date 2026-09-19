import { act, renderHook } from '@testing-library/react';
import { useConsoleBackgroundTabRefresh } from './useConsoleBackgroundTabRefresh';
import {
  CONSOLE_TAB_REFRESH_INTERVAL_MS,
  refreshProjectTabsToCache,
} from './useConsoleTabData';

jest.mock('./useConsoleTabData', () => ({
  ...jest.requireActual('./useConsoleTabData'),
  refreshProjectTabsToCache: jest.fn(),
}));

const mockRefresh = refreshProjectTabsToCache as jest.Mock;

describe('useConsoleBackgroundTabRefresh', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockRefresh.mockReset();
    mockRefresh.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('immediately refreshes background projects on mount when enabled', () => {
    renderHook(() =>
      useConsoleBackgroundTabRefresh('acme', ['acme', 'beta', 'gamma'], true),
    );
    expect(mockRefresh).toHaveBeenCalledWith('beta');
    expect(mockRefresh).toHaveBeenCalledWith('gamma');
    expect(mockRefresh).not.toHaveBeenCalledWith('acme');
  });

  it('does not refresh when disabled', () => {
    renderHook(() =>
      useConsoleBackgroundTabRefresh('acme', ['acme', 'beta'], false),
    );
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it('does not refresh when there are no background projects', () => {
    renderHook(() => useConsoleBackgroundTabRefresh('acme', ['acme'], true));
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it('refreshes background projects at the refresh interval', () => {
    renderHook(() =>
      useConsoleBackgroundTabRefresh('acme', ['acme', 'beta'], true),
    );
    expect(mockRefresh).toHaveBeenCalledTimes(1);

    act(() => {
      jest.advanceTimersByTime(CONSOLE_TAB_REFRESH_INTERVAL_MS);
    });
    expect(mockRefresh).toHaveBeenCalledTimes(2);

    act(() => {
      jest.advanceTimersByTime(CONSOLE_TAB_REFRESH_INTERVAL_MS);
    });
    expect(mockRefresh).toHaveBeenCalledTimes(3);
  });

  it('stops refreshing after unmount', () => {
    const { unmount } = renderHook(() =>
      useConsoleBackgroundTabRefresh('acme', ['acme', 'beta'], true),
    );
    expect(mockRefresh).toHaveBeenCalledTimes(1);
    unmount();

    act(() => {
      jest.advanceTimersByTime(CONSOLE_TAB_REFRESH_INTERVAL_MS * 3);
    });
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it('excludes the active project from background refresh', () => {
    renderHook(() =>
      useConsoleBackgroundTabRefresh('beta', ['acme', 'beta', 'gamma'], true),
    );
    expect(mockRefresh).toHaveBeenCalledWith('acme');
    expect(mockRefresh).toHaveBeenCalledWith('gamma');
    expect(mockRefresh).not.toHaveBeenCalledWith('beta');
  });

  it('refreshes all pjcodes as background when active project is null', () => {
    renderHook(() =>
      useConsoleBackgroundTabRefresh(null, ['acme', 'beta'], true),
    );
    expect(mockRefresh).toHaveBeenCalledWith('acme');
    expect(mockRefresh).toHaveBeenCalledWith('beta');
  });

  it('restarts refresh with updated background projects when active project changes', () => {
    const { rerender } = renderHook(
      ({ activePjcode }: { activePjcode: string }) =>
        useConsoleBackgroundTabRefresh(
          activePjcode,
          ['acme', 'beta', 'gamma'],
          true,
        ),
      { initialProps: { activePjcode: 'acme' } },
    );
    mockRefresh.mockClear();

    rerender({ activePjcode: 'beta' });
    expect(mockRefresh).toHaveBeenCalledWith('acme');
    expect(mockRefresh).toHaveBeenCalledWith('gamma');
    expect(mockRefresh).not.toHaveBeenCalledWith('beta');
  });
});
