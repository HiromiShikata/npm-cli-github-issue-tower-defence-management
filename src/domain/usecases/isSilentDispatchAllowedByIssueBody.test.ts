import {
  isSilentDispatchAllowedByIssueBody,
  TDPM_SILENT_DISPATCH_ALLOWED_MARKER,
} from './isSilentDispatchAllowedByIssueBody';

describe('isSilentDispatchAllowedByIssueBody', () => {
  it.each([
    {
      name: 'returns true when the marker is present anywhere in the body',
      body: 'Some instructions.\n\n<!-- TDPM_SILENT_DISPATCH_ALLOWED -->\n\nMore text.',
      expected: true,
    },
    {
      name: 'returns true when the body is exactly the marker',
      body: TDPM_SILENT_DISPATCH_ALLOWED_MARKER,
      expected: true,
    },
    {
      name: 'returns false when the marker is absent from an otherwise normal body',
      body: 'This is a normal issue body describing a task with no marker.',
      expected: false,
    },
    {
      name: 'returns false for an empty string',
      body: '',
      expected: false,
    },
    {
      name: 'returns false for the bare token without the HTML-comment wrapper',
      body: 'TDPM_SILENT_DISPATCH_ALLOWED',
      expected: false,
    },
    {
      name: 'returns false for null',
      body: null,
      expected: false,
    },
    {
      name: 'returns false for undefined',
      body: undefined,
      expected: false,
    },
  ])('$name', ({ body, expected }) => {
    expect(isSilentDispatchAllowedByIssueBody(body)).toBe(expected);
  });
});
