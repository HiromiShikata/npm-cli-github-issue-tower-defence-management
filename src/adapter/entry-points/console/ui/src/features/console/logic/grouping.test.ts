import {
  buildConsoleListRows,
  CONSOLE_NO_STORY_LABEL,
  resolveItemStory,
  resolveStoryColorEnum,
} from './grouping';
import * as groupingModule from './grouping';
import type { ConsoleListItem, ConsoleOverlay } from './types';

const item = (
  overrides: Partial<ConsoleListItem> &
    Pick<ConsoleListItem, 'number' | 'story'>,
): ConsoleListItem => ({
  title: `Item ${overrides.number}`,
  url: `https://github.com/o/r/issues/${overrides.number}`,
  repo: 'o/r',
  nameWithOwner: 'o/r',
  projectItemId: `PVTI_${overrides.number}`,
  itemId: `PVTI_${overrides.number}`,
  isPr: false,
  relatedOpenPullRequestUrls: [],
  status: null,
  agent: null,
  nextActionDate: null,
  nextActionHour: null,
  dependedIssueUrls: [],
  labels: [],
  createdAt: '2026-06-10T00:00:00.000Z',
  ...overrides,
});

describe('resolveStoryColorEnum', () => {
  it('reads a wrapped color object shape', () => {
    expect(resolveStoryColorEnum({ s: { color: 'BLUE' } }, 's')).toBe('BLUE');
  });

  it('reads a bare enum shape', () => {
    expect(resolveStoryColorEnum({ s: 'RED' }, 's')).toBe('RED');
  });

  it('returns null for an unknown story', () => {
    expect(resolveStoryColorEnum({}, 's')).toBeNull();
  });
});

describe('resolveItemStory', () => {
  it('prefers the overlay story name', () => {
    const overlay: ConsoleOverlay = {
      PVTI_1: {
        ts: 1,
        mode: 'todo-by-human',
        story: { name: 'Overlay', color: 'BLUE' },
      },
    };
    expect(
      resolveItemStory(item({ number: 1, story: 'Original' }), overlay),
    ).toBe('Overlay');
  });

  it('uses the trimmed item story when no overlay story exists', () => {
    expect(resolveItemStory(item({ number: 2, story: '  Real  ' }), {})).toBe(
      '  Real  ',
    );
  });

  it('falls back to the no-story label when empty', () => {
    expect(resolveItemStory(item({ number: 3, story: '   ' }), {})).toBe(
      CONSOLE_NO_STORY_LABEL,
    );
  });

  it('returns overlay story when overlay entry is fresh (ts >= snapshot)', () => {
    const snapshotTs = 1000;
    const overlay: ConsoleOverlay = {
      PVTI_4: {
        ts: snapshotTs,
        mode: 'todo-by-human',
        story: { name: 'FreshOverlay', color: 'GREEN' },
      },
    };
    expect(
      resolveItemStory(
        item({ number: 4, story: 'ItemStory' }),
        overlay,
        new Date(snapshotTs).toISOString(),
      ),
    ).toBe('FreshOverlay');
  });

  it('falls back to item story when overlay entry is stale (ts < snapshot)', () => {
    const overlayTs = 999;
    const snapshotTs = 1000;
    const overlay: ConsoleOverlay = {
      PVTI_5: {
        ts: overlayTs,
        mode: 'todo-by-human',
        story: { name: 'StaleOverlay', color: 'RED' },
      },
    };
    expect(
      resolveItemStory(
        item({ number: 5, story: 'ItemStory' }),
        overlay,
        new Date(snapshotTs).toISOString(),
      ),
    ).toBe('ItemStory');
  });

  it('returns overlay story when snapshotGeneratedAt is null (backward compat)', () => {
    const overlay: ConsoleOverlay = {
      PVTI_6: {
        ts: 1,
        mode: 'todo-by-human',
        story: { name: 'OverlayStory', color: 'BLUE' },
      },
    };
    expect(
      resolveItemStory(item({ number: 6, story: 'ItemStory' }), overlay, null),
    ).toBe('OverlayStory');
  });

  it('returns overlay story when snapshotGeneratedAt is an invalid date string (NaN guard)', () => {
    const overlay: ConsoleOverlay = {
      PVTI_7: {
        ts: 1,
        mode: 'todo-by-human',
        story: { name: 'OverlayStory', color: 'BLUE' },
      },
    };
    expect(
      resolveItemStory(
        item({ number: 7, story: 'ItemStory' }),
        overlay,
        'not-a-date',
      ),
    ).toBe('OverlayStory');
  });
});

