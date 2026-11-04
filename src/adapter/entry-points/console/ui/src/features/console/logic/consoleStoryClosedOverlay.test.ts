import { consoleStoryEntriesWithClosedOverlay } from './consoleStoryClosedOverlay';
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
      label: 'entry before snapshot generation',
      ts: Date.parse('2026-10-04T23:59:59.000Z'),
      generatedAt: '2026-10-05T00:00:00.000Z',
      closed: false,
    },
    {
      label: 'entry at snapshot generation',
      ts: Date.parse('2026-10-05T00:00:00.000Z'),
      generatedAt: '2026-10-05T00:00:00.000Z',
      closed: true,
    },
    {
      label: 'entry after snapshot generation',
      ts: Date.parse('2026-10-05T00:00:01.000Z'),
      generatedAt: '2026-10-05T00:00:00.000Z',
      closed: true,
    },
    {
      label: 'no snapshot loaded',
      ts: Date.parse('2026-10-05T00:00:01.000Z'),
      generatedAt: null,
      closed: true,
    },
    {
      label: 'unparsable snapshot generation',
      ts: Date.parse('2026-10-05T00:00:01.000Z'),
      generatedAt: 'not-a-date',
      closed: false,
    },
  ])(
    'applies closure only for the valid $label',
    ({ ts, generatedAt, closed }) => {
      const stories = makeStories();
      const result = consoleStoryEntriesWithClosedOverlay(
        stories,
        { 'item-1': { ts, mode: 'todo-by-human', closed: true } },
        generatedAt,
      );
      expect(result[0].items[0]).toHaveProperty(
        'isClosed',
        closed ? true : undefined,
      );
      expect(result[0].openItemCount).toBe(closed ? 0 : 1);
    },
  );

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
        { 'item-1': { ts: 1, mode: 'todo-by-human', closed: true } },
        null,
      );
      expect(result[0].openItemCount).toBe(expected);
    },
  );

  it('does not mutate the input array or its entries', () => {
    const stories = makeStories();
    const overlay: ConsoleOverlay = {
      'item-1': { ts: 1, mode: 'todo-by-human', closed: true },
    };
    const result = consoleStoryEntriesWithClosedOverlay(stories, overlay, null);
    expect(result).not.toBe(stories);
    expect(result[0]).not.toBe(stories[0]);
    expect(stories[0].items[0]).not.toHaveProperty('isClosed');
    expect(stories[0].openItemCount).toBe(1);
  });
});
