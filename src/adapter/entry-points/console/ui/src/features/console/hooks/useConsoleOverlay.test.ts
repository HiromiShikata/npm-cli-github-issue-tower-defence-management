import { act, renderHook } from '@testing-library/react';
import { overlayStorageKey } from '../logic/overlay';
import {
  overlayCloseSuccessRecord,
  useConsoleOverlay,
} from './useConsoleOverlay';

const closeRequest = (pjcode: string, projectItemId: string) => ({
  pjcode,
  action: 'close',
  issueUrl: 'https://github.com/o/r/issues/1',
  projectItemId,
});

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

  it('records the server close time on the persisted entry when no hook is mounted, and a hook mounted afterwards reads it', () => {
    jest.useFakeTimers();
    try {
      jest.setSystemTime(Date.parse('2026-01-01T00:00:00.400Z'));
      const first = renderHook(() => useConsoleOverlay('acme'));
      act(() => {
        first.result.current.patchOverlay(
          'PVTI_1',
          { done: true, closed: true },
          'todo-by-human',
        );
      });
      first.unmount();
      overlayCloseSuccessRecord(closeRequest('acme', 'PVTI_1'), {
        ok: true,
        closedAtMs: Date.parse('2026-01-01T00:00:40.000Z'),
      });
      const stored = JSON.parse(
        localStorage.getItem(overlayStorageKey('acme')) ?? '{}',
      );
      expect(stored.PVTI_1).toEqual({
        done: true,
        closedAtMs: Date.parse('2026-01-01T00:00:40.000Z'),
        ts: Date.parse('2026-01-01T00:00:00.400Z'),
        mode: 'todo-by-human',
      });
      const second = renderHook(() => useConsoleOverlay('acme'));
      expect(second.result.current.overlay.PVTI_1?.closedAtMs).toBe(
        Date.parse('2026-01-01T00:00:40.000Z'),
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('applies the server close time to a mounted hook state and to storage', () => {
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
      act(() => {
        overlayCloseSuccessRecord(closeRequest('acme', 'PVTI_1'), {
          ok: true,
          closedAtMs: Date.parse('2026-01-01T00:00:40.000Z'),
        });
      });
      expect(result.current.overlay.PVTI_1).toEqual({
        done: true,
        closedAtMs: Date.parse('2026-01-01T00:00:40.000Z'),
        ts: Date.parse('2026-01-01T00:00:00.400Z'),
        mode: 'todo-by-human',
      });
      const stored = JSON.parse(
        localStorage.getItem(overlayStorageKey('acme')) ?? '{}',
      );
      expect(stored.PVTI_1.closedAtMs).toBe(
        Date.parse('2026-01-01T00:00:40.000Z'),
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('changes neither state nor storage for another pjcode, a missing key, a response without a finite closedAtMs, or an entry removed by revert', () => {
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
      const storedBefore = localStorage.getItem(overlayStorageKey('acme'));
      const overlayBefore = result.current.overlay;
      const unchangedCases: {
        name: string;
        request: Record<string, unknown>;
        response: unknown;
      }[] = [
        {
          name: 'request for another pjcode',
          request: closeRequest('other', 'PVTI_1'),
          response: { ok: true, closedAtMs: 1767225640000 },
        },
        {
          name: 'request with a missing key',
          request: closeRequest('acme', 'PVTI_missing'),
          response: { ok: true, closedAtMs: 1767225640000 },
        },
        {
          name: 'response without a finite closedAtMs',
          request: closeRequest('acme', 'PVTI_1'),
          response: { ok: true },
        },
      ];
      for (const testCase of unchangedCases) {
        act(() => {
          overlayCloseSuccessRecord(testCase.request, testCase.response);
        });
        expect({
          name: testCase.name,
          overlay: result.current.overlay,
          stored: localStorage.getItem(overlayStorageKey('acme')),
          storedOther: localStorage.getItem(overlayStorageKey('other')),
        }).toEqual({
          name: testCase.name,
          overlay: overlayBefore,
          stored: storedBefore,
          storedOther: null,
        });
      }
      act(() => {
        result.current.revertOverlayEntry('PVTI_1');
      });
      const storedAfterRevert = localStorage.getItem(overlayStorageKey('acme'));
      act(() => {
        overlayCloseSuccessRecord(closeRequest('acme', 'PVTI_1'), {
          ok: true,
          closedAtMs: 1767225640000,
        });
      });
      expect(result.current.overlay.PVTI_1).toBeUndefined();
      expect(localStorage.getItem(overlayStorageKey('acme'))).toBe(
        storedAfterRevert,
      );
    } finally {
      jest.useRealTimers();
    }
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
