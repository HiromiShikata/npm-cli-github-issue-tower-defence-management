import {
  countPendingItems,
  filterPendingItems,
  getOverlayEntry,
  isOverlayEntryActedForMode,
  isOverlayEntryExpiredForMode,
  overlayKeyForItem,
  overlayStorageKey,
  parseGeneratedAtMs,
  writeOverlayEntry,
} from './overlay';
import type { ConsoleListItem, ConsoleOverlay } from './types';

const item = (number: number): ConsoleListItem => ({
  number,
  title: `Item ${number}`,
  url: `https://github.com/o/r/issues/${number}`,
  repo: 'o/r',
  nameWithOwner: 'o/r',
  projectItemId: `PVTI_${number}`,
  itemId: `PVTI_${number}`,
  isPr: false,
  story: 'Story',
  labels: [],
  createdAt: '2026-06-10T00:00:00.000Z',
});

describe('overlay helpers', () => {
  it('builds the per-project storage key', () => {
    expect(overlayStorageKey('umino')).toBe('pv_overlay_umino');
  });

  it('uses the projectItemId as the overlay key when present', () => {
    expect(overlayKeyForItem(item(5))).toBe('PVTI_5');
  });

  it('parses a generatedAt timestamp', () => {
    expect(parseGeneratedAtMs('2026-06-10T00:00:00.000Z')).toBe(
      Date.parse('2026-06-10T00:00:00.000Z'),
    );
    expect(parseGeneratedAtMs('not-a-date')).toBe(0);
  });
});

describe('mode-aware expiry', () => {
  it('expires a same-mode entry written before the snapshot', () => {
    expect(
      isOverlayEntryExpiredForMode(
        { ts: 100, mode: 'prs', done: true },
        200,
        'prs',
      ),
    ).toBe(true);
  });

  it('does not expire an entry written in a different mode', () => {
    expect(
      isOverlayEntryExpiredForMode(
        { ts: 100, mode: 'triage', done: true },
        200,
        'prs',
      ),
    ).toBe(false);
  });

  it('does not expire an entry written after the snapshot', () => {
    expect(
      isOverlayEntryExpiredForMode(
        { ts: 300, mode: 'prs', done: true },
        200,
        'prs',
      ),
    ).toBe(false);
  });
});

describe('counts driven to zero do not revive on tab switch', () => {
  it('keeps a done item subtracted in its own mode', () => {
    const overlay: ConsoleOverlay = {
      PVTI_1: { ts: 500, mode: 'prs', done: true },
    };
    const generatedAtMs = 400;
    expect(countPendingItems([item(1)], overlay, generatedAtMs, 'prs')).toBe(0);
  });

  it('treats a done entry from another mode as still acted', () => {
    const overlay: ConsoleOverlay = {
      PVTI_1: { ts: 100, mode: 'triage', done: true },
    };
    expect(isOverlayEntryActedForMode(overlay.PVTI_1, 999, 'prs')).toBe(true);
    expect(countPendingItems([item(1)], overlay, 999, 'prs')).toBe(0);
  });

  it('revives the count only when a newer same-mode snapshot supersedes the entry', () => {
    const overlay: ConsoleOverlay = {
      PVTI_1: { ts: 100, mode: 'prs', done: true },
    };
    expect(countPendingItems([item(1)], overlay, 200, 'prs')).toBe(1);
  });
});

describe('filterPendingItems', () => {
  it('drops acted items and keeps the rest', () => {
    const overlay: ConsoleOverlay = {
      PVTI_1: { ts: 500, mode: 'prs', done: true },
    };
    const result = filterPendingItems([item(1), item(2)], overlay, 400, 'prs');
    expect(result.map((entry) => entry.number)).toEqual([2]);
  });
});

describe('getOverlayEntry and writeOverlayEntry', () => {
  it('returns null for an expired entry', () => {
    const overlay: ConsoleOverlay = {
      PVTI_1: { ts: 100, mode: 'prs', done: true },
    };
    expect(getOverlayEntry(overlay, item(1), 200, 'prs')).toBeNull();
  });

  it('stamps the timestamp and mode on write', () => {
    const next = writeOverlayEntry({}, 'PVTI_1', { done: true }, 'prs', 1234);
    expect(next.PVTI_1).toEqual({ done: true, ts: 1234, mode: 'prs' });
  });
});
