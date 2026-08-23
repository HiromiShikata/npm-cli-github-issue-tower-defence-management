import {
  buildConsoleListRows,
  CONSOLE_NO_STORY_LABEL,
  resolveItemStory,
  resolveStoryColorEnum,
} from './grouping';
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
        mode: 'triage',
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
        mode: 'triage',
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
});
