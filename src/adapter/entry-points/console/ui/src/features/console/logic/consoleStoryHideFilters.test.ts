import {
  buildConsoleStoryRenderEntries,
  isConsoleListItemTriggered,
} from './consoleStoryHideFilters';
import type { ConsoleListItem, ConsoleStoryEntry } from './types';

const makeItem = (
  number: number,
  overrides: Partial<ConsoleListItem> = {},
): ConsoleListItem => ({
  number,
  title: `Task ${number}`,
  url: `https://github.com/demo/repo/issues/${number}`,
  repo: 'demo/repo',
  nameWithOwner: 'demo/repo',
  projectItemId: `item-${number}`,
  itemId: `item-${number}`,
  isPr: false,
  story: 'Story',
  status: 'Preparation',
  agent: null,
  nextActionDate: null,
  nextActionHour: null,
  dependedIssueUrls: [],
  labels: [],
  createdAt: '2026-06-13T08:18:45.000Z',
  relatedOpenPullRequestUrls: [],
  ...overrides,
});

const makeStory = (
  storyName: string,
  openItemCount: number,
  items: ConsoleListItem[],
): ConsoleStoryEntry => ({
  storyName,
  storyOptionId: `option-${storyName}`,
  color: 'BLUE',
  description: '',
  openItemCount,
  storyViewUrl: null,
  items,
});

const dependedOnItem = makeItem(4, {
  status: 'Awaiting Owner',
  dependedIssueUrls: ['https://github.com/demo/repo/issues/40'],
});

const stories: ConsoleStoryEntry[] = [
  makeStory('Console port', 2, [
    makeItem(1, { title: 'Write status filter tests' }),
    makeItem(2, {
      title: 'Confirm Reactivation Trigger display',
      nextActionDate: '2026-11-10',
    }),
    makeItem(3, { title: 'Archive old board fields', status: 'Done' }),
  ]),
  makeStory('Invoice automation', 2, [
    dependedOnItem,
    makeItem(5, { title: 'Draft invoice export spec' }),
  ]),
  makeStory('Finished onboarding', 0, [
    makeItem(6, { title: 'Close onboarding checklist', status: 'Done' }),
  ]),
  makeStory('Empty planning story', 0, []),
  makeStory('Waiting on vendor', 1, [
    makeItem(7, {
      title: 'Wait for vendor reply',
      nextActionHour: 9,
    }),
  ]),
];

type RenderEntrySummary = {
  storyName: string;
  visibleNumbers: number[];
  badgeCount: number;
};

describe('isConsoleListItemTriggered', () => {
  it.each([
    {
      label: 'no depended issue, no next action date and no next action hour',
      overrides: {},
      expected: false,
    },
    {
      label: 'one depended issue URL',
      overrides: {
        dependedIssueUrls: ['https://github.com/demo/repo/issues/40'],
      },
      expected: true,
    },
    {
      label: 'a next action date',
      overrides: { nextActionDate: '2026-11-10' },
      expected: true,
    },
    {
      label: 'a next action hour of 0',
      overrides: { nextActionHour: 0 },
      expected: true,
    },
    {
      label: 'a next action hour of 9',
      overrides: { nextActionHour: 9 },
      expected: true,
    },
  ])(
    'returns $expected when the item has $label',
    ({ overrides, expected }) => {
      expect(isConsoleListItemTriggered(makeItem(1, overrides))).toBe(expected);
    },
  );
});

