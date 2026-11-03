import {
  formatHiddenConsoleStoryRowFieldsIntoSearch,
  parseHiddenConsoleStoryRowFieldsFromSearch,
  toggleConsoleStoryRowField,
} from './consoleStoryRowFields';

describe('parseHiddenConsoleStoryRowFieldsFromSearch', () => {
  it.each([
    { name: 'empty search hides nothing', search: '', expected: [] },
    {
      name: 'reads every hidden field named in the URL',
      search: '?hiddenStoryField=agent&hiddenStoryField=status',
      expected: ['agent', 'status'],
    },
    {
      name: 'returns fields in display order regardless of URL order',
      search: '?hiddenStoryField=status&hiddenStoryField=trigger',
      expected: ['trigger', 'status'],
    },
    {
      name: 'ignores unknown field names',
      search: '?hiddenStoryField=unknown&hiddenStoryField=story',
      expected: ['story'],
    },
    {
      name: 'ignores unrelated query parameters',
      search: '?status=Done&tab=stories',
      expected: [],
    },
  ])('$name', ({ search, expected }) => {
    expect(parseHiddenConsoleStoryRowFieldsFromSearch(search)).toEqual(expected);
  });
});

describe('formatHiddenConsoleStoryRowFieldsIntoSearch', () => {
  it.each([
    {
      name: 'empty selection removes the parameter and leaves no query',
      search: '?hiddenStoryField=agent',
      hidden: [],
      expected: '',
    },
    {
      name: 'writes hidden fields in display order',
      search: '',
      hidden: ['status', 'trigger'] as const,
      expected: '?hiddenStoryField=trigger&hiddenStoryField=status',
    },
    {
      name: 'keeps unrelated parameters such as the status filter',
      search: '?status=Done',
      hidden: ['story'] as const,
      expected: '?status=Done&hiddenStoryField=story',
    },
    {
      name: 'replaces previously written hidden fields',
      search: '?hiddenStoryField=agent&tab=stories',
      hidden: ['story'] as const,
      expected: '?tab=stories&hiddenStoryField=story',
    },
  ])('$name', ({ search, hidden, expected }) => {
    expect(
      formatHiddenConsoleStoryRowFieldsIntoSearch(search, [...hidden]),
    ).toBe(expected);
  });

  it('round-trips through the parser', () => {
    const hidden = ['agent', 'status'] as const;
    const search = formatHiddenConsoleStoryRowFieldsIntoSearch('', [...hidden]);
    expect(parseHiddenConsoleStoryRowFieldsFromSearch(search)).toEqual([
      ...hidden,
    ]);
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
