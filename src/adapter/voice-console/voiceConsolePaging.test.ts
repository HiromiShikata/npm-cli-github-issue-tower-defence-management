import { PAGE_CHARACTER_LIMIT, paginateText } from './voiceConsolePaging';

const japaneseUnit = 'あいうえお';

const repeatToLength = (length: number): string =>
  japaneseUnit.repeat(Math.ceil(length / japaneseUnit.length)).slice(0, length);

describe('paginateText', () => {
  it('uses 3000 characters as the page limit', () => {
    expect(PAGE_CHARACTER_LIMIT).toBe(3000);
  });

  it('returns the requested page with its page count for each input and page combination', () => {
    const cases = [
      {
        name: 'empty text defaults to page 1 with empty text',
        text: '',
        page: undefined,
        expected: { ok: true, page: 1, pageCount: 1, text: '' },
      },
      {
        name: 'short text without a page means page 1',
        text: 'abc',
        page: undefined,
        expected: { ok: true, page: 1, pageCount: 1, text: 'abc' },
      },
      {
        name: 'text of exactly 3000 characters is a single page',
        text: repeatToLength(3000),
        page: 1,
        expected: {
          ok: true,
          page: 1,
          pageCount: 1,
          text: repeatToLength(3000),
        },
      },
      {
        name: 'text of 3001 characters puts one character on page 2',
        text: repeatToLength(3001),
        page: 2,
        expected: {
          ok: true,
          page: 2,
          pageCount: 2,
          text: repeatToLength(3001).slice(3000),
        },
      },
      {
        name: 'page 1 of 3001 characters holds the first 3000 characters',
        text: repeatToLength(3001),
        page: 1,
        expected: {
          ok: true,
          page: 1,
          pageCount: 2,
          text: repeatToLength(3001).slice(0, 3000),
        },
      },
      {
        name: 'page 0 is out of range',
        text: 'abc',
        page: 0,
        expected: { ok: false, error: 'page_out_of_range', pageCount: 1 },
      },
      {
        name: 'page beyond the page count is out of range',
        text: 'abc',
        page: 2,
        expected: { ok: false, error: 'page_out_of_range', pageCount: 1 },
      },
      {
        name: 'a negative page is out of range',
        text: repeatToLength(3001),
        page: -1,
        expected: { ok: false, error: 'page_out_of_range', pageCount: 2 },
      },
      {
        name: 'a non-integer page is out of range',
        text: repeatToLength(3001),
        page: 1.5,
        expected: { ok: false, error: 'page_out_of_range', pageCount: 2 },
      },
    ];

    for (const testCase of cases) {
      expect({
        name: testCase.name,
        result: paginateText(testCase.text, testCase.page),
      }).toEqual({ name: testCase.name, result: testCase.expected });
    }
  });

  it('reproduces the original text when all pages are concatenated', () => {
    const cases = [
      { length: 0, expectedPageCount: 1 },
      { length: 1, expectedPageCount: 1 },
      { length: 2999, expectedPageCount: 1 },
      { length: 3000, expectedPageCount: 1 },
      { length: 3001, expectedPageCount: 2 },
      { length: 6000, expectedPageCount: 2 },
      { length: 6001, expectedPageCount: 3 },
      { length: 9001, expectedPageCount: 4 },
    ];

    for (const testCase of cases) {
      const text = repeatToLength(testCase.length);
      const first = paginateText(text, undefined);
      if (!first.ok) {
        throw new Error('page 1 must always exist');
      }
      expect(first.pageCount).toBe(testCase.expectedPageCount);

      const pages: string[] = [];
      for (let page = 1; page <= first.pageCount; page += 1) {
        const result = paginateText(text, page);
        if (!result.ok) {
          throw new Error(`page ${page} must exist`);
        }
        pages.push(result.text);
      }
      expect(pages.join('')).toBe(text);
    }
  });
});