describe('buildConsoleStoryRenderEntries', () => {
  it.each([
    {
      label: 'no toggle is on and no status is selected, showing done tasks off',
      input: {
        effectiveStatusSelection: [],
        showDone: false,
        hideTriggered: false,
        hideEmptyStories: false,
      },
      expected: [
        {
          storyName: 'Console port',
          visibleNumbers: [1, 2],
          badgeCount: 2,
        },
        {
          storyName: 'Invoice automation',
          visibleNumbers: [4, 5],
          badgeCount: 2,
        },
        {
          storyName: 'Finished onboarding',
          visibleNumbers: [],
          badgeCount: 0,
        },
        {
          storyName: 'Empty planning story',
          visibleNumbers: [],
          badgeCount: 0,
        },
        {
          storyName: 'Waiting on vendor',
          visibleNumbers: [7],
          badgeCount: 1,
        },
      ],
    },
    {
      label: 'no toggle is on and no status is selected, showing done tasks on',
      input: {
        effectiveStatusSelection: [],
        showDone: true,
        hideTriggered: false,
        hideEmptyStories: false,
      },
      expected: [
        {
          storyName: 'Console port',
          visibleNumbers: [1, 2, 3],
          badgeCount: 2,
        },
        {
          storyName: 'Invoice automation',
          visibleNumbers: [4, 5],
          badgeCount: 2,
        },
        {
          storyName: 'Finished onboarding',
          visibleNumbers: [6],
          badgeCount: 0,
        },
        {
          storyName: 'Empty planning story',
          visibleNumbers: [],
          badgeCount: 0,
        },
        {
          storyName: 'Waiting on vendor',
          visibleNumbers: [7],
          badgeCount: 1,
        },
      ],
    },
    {
      label: 'Hide triggered is on and showing done tasks off',
      input: {
        effectiveStatusSelection: [],
        showDone: false,
        hideTriggered: true,
        hideEmptyStories: false,
      },
      expected: [
        {
          storyName: 'Console port',
          visibleNumbers: [1],
          badgeCount: 1,
        },
        {
          storyName: 'Invoice automation',
          visibleNumbers: [5],
          badgeCount: 1,
        },
        {
          storyName: 'Finished onboarding',
          visibleNumbers: [],
          badgeCount: 0,
        },
        {
          storyName: 'Empty planning story',
          visibleNumbers: [],
          badgeCount: 0,
        },
        {
          storyName: 'Waiting on vendor',
          visibleNumbers: [],
          badgeCount: 0,
        },
      ],
    },
    {
      label: 'Hide triggered is on and showing done tasks on',
      input: {
        effectiveStatusSelection: [],
        showDone: true,
        hideTriggered: true,
        hideEmptyStories: false,
      },
      expected: [
        {
          storyName: 'Console port',
          visibleNumbers: [1, 3],
          badgeCount: 1,
        },
        {
          storyName: 'Invoice automation',
          visibleNumbers: [5],
          badgeCount: 1,
        },
        {
          storyName: 'Finished onboarding',
          visibleNumbers: [6],
          badgeCount: 0,
        },
        {
          storyName: 'Empty planning story',
          visibleNumbers: [],
          badgeCount: 0,
        },
        {
          storyName: 'Waiting on vendor',
          visibleNumbers: [],
          badgeCount: 0,
        },
      ],
    },
    {
      label: 'Hide empty is on and no other toggle is on',
      input: {
        effectiveStatusSelection: [],
        showDone: false,
        hideTriggered: false,
        hideEmptyStories: true,
      },
      expected: [
        {
          storyName: 'Console port',
          visibleNumbers: [1, 2],
          badgeCount: 2,
        },
        {
          storyName: 'Invoice automation',
          visibleNumbers: [4, 5],
          badgeCount: 2,
        },
        {
          storyName: 'Waiting on vendor',
          visibleNumbers: [7],
          badgeCount: 1,
        },
      ],
    },
    {
      label: 'Hide triggered and Hide empty are on and showing done tasks off',
      input: {
        effectiveStatusSelection: [],
        showDone: false,
        hideTriggered: true,
        hideEmptyStories: true,
      },
      expected: [
        {
          storyName: 'Console port',
          visibleNumbers: [1],
          badgeCount: 1,
        },
        {
          storyName: 'Invoice automation',
          visibleNumbers: [5],
          badgeCount: 1,
        },
      ],
    },
    {
      label: 'Hide triggered and Hide empty are on and showing done tasks on',
      input: {
        effectiveStatusSelection: [],
        showDone: true,
        hideTriggered: true,
        hideEmptyStories: true,
      },
      expected: [
        {
          storyName: 'Console port',
          visibleNumbers: [1, 3],
          badgeCount: 1,
        },
        {
          storyName: 'Invoice automation',
          visibleNumbers: [5],
          badgeCount: 1,
        },
      ],
    },
    {
      label: 'a status is selected and no toggle is on',
      input: {
        effectiveStatusSelection: ['Preparation'],
        showDone: false,
        hideTriggered: false,
        hideEmptyStories: false,
      },
      expected: [
        {
          storyName: 'Console port',
          visibleNumbers: [1, 2],
          badgeCount: 2,
        },
        {
          storyName: 'Invoice automation',
          visibleNumbers: [5],
          badgeCount: 1,
        },
        {
          storyName: 'Waiting on vendor',
          visibleNumbers: [7],
          badgeCount: 1,
        },
      ],
    },
    {
      label: 'a status is selected and Hide triggered is on',
      input: {
        effectiveStatusSelection: ['Preparation'],
        showDone: false,
        hideTriggered: true,
        hideEmptyStories: false,
      },
      expected: [
        {
          storyName: 'Console port',
          visibleNumbers: [1],
          badgeCount: 1,
        },
        {
          storyName: 'Invoice automation',
          visibleNumbers: [5],
          badgeCount: 1,
        },
        {
          storyName: 'Waiting on vendor',
          visibleNumbers: [],
          badgeCount: 0,
        },
      ],
    },
    {
      label: 'a status is selected and Hide triggered and Hide empty are on',
      input: {
        effectiveStatusSelection: ['Preparation'],
        showDone: false,
        hideTriggered: true,
        hideEmptyStories: true,
      },
      expected: [
        {
          storyName: 'Console port',
          visibleNumbers: [1],
          badgeCount: 1,
        },
        {
          storyName: 'Invoice automation',
          visibleNumbers: [5],
          badgeCount: 1,
        },
      ],
    },
    {
      label: 'the selected status is Done and Hide triggered is on',
      input: {
        effectiveStatusSelection: ['Done'],
        showDone: false,
        hideTriggered: true,
        hideEmptyStories: false,
      },
      expected: [
        {
          storyName: 'Console port',
          visibleNumbers: [3],
          badgeCount: 1,
        },
        {
          storyName: 'Finished onboarding',
          visibleNumbers: [6],
          badgeCount: 1,
        },
      ],
    },
    {
      label:
        'the selected status holds only triggered tasks, Hide triggered is on and Hide empty is off',
      input: {
        effectiveStatusSelection: ['Awaiting Owner'],
        showDone: false,
        hideTriggered: true,
        hideEmptyStories: false,
      },
      expected: [
        {
          storyName: 'Invoice automation',
          visibleNumbers: [],
          badgeCount: 0,
        },
      ],
    },
    {
      label:
        'the selected status holds only triggered tasks, Hide triggered and Hide empty are on',
      input: {
        effectiveStatusSelection: ['Awaiting Owner'],
        showDone: false,
        hideTriggered: true,
        hideEmptyStories: true,
      },
      expected: [],
    },
  ])(
    'returns the rendered entries when $label',
    ({ input, expected }) => {
      const actual: RenderEntrySummary[] = buildConsoleStoryRenderEntries({
        stories,
        ...input,
      }).map((renderEntry) => ({
        storyName: renderEntry.entry.storyName,
        visibleNumbers: renderEntry.visibleItems.map((item) => item.number),
        badgeCount: renderEntry.badgeCount,
      }));
      expect(actual).toEqual(expected);
    },
  );
});
