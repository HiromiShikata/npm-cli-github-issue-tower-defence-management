import {
  isAgentReportBody,
  isAgentReportBodyFromAgent,
  stripLeadingFencedBlocks,
} from './isAgentReportBody';

describe('isAgentReportBody', () => {
  it('accepts a body that opens with the report prefix', () => {
    expect(isAgentReportBody('From: :robot: agent (model)\n\n## Result')).toBe(
      true,
    );
  });

  it('accepts a body whose report prefix follows a leading fenced json block', () => {
    expect(
      isAgentReportBody(
        '```json\n{ "pullRequestRequired": false }\n```\n\nFrom: :robot: agent (model)\n\n## Result',
      ),
    ).toBe(true);
  });

  it('accepts a body whose report prefix follows two leading fenced blocks', () => {
    expect(
      isAgentReportBody(
        '```json\n{ "pullRequestRequired": false }\n```\n~~~\nplain\n~~~\nFrom: :robot: agent (model)',
      ),
    ).toBe(true);
  });

  it('accepts a body whose leading fence carries a longer marker than three backticks', () => {
    expect(
      isAgentReportBody(
        '````json\n```\n{ "pullRequestRequired": false }\n```\n````\nFrom: :robot: agent (model)',
      ),
    ).toBe(true);
  });

  it('accepts a body whose report prefix follows blank lines', () => {
    expect(isAgentReportBody('\n\nFrom: :robot: agent (model)')).toBe(true);
  });

  it('accepts a body written with carriage returns and escaped backticks', () => {
    expect(
      isAgentReportBody(
        '\\`\\`\\`json\r\n{ "pullRequestRequired": false }\r\n\\`\\`\\`\r\nFrom: :robot: agent (model)',
      ),
    ).toBe(true);
  });

  it('rejects a body whose only report prefix sits inside a fenced block', () => {
    expect(
      isAgentReportBody('```\nFrom: :robot: agent (model)\n```\n\nQuoted.'),
    ).toBe(false);
  });

  it('rejects a body whose report prefix follows prose', () => {
    expect(
      isAgentReportBody('Note about the task.\n\nFrom: :robot: agent (model)'),
    ).toBe(false);
  });

  it('rejects a body whose leading fence is never closed', () => {
    expect(
      isAgentReportBody(
        '```json\n{ "pullRequestRequired": false }\nFrom: :robot: agent (model)',
      ),
    ).toBe(false);
  });

  it('rejects a body that carries no report prefix', () => {
    expect(isAgentReportBody('Auto Status Check: RETURNED')).toBe(false);
  });

  it('rejects an empty body', () => {
    expect(isAgentReportBody('')).toBe(false);
  });
});

describe('isAgentReportBodyFromAgent', () => {
  it('accepts a report from the named agent behind a leading fenced block', () => {
    expect(
      isAgentReportBodyFromAgent(
        '```json\n{ "triagerProposal": {} }\n```\nFrom: :robot: triager (model)',
        'triager',
      ),
    ).toBe(true);
  });

  it('rejects a report from another agent', () => {
    expect(
      isAgentReportBodyFromAgent('From: :robot: developer (model)', 'triager'),
    ).toBe(false);
  });
});

describe('stripLeadingFencedBlocks', () => {
  it('keeps a body that opens with prose unchanged', () => {
    expect(stripLeadingFencedBlocks('one\n```\ntwo\n```')).toBe(
      'one\n```\ntwo\n```',
    );
  });

  it('removes only the leading fenced blocks', () => {
    expect(stripLeadingFencedBlocks('```\none\n```\nbody\n```\ntwo\n```')).toBe(
      'body\n```\ntwo\n```',
    );
  });
});
