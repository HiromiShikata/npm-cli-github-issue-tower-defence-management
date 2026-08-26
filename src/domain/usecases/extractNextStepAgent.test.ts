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

  it('returns the declared agent when the routing block is not the first fenced json block', () => {
    expect(
      extractNextStepAgent(
        'From: :robot: agent (model)\n\n```json\n{ "pullRequestRequired": false }\n```\n\n## review result\n\n```json\n{ "pullRequestRequired": false, "nextStepAgent": "systems-analyst" }\n```\n',
      ),
    ).toBe('systems-analyst');
  });

  it('returns the declared agent from a later block and reports the earlier unparseable block', () => {
    const consoleWarn = jest.spyOn(console, 'warn').mockImplementation();
    expect(
      extractNextStepAgent(
        'From: :robot: agent (model)\n\n```json\n{ "pullRequestRequired": false,\n```\n\n```json\n{ "nextStepAgent": "developer" }\n```\n',
      ),
    ).toBe('developer');
    expect(consoleWarn).toHaveBeenCalled();
    consoleWarn.mockRestore();
  });
});
