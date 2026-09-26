import {
  buildConsoleListRows,
  CONSOLE_NO_STORY_LABEL,
  resolveItemStory,
  resolveStoryColorEnum,
} from './grouping';
import type { ConsoleListItem, ConsoleOverlay } from './types';

const item = (
  overrides: Partial<ConsoleListItem> &
    Pick<ConsoleListItem, 'number' | 'story'> & {
      storyOptionId?: string | null;
    },
): ConsoleListItem => {
  const defaults = {
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
    storyOptionId: null,
  };
  return { ...defaults, ...overrides };
};

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
      item({ number: 1, story: 'Beta', storyOptionId: 'opt-beta' }),
      item({ number: 2, story: 'Alpha', storyOptionId: 'opt-alpha' }),
      item({ number: 3, story: 'Beta', storyOptionId: 'opt-beta' }),
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
      item({ number: 1, story: 'Beta', storyOptionId: 'opt-beta' }),
      item({ number: 2, story: 'Beta', storyOptionId: 'opt-beta' }),
    ];
    const rows = buildConsoleListRows(items, overlay, ['Alpha', 'Beta']);
    const firstHeader = rows[0];
    expect(firstHeader.kind === 'group-header' && firstHeader.story).toBe(
      'Alpha',
    );
  });

  it('keeps original relative order when storyOrder is empty', () => {
    const items = [
      item({ number: 1, story: 'Alpha', storyOptionId: 'opt-alpha' }),
      item({ number: 2, story: 'Alpha', storyOptionId: 'opt-alpha' }),
      item({ number: 3, story: 'Beta', storyOptionId: 'opt-beta' }),
      item({ number: 4, story: 'Alpha', storyOptionId: 'opt-alpha' }),
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
    const items = [
      item({ number: 1, story: 'ItemStory', storyOptionId: 'opt-item-story' }),
    ];
    const rows = buildConsoleListRows(
      items,
      overlay,
      [],
      new Date(snapshotTs).toISOString(),
    );
    const header = rows[0];
    expect(header.kind === 'group-header' && header.story).toBe('ItemStory');
  });
});

describe('buildConsoleListRows grouping by story option id', () => {
  const summarizeRows = (rows: ReturnType<typeof buildConsoleListRows>) =>
    rows.map((row) =>
      row.kind === 'group-header'
        ? { header: row.story, count: row.count }
        : { itemNumber: row.item.number },
    );

  it.each([
    {
      description:
        'sorts uniquely named stories by story order and groups each story under one header',
      items: [
        item({ number: 1, story: 'Beta', storyOptionId: 'opt-beta' }),
        item({ number: 2, story: 'Alpha', storyOptionId: 'opt-alpha' }),
        item({ number: 3, story: 'Beta', storyOptionId: 'opt-beta' }),
      ],
      storyOrder: ['Alpha', 'Beta'],
      expectedRows: [
        { header: 'Alpha', count: 1 },
        { itemNumber: 2 },
        { header: 'Beta', count: 2 },
        { itemNumber: 1 },
        { itemNumber: 3 },
      ],
    },
    {
      description:
        'keeps the original order of uniquely named stories and opens a header at each story change when story order is empty',
      items: [
        item({ number: 1, story: 'Alpha', storyOptionId: 'opt-alpha' }),
        item({ number: 2, story: 'Alpha', storyOptionId: 'opt-alpha' }),
        item({ number: 3, story: 'Beta', storyOptionId: 'opt-beta' }),
        item({ number: 4, story: 'Alpha', storyOptionId: 'opt-alpha' }),
      ],
      storyOrder: [],
      expectedRows: [
        { header: 'Alpha', count: 3 },
        { itemNumber: 1 },
        { itemNumber: 2 },
        { header: 'Beta', count: 1 },
        { itemNumber: 3 },
        { header: 'Alpha', count: 3 },
        { itemNumber: 4 },
      ],
    },
  ])('$description', ({ items, storyOrder, expectedRows }) => {
    expect(summarizeRows(buildConsoleListRows(items, {}, storyOrder))).toEqual(
      expectedRows,
    );
  });

  it('opens a separate header with its own count for each of two same-named story options', () => {
    const items = [
      item({ number: 1, story: 'Duplicate', storyOptionId: 'opt-dup-first' }),
      item({ number: 2, story: 'Duplicate', storyOptionId: 'opt-dup-first' }),
      item({ number: 3, story: 'Duplicate', storyOptionId: 'opt-dup-second' }),
      item({ number: 4, story: 'Alpha', storyOptionId: 'opt-alpha' }),
    ];
    expect(
      summarizeRows(
        buildConsoleListRows(items, {}, ['Alpha', 'Duplicate', 'Duplicate']),
      ),
    ).toEqual([
      { header: 'Alpha', count: 1 },
      { itemNumber: 4 },
      { header: 'Duplicate', count: 2 },
      { itemNumber: 1 },
      { itemNumber: 2 },
      { header: 'Duplicate', count: 1 },
      { itemNumber: 3 },
    ]);
  });

  it.each([
    { storyOptionIdDescription: 'null', storyOptionId: null },
    { storyOptionIdDescription: 'undefined', storyOptionId: undefined },
  ])(
    'groups an item whose story option id is $storyOptionIdDescription under a header of its own story name, never merged into the group of a story option, including a same-named one',
    ({ storyOptionId }) => {
      const items = [
        item({ number: 1, story: 'Duplicate', storyOptionId: 'opt-dup-first' }),
        item({
          number: 2,
          story: 'Duplicate',
          storyOptionId: 'opt-dup-second',
        }),
        item({ number: 3, story: 'Duplicate', storyOptionId }),
        item({ number: 4, story: 'Alpha', storyOptionId: 'opt-alpha' }),
        item({ number: 5, story: 'Alpha', storyOptionId }),
      ];
      const groups: { header: string; count: number; itemNumbers: number[] }[] =
        [];
      buildConsoleListRows(items, {}, [
        'Alpha',
        'Duplicate',
        'Duplicate',
      ]).forEach((row) => {
        if (row.kind === 'group-header') {
          groups.push({ header: row.story, count: row.count, itemNumbers: [] });
          return;
        }
        const currentGroup = groups[groups.length - 1];
        if (currentGroup) {
          currentGroup.itemNumbers.push(row.item.number);
        }
      });
      const groupsContainingItem = (itemNumber: number) =>
        groups.filter((group) => group.itemNumbers.includes(itemNumber));
      expect(groupsContainingItem(3)).toEqual([
        { header: 'Duplicate', count: 1, itemNumbers: [3] },
      ]);
      expect(groupsContainingItem(5)).toEqual([
        { header: 'Alpha', count: 1, itemNumbers: [5] },
      ]);
    },
  );
});
