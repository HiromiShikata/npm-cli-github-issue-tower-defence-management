import { consoleStoryEntriesWithClosedOverlay } from './consoleStoryClosedOverlay';
import { writeOverlayEntry } from './overlay';
import type { ConsoleOverlay, ConsoleStoryEntry } from './types';

const makeStories = (
  overrides: Record<string, unknown> = {},
): ConsoleStoryEntry[] => [
  {
    storyName: 'regular / NO STORY',
    storyOptionId: 'story-1',
    color: 'BLUE',
    description: '',
    openItemCount: 1,
    storyViewUrl: null,
    items: [
      {
        number: 12345,
        title: 'Example task for closed-state behavior',
        url: 'https://github.com/example/repository/issues/12345',
        repo: 'example/repository',
        nameWithOwner: 'example/repository',
        projectItemId: 'item-1',
        itemId: 'item-1',
        isPr: false,
        story: 'regular / NO STORY',
        status: 'In Tmux by human',
        agent: null,
        nextActionDate: null,
        nextActionHour: null,
        dependedIssueUrls: [],
        labels: [],
        createdAt: '2026-10-01T00:00:00.000Z',
        relatedOpenPullRequestUrls: [],
        ...overrides,
      } as ConsoleStoryEntry['items'][0],
    ],
  },
];

