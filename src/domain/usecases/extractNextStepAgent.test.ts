import { extractNextStepAgent } from './extractNextStepAgent';

describe('extractNextStepAgent', () => {
  it('returns the declared agent from a plain fenced json block', () => {
    expect(
      extractNextStepAgent(
        'From: :robot: agent (model)\n\n```json\n{ "pullRequestRequired": false, "nextStepAgent": "developer" }\n```\n\nbody text\n',
      ),
    ).toBe('developer');
  });

  it('returns the declared agent when the code fence backticks are backslash escaped', () => {
    expect(
      extractNextStepAgent(
        'From: :robot: agent (model)\n\n\\`\\`\\`json\n{ "pullRequestRequired": false, "nextStepAgent": "developer" }\n\\`\\`\\`\n\nbody text\n',
      ),
    ).toBe('developer');
  });

  it('returns the declared agent when the report body uses CRLF line endings', () => {
    expect(
      extractNextStepAgent(
        'From: :robot: agent (model)\r\n\r\n```json\r\n{ "pullRequestRequired": false, "nextStepAgent": "developer" }\r\n```\r\n\r\nbody text\r\n',
      ),
    ).toBe('developer');
  });

  it('returns null when the report declares no agent', () => {
    expect(
      extractNextStepAgent(
        'From: :robot: agent (model)\n\n```json\n{ "nextStep": null }\n```\n',
      ),
    ).toBeNull();
  });

  it('returns null when the body carries no fenced json block', () => {
    expect(extractNextStepAgent('Please go ahead with that.')).toBeNull();
  });
});
