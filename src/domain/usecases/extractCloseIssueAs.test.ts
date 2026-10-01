import {
  CloseIssueAsRequest,
  extractCloseIssueAs,
} from './extractCloseIssueAs';

type ReportBodyFormat = {
  name: string;
  render: (jsonBlocks: string[]) => string;
};

const reportBodyFormats: ReportBodyFormat[] = [
  {
    name: 'plain fences with LF line endings',
    render: (jsonBlocks) =>
      [
        'From: :robot: chore (model)',
        '',
        'The deliverable is finished and verified.',
        ...jsonBlocks.flatMap((block) => ['', '```json', block, '```']),
        '',
      ].join('\n'),
  },
  {
    name: 'backslash-escaped fences',
    render: (jsonBlocks) =>
      [
        'From: :robot: chore (model)',
        '',
        'The deliverable is finished and verified.',
        ...jsonBlocks.flatMap((block) => [
          '',
          '\\`\\`\\`json',
          block,
          '\\`\\`\\`',
        ]),
        '',
      ].join('\n'),
  },
  {
    name: 'CRLF line endings',
    render: (jsonBlocks) =>
      [
        'From: :robot: chore (model)',
        '',
        'The deliverable is finished and verified.',
        ...jsonBlocks.flatMap((block) => ['', '```json', block, '```']),
        '',
      ].join('\r\n'),
  },
];

type CloseIssueAsBodyCase = {
  description: string;
  jsonBlocks: string[];
  expected: CloseIssueAsRequest;
};

const closeIssueAsBodyCases: CloseIssueAsBodyCase[] = [
  {
    description: 'a last json block requesting "completed"',
    jsonBlocks: ['{"closeIssueAs": "completed"}'],
    expected: { kind: 'requested', stateReason: 'completed' },
  },
  {
    description: 'a last json block requesting "not_planned"',
    jsonBlocks: ['{"closeIssueAs": "not_planned"}'],
    expected: { kind: 'requested', stateReason: 'not_planned' },
  },
  {
    description: 'a last json block without the closeIssueAs field',
    jsonBlocks: ['{"nextStep": null}'],
    expected: { kind: 'notRequested' },
  },
  {
    description: 'a last json block with closeIssueAs null',
    jsonBlocks: ['{"closeIssueAs": null}'],
    expected: { kind: 'notRequested' },
  },
  {
    description:
      'an earlier json block with closeIssueAs and a last json block without it',
    jsonBlocks: ['{"closeIssueAs": "completed"}', '{"nextStep": null}'],
    expected: { kind: 'notRequested' },
  },
  {
    description: 'a body without any json block',
    jsonBlocks: [],
    expected: { kind: 'notRequested' },
  },
  {
    description: 'a last json block with closeIssueAs "not planned"',
    jsonBlocks: ['{"closeIssueAs": "not planned"}'],
    expected: { kind: 'invalidValue', receivedValueJson: '"not planned"' },
  },
  {
    description: 'a last json block with closeIssueAs 1',
    jsonBlocks: ['{"closeIssueAs": 1}'],
    expected: { kind: 'invalidValue', receivedValueJson: '1' },
  },
  {
    description: 'a last json block with closeIssueAs as an empty string',
    jsonBlocks: ['{"closeIssueAs": ""}'],
    expected: { kind: 'invalidValue', receivedValueJson: '""' },
  },
  {
    description: 'a last json block with closeIssueAs false',
    jsonBlocks: ['{"closeIssueAs": false}'],
    expected: { kind: 'invalidValue', receivedValueJson: 'false' },
  },
  {
    description: 'a last json block with closeIssueAs as an array',
    jsonBlocks: ['{"closeIssueAs": ["completed"]}'],
    expected: { kind: 'invalidValue', receivedValueJson: '["completed"]' },
  },
];

const closeIssueAsExtractionCases = closeIssueAsBodyCases.flatMap((bodyCase) =>
  reportBodyFormats.map((format) => ({
    description: `${bodyCase.description} written with ${format.name}`,
    body: format.render(bodyCase.jsonBlocks),
    expected: bodyCase.expected,
  })),
);

describe('extractCloseIssueAs', () => {
  it.each(closeIssueAsExtractionCases)(
    'returns the close request for $description (closeIssueAs criterion 16)',
    ({ body, expected }) => {
      expect(extractCloseIssueAs(body)).toEqual(expected);
    },
  );
});
