import {
  type ConsoleStoryPendingMove,
  consoleStoryEntriesWithPendingMoves,
  consoleStoryPendingMovesRemaining,
  consoleStorySetAtMsRead,
  moveTaskToStory,
} from './consoleStoryPendingMoves';
import type {
  ConsoleFieldOption,
  ConsoleListItem,
  ConsoleStoryEntry,
} from './types';

const storyOption = (id: string, name: string): ConsoleFieldOption => ({
  id,
  name,
  color: 'BLUE',
});

const alphaStory = storyOption('opt-alpha', 'Story Alpha');
const betaStory = storyOption('opt-beta', 'Story Beta');
const gammaStory = storyOption('opt-gamma', 'Story Gamma');

const listItem = (
  projectItemId: string,
  status: string,
  isClosed: boolean,
): ConsoleListItem => ({
  number: 1,
  title: `Task ${projectItemId}`,
  url: 'https://github.com/o/r/issues/1',
  repo: 'r',
  nameWithOwner: 'o/r',
  projectItemId,
  itemId: projectItemId,
  isPr: false,
  story: '',
  status,
  agent: null,
  nextActionDate: null,
  nextActionHour: null,
  dependedIssueUrls: [],
  labels: [],
  createdAt: '2026-11-06T00:00:00Z',
  relatedOpenPullRequestUrls: [],
  isClosed,
});

const isCountedAsOpen = (item: ConsoleListItem): boolean => !item.isClosed;

const storyEntry = (
  story: ConsoleFieldOption,
  items: ConsoleListItem[],
): ConsoleStoryEntry => ({
  storyName: story.name,
  storyOptionId: story.id,
  color: 'BLUE',
  description: '',
  openItemCount: items.filter(isCountedAsOpen).length,
  storyViewUrl: null,
  items,
});

const initialStories = (): ConsoleStoryEntry[] => [
  storyEntry(alphaStory, [
    listItem('t1', 'Todo by human', false),
    listItem('t2', 'Todo by human', false),
  ]),
  storyEntry(betaStory, []),
  storyEntry(gammaStory, []),
];

const T0_MS = Date.parse('2026-11-06T03:50:00.000Z');

const secondsAfterT0 = (seconds: number): number => T0_MS + seconds * 1000;

const listAt = (seconds: number): string =>
  new Date(secondsAfterT0(seconds)).toISOString().replace('.000Z', 'Z');

const moveAt = (
  projectItemId: string,
  target: ConsoleFieldOption,
  seconds: number,
): ConsoleStoryPendingMove => ({
  projectItemId,
  target,
  storySetAtMs: secondsAfterT0(seconds),
});

const placementsOf = (entries: ConsoleStoryEntry[]): string[] =>
  entries
    .flatMap((entry) =>
      entry.items.map((item) => `${item.projectItemId}:${entry.storyOptionId}`),
    )
    .sort();

