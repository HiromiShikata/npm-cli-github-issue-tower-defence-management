import { act, renderHook } from '@testing-library/react';
import { overlayStorageKey } from '../overlay';
import { useConsoleOverlay } from './useConsoleOverlay';

describe('useConsoleOverlay', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts from the persisted overlay', () => {
    localStorage.setItem(
      overlayStorageKey('umino'),
      JSON.stringify({ PVTI_1: { ts: 5, mode: 'prs', done: true } }),
    );
    const { result } = renderHook(() => useConsoleOverlay('umino'));
    expect(result.current.overlay.PVTI_1?.done).toBe(true);
  });

  it('patches and persists overlay entries with timestamp and mode', () => {
    const { result } = renderHook(() => useConsoleOverlay('umino'));
    act(() => {
      result.current.patchOverlay('PVTI_2', { done: true }, 'triage');
    });
    expect(result.current.overlay.PVTI_2?.done).toBe(true);
    expect(result.current.overlay.PVTI_2?.mode).toBe('triage');
    const stored = JSON.parse(
      localStorage.getItem(overlayStorageKey('umino')) ?? '{}',
    );
    expect(stored.PVTI_2.done).toBe(true);
  });

  it('ignores malformed persisted entries', () => {
    localStorage.setItem(
      overlayStorageKey('umino'),
      JSON.stringify({ bad: { no: 'ts' } }),
    );
    const { result } = renderHook(() => useConsoleOverlay('umino'));
    expect(result.current.overlay.bad).toBeUndefined();
  });
});
