import {
  countPendingItems,
  filterPendingItems,
  isOverlayEntryActed,
  overlayKeyForItem,
  overlayStorageKey,
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
  status: null,
  nextActionDate: null,
  nextActionHour: null,
  dependedIssueUrls: [],
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

  it('falls back to the itemId when the projectItemId is empty', () => {
    expect(overlayKeyForItem({ ...item(5), projectItemId: '' })).toBe('PVTI_5');
  });
});

describe('isOverlayEntryActed', () => {
  it('treats a done entry as acted', () => {
    expect(isOverlayEntryActed({ ts: 100, mode: 'prs', done: true })).toBe(
      true,
    );
  });

  it('treats a missing entry as not acted', () => {
    expect(isOverlayEntryActed(undefined)).toBe(false);
  });

  it('treats an entry without done as not acted', () => {
    expect(
      isOverlayEntryActed({
        ts: 100,
        mode: 'prs',
        story: { name: 'Story', color: 'BLUE' },
      }),
    ).toBe(false);
  });

  it('treats a done entry as acted regardless of the mode it was written in', () => {
    expect(isOverlayEntryActed({ ts: 100, mode: 'triage', done: true })).toBe(
      true,
    );
  });
});

describe('counts driven to zero do not revive on tab switch', () => {
  it('keeps a done item subtracted in the tab it was processed in', () => {
    const overlay: ConsoleOverlay = {
      PVTI_1: { ts: 500, mode: 'prs', done: true },
    };
    expect(countPendingItems([item(1)], overlay)).toBe(0);
  });

  it('keeps a done item subtracted from every tab regardless of its mode', () => {
    const overlay: ConsoleOverlay = {
      PVTI_1: { ts: 100, mode: 'triage', done: true },
    };
    expect(countPendingItems([item(1)], overlay)).toBe(0);
  });

  it('does not revive a done item even when an entry was processed before the snapshot it still appears in', () => {
    const overlay: ConsoleOverlay = {
      PVTI_1: { ts: 100, mode: 'prs', done: true },
    };
    expect(countPendingItems([item(1)], overlay)).toBe(0);
  });

  it('does not revive a done item when it appears in a tab other than the one it was processed in', () => {
    const overlay: ConsoleOverlay = {
      PVTI_1: { ts: 100, mode: 'prs', done: true },
    };
    expect(countPendingItems([item(1)], overlay)).toBe(0);
    expect(filterPendingItems([item(1)], overlay)).toEqual([]);
  });

  it('counts an item that has no done entry', () => {
    expect(countPendingItems([item(1)], {})).toBe(1);
  });
});

describe('filterPendingItems', () => {
  it('drops acted items and keeps the rest', () => {
    const overlay: ConsoleOverlay = {
      PVTI_1: { ts: 500, mode: 'prs', done: true },
    };
    const result = filterPendingItems([item(1), item(2)], overlay);
    expect(result.map((entry) => entry.number)).toEqual([2]);
  });

  it('keeps the badge count and the filtered list consistent', () => {
    const overlay: ConsoleOverlay = {
      PVTI_1: { ts: 500, mode: 'prs', done: true },
    };
    const items = [item(1), item(2)];
    expect(countPendingItems(items, overlay)).toBe(
      filterPendingItems(items, overlay).length,
    );
  });
});

describe('workflow-blocker items are filtered by the done overlay like every other tab', () => {
  it('subtracts a processed workflow-blocker item from the count', () => {
    const overlay: ConsoleOverlay = {
      PVTI_1: { ts: 100, mode: 'workflow-blocker', done: true },
    };
    expect(countPendingItems([item(1), item(2)], overlay)).toBe(1);
  });

  it('removes a processed workflow-blocker item from the list', () => {
    const overlay: ConsoleOverlay = {
      PVTI_1: { ts: 100, mode: 'workflow-blocker', done: true },
    };
    const result = filterPendingItems([item(1), item(2)], overlay);
    expect(result.map((entry) => entry.number)).toEqual([2]);
  });

  it('drives the count to zero when every workflow-blocker item is processed', () => {
    const overlay: ConsoleOverlay = {
      PVTI_1: { ts: 100, mode: 'workflow-blocker', done: true },
      PVTI_2: { ts: 100, mode: 'workflow-blocker', done: true },
    };
    expect(countPendingItems([item(1), item(2)], overlay)).toBe(0);
    expect(filterPendingItems([item(1), item(2)], overlay)).toEqual([]);
  });
});

describe('writeOverlayEntry', () => {
  it('stamps the timestamp and mode on write', () => {
    const next = writeOverlayEntry({}, 'PVTI_1', { done: true }, 'prs', 1234);
    expect(next.PVTI_1).toEqual({ done: true, ts: 1234, mode: 'prs' });
  });

  it('merges a patch into an existing entry while refreshing ts and mode', () => {
    const overlay: ConsoleOverlay = {
      PVTI_1: { ts: 100, mode: 'prs', done: true },
    };
    const next = writeOverlayEntry(
      overlay,
      'PVTI_1',
      { story: { name: 'New Story', color: 'GREEN' } },
      'triage',
      999,
    );
    expect(next.PVTI_1).toEqual({
      done: true,
      story: { name: 'New Story', color: 'GREEN' },
      ts: 999,
      mode: 'triage',
    });
  });
});
