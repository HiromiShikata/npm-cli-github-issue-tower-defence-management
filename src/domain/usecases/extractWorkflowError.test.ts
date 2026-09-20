import { extractWorkflowError } from './extractWorkflowError';

describe('extractWorkflowError', () => {
  it('returns the workflow error string from a fenced json block', () => {
    expect(
      extractWorkflowError(
        'From: :robot: agent (model)\n\n```json\n{ "workflowError": "missing required config" }\n```\n',
      ),
    ).toBe('missing required config');
  });

  it('returns the workflow error when the code fence backticks are backslash escaped', () => {
    expect(
      extractWorkflowError(
        'From: :robot: agent (model)\n\n\\`\\`\\`json\n{ "workflowError": "fatal error" }\n\\`\\`\\`\n',
      ),
    ).toBe('fatal error');
  });

  it('returns the workflow error when the report body uses CRLF line endings', () => {
    expect(
      extractWorkflowError(
        'From: :robot: agent (model)\r\n\r\n```json\r\n{ "workflowError": "some error" }\r\n```\r\n',
      ),
    ).toBe('some error');
  });

  it('returns null when the report declares no workflow error', () => {
    expect(
      extractWorkflowError(
        'From: :robot: agent (model)\n\n```json\n{ "nextStep": null }\n```\n',
      ),
    ).toBeNull();
  });

  it('returns null when workflowError is an empty string', () => {
    expect(
      extractWorkflowError(
        'From: :robot: agent (model)\n\n```json\n{ "workflowError": "" }\n```\n',
      ),
    ).toBeNull();
  });

  it('returns null when workflowError is null', () => {
    expect(
      extractWorkflowError(
        'From: :robot: agent (model)\n\n```json\n{ "workflowError": null }\n```\n',
      ),
    ).toBeNull();
  });

  it('returns null when the body carries no fenced json block', () => {
    expect(extractWorkflowError('Please go ahead with that.')).toBeNull();
  });

  it('trims surrounding whitespace from the workflow error value', () => {
    expect(
      extractWorkflowError(
        'From: :robot: agent (model)\n\n```json\n{ "workflowError": "  trimmed  " }\n```\n',
      ),
    ).toBe('trimmed');
  });

  it('returns the workflow error from a later block when the routing block is not the first fenced json block', () => {
    expect(
      extractWorkflowError(
        'From: :robot: agent (model)\n\n```json\n{ "context": "info" }\n```\n\n```json\n{ "workflowError": "escalated error" }\n```\n',
      ),
    ).toBe('escalated error');
  });

  it('returns the workflow error from a later block and warns about the earlier unparseable block', () => {
    const consoleWarn = jest.spyOn(console, 'warn').mockImplementation();
    expect(
      extractWorkflowError(
        'From: :robot: agent (model)\n\n```json\n{ "broken",\n```\n\n```json\n{ "workflowError": "real error" }\n```\n',
      ),
    ).toBe('real error');
    expect(consoleWarn).toHaveBeenCalled();
    consoleWarn.mockRestore();
  });
});
