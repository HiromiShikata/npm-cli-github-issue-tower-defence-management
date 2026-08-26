import { renderHook } from '@testing-library/react';
import { useConsoleProjectTimer } from './useConsoleProjectTimer';

describe('useConsoleProjectTimer', () => {
  beforeEach(() => {
    jest.spyOn(Date, 'now');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns false before the configured minutes have elapsed', () => {
    (Date.now as jest.Mock).mockReturnValue(1000);
    const { result } = renderHook(() => useConsoleProjectTimer('alpha'));
    (Date.now as jest.Mock).mockReturnValue(1000 + 4 * 60 * 1000);
    expect(result.current.isTimerExpired(5)).toBe(false);
  });

  it('returns true once the configured minutes have elapsed', () => {
    (Date.now as jest.Mock).mockReturnValue(0);
    const { result } = renderHook(() => useConsoleProjectTimer('alpha'));
    (Date.now as jest.Mock).mockReturnValue(5 * 60 * 1000);
    expect(result.current.isTimerExpired(5)).toBe(true);
  });

  it('returns true after more than the configured minutes have elapsed', () => {
    (Date.now as jest.Mock).mockReturnValue(0);
    const { result } = renderHook(() => useConsoleProjectTimer('alpha'));
    (Date.now as jest.Mock).mockReturnValue(10 * 60 * 1000);
    expect(result.current.isTimerExpired(5)).toBe(true);
  });

  it('returns false when minutes is 0 regardless of elapsed time', () => {
    (Date.now as jest.Mock).mockReturnValue(0);
    const { result } = renderHook(() => useConsoleProjectTimer('alpha'));
    (Date.now as jest.Mock).mockReturnValue(10 * 60 * 1000);
    expect(result.current.isTimerExpired(0)).toBe(false);
  });

  it('returns false when minutes is negative', () => {
    (Date.now as jest.Mock).mockReturnValue(0);
    const { result } = renderHook(() => useConsoleProjectTimer('alpha'));
    (Date.now as jest.Mock).mockReturnValue(10 * 60 * 1000);
    expect(result.current.isTimerExpired(-1)).toBe(false);
  });

  it('resets the start time when pjcode changes', () => {
    (Date.now as jest.Mock).mockReturnValue(0);
    const { result, rerender } = renderHook(
      ({ pjcode }: { pjcode: string | null }) => useConsoleProjectTimer(pjcode),
      { initialProps: { pjcode: 'alpha' } },
    );
    (Date.now as jest.Mock).mockReturnValue(4 * 60 * 1000);
    rerender({ pjcode: 'beta' });
    (Date.now as jest.Mock).mockReturnValue(4 * 60 * 1000 + 30 * 1000);
    expect(result.current.isTimerExpired(5)).toBe(false);
  });
});