describe('consoleStoryPendingMoves', () => {
  describe('consoleStoryPendingMovesRemaining', () => {
    it('keeps a move only when the stories list generatedAt is earlier than the move, or unknown', () => {
      const move = moveAt('t1', betaStory, 0);
      const cases = [
        {
          name: 'list generated before the move',
          storiesGeneratedAt: listAt(-30),
          expectedKept: true,
        },
        {
          name: 'list generated at the same second as the move',
          storiesGeneratedAt: listAt(0),
          expectedKept: false,
        },
        {
          name: 'list generated after the move',
          storiesGeneratedAt: listAt(30),
          expectedKept: false,
        },
        {
          name: 'list without generatedAt',
          storiesGeneratedAt: null,
          expectedKept: true,
        },
        {
          name: 'list with an unparsable generatedAt',
          storiesGeneratedAt: 'not-a-timestamp',
          expectedKept: true,
        },
      ];
      for (const testCase of cases) {
        const kept =
          consoleStoryPendingMovesRemaining([move], testCase.storiesGeneratedAt)
            .length === 1;
        expect({ name: testCase.name, kept }).toEqual({
          name: testCase.name,
          kept: testCase.expectedKept,
        });
      }
    });
  });

  describe('consoleStoryEntriesWithPendingMoves', () => {
    it('shows each task under the story of its latest pending move, dropping moves at or before the list generatedAt', () => {
      const cases = [
        {
          name: 'one move, list generated before it',
          moves: [moveAt('t1', betaStory, 0)],
          storiesGeneratedAt: listAt(-30),
          expectedPlacements: ['t1:opt-beta', 't2:opt-alpha'],
        },
        {
          name: 'one move, list generated at the same second',
          moves: [moveAt('t1', betaStory, 0)],
          storiesGeneratedAt: listAt(0),
          expectedPlacements: ['t1:opt-alpha', 't2:opt-alpha'],
        },
        {
          name: 'one move, list generated after it',
          moves: [moveAt('t1', betaStory, 0)],
          storiesGeneratedAt: listAt(30),
          expectedPlacements: ['t1:opt-alpha', 't2:opt-alpha'],
        },
        {
          name: 'two moves of different tasks, list generated before both',
          moves: [moveAt('t1', betaStory, 0), moveAt('t2', gammaStory, 5)],
          storiesGeneratedAt: listAt(-30),
          expectedPlacements: ['t1:opt-beta', 't2:opt-gamma'],
        },
        {
          name: 'move A to B then B to C, list generated before both',
          moves: [moveAt('t1', betaStory, 0), moveAt('t1', gammaStory, 10)],
          storiesGeneratedAt: listAt(-30),
          expectedPlacements: ['t1:opt-gamma', 't2:opt-alpha'],
        },
        {
          name: 'move A to B then back to A, list generated before both',
          moves: [moveAt('t1', betaStory, 0), moveAt('t1', alphaStory, 10)],
          storiesGeneratedAt: listAt(-30),
          expectedPlacements: ['t1:opt-alpha', 't2:opt-alpha'],
        },
        {
          name: 'move A to B then B to C, list generated between the two moves',
          moves: [moveAt('t1', betaStory, 0), moveAt('t1', gammaStory, 10)],
          storiesGeneratedAt: listAt(5),
          expectedPlacements: ['t1:opt-gamma', 't2:opt-alpha'],
        },
        {
          name: 'move A to B then B to C, list generated at the second move',
          moves: [moveAt('t1', betaStory, 0), moveAt('t1', gammaStory, 10)],
          storiesGeneratedAt: listAt(10),
          expectedPlacements: ['t1:opt-alpha', 't2:opt-alpha'],
        },
        {
          name: 'two moves of different tasks, list without generatedAt',
          moves: [moveAt('t1', betaStory, 0), moveAt('t2', gammaStory, 5)],
          storiesGeneratedAt: null,
          expectedPlacements: ['t1:opt-beta', 't2:opt-gamma'],
        },
        {
          name: 'two moves of different tasks, list with an unparsable generatedAt',
          moves: [moveAt('t1', betaStory, 0), moveAt('t2', gammaStory, 5)],
          storiesGeneratedAt: 'not-a-timestamp',
          expectedPlacements: ['t1:opt-beta', 't2:opt-gamma'],
        },
      ];
      for (const testCase of cases) {
        const placements = placementsOf(
          consoleStoryEntriesWithPendingMoves(
            initialStories(),
            testCase.moves,
            testCase.storiesGeneratedAt,
          ),
        );
        expect({ name: testCase.name, placements }).toEqual({
          name: testCase.name,
          placements: [...testCase.expectedPlacements].sort(),
        });
      }
    });
  });

  describe('consoleStorySetAtMsRead', () => {
    it('returns storySetAtMs only when it is a finite number', () => {
      const cases: { name: string; response: unknown; expected: number | undefined }[] =
        [
          {
            name: 'finite number',
            response: { ok: true, storySetAtMs: 1793975484000 },
            expected: 1793975484000,
          },
          {
            name: 'zero',
            response: { ok: true, storySetAtMs: 0 },
            expected: 0,
          },
          {
            name: 'missing storySetAtMs',
            response: { ok: true },
            expected: undefined,
          },
          {
            name: 'numeric string',
            response: { ok: true, storySetAtMs: '1793975484000' },
            expected: undefined,
          },
          {
            name: 'NaN',
            response: { ok: true, storySetAtMs: Number.NaN },
            expected: undefined,
          },
          {
            name: 'Infinity',
            response: { ok: true, storySetAtMs: Number.POSITIVE_INFINITY },
            expected: undefined,
          },
          {
            name: 'null storySetAtMs',
            response: { ok: true, storySetAtMs: null },
            expected: undefined,
          },
          {
            name: 'null body',
            response: null,
            expected: undefined,
          },
          {
            name: 'undefined body',
            response: undefined,
            expected: undefined,
          },
          {
            name: 'bare number body',
            response: 1793975484000,
            expected: undefined,
          },
        ];
      for (const testCase of cases) {
        const actual = consoleStorySetAtMsRead(testCase.response);
        expect({ name: testCase.name, actual }).toEqual({
          name: testCase.name,
          actual: testCase.expected,
        });
      }
    });
  });

  describe('moveTaskToStory open-item counts', () => {
    it('changes the source and target openItemCount only when the moved task is counted as open', () => {
      const cases = [
        {
          name: 'an open task',
          isClosed: false,
          status: 'Todo by human',
          sourceDelta: -1,
          targetDelta: 1,
        },
        {
          name: 'an open task whose status is Done',
          isClosed: false,
          status: 'Done',
          sourceDelta: -1,
          targetDelta: 1,
        },
        {
          name: 'a closed task',
          isClosed: true,
          status: 'Todo by human',
          sourceDelta: 0,
          targetDelta: 0,
        },
        {
          name: 'a closed task whose status is Done',
          isClosed: true,
          status: 'Done',
          sourceDelta: 0,
          targetDelta: 0,
        },
      ];
      for (const testCase of cases) {
        const moved = listItem('moved', testCase.status, testCase.isClosed);
        const entries = [
          storyEntry(alphaStory, [
            moved,
            listItem('other', 'Todo by human', false),
          ]),
          storyEntry(betaStory, [listItem('beta-task', 'Todo by human', false)]),
          storyEntry(gammaStory, []),
        ];
        const sourceBefore = entries[0].openItemCount;
        const targetBefore = entries[1].openItemCount;
        const after = moveTaskToStory(entries, 'moved', betaStory);
        const counts = {
          source: after.find((e) => e.storyOptionId === alphaStory.id)
            ?.openItemCount,
          target: after.find((e) => e.storyOptionId === betaStory.id)
            ?.openItemCount,
        };
        expect({ name: testCase.name, counts }).toEqual({
          name: testCase.name,
          counts: {
            source: sourceBefore + testCase.sourceDelta,
            target: targetBefore + testCase.targetDelta,
          },
        });
      }
    });
  });
});
