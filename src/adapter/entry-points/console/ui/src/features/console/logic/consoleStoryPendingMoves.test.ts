import {
  type ConsoleStoryPendingMove,
  consoleStoryEntriesWithPendingMoves,
  consoleStoryPendingMovesRemaining,
  consoleStorySetAtMsRead,
} from './consoleStoryPendingMoves';
import type { ConsoleFieldOption, ConsoleStoryEntry } from './types';

const alphaStoryOptionId = 'opt-alpha';
const betaStoryOptionId = 'opt-beta';
const betaOption: ConsoleFieldOption = {
  id: betaStoryOptionId,
  name: 'Story Beta',
  color: 'BLUE',
};

const makeStories = (): ConsoleStoryEntry[] => [
  {
    storyName: 'Story Alpha',
    storyOptionId: alphaStoryOptionId,
    color: 'BLUE',
    description: '',
    openItemCount: 1,
    storyViewUrl: null,
    items: [
      {
        number: 7,
        title: 'Moved task',
        url: 'https://github.com/example/repository/issues/7',
        repo: 'example/repository',
        nameWithOwner: 'example/repository',
        projectItemId: 'item-moved',
        itemId: 'item-moved',
        isPr: false,
        story: 'Story Alpha',
        status: 'Todo by human',
        agent: null,
        nextActionDate: null,
        nextActionHour: null,
        dependedIssueUrls: [],
        labels: [],
        createdAt: '2026-10-01T00:00:00.000Z',
        relatedOpenPullRequestUrls: [],
      } as ConsoleStoryEntry['items'][0],
    ],
  },
  {
    storyName: 'Story Beta',
    storyOptionId: betaStoryOptionId,
    color: 'BLUE',
    description: '',
    openItemCount: 0,
    storyViewUrl: null,
    items: [],
  },
];

const moveSavedAtMs = Date.parse('2026-10-05T00:02:00.000Z');
const pendingMove: ConsoleStoryPendingMove = {
  projectItemId: 'item-moved',
  target: betaOption,
  storySetAtMs: moveSavedAtMs,
};

describe('consoleStorySetAtMsRead', () => {
  it.each([
    {
      label: 'a finite number',
      response: { ok: true, storySetAtMs: moveSavedAtMs },
      expected: moveSavedAtMs,
    },
    {
      label: 'a response without the field',
      response: { ok: true },
      expected: undefined,
    },
    {
      label: 'a non-number field',
      response: { ok: true, storySetAtMs: '2026-10-05T00:02:00.000Z' },
      expected: undefined,
    },
    { label: 'null', response: null, expected: undefined },
    { label: 'a string', response: 'ok', expected: undefined },
  ])('returns $expected for $label', ({ response, expected }) => {
    expect(consoleStorySetAtMsRead(response)).toBe(expected);
  });
});

describe('consoleStoryPendingMovesRemaining', () => {
  it.each([
    {
      label: 'a list generated before the move was saved',
      storiesGeneratedAt: '2026-10-05T00:01:30.000Z',
      kept: true,
    },
    {
      label: 'a list generated at the same instant as the move was saved',
      storiesGeneratedAt: '2026-10-05T00:02:00.000Z',
      kept: false,
    },
    {
      label: 'a list generated after the move was saved',
      storiesGeneratedAt: '2026-10-05T00:02:30.000Z',
      kept: false,
    },
    {
      label: 'no list received yet',
      storiesGeneratedAt: null,
      kept: true,
    },
    {
      label: 'a list whose generatedAt cannot be parsed',
      storiesGeneratedAt: 'not a timestamp',
      kept: false,
    },
  ])(
    'keeps the move for $label: $kept',
    ({ storiesGeneratedAt, kept }) => {
      expect(
        consoleStoryPendingMovesRemaining([pendingMove], storiesGeneratedAt),
      ).toEqual(kept ? [pendingMove] : []);
    },
  );
});

describe('consoleStoryEntriesWithPendingMoves', () => {
  it.each([
    {
      label: 'an older list still listing the task under its original story',
      storiesGeneratedAt: '2026-10-05T00:01:30.000Z',
      expectedStoryOptionId: betaStoryOptionId,
    },
    {
      label: 'a newer list',
      storiesGeneratedAt: '2026-10-05T00:02:30.000Z',
      expectedStoryOptionId: alphaStoryOptionId,
    },
  ])(
    'places the task under the expected story for $label',
    ({ storiesGeneratedAt, expectedStoryOptionId }) => {
      const result = consoleStoryEntriesWithPendingMoves(
        makeStories(),
        [pendingMove],
        storiesGeneratedAt,
      );
      const holders = result
        .filter((entry) =>
          (entry.items ?? []).some(
            (item) => item.projectItemId === 'item-moved',
          ),
        )
        .map((entry) => entry.storyOptionId);
      expect(holders).toEqual([expectedStoryOptionId]);
    },
  );
});
