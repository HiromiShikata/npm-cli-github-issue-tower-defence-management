import { hasReportJsonBlock } from './hasReportJsonBlock';

describe('hasReportJsonBlock', () => {
  it('finds a report json block', () => {
    expect(
      hasReportJsonBlock(
        'From: :robot: agent (model)\n```json\n{"nextStep": null}\n```',
      ),
    ).toBe(true);
  });

  it('finds a report json block whose fence is backslash escaped', () => {
    expect(
      hasReportJsonBlock(
        'From: :robot: agent (model)\n\\`\\`\\`json\n{"nextStep": null}\n\\`\\`\\`',
      ),
    ).toBe(true);
  });

  it('finds a report json block written with CRLF line endings', () => {
    expect(
      hasReportJsonBlock(
        'From: :robot: agent (model)\r\n```json\r\n{"nextStep": null}\r\n```',
      ),
    ).toBe(true);
  });

  it('finds a report json block that does not parse as json', () => {
    expect(
      hasReportJsonBlock('From: :robot: agent (model)\n```json\n{oops}\n```'),
    ).toBe(true);
  });

  it('reports no block for a comment that carries none', () => {
    expect(
      hasReportJsonBlock(
        'From: :robot: agent (model)\n\n## PR URL\nhttps://example.com/p/1',
      ),
    ).toBe(false);
  });

  it('reports no block for a fenced block of another language', () => {
    expect(
      hasReportJsonBlock(
        'From: :robot: agent (model)\n```ts\nconst a = 1;\n```',
      ),
    ).toBe(false);
  });

  it('reports no block for an unterminated fence', () => {
    expect(
      hasReportJsonBlock(
        'From: :robot: agent (model)\n```json\n{"nextStep": null}',
      ),
    ).toBe(false);
  });
});