describe('buildConsoleListRows', () => {
  it('sorts items by storyOrder before grouping', () => {
    const items = [
      item({ number: 1, story: 'Beta' }),
      item({ number: 2, story: 'Alpha' }),
      item({ number: 3, story: 'Beta' }),
    ];
    const rows = buildConsoleListRows(items, {}, ['Alpha', 'Beta']);
    expect(rows.map((row) => row.kind)).toEqual([
      'group-header',
      'item',
      'group-header',
      'item',
      'item',
    ]);
    const firstHeader = rows[0];
    expect(firstHeader.kind === 'group-header' && firstHeader.story).toBe(
      'Alpha',
    );
    const secondHeader = rows[2];
    expect(secondHeader.kind === 'group-header' && secondHeader.story).toBe(
      'Beta',
    );
    expect(secondHeader.kind === 'group-header' && secondHeader.count).toBe(2);
  });

  it('sorts by overlay-resolved story when storyOrder is provided', () => {
    const overlay: ConsoleOverlay = {
      PVTI_1: {
        ts: 1,
        mode: 'todo-by-human',
        story: { name: 'Alpha', color: 'BLUE' },
      },
    };
    const items = [
      item({ number: 1, story: 'Beta' }),
      item({ number: 2, story: 'Beta' }),
    ];
    const rows = buildConsoleListRows(items, overlay, ['Alpha', 'Beta']);
    const firstHeader = rows[0];
    expect(firstHeader.kind === 'group-header' && firstHeader.story).toBe(
      'Alpha',
    );
  });

  it('keeps original relative order when storyOrder is empty', () => {
    const items = [
      item({ number: 1, story: 'Alpha' }),
      item({ number: 2, story: 'Alpha' }),
      item({ number: 3, story: 'Beta' }),
      item({ number: 4, story: 'Alpha' }),
    ];
    const rows = buildConsoleListRows(items, {}, []);
    expect(rows.map((row) => row.kind)).toEqual([
      'group-header',
      'item',
      'item',
      'group-header',
      'item',
      'group-header',
      'item',
    ]);
    const firstHeader = rows[0];
    expect(firstHeader.kind === 'group-header' && firstHeader.count).toBe(3);
  });

  it('returns no rows for an empty list', () => {
    expect(buildConsoleListRows([], {}, [])).toEqual([]);
  });

  it('uses item story for group header when overlay entry is stale', () => {
    const overlayTs = 999;
    const snapshotTs = 1000;
    const overlay: ConsoleOverlay = {
      PVTI_1: {
        ts: overlayTs,
        mode: 'todo-by-human',
        story: { name: 'StaleStory', color: 'RED' },
      },
    };
    const items = [item({ number: 1, story: 'ItemStory' })];
    const rows = buildConsoleListRows(
      items,
      overlay,
      [],
      new Date(snapshotTs).toISOString(),
    );
    const header = rows[0];
    expect(header.kind === 'group-header' && header.story).toBe('ItemStory');
  });

  describe('storyOptionId grouping (bug: HiromiShikata/secretary#7370)', () => {
    const itemWithStoryOptionId = (
      numberValue: number,
      story: string,
      storyOptionId: string | null,
    ): ConsoleListItem =>
      ({
        ...item({ number: numberValue, story }),
        storyOptionId,
      }) as unknown as ConsoleListItem;

    it('produces two separate group-header rows, each with its own storyOptionId and count, for items sharing the same story display name but different story option ids', () => {
      const items = [
        itemWithStoryOptionId(1, 'Duplicate Name', 'dup-1'),
        itemWithStoryOptionId(2, 'Duplicate Name', 'dup-2'),
      ];
      const rows = buildConsoleListRows(items, {}, []);
      const headers = rows.filter(
        (row) => row.kind === 'group-header',
      ) as unknown as {
        kind: 'group-header';
        story: string;
        storyOptionId: string | null;
        count: number;
      }[];
      expect(headers).toHaveLength(2);
      expect(headers[0]?.storyOptionId).toBe('dup-1');
      expect(headers[0]?.count).toBe(1);
      expect(headers[1]?.storyOptionId).toBe('dup-2');
      expect(headers[1]?.count).toBe(1);
    });
  });
});

describe('resolveItemStoryOptionId (bug: HiromiShikata/secretary#7370)', () => {
  const resolveFn = (
    groupingModule as unknown as {
      resolveItemStoryOptionId?: (
        target: ConsoleListItem,
        overlay: ConsoleOverlay,
        snapshotGeneratedAt?: string | null,
      ) => string | null;
    }
  ).resolveItemStoryOptionId;

  const itemWithStoryOptionId = (
    numberValue: number,
    story: string,
    storyOptionId: string | null,
  ): ConsoleListItem =>
    ({
      ...item({ number: numberValue, story }),
      storyOptionId,
    }) as unknown as ConsoleListItem;

  it('prefers the overlay story option id when the overlay carries one', () => {
    const overlay = {
      PVTI_1: {
        ts: 1,
        mode: 'todo-by-human',
        story: { name: 'Overlay', color: 'BLUE', id: 'overlay-id' },
      },
    } as unknown as ConsoleOverlay;
    const target = itemWithStoryOptionId(1, 'Original', 'item-id');
    expect(resolveFn?.(target, overlay)).toBe('overlay-id');
  });

  it('falls back to the item storyOptionId when no overlay entry exists', () => {
    const target = itemWithStoryOptionId(2, 'Original', 'item-id-2');
    expect(resolveFn?.(target, {})).toBe('item-id-2');
  });

  it('returns null when neither the overlay nor the item carries a story option id', () => {
    const target = itemWithStoryOptionId(3, 'Original', null);
    expect(resolveFn?.(target, {})).toBeNull();
  });
});

describe('resolveStoryColorEnum with an id-shaped key', () => {
  it('resolves a color using a story option id string as the lookup key', () => {
    const storyColorsById: Record<string, { color: 'RED' | 'YELLOW' }> = {
      'dup-1': { color: 'RED' },
      'dup-2': { color: 'YELLOW' },
    };
    expect(resolveStoryColorEnum(storyColorsById, 'dup-1')).toBe('RED');
    expect(resolveStoryColorEnum(storyColorsById, 'dup-2')).toBe('YELLOW');
  });
});