describe('consoleStoryEntriesWithClosedOverlay', () => {
  it.each([
    {
      label: 'close before snapshot generation',
      closedAtMs: Date.parse('2026-10-04T23:59:59.000Z'),
      generatedAt: '2026-10-05T00:00:00.000Z',
      closed: false,
    },
    {
      label: 'close at snapshot generation',
      closedAtMs: Date.parse('2026-10-05T00:00:00.000Z'),
      generatedAt: '2026-10-05T00:00:00.000Z',
      closed: false,
    },
    {
      label: 'close after snapshot generation',
      closedAtMs: Date.parse('2026-10-05T00:00:01.000Z'),
      generatedAt: '2026-10-05T00:00:00.000Z',
      closed: true,
    },
    {
      label: 'no snapshot loaded',
      closedAtMs: Date.parse('2026-10-05T00:00:01.000Z'),
      generatedAt: null,
      closed: true,
    },
    {
      label: 'unparsable snapshot generation',
      closedAtMs: Date.parse('2026-10-05T00:00:01.000Z'),
      generatedAt: 'not-a-date',
      closed: false,
    },
  ])(
    'applies closure only for the valid $label',
    ({ closedAtMs, generatedAt, closed }) => {
      const stories = makeStories();
      const result = consoleStoryEntriesWithClosedOverlay(
        stories,
        {
          'item-1': { ts: closedAtMs, mode: 'todo-by-human', closedAtMs },
        } as unknown as ConsoleOverlay,
        generatedAt,
      );
      expect(result[0].items[0]).toHaveProperty(
        'isClosed',
        closed ? true : undefined,
      );
      expect(result[0].openItemCount).toBe(closed ? 0 : 1);
    },
  );

  it('applies the closed mark by the whole-second generatedAt the server emits', () => {
    const cases: {
      label: string;
      closedAtMs: number;
      generatedAt: string;
      isClosed: true | undefined;
      openItemCount: number;
    }[] = [
      {
        label: 'same wall-clock second, value earlier than the close',
        closedAtMs: Date.parse('2026-10-05T00:00:00.400Z'),
        generatedAt: '2026-10-05T00:00:00Z',
        isClosed: true,
        openItemCount: 0,
      },
      {
        label: 'earlier second than the close',
        closedAtMs: Date.parse('2026-10-05T00:00:00.400Z'),
        generatedAt: '2026-10-04T23:59:59Z',
        isClosed: true,
        openItemCount: 0,
      },
      {
        label: 'next second after the close',
        closedAtMs: Date.parse('2026-10-05T00:00:00.400Z'),
        generatedAt: '2026-10-05T00:00:01Z',
        isClosed: undefined,
        openItemCount: 1,
      },
      {
        label: 'close exactly on a second, equal generatedAt',
        closedAtMs: Date.parse('2026-10-05T00:00:00.000Z'),
        generatedAt: '2026-10-05T00:00:00Z',
        isClosed: undefined,
        openItemCount: 1,
      },
    ];
    const actual = cases.map(({ label, closedAtMs, generatedAt }) => {
      const result = consoleStoryEntriesWithClosedOverlay(
        makeStories(),
        {
          'item-1': { ts: closedAtMs, mode: 'todo-by-human', closedAtMs },
        } as unknown as ConsoleOverlay,
        generatedAt,
      );
      return {
        label,
        isClosed: result[0].items[0].isClosed,
        openItemCount: result[0].openItemCount,
      };
    });
    expect(actual).toEqual(
      cases.map(({ label, isClosed, openItemCount }) => ({
        label,
        isClosed,
        openItemCount,
      })),
    );
  });

  it.each([
    {
      label: 'non-numeric close time',
      closedAtMs: 'not-a-number',
    },
    {
      label: 'missing close time',
      closedAtMs: undefined,
    },
  ])('does not apply a legacy closed flag with a $label', ({ closedAtMs }) => {
    const stories = makeStories();
    const overlay = {
      'item-1': {
        ts: Date.parse('2026-10-05T00:00:01.000Z'),
        mode: 'todo-by-human',
        closed: true,
        closedAtMs,
      },
    } as unknown as ConsoleOverlay;
    const result = consoleStoryEntriesWithClosedOverlay(
      stories,
      overlay,
      '2026-10-05T00:00:00.000Z',
    );
    expect(result[0].items[0]).toHaveProperty('isClosed', undefined);
    expect(result[0].openItemCount).toBe(1);
  });

  it.each([
    {
      label: 'status write',
      patch: { status: { name: 'In Tmux by human', color: 'BLUE' as const } },
    },
    {
      label: 'story write',
      patch: { story: { name: 'New Story', color: 'GREEN' as const } },
    },
  ])(
    'keeps a snapshot generated between the close and a later $label open',
    ({ patch }) => {
      const closeAt = Date.parse('2026-10-05T00:01:00.000Z');
      const snapshotAt = '2026-10-05T00:02:00.000Z';
      const closed = writeOverlayEntry(
        {},
        'item-1',
        { done: true, closed: true },
        'todo-by-human',
        closeAt,
      );
      const overlay = writeOverlayEntry(
        closed,
        'item-1',
        patch,
        'todo-by-human',
        Date.parse('2026-10-05T00:03:00.000Z'),
      );
      const result = consoleStoryEntriesWithClosedOverlay(
        makeStories(),
        overlay,
        snapshotAt,
      );
      expect(result[0].items[0]).toHaveProperty('isClosed', undefined);
      expect(result[0].openItemCount).toBe(1);
    },
  );

  it('keeps the item hidden when a later story write follows a close and the snapshot predates it', () => {
    const closed = writeOverlayEntry(
      {},
      'item-1',
      { done: true, closed: true },
      'todo-by-human',
      Date.parse('2026-10-05T00:01:00.000Z'),
    );
    const overlay = writeOverlayEntry(
      closed,
      'item-1',
      { story: { name: 'New Story', color: 'GREEN' } },
      'todo-by-human',
      Date.parse('2026-10-05T00:03:00.000Z'),
    );
    const result = consoleStoryEntriesWithClosedOverlay(
      makeStories(),
      overlay,
      '2026-10-05T00:00:30.000Z',
    );
    expect(result[0].items[0]).toHaveProperty('isClosed', true);
    expect(result[0].openItemCount).toBe(0);
  });

  it.each([
    {
      label: 'open item',
      itemClosed: undefined,
      openItemCount: 1,
      expected: 0,
    },
    {
      label: 'already closed item',
      itemClosed: true,
      openItemCount: 1,
      expected: 1,
    },
    {
      label: 'zero count',
      itemClosed: undefined,
      openItemCount: 0,
      expected: 0,
    },
  ])(
    'decrements once and never below zero for an $label',
    ({ itemClosed, openItemCount, expected }) => {
      const stories = makeStories({ isClosed: itemClosed });
      stories[0].openItemCount = openItemCount;
      const result = consoleStoryEntriesWithClosedOverlay(
        stories,
        {
          'item-1': { ts: 1, mode: 'todo-by-human', closedAtMs: 1 },
        } as unknown as ConsoleOverlay,
        null,
      );
      expect(result[0].openItemCount).toBe(expected);
    },
  );

  it('does not mutate the input array or its entries', () => {
    const stories = makeStories();
    const overlay = {
      'item-1': { ts: 1, mode: 'todo-by-human', closedAtMs: 1 },
    } as unknown as ConsoleOverlay;
    const result = consoleStoryEntriesWithClosedOverlay(stories, overlay, null);
    expect(result).not.toBe(stories);
    expect(result[0]).not.toBe(stories[0]);
    expect(stories[0].items[0]).not.toHaveProperty('isClosed');
    expect(stories[0].openItemCount).toBe(1);
  });
});
