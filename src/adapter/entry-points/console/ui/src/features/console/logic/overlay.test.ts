import {
  computeEffectiveOverlay,
  countPendingItems,
  filterPendingItems,
  isOverlayEntryActed,
  overlayEntriesActedSinceSnapshot,
  overlayKeyForItem,
  overlayStatusSinceSnapshot,
  overlayStorageKey,
  removeOverlayEntry,
  writeOverlayEntry,
} from './overlay';
import type {
  ConsoleListItem,
  ConsoleOverlay,
  ConsoleOverlayStatus,
  ConsoleTabName,
} from './types';

const item = (number: number): ConsoleListItem => ({
  number,
  title: `Item ${number}`,
  url: `https://github.com/o/r/issues/${number}`,
  repo: 'o/r',
  nameWithOwner: 'o/r',
  projectItemId: `PVTI_${number}`,
  itemId: `PVTI_${number}`,
  isPr: false,
  relatedOpenPullRequestUrls: [],
  story: 'Story',
  status: null,
  agent: null,
  nextActionDate: null,
  nextActionHour: null,
  dependedIssueUrls: [],
  labels: [],
  createdAt: '2026-06-10T00:00:00.000Z',
});

describe('overlay helpers', () => {
  it('builds the per-project storage key', () => {
    expect(overlayStorageKey('acme')).toBe('pv_overlay_acme');
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
    expect(
      isOverlayEntryActed({ ts: 100, mode: 'todo-by-human', done: true }),
    ).toBe(true);
  });
});

describe('counts driven to zero do not revive on tab switch', () => {
  it('keeps a done item subtracted in the tab it was processed in', () => {
    const overlay: ConsoleOverlay = {
      PVTI_1: { ts: 500, mode: 'prs', done: true },
    };
    expect(countPendingItems([item(1)], overlay, 'prs')).toBe(0);
  });

  it('does not subtract a done item from a tab other than the one it was processed in', () => {
    const overlay: ConsoleOverlay = {
      PVTI_1: { ts: 100, mode: 'todo-by-human', done: true },
    };
    expect(countPendingItems([item(1)], overlay, 'prs')).toBe(1);
  });

  it('does not revive a done item even when an entry was processed before the snapshot it still appears in', () => {
    const overlay: ConsoleOverlay = {
      PVTI_1: { ts: 100, mode: 'prs', done: true },
    };
    expect(countPendingItems([item(1)], overlay, 'prs')).toBe(0);
  });

  it('shows a done item in a tab other than the one it was processed in', () => {
    const overlay: ConsoleOverlay = {
      PVTI_1: { ts: 100, mode: 'prs', done: true },
    };
    expect(countPendingItems([item(1)], overlay, 'todo-by-human')).toBe(1);
    expect(filterPendingItems([item(1)], overlay, 'todo-by-human')).toEqual([
      item(1),
    ]);
  });

  it('counts an item that has no done entry', () => {
    expect(countPendingItems([item(1)], {}, 'prs')).toBe(1);
  });
});

describe('filterPendingItems', () => {
  it('drops acted items and keeps the rest', () => {
    const overlay: ConsoleOverlay = {
      PVTI_1: { ts: 500, mode: 'prs', done: true },
    };
    const result = filterPendingItems([item(1), item(2)], overlay, 'prs');
    expect(result.map((entry) => entry.number)).toEqual([2]);
  });

  it('keeps the badge count and the filtered list consistent', () => {
    const overlay: ConsoleOverlay = {
      PVTI_1: { ts: 500, mode: 'prs', done: true },
    };
    const items = [item(1), item(2)];
    expect(countPendingItems(items, overlay, 'prs')).toBe(
      filterPendingItems(items, overlay, 'prs').length,
    );
  });
});

describe('workflow-blocker items are filtered by the done overlay like every other tab', () => {
  it('subtracts a processed workflow-blocker item from the count', () => {
    const overlay: ConsoleOverlay = {
      PVTI_1: { ts: 100, mode: 'workflow-blocker', done: true },
    };
    expect(
      countPendingItems([item(1), item(2)], overlay, 'workflow-blocker'),
    ).toBe(1);
  });

  it('removes a processed workflow-blocker item from the list', () => {
    const overlay: ConsoleOverlay = {
      PVTI_1: { ts: 100, mode: 'workflow-blocker', done: true },
    };
    const result = filterPendingItems(
      [item(1), item(2)],
      overlay,
      'workflow-blocker',
    );
    expect(result.map((entry) => entry.number)).toEqual([2]);
  });

  it('drives the count to zero when every workflow-blocker item is processed', () => {
    const overlay: ConsoleOverlay = {
      PVTI_1: { ts: 100, mode: 'workflow-blocker', done: true },
      PVTI_2: { ts: 100, mode: 'workflow-blocker', done: true },
    };
    expect(
      countPendingItems([item(1), item(2)], overlay, 'workflow-blocker'),
    ).toBe(0);
    expect(
      filterPendingItems([item(1), item(2)], overlay, 'workflow-blocker'),
    ).toEqual([]);
  });
});

