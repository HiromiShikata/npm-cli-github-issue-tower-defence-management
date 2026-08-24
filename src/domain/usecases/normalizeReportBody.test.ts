import { normalizeReportBody } from './normalizeReportBody';

describe('normalizeReportBody', () => {
  it('unescapes backslash escaped code fence backticks', () => {
    expect(normalizeReportBody('\\`\\`\\`json\n{}\n\\`\\`\\`')).toBe(
      '```json\n{}\n```',
    );
  });

  it('rewrites CRLF line endings to LF so fence matching is line ending agnostic', () => {
    expect(normalizeReportBody('```json\r\n{}\r\n```')).toBe(
      '```json\n{}\n```',
    );
  });

  it('leaves a body that uses LF and unescaped fences unchanged', () => {
    const body = 'From: :robot: agent (model)\n\n```json\n{}\n```\n';
    expect(normalizeReportBody(body)).toBe(body);
  });

  it('leaves a lone carriage return that is not part of a line ending in place', () => {
    expect(normalizeReportBody('a\rb')).toBe('a\rb');
  });
});
