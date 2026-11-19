import {
  CONSOLE_STORY_STATUS_SELECTION_FORMAT_KEY,
  CONSOLE_STORY_STATUS_SELECTION_KEY,
  defaultConsoleStoryStatusSelection,
  displayedConsoleStoryStatusSelection,
  filterConsoleStoryEntriesByStatusSelection,
  formatConsoleStoryStatusSelectionIntoSearch,
  isConsoleStoryDoneShown,
  isCurrentConsoleStoryStatusSelectionFormat,
  migrateLegacyConsoleStoryStatusSelection,
  normalizeConsoleStoryStatusSelection,
  parseConsoleStoryStatusSelectionFromSearch,
  readConsoleStoryStatusSelection,
  removeConsoleStoryStatusSelectionFromSearch,
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
    const cases: {
      label: string;
      raw: string | null;
      expected: string[] | null;
    }[] = [
      { label: 'nothing saved (never set)', raw: null, expected: null },
      {
        label: 'valid array',
        raw: '["Done","Unread"]',
        expected: ['Done', 'Unread'],
      },
      { label: 'empty array (explicitly empty)', raw: '[]', expected: [] },
      { label: 'broken JSON', raw: '["Done"', expected: null },
      { label: 'non-array JSON', raw: '{"status":"Done"}', expected: null },
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
      selected: string[] | null;
      optionNames: string[];
      expected: string[];
    }[] = [
      {
        label: 'never set (null) applies no filter',
        selected: null,
        optionNames: ['Unread', 'Done'],
        expected: [],
      },
      {
        label: 'explicitly empty applies no filter',
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

  it.each([
    {
      label: 'selected status',
      selected: ['Unread'],
      expected: ['alpha unread'],
    },
    { label: 'unselected status', selected: ['Preparation'], expected: [] },
  ])(
    'keeps the current status filtering behavior for a $label',
    ({ selected, expected }) => {
      expect(
        filterConsoleStoryEntriesByStatusSelection(stories, selected)
          .flatMap((entry) => entry.items)
          .map((item) => item.title),
      ).toEqual(expected);
    },
  );

  it.each([
    {
      label: 'closed item selected as Done',
      item: { isClosed: true, status: 'In Tmux by human' },
      selected: ['Done'],
      expected: true,
    },
    {
      label: 'closed item selected by its stale status',
      item: { isClosed: true, status: 'In Tmux by human' },
      selected: ['In Tmux by human'],
      expected: false,
    },
    {
      label: 'open item with Done status selected as Done',
      item: { isClosed: false, status: 'Done' },
      selected: ['Done'],
      expected: true,
    },
  ])(
    'uses Done as the status key for a $label',
    ({ item, selected, expected }) => {
      const story = makeStory('Closed-state story', [
        { ...makeItem('closed-state task', item.status), ...item } as StoryItem,
      ]);
      expect(
        filterConsoleStoryEntriesByStatusSelection([story], selected),
      ).toHaveLength(expected ? 1 : 0);
    },
  );

  it('parses every status query parameter into status names, keeping order and skipping empty or repeated values', () => {
    const cases: {
      label: string;
      search: string;
      expected: string[] | null;
    }[] = [
      { label: 'empty query has no status key', search: '', expected: null },
      {
        label: 'no status parameter has no status key',
        search: '?k=token',
        expected: null,
      },
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
      {
        label: 'an empty value is an explicitly empty selection',
        search: '?status=',
        expected: [],
      },
      {
        label: 'an empty value next to a name keeps the name',
        search: '?status=&status=Done',
        expected: ['Done'],
      },
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
        label: 'empty selection and empty query write an explicit empty marker',
        search: '',
        statuses: [],
        expected: '?status=',
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
        label:
          'an empty selection replaces the status parameters with the explicit empty marker',
        search: '?k=token&status=Done&status=Unread',
        statuses: [],
        expected: '?k=token&status=',
      },
      {
        label:
          'an empty selection replaces a previous explicit empty marker and keeps other parameters',
        search: '?status=&k=token',
        statuses: [],
        expected: '?k=token&status=',
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

  describe('migrateLegacyConsoleStoryStatusSelection', () => {
    it.each([
      {
        label: 'nothing saved becomes the current format with no selection',
        raw: null,
        format: null,
        expectedRaw: null,
        expectedFormat: '2',
        expectedRead: null,
      },
      {
        label:
          'a legacy empty array (written by Clear before this format) is removed, so it reads as never set',
        raw: '[]',
        format: null,
        expectedRaw: null,
        expectedFormat: '2',
        expectedRead: null,
      },
      {
        label: 'a legacy non-empty selection keeps its meaning',
        raw: '["Done"]',
        format: null,
        expectedRaw: '["Done"]',
        expectedFormat: '2',
        expectedRead: ['Done'],
      },
      {
        label: 'a legacy corrupted value is left as is and reads as never set',
        raw: 'not json [',
        format: null,
        expectedRaw: 'not json [',
        expectedFormat: '2',
        expectedRead: null,
      },
      {
        label:
          'an explicit empty array saved in the current format is kept as explicitly empty',
        raw: '[]',
        format: '2',
        expectedRaw: '[]',
        expectedFormat: '2',
        expectedRead: [],
      },
      {
        label: 'a non-empty selection saved in the current format is kept',
        raw: '["Unread"]',
        format: '2',
        expectedRaw: '["Unread"]',
        expectedFormat: '2',
        expectedRead: ['Unread'],
      },
    ])(
      '$label',
      ({ raw, format, expectedRaw, expectedFormat, expectedRead }) => {
        localStorage.clear();
        if (raw !== null) {
          localStorage.setItem(CONSOLE_STORY_STATUS_SELECTION_KEY, raw);
        }
        if (format !== null) {
          localStorage.setItem(
            CONSOLE_STORY_STATUS_SELECTION_FORMAT_KEY,
            format,
          );
        }
        migrateLegacyConsoleStoryStatusSelection();
        expect({
          raw: localStorage.getItem(CONSOLE_STORY_STATUS_SELECTION_KEY),
          format: localStorage.getItem(
            CONSOLE_STORY_STATUS_SELECTION_FORMAT_KEY,
          ),
          read: readConsoleStoryStatusSelection(),
        }).toEqual({
          raw: expectedRaw,
          format: expectedFormat,
          read: expectedRead,
        });
      },
    );

    it('keeps an explicit empty selection explicit across repeated migrations', () => {
      localStorage.clear();
      migrateLegacyConsoleStoryStatusSelection();
      writeConsoleStoryStatusSelection([]);
      migrateLegacyConsoleStoryStatusSelection();
      expect(readConsoleStoryStatusSelection()).toEqual([]);
    });
  });

  describe('normalizeConsoleStoryStatusSelection', () => {
    it.each([
      {
        label: 'never set stays never set',
        selected: null,
        optionNames: ['Unread', 'Done'],
        expected: null,
      },
      {
        label: 'explicitly empty stays explicitly empty',
        selected: [],
        optionNames: ['Unread', 'Done'],
        expected: [],
      },
      {
        label: 'a selection with an existing option is kept as stored',
        selected: ['Done'],
        optionNames: ['Unread', 'Done'],
        expected: ['Done'],
      },
      {
        label: 'a selection of only removed options becomes never set',
        selected: ['Icebox'],
        optionNames: ['Unread', 'Done'],
        expected: null,
      },
      {
        label: 'a mixed selection keeps the stored list',
        selected: ['Done', 'Icebox'],
        optionNames: ['Unread', 'Done'],
        expected: ['Done', 'Icebox'],
      },
      {
        label: 'while the options have not loaded, a selection is kept',
        selected: ['Icebox'],
        optionNames: [],
        expected: ['Icebox'],
      },
    ])('$label', ({ selected, optionNames, expected }) => {
      expect(
        normalizeConsoleStoryStatusSelection(selected, optionNames),
      ).toEqual(expected);
    });
  });

  describe('isCurrentConsoleStoryStatusSelectionFormat', () => {
    it.each([
      {
        label: 'no format saved is a legacy format',
        format: null,
        expected: false,
      },
      {
        label: 'an older format value is a legacy format',
        format: '1',
        expected: false,
      },
      {
        label: 'the current format value is current',
        format: '2',
        expected: true,
      },
    ])('$label', ({ format, expected }) => {
      localStorage.clear();
      if (format !== null) {
        localStorage.setItem(CONSOLE_STORY_STATUS_SELECTION_FORMAT_KEY, format);
      }
      expect(isCurrentConsoleStoryStatusSelectionFormat()).toBe(expected);
    });
  });

  describe('removeConsoleStoryStatusSelectionFromSearch', () => {
    it.each([
      { label: 'an empty query stays empty', search: '', expected: '' },
      {
        label:
          'an empty status marker is removed and other parameters are kept',
        search: '?k=token&status=',
        expected: '?k=token',
      },
      {
        label: 'a query holding only status parameters becomes empty',
        search: '?status=Done&status=',
        expected: '',
      },
      {
        label:
          'a status name is removed and other parameters are kept in order',
        search: '?k=token&status=Done&x=1',
        expected: '?k=token&x=1',
      },
    ])('$label', ({ search, expected }) => {
      expect(removeConsoleStoryStatusSelectionFromSearch(search)).toBe(
        expected,
      );
    });
  });

  describe('defaultConsoleStoryStatusSelection', () => {
    it.each([
      {
        label: 'excludes Done and keeps the other options in order',
        optionNames: ['Unread', 'Done', 'Preparation'],
        expected: ['Unread', 'Preparation'],
      },
      {
        label: 'excludes Done wherever it appears',
        optionNames: ['Done', 'Unread'],
        expected: ['Unread'],
      },
      {
        label: 'returns an option list without Done unchanged',
        optionNames: ['Awaiting Owner', 'Icebox'],
        expected: ['Awaiting Owner', 'Icebox'],
      },
      {
        label: 'yields nothing when Done is the only option',
        optionNames: ['Done'],
        expected: [],
      },
      {
        label: 'yields nothing while the options have not loaded yet',
        optionNames: [],
        expected: [],
      },
    ])('$label', ({ optionNames, expected }) => {
      expect(defaultConsoleStoryStatusSelection(optionNames)).toEqual(expected);
    });
  });

  describe('displayedConsoleStoryStatusSelection', () => {
    it.each([
      {
        label: 'never set shows the default, with Done unchecked',
        selected: null,
        optionNames: ['Unread', 'Done'],
        expected: ['Unread'],
      },
      {
        label: 'never set while options are still loading shows nothing',
        selected: null,
        optionNames: [],
        expected: [],
      },
      {
        label: 'explicitly empty shows nothing checked',
        selected: [],
        optionNames: ['Unread', 'Done'],
        expected: [],
      },
      {
        label: 'an explicit set is shown as stored, including Done',
        selected: ['Done'],
        optionNames: ['Unread', 'Done'],
        expected: ['Done'],
      },
      {
        label: 'an explicit set is not replaced by the default',
        selected: ['Preparation'],
        optionNames: ['Unread', 'Preparation', 'Done'],
        expected: ['Preparation'],
      },
    ])('$label', ({ selected, optionNames, expected }) => {
      expect(
        displayedConsoleStoryStatusSelection(selected, optionNames),
      ).toEqual(expected);
    });
  });

  describe('never set, explicitly empty and explicitly set stay distinct', () => {
    it.each([
      {
        label: 'never set',
        selected: null,
        displayed: ['Unread'],
        effective: [],
        doneShown: false,
      },
      {
        label: 'explicitly empty',
        selected: [],
        displayed: [],
        effective: [],
        doneShown: true,
      },
      {
        label: 'explicitly set to the non-Done options',
        selected: ['Unread'],
        displayed: ['Unread'],
        effective: ['Unread'],
        doneShown: false,
      },
      {
        label: 'explicitly set including Done',
        selected: ['Unread', 'Done'],
        displayed: ['Unread', 'Done'],
        effective: ['Unread', 'Done'],
        doneShown: true,
      },
    ])(
      '$label: displayed, effective and Done visibility follow the selection',
      ({ selected, displayed, effective, doneShown }) => {
        const optionNames = ['Unread', 'Done'];
        expect({
          displayed: displayedConsoleStoryStatusSelection(
            selected,
            optionNames,
          ),
          effective: resolveEffectiveConsoleStoryStatusSelection(
            selected,
            optionNames,
          ),
          doneShown: isConsoleStoryDoneShown(selected),
        }).toEqual({ displayed, effective, doneShown });
      },
    );
  });

  describe('isConsoleStoryDoneShown', () => {
    it.each([
      { label: 'never set hides Done', selected: null, expected: false },
      {
        label: 'explicitly empty shows Done',
        selected: [],
        expected: true,
      },
      {
        label: 'a selection with Done shows Done',
        selected: ['Done'],
        expected: true,
      },
      {
        label: 'a selection without Done hides Done',
        selected: ['Unread'],
        expected: false,
      },
    ])('$label', ({ selected, expected }) => {
      expect(isConsoleStoryDoneShown(selected)).toBe(expected);
    });
  });
});
