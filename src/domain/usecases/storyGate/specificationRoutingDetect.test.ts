import { approvedSpecificationUrlsExtract } from './specificationRoutingDetect';

describe('specificationRoutingDetect', () => {
  it.each([
    {
      name: 'one named specification',
      body: 'Note\n承認済み仕様: https://github.com/owner/repo/issues/5\nEnd',
      expected: ['https://github.com/owner/repo/issues/5'],
    },
    {
      name: 'two named specifications',
      body: '承認済み仕様: https://github.com/owner/repo/issues/5\n承認済み仕様: https://github.com/owner/repo/issues/6',
      expected: [
        'https://github.com/owner/repo/issues/5',
        'https://github.com/owner/repo/issues/6',
      ],
    },
    { name: 'the absent line', body: '承認済み仕様: なし', expected: [] },
    {
      name: 'a URL without the line prefix',
      body: 'See https://github.com/owner/repo/issues/5',
      expected: [],
    },
  ])('approvedSpecificationUrlsExtract reads $name', ({ body, expected }) => {
    expect(approvedSpecificationUrlsExtract(body)).toEqual(expected);
  });
});
