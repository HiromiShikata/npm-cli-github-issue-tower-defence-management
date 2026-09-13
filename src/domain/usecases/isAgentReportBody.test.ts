import {
  isAgentReportBody,
  isAgentReportBodyFromAgent,
  stripLeadingFencedBlocks,
} from './isAgentReportBody';

describe('isAgentReportBody', () => {
  it('accepts a body containing only a fenced json block with a JSON object', () => {
    expect(
      isAgentReportBody('```json\n{ "nextStepAgent": "developer" }\n```\n'),
    ).toBe(true);
  });

  it('accepts a body containing a fenced json block with nextStep null', () => {
    expect(isAgentReportBody('```json\n{ "nextStep": null }\n```\n')).toBe(
      true,
    );
  });

  it('accepts a body where the json block appears after prose text', () => {
    expect(
      isAgentReportBody(
        'Some text\n\n```json\n{ "nextStepAgent": "developer" }\n```\n',
      ),
    ).toBe(true);
  });

  it('accepts a body with multiple json blocks where the first is a valid object', () => {
    expect(
      isAgentReportBody(
        '```json\n{ "nextStep": null }\n```\n\n```json\n{ "other": 1 }\n```\n',
      ),
    ).toBe(true);
  });

  it('rejects a body that carries only the From: :robot: prefix without a json block', () => {
    expect(
      isAgentReportBody('From: :robot: agent (model)\n\nNo JSON block here.'),
    ).toBe(false);
  });

  it('rejects a body with a fenced json block containing a JSON string (not an object)', () => {
    expect(isAgentReportBody('```json\n"just a string"\n```\n')).toBe(false);
  });

  it('rejects a body with a fenced json block containing null at top level', () => {
    expect(isAgentReportBody('```json\nnull\n```\n')).toBe(false);
  });

  it('rejects a body with a fenced json block containing a JSON array', () => {
    expect(isAgentReportBody('```json\n[1, 2, 3]\n```\n')).toBe(false);
  });

  it('rejects a body with only a non-json fenced block', () => {
    expect(isAgentReportBody('```\nsome code\n```\n')).toBe(false);
  });

  it('rejects a body that carries no json block and no report prefix', () => {
    expect(isAgentReportBody('Auto Status Check: RETURNED')).toBe(false);
  });

  it('rejects an empty body', () => {
    expect(isAgentReportBody('')).toBe(false);
  });

  it('rejects a body with an unclosed json fence', () => {
    expect(
      isAgentReportBody('```json\n{ "nextStep": null }\nno closing fence'),
    ).toBe(false);
  });
});

describe('isAgentReportBodyFromAgent', () => {
  it('accepts when body has json block and agentFieldValue matches agentName', () => {
    expect(
      isAgentReportBodyFromAgent(
        '```json\n{ "nextStepAgent": "developer" }\n```\nSome content',
        'triager',
        'triager',
      ),
    ).toBe(true);
  });

  it('rejects when body has json block but agentFieldValue does not match agentName', () => {
    expect(
      isAgentReportBodyFromAgent(
        '```json\n{ "nextStep": null }\n```\nFrom: :robot: triager (model)',
        'triager',
        'developer',
      ),
    ).toBe(false);
  });

  it('rejects when agentFieldValue is null even if body has a json block', () => {
    expect(
      isAgentReportBodyFromAgent(
        '```json\n{ "nextStep": null }\n```\nSome content',
        'developer',
        null,
      ),
    ).toBe(false);
  });

  it('rejects when agentFieldValue is undefined even if body has a json block', () => {
    expect(
      isAgentReportBodyFromAgent(
        '```json\n{ "nextStep": null }\n```\nSome content',
        'developer',
        undefined,
      ),
    ).toBe(false);
  });

  it('accepts when agentFieldValue and agentName differ only in casing', () => {
    expect(
      isAgentReportBodyFromAgent(
        '```json\n{ "nextStep": null }\n```\nSome content',
        'Developer',
        'developer',
      ),
    ).toBe(true);
  });

  it('rejects when body has no json block even if agentFieldValue matches agentName', () => {
    expect(
      isAgentReportBodyFromAgent(
        'From: :robot: triager (model)\n\nNo JSON block',
        'triager',
        'triager',
      ),
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
