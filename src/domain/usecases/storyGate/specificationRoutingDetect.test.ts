import {
  approvedSpecificationUrlsExtract,
  isSpecificationRoutingAlreadyPosted,
} from './specificationRoutingDetect';

const routingComment = (line: string, nextStepAgent: string): string =>
  [
    'From: :robot: developer-agent (model)',
    '',
    line,
    '',
    '```json',
    JSON.stringify({ nextStepAgent }),
    '```',
  ].join('\n');

describe('specificationRoutingDetect', () => {
  it.each([
    {
      name: 'the absent line and a routing block naming the specification agent',
      body: routingComment('承認済み仕様: なし', 'spec-agent'),
      expected: true,
    },
    {
      name: 'a routing block naming another agent',
      body: routingComment('承認済み仕様: なし', 'other-agent'),
      expected: false,
    },
    {
      name: 'no absent line',
      body: routingComment('Specification is pending', 'spec-agent'),
      expected: false,
    },
    {
      name: 'an approved specification URL instead of the absent line',
      body: routingComment(
        '承認済み仕様: https://github.com/owner/repo/issues/5',
        'spec-agent',
      ),
      expected: false,
    },
    {
      name: 'the absent line without a fenced block',
      body: '承認済み仕様: なし\nnextStepAgent spec-agent',
      expected: false,
    },
  ])(
    'isSpecificationRoutingAlreadyPosted is $expected for $name',
    ({ body, expected }) => {
      expect(isSpecificationRoutingAlreadyPosted(body, 'spec-agent')).toBe(
        expected,
      );
    },
  );

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
