import type { ConsoleStoryEntry } from './types';
import {
  CONSOLE_STORY_STATUS_SELECTION_KEY,
  filterConsoleStoryEntriesByStatusSelection,
  readConsoleStoryStatusSelection,
  resolveEffectiveConsoleStoryStatusSelection,
  writeConsoleStoryStatusSelection,
} from './consoleStoryStatusSelection';

type StoryItem = ConsoleStoryEntry['items'][0];

const makeItem = (title: string, status: string | null): StoryItem => ({
  number: 1,
  title,
  url: `https://github.com/demo/repo/issues/${title.length}`,
  repo: 'demo/repo',
  nameWithOwner: 'demo/repo',
  projectItemId: `PVTI_${title}`,
  itemId: `PVTI_${title}`,
  isPr: false,
  story: 'Story',
  status,
  agent: null,
  nextActionDate: null,
  nextActionHour: null,
  dependedIssueUrls: [],
  labels: [],
  createdAt: '2026-08-01T00:00:00.000Z',
  relatedOpenPullRequestUrls: [],
});

const makeStory = (
  storyName: string,
  items: StoryItem[],
): ConsoleStoryEntry => ({
  storyName,
  storyOptionId: storyName,
  color: 'BLUE',
  description: '',
  openItemCount: items.length,
  storyViewUrl: null,
  items,
});

const stories: ConsoleStoryEntry[] = [
  makeStory('Alpha', [
    makeItem('alpha unread', 'Unread'),
    makeItem('alpha done', 'Done'),
  ]),
  makeStory('Beta', [makeItem('beta running', 'In Tmux by agent')]),
  makeStory('Gamma', []),
  makeStory('Delta', [makeItem('delta done', 'Done')]),
];

const summarize = (entries: ConsoleStoryEntry[]) =>
  entries.map((entry) => [
    entry.storyName,
    entry.items.map((item) => item.title),
  ]);

describe('consoleStoryStatusSelection', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('uses the console-story-selected-statuses localStorage key', () => {
    expect(CONSOLE_STORY_STATUS_SELECTION_KEY).toBe(
      'console-story-selected-statuses',
    );
  });

  it('reads the saved selection as a list of status names for every stored shape', () => {
    const cases: { label: string; raw: string | null; expected: string[] }[] =
      [
        { label: 'nothing saved', raw: null, expected: [] },
        {
          label: 'valid array',
          raw: '["Done","Unread"]',
          expected: ['Done', 'Unread'],
        },
        { label: 'empty array', raw: '[]', expected: [] },
        { label: 'broken JSON', raw: '["Done"', expected: [] },
        { label: 'non-array JSON', raw: '{"status":"Done"}', expected: [] },
        {
          label: 'array containing non-strings',
          raw: '["Done",1,null,{"a":1},"Unread"]',
          expected: ['Done', 'Unread'],
        },
      ];
    for (const { label, raw, expected } of cases) {
      localStorage.clear();
      if (raw !== null) {
        localStorage.setItem(CONSOLE_STORY_STATUS_SELECTION_KEY, raw);
      }
      expect({ label, value: readConsoleStoryStatusSelection() }).toEqual({
        label,
        value: expected,
      });
    }
  });

  it('writes the selection as a JSON array that the read function returns unchanged', () => {
    writeConsoleStoryStatusSelection(['Done', 'Unread']);
    expect(localStorage.getItem(CONSOLE_STORY_STATUS_SELECTION_KEY)).toBe(
      '["Done","Unread"]',
    );
    expect(readConsoleStoryStatusSelection()).toEqual(['Done', 'Unread']);
  });

  it('keeps only selected names that exist in the current status options', () => {
    const cases: {
      label: string;
      selected: string[];
      optionNames: string[];
      expected: string[];
    }[] = [
      {
        label: 'no selection',
        selected: [],
        optionNames: ['Unread', 'Done'],
        expected: [],
      },
      {
        label: 'selection present in options',
        selected: ['Done'],
        optionNames: ['Unread', 'Done'],
        expected: ['Done'],
      },
      {
        label: 'selection absent from options',
        selected: ['Removed'],
        optionNames: ['Unread', 'Done'],
        expected: [],
      },
      {
        label: 'mixed present and absent',
        selected: ['Done', 'Removed'],
        optionNames: ['Unread', 'Done'],
        expected: ['Done'],
      },
    ];
    for (const { label, selected, optionNames, expected } of cases) {
      expect({
        label,
        value: resolveEffectiveConsoleStoryStatusSelection(
          selected,
          optionNames,
        ),
      }).toEqual({ label, value: expected });
    }
  });

  it('returns stories unchanged for an empty selection and otherwise keeps stories and items whose status is selected, as a union', () => {
    const cases: { label: string; selected: string[]; expected: unknown }[] =
      [
        {
          label: 'empty selection leaves every story and item',
          selected: [],
          expected: summarize(stories),
        },
        {
          label: 'one status keeps matching stories and only matching items',
          selected: ['Done'],
          expected: [
            ['Alpha', ['alpha done']],
            ['Delta', ['delta done']],
          ],
        },
        {
          label: 'two statuses are a union',
          selected: ['Unread', 'In Tmux by agent'],
          expected: [
            ['Alpha', ['alpha unread']],
            ['Beta', ['beta running']],
          ],
        },
      ];
    for (const { label, selected, expected } of cases) {
      expect({
        label,
        value: summarize(filterConsoleStoryEntriesByStatusSelection(
          stories,
          selected,
        )),
      }).toEqual({ label, value: expected });
    }
  });
});
