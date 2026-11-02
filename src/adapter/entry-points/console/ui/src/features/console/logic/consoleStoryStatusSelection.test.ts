import {
  CONSOLE_STORY_STATUS_SELECTION_KEY,
  filterConsoleStoryEntriesByStatusSelection,
  formatConsoleStoryStatusSelectionIntoSearch,
  parseConsoleStoryStatusSelectionFromSearch,
  readConsoleStoryStatusSelection,
  resolveEffectiveConsoleStoryStatusSelection,
  writeConsoleStoryStatusSelection,
} from './consoleStoryStatusSelection';
import type { ConsoleStoryEntry } from './types';

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
    const cases: { label: string; raw: string | null; expected: string[] }[] = [
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
    const cases: { label: string; selected: string[]; expected: unknown }[] = [
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
        value: summarize(
          filterConsoleStoryEntriesByStatusSelection(stories, selected),
        ),
      }).toEqual({ label, value: expected });
    }
  });

  it('parses every status query parameter into status names, keeping order and skipping empty or repeated values', () => {
    const cases: { label: string; search: string; expected: string[] }[] = [
      { label: 'empty query', search: '', expected: [] },
      { label: 'no status parameter', search: '?k=token', expected: [] },
      { label: 'one status', search: '?status=Done', expected: ['Done'] },
      {
        label: 'repeated status parameters keep their order',
        search: '?k=token&status=Done&status=Unread',
        expected: ['Done', 'Unread'],
      },
      {
        label: 'a repeated name is kept once',
        search: '?status=Done&status=Done',
        expected: ['Done'],
      },
      { label: 'an empty value is ignored', search: '?status=', expected: [] },
      {
        label: 'a plus-encoded name with spaces is decoded',
        search: '?status=In+Tmux+by+agent',
        expected: ['In Tmux by agent'],
      },
      {
        label: 'a percent-encoded name with spaces is decoded',
        search: '?status=In%20Tmux%20by%20agent',
        expected: ['In Tmux by agent'],
      },
    ];
    for (const { label, search, expected } of cases) {
      expect({
        label,
        value: parseConsoleStoryStatusSelectionFromSearch(search),
      }).toEqual({ label, value: expected });
    }
  });

  it('formats the selection into the query, replacing previous status parameters and keeping other parameters in their order', () => {
    const cases: {
      label: string;
      search: string;
      statuses: string[];
      expected: string;
    }[] = [
      {
        label: 'empty selection and empty query stay empty',
        search: '',
        statuses: [],
        expected: '',
      },
      {
        label: 'selection is appended after other parameters',
        search: '?k=token',
        statuses: ['Done'],
        expected: '?k=token&status=Done',
      },
      {
        label: 'previous status parameters are replaced',
        search: '?status=Unread&k=token',
        statuses: ['Done'],
        expected: '?k=token&status=Done',
      },
      {
        label: 'an empty selection removes only the status parameters',
        search: '?k=token&status=Done&status=Unread',
        statuses: [],
        expected: '?k=token',
      },
      {
        label: 'selection order is preserved',
        search: '?k=token',
        statuses: ['Unread', 'Done'],
        expected: '?k=token&status=Unread&status=Done',
      },
      {
        label: 'a repeated name is written once',
        search: '',
        statuses: ['Done', 'Done'],
        expected: '?status=Done',
      },
      {
        label: 'a name with spaces is encoded',
        search: '',
        statuses: ['In Tmux by agent'],
        expected: '?status=In+Tmux+by+agent',
      },
    ];
    for (const { label, search, statuses, expected } of cases) {
      expect({
        label,
        value: formatConsoleStoryStatusSelectionIntoSearch(search, statuses),
      }).toEqual({ label, value: expected });
    }
  });

  it('parses back exactly the selection that was formatted into the query', () => {
    const selections: string[][] = [
      [],
      ['Done'],
      ['Unread', 'In Tmux by agent'],
    ];
    for (const statuses of selections) {
      const search = formatConsoleStoryStatusSelectionIntoSearch(
        '?k=token',
        statuses,
      );
      expect({
        statuses,
        value: parseConsoleStoryStatusSelectionFromSearch(search),
      }).toEqual({ statuses, value: statuses });
    }
  });
});
