import { act, renderHook } from '@testing-library/react';
import { overlayStorageKey } from '../logic/overlay';
import { useConsoleOverlay } from './useConsoleOverlay';

describe('useConsoleOverlay', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts from the persisted overlay', () => {
    localStorage.setItem(
      overlayStorageKey('acme'),
      JSON.stringify({ PVTI_1: { ts: 5, mode: 'prs', done: true } }),
    );
    const { result } = renderHook(() => useConsoleOverlay('acme'));
    expect(result.current.overlay.PVTI_1?.done).toBe(true);
  });

  it('patches and persists overlay entries with timestamp and mode', () => {
    const { result } = renderHook(() => useConsoleOverlay('acme'));
    act(() => {
      result.current.patchOverlay('PVTI_2', { done: true }, 'todo-by-human');
    });
    expect(result.current.overlay.PVTI_2?.done).toBe(true);
    expect(result.current.overlay.PVTI_2?.mode).toBe('todo-by-human');
    const stored = JSON.parse(
      localStorage.getItem(overlayStorageKey('acme')) ?? '{}',
    );
    expect(stored.PVTI_2.done).toBe(true);
  });

  it('ignores malformed persisted entries', () => {
    localStorage.setItem(
      overlayStorageKey('acme'),
      JSON.stringify({ bad: { no: 'ts' } }),
    );
    const { result } = renderHook(() => useConsoleOverlay('acme'));
    expect(result.current.overlay.bad).toBeUndefined();
  });

  it('removes the named key from overlay state and storage when revertOverlayEntry is called', () => {
    localStorage.setItem(
      overlayStorageKey('acme'),
      JSON.stringify({
        PVTI_1: { ts: 100, mode: 'prs', done: true },
        PVTI_2: { ts: 200, mode: 'prs', done: true },
      }),
    );
    const { result } = renderHook(() => useConsoleOverlay('acme'));
    act(() => {
      result.current.revertOverlayEntry('PVTI_1');
    });
    expect(result.current.overlay.PVTI_1).toBeUndefined();
    expect(result.current.overlay.PVTI_2?.done).toBe(true);
    const stored = JSON.parse(
      localStorage.getItem(overlayStorageKey('acme')) ?? '{}',
    );
    expect(stored.PVTI_1).toBeUndefined();
    expect(stored.PVTI_2).toBeDefined();
  });

  it('replaces the closedAtMs of a closed entry with the success time and keeps the press time as ts', () => {
    jest.useFakeTimers();
    try {
      jest.setSystemTime(Date.parse('2026-01-01T00:00:00.400Z'));
      const { result } = renderHook(() => useConsoleOverlay('acme'));
      act(() => {
        result.current.patchOverlay(
          'PVTI_1',
          { done: true, closed: true },
          'todo-by-human',
        );
      });
      jest.setSystemTime(Date.parse('2026-01-01T00:00:07.400Z'));
      act(() => {
        result.current.overlayEntryClosedAtUpdateToNow('PVTI_1');
      });
      expect(result.current.overlay.PVTI_1).toEqual({
        done: true,
        closedAtMs: Date.parse('2026-01-01T00:00:07.400Z'),
        ts: Date.parse('2026-01-01T00:00:00.400Z'),
        mode: 'todo-by-human',
      });
      const stored = JSON.parse(
        localStorage.getItem(overlayStorageKey('acme')) ?? '{}',
      );
      expect(stored.PVTI_1.closedAtMs).toBe(
        Date.parse('2026-01-01T00:00:07.400Z'),
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('creates no entry for a missing key and leaves the stored overlay unchanged', () => {
    const { result } = renderHook(() => useConsoleOverlay('acme'));
    act(() => {
      result.current.patchOverlay('PVTI_other', { done: true }, 'prs');
    });
    const before = localStorage.getItem(overlayStorageKey('acme'));
    act(() => {
      result.current.overlayEntryClosedAtUpdateToNow('PVTI_missing');
    });
    expect(result.current.overlay.PVTI_missing).toBeUndefined();
    expect(localStorage.getItem(overlayStorageKey('acme'))).toBe(before);
  });

  it('does not recreate an entry that revertOverlayEntry removed', () => {
    const { result } = renderHook(() => useConsoleOverlay('acme'));
    act(() => {
      result.current.patchOverlay(
        'PVTI_1',
        { done: true, closed: true },
        'todo-by-human',
      );
    });
    act(() => {
      result.current.revertOverlayEntry('PVTI_1');
    });
    act(() => {
      result.current.overlayEntryClosedAtUpdateToNow('PVTI_1');
    });
    expect(result.current.overlay.PVTI_1).toBeUndefined();
    const stored = JSON.parse(
      localStorage.getItem(overlayStorageKey('acme')) ?? '{}',
    );
    expect(stored.PVTI_1).toBeUndefined();
  });

  it('persists a status patch with the press time and no close time', () => {
    jest.useFakeTimers();
    try {
      jest.setSystemTime(Date.parse('2026-01-01T00:00:00.400Z'));
      const { result } = renderHook(() => useConsoleOverlay('acme'));
      act(() => {
        result.current.patchOverlay(
          'PVTI_1',
          { done: true, status: { name: 'In Tmux by human', color: 'BLUE' } },
          'todo-by-human',
        );
      });
      const stored = JSON.parse(
        localStorage.getItem(overlayStorageKey('acme')) ?? '{}',
      );
      expect(stored.PVTI_1).not.toHaveProperty('closedAtMs');
      expect(stored.PVTI_1.ts).toBe(Date.parse('2026-01-01T00:00:00.400Z'));
    } finally {
      jest.useRealTimers();
    }
  });
});