describe('overlayEntriesActedSinceSnapshot', () => {
  it('drops an entry written before the snapshot was generated so the item is pending again', () => {
    const overlay: ConsoleOverlay = {
      PVTI_1: {
        ts: Date.parse('2026-08-04T00:20:00.000Z'),
        mode: 'todo-by-human',
        done: true,
      },
    };
    const acted = overlayEntriesActedSinceSnapshot(
      overlay,
      '2026-08-04T00:26:06Z',
    );
    expect(acted).toEqual({});
    expect(countPendingItems([item(1)], acted, 'todo-by-human')).toBe(1);
    expect(filterPendingItems([item(1)], acted, 'todo-by-human')).toEqual([
      item(1),
    ]);
  });

  it('keeps an entry written after the snapshot was generated so the item stays hidden', () => {
    const overlay: ConsoleOverlay = {
      PVTI_1: {
        ts: Date.parse('2026-08-04T00:30:00.000Z'),
        mode: 'todo-by-human',
        done: true,
      },
    };
    const acted = overlayEntriesActedSinceSnapshot(
      overlay,
      '2026-08-04T00:26:06Z',
    );
    expect(countPendingItems([item(1)], acted, 'todo-by-human')).toBe(0);
  });

  it('keeps an entry written at the exact snapshot generation time', () => {
    const overlay: ConsoleOverlay = {
      PVTI_1: {
        ts: Date.parse('2026-08-04T00:26:06Z'),
        mode: 'todo-by-human',
        done: true,
      },
    };
    expect(
      overlayEntriesActedSinceSnapshot(overlay, '2026-08-04T00:26:06Z'),
    ).toEqual(overlay);
  });

  it('suppresses nothing when the snapshot carries no parsable generation time', () => {
    const overlay: ConsoleOverlay = {
      PVTI_1: { ts: 500, mode: 'todo-by-human', done: true },
    };
    expect(overlayEntriesActedSinceSnapshot(overlay, '')).toEqual({});
  });
});

describe('removeOverlayEntry', () => {
  it('removes the named key from the overlay and leaves the rest intact', () => {
    const overlay: ConsoleOverlay = {
      PVTI_1: { ts: 100, mode: 'prs', done: true },
      PVTI_2: { ts: 200, mode: 'prs', done: true },
    };
    const next = removeOverlayEntry(overlay, 'PVTI_1');
    expect(next).toEqual({ PVTI_2: { ts: 200, mode: 'prs', done: true } });
  });

  it('returns the overlay unchanged when the key is absent', () => {
    const overlay: ConsoleOverlay = {
      PVTI_2: { ts: 200, mode: 'prs', done: true },
    };
    const next = removeOverlayEntry(overlay, 'PVTI_1');
    expect(next).toEqual(overlay);
    expect(next).not.toBe(overlay);
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
      'todo-by-human',
      999,
    );
    expect(next.PVTI_1).toEqual({
      done: true,
      story: { name: 'New Story', color: 'GREEN' },
      ts: 999,
      mode: 'todo-by-human',
    });
  });
});

describe('overlayStatusSinceSnapshot', () => {
  const snapshotGeneratedAt = '2026-08-13T21:52:01.000Z';
  const snapshotEpochMs = Date.parse(snapshotGeneratedAt);
  const inTmuxByHuman: ConsoleOverlayStatus = {
    name: 'In Tmux by human',
    color: 'RED',
  };

  const overlayWithStatusAt = (epochMs: number): ConsoleOverlay => ({
    [overlayKeyForItem(item(1))]: {
      status: inTmuxByHuman,
      ts: epochMs,
      mode: 'todo-by-human',
    },
  });

  it('shows a status the owner set after the snapshot was generated', () => {
    expect(
      overlayStatusSinceSnapshot(
        overlayWithStatusAt(snapshotEpochMs + 1000),
        item(1),
        snapshotGeneratedAt,
      ),
    ).toEqual(inTmuxByHuman);
  });

  it('drops a status the snapshot already superseded', () => {
    expect(
      overlayStatusSinceSnapshot(
        overlayWithStatusAt(snapshotEpochMs - 1000),
        item(1),
        snapshotGeneratedAt,
      ),
    ).toBeNull();
  });

  it('drops every status when the snapshot time is unusable', () => {
    expect(
      overlayStatusSinceSnapshot(
        overlayWithStatusAt(snapshotEpochMs + 1000),
        item(1),
        null,
      ),
    ).toBeNull();
  });

  it('shows a status set at the exact moment the snapshot was generated', () => {
    expect(
      overlayStatusSinceSnapshot(
        overlayWithStatusAt(snapshotEpochMs),
        item(1),
        snapshotGeneratedAt,
      ),
    ).toEqual(inTmuxByHuman);
  });

  it('drops every status when the snapshot time cannot be parsed', () => {
    expect(
      overlayStatusSinceSnapshot(
        overlayWithStatusAt(snapshotEpochMs + 1000),
        item(1),
        'not a timestamp',
      ),
    ).toBeNull();
  });

  it('returns null when the item has no overlay entry', () => {
    expect(
      overlayStatusSinceSnapshot({}, item(1), snapshotGeneratedAt),
    ).toBeNull();
  });
});

