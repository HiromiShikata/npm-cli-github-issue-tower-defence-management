import {
  CONSOLE_STORY_ROW_FIELDS,
  type ConsoleStoryRowField,
  DEFAULT_SHOWN_CONSOLE_STORY_ROW_FIELDS,
  formatShownConsoleStoryRowFieldsIntoSearch,
  hiddenConsoleStoryRowFields,
  parseShownConsoleStoryRowFieldsFromSearch,
  toggleConsoleStoryRowField,
} from './consoleStoryRowFields';

const ALL_SHOWN: ConsoleStoryRowField[] = [
  'story',
  'status',
  'dependedIssueUrl',
  'nextActionDate',
  'nextActionHour',
  'agent',
];

const ALL_SUBSETS_OF_DISPLAY_ITEMS: ConsoleStoryRowField[][] = Array.from(
  { length: 2 ** CONSOLE_STORY_ROW_FIELDS.length },
  (_, mask) =>
    CONSOLE_STORY_ROW_FIELDS.filter((_field, index) => (mask >> index) & 1),
);

describe('CONSOLE_STORY_ROW_FIELDS and the default', () => {
  it('lists the display items in the checkbox order', () => {
    expect([...CONSOLE_STORY_ROW_FIELDS]).toEqual([
      'story',
      'status',
      'dependedIssueUrl',
      'nextActionDate',
      'nextActionHour',
      'agent',
    ]);
  });

  it('shows only Story and Status by default', () => {
    expect([...DEFAULT_SHOWN_CONSOLE_STORY_ROW_FIELDS]).toEqual([
      'story',
      'status',
    ]);
  });
});

describe('parseShownConsoleStoryRowFieldsFromSearch', () => {
  it.each([
    {
      name: 'empty search shows the default',
      search: '',
      expected: ['story', 'status'],
    },
    {
      name: 'unrelated parameters show the default',
      search: '?status=Done&tab=stories',
      expected: ['story', 'status'],
    },
    {
      name: 'reads every shown field named in the URL in display order',
      search: '?shownStoryField=agent&shownStoryField=story',
      expected: ['story', 'agent'],
    },
    {
      name: 'an empty shownStoryField value shows nothing',
      search: '?shownStoryField=',
      expected: [],
    },
    {
      name: 'ignores unknown field names',
      search: '?shownStoryField=unknown&shownStoryField=status',
      expected: ['status'],
    },
    {
      name: 'a legacy hiddenStoryField URL falls back to the default',
      search: '?hiddenStoryField=agent&hiddenStoryField=status',
      expected: ['story', 'status'],
    },
    {
      name: 'a legacy hiddenStoryField is ignored when shownStoryField is present',
      search: '?hiddenStoryField=agent&shownStoryField=agent',
      expected: ['agent'],
    },
  ])('$name', ({ search, expected }) => {
    expect([...parseShownConsoleStoryRowFieldsFromSearch(search)]).toEqual(
      expected,
    );
  });
});

describe('formatShownConsoleStoryRowFieldsIntoSearch', () => {
  it.each([
    {
      name: 'the default set writes no parameter',
      search: '',
      shown: ['story', 'status'] as const,
      expected: '',
    },
    {
      name: 'the default set in another order still writes no parameter',
      search: '',
      shown: ['status', 'story'] as const,
      expected: '',
    },
    {
      name: 'an empty shown set writes a single empty parameter',
      search: '',
      shown: [] as const,
      expected: '?shownStoryField=',
    },
    {
      name: 'all six shown are written in display order',
      search: '',
      shown: ALL_SHOWN,
      expected:
        '?shownStoryField=story&shownStoryField=status&shownStoryField=dependedIssueUrl&shownStoryField=nextActionDate&shownStoryField=nextActionHour&shownStoryField=agent',
    },
    {
      name: 'a non-default set is written in display order',
      search: '',
      shown: ['agent'] as const,
      expected: '?shownStoryField=agent',
    },
    {
      name: 'keeps unrelated parameters and appends the shown fields',
      search: '?k=token',
      shown: ['agent'] as const,
      expected: '?k=token&shownStoryField=agent',
    },
    {
      name: 'replaces previously written shown fields',
      search: '?shownStoryField=status&tab=stories',
      shown: ['story'] as const,
      expected: '?tab=stories&shownStoryField=story',
    },
    {
      name: 'removes a legacy hiddenStoryField and keeps the rest',
      search: '?hiddenStoryField=agent&tab=stories',
      shown: ['story', 'status'] as const,
      expected: '?tab=stories',
    },
  ])('$name', ({ search, shown, expected }) => {
    expect(formatShownConsoleStoryRowFieldsIntoSearch(search, [...shown])).toBe(
      expected,
    );
  });

  it.each(
    ALL_SUBSETS_OF_DISPLAY_ITEMS.map((shown) => ({
      name: `round-trips the shown set [${shown.join(', ') || 'none'}]`,
      shown,
    })),
  )('$name through the URL and back', ({ shown }) => {
    const search = formatShownConsoleStoryRowFieldsIntoSearch(
      '?k=token',
      shown,
    );
    expect([...parseShownConsoleStoryRowFieldsFromSearch(search)]).toEqual(
      shown,
    );
    expect(new URLSearchParams(search).get('k')).toBe('token');
  });
});

describe('hiddenConsoleStoryRowFields', () => {
  it.each([
    {
      name: 'nothing is hidden when every field is shown',
      shown: ALL_SHOWN,
      expected: [],
    },
    {
      name: 'every field is hidden when none is shown, in display order',
      shown: [],
      expected: ALL_SHOWN,
    },
    {
      name: 'the default shows Story and Status and hides the other four',
      shown: ['story', 'status'] as const,
      expected: [
        'dependedIssueUrl',
        'nextActionDate',
        'nextActionHour',
        'agent',
      ],
    },
    {
      name: 'hides the unshown fields in display order regardless of shown order',
      shown: ['agent', 'story'] as const,
      expected: [
        'status',
        'dependedIssueUrl',
        'nextActionDate',
        'nextActionHour',
      ],
    },
  ])('$name', ({ shown, expected }) => {
    expect([...hiddenConsoleStoryRowFields([...shown])]).toEqual(expected);
  });
});

describe('toggleConsoleStoryRowField', () => {
  it.each([
    {
      name: 'hides a shown field',
      hidden: [],
      field: 'agent' as const,
      expected: ['agent'],
    },
    {
      name: 'shows a hidden field',
      hidden: ['agent', 'status'] as const,
      field: 'agent' as const,
      expected: ['status'],
    },
  ])('$name', ({ hidden, field, expected }) => {
    expect(toggleConsoleStoryRowField([...hidden], field)).toEqual(expected);
  });
});
