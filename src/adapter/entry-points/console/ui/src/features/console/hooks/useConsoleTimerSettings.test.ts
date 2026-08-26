import { act, renderHook } from '@testing-library/react';
import { TIMER_SETTINGS_KEY } from '../logic/timerSettings';
import { useConsoleTimerSettings } from './useConsoleTimerSettings';

describe('useConsoleTimerSettings', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('initialises with timer mode off and empty project minutes when localStorage is empty', () => {
    const { result } = renderHook(() => useConsoleTimerSettings());
    expect(result.current.timerMode).toBe(false);
    expect(result.current.projectMinutes).toEqual({});
    expect(result.current.isOpen).toBe(false);
  });

  it('openSettings resets draft to the current saved settings, not the previous draft', () => {
    localStorage.setItem(
      TIMER_SETTINGS_KEY,
      JSON.stringify({ timerMode: true, projectMinutes: { acme: 30 } }),
    );
    const { result } = renderHook(() => useConsoleTimerSettings());
    act(() => {
      result.current.openSettings();
    });
    act(() => {
      result.current.changeDraftMinutes('acme', 99);
    });
    act(() => {
      result.current.closeSettings();
    });
    act(() => {
      result.current.openSettings();
    });
    expect(result.current.draftTimerMode).toBe(true);
    expect(result.current.draftProjectMinutes).toEqual({ acme: 30 });
  });

  it('openSettings sets isOpen to true', () => {
    const { result } = renderHook(() => useConsoleTimerSettings());
    act(() => {
      result.current.openSettings();
    });
    expect(result.current.isOpen).toBe(true);
  });

  it('changeDraftMinutes mutates draft but does not change saved or localStorage', () => {
    const { result } = renderHook(() => useConsoleTimerSettings());
    act(() => {
      result.current.openSettings();
    });
    act(() => {
      result.current.changeDraftMinutes('acme', 45);
    });
    expect(result.current.draftProjectMinutes).toEqual({ acme: 45 });
    expect(result.current.projectMinutes).toEqual({});
    expect(localStorage.getItem(TIMER_SETTINGS_KEY)).toBeNull();
  });

  it('saveSettings writes to localStorage with key tdpm-timer-settings and closes the dialog', () => {
    const { result } = renderHook(() => useConsoleTimerSettings());
    act(() => {
      result.current.openSettings();
    });
    act(() => {
      result.current.toggleDraftTimerMode(true);
    });
    act(() => {
      result.current.changeDraftMinutes('acme', 20);
    });
    act(() => {
      result.current.saveSettings();
    });
    expect(result.current.isOpen).toBe(false);
    const stored = localStorage.getItem(TIMER_SETTINGS_KEY);
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored as string) as unknown;
    expect(parsed).toEqual({ timerMode: true, projectMinutes: { acme: 20 } });
    expect(result.current.timerMode).toBe(true);
    expect(result.current.projectMinutes).toEqual({ acme: 20 });
  });

  it('closeSettings discards draft without writing to localStorage', () => {
    const { result } = renderHook(() => useConsoleTimerSettings());
    act(() => {
      result.current.openSettings();
    });
    act(() => {
      result.current.changeDraftMinutes('acme', 60);
    });
    act(() => {
      result.current.closeSettings();
    });
    expect(result.current.isOpen).toBe(false);
    expect(localStorage.getItem(TIMER_SETTINGS_KEY)).toBeNull();
    expect(result.current.projectMinutes).toEqual({});
  });

  it('toggleDraftTimerMode updates draftTimerMode without affecting saved timerMode', () => {
    const { result } = renderHook(() => useConsoleTimerSettings());
    act(() => {
      result.current.openSettings();
    });
    act(() => {
      result.current.toggleDraftTimerMode(true);
    });
    expect(result.current.draftTimerMode).toBe(true);
    expect(result.current.timerMode).toBe(false);
  });
});