describe('computeEffectiveOverlay', () => {
  const snapshotGeneratedAt = '2026-08-01T00:00:00.000Z';
  const snapshotGeneratedAtMs = Date.parse(snapshotGeneratedAt);

  const emptySnapshots = (): Record<
    ConsoleTabName,
    { items: ConsoleListItem[]; generatedAt: string } | null
  > => ({
    'workflow-blocker': null,
    prs: null,
    'failed-preparation': null,
    'todo-by-human': null,
    queued: null,
    stories: null,
  });

  const snapshotWith = (
    tab: ConsoleTabName,
    items: ConsoleListItem[],
  ): Record<
    ConsoleTabName,
    { items: ConsoleListItem[]; generatedAt: string } | null
  > => ({
    ...emptySnapshots(),
    [tab]: { items, generatedAt: snapshotGeneratedAt },
  });

  const tsBeforeSnapshot = snapshotGeneratedAtMs - 1000;
  const tsAfterSnapshot = snapshotGeneratedAtMs + 1000;

  const testCases: {
    name: string;
    overlay: ConsoleOverlay;
    snapshotsByTab: Record<
      ConsoleTabName,
      { items: ConsoleListItem[]; generatedAt: string } | null
    >;
    expected: ConsoleOverlay;
  }[] = [
    {
      name: 'removes a done entry when the item still appears in the matching tab snapshot and the entry predates the snapshot',
      overlay: { PVTI_1: { ts: tsBeforeSnapshot, mode: 'prs', done: true } },
      snapshotsByTab: snapshotWith('prs', [item(1)]),
      expected: {},
    },
    {
      name: 'keeps a done entry when the item no longer appears in the matching tab snapshot',
      overlay: { PVTI_1: { ts: tsBeforeSnapshot, mode: 'prs', done: true } },
      snapshotsByTab: snapshotWith('prs', []),
      expected: { PVTI_1: { ts: tsBeforeSnapshot, mode: 'prs', done: true } },
    },
    {
      name: 'keeps a done entry when the matching tab snapshot is null',
      overlay: { PVTI_1: { ts: tsBeforeSnapshot, mode: 'prs', done: true } },
      snapshotsByTab: emptySnapshots(),
      expected: { PVTI_1: { ts: tsBeforeSnapshot, mode: 'prs', done: true } },
    },
    {
      name: 'keeps an entry without a done flag even when the item appears in the matching tab snapshot',
      overlay: { PVTI_1: { ts: tsBeforeSnapshot, mode: 'prs' } },
      snapshotsByTab: snapshotWith('prs', [item(1)]),
      expected: { PVTI_1: { ts: tsBeforeSnapshot, mode: 'prs' } },
    },
    {
      name: 'keeps a done entry when the item appears in a different tab snapshot but not the matching one',
      overlay: { PVTI_1: { ts: tsBeforeSnapshot, mode: 'prs', done: true } },
      snapshotsByTab: {
        ...snapshotWith('prs', []),
        'todo-by-human': { items: [item(1)], generatedAt: snapshotGeneratedAt },
      },
      expected: { PVTI_1: { ts: tsBeforeSnapshot, mode: 'prs', done: true } },
    },
    {
      name: 'removes only the failed-action entry and keeps the succeeded entry when items have mixed outcomes',
      overlay: {
        PVTI_1: { ts: tsBeforeSnapshot, mode: 'prs', done: true },
        PVTI_2: { ts: tsBeforeSnapshot, mode: 'prs', done: true },
      },
      snapshotsByTab: snapshotWith('prs', [item(1)]),
      expected: { PVTI_2: { ts: tsBeforeSnapshot, mode: 'prs', done: true } },
    },
    {
      name: 'removes a done entry for a non-prs tab when the item still appears in that tab snapshot and the entry predates the snapshot',
      overlay: {
        PVTI_1: { ts: tsBeforeSnapshot, mode: 'todo-by-human', done: true },
      },
      snapshotsByTab: snapshotWith('todo-by-human', [item(1)]),
      expected: {},
    },
  ];

  test.each(testCases)('$name', ({ overlay, snapshotsByTab, expected }) => {
    expect(computeEffectiveOverlay(overlay, snapshotsByTab)).toEqual(expected);
  });

  it('keeps a done entry when the entry was set after the snapshot was generated (optimistic update)', () => {
    const overlay: ConsoleOverlay = {
      PVTI_1: { ts: tsAfterSnapshot, mode: 'prs', done: true },
    };
    expect(
      computeEffectiveOverlay(overlay, snapshotWith('prs', [item(1)])),
    ).toEqual(overlay);
  });

  it('keeps a done entry when the snapshot generatedAt cannot be parsed', () => {
    const overlay: ConsoleOverlay = {
      PVTI_1: { ts: tsBeforeSnapshot, mode: 'prs', done: true },
    };
    const snapshots = {
      ...emptySnapshots(),
      prs: { items: [item(1)], generatedAt: 'invalid' },
    };
    expect(computeEffectiveOverlay(overlay, snapshots)).toEqual(overlay);
  });
});
