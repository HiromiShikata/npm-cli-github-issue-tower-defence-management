import { extractFencedJsonBlocks } from './extractFencedJsonBlocks';

describe('extractFencedJsonBlocks', () => {
  it('returns every fenced json block in the order they appear', () => {
    expect(
      extractFencedJsonBlocks(
        'From: :robot: agent (model)\n\n```json\n{ "pullRequestRequired": false }\n```\n\ntext\n\n```json\n{ "nextStepAgent": "developer" }\n```\n',
        'test',
      ),
    ).toEqual([{ pullRequestRequired: false }, { nextStepAgent: 'developer' }]);
  });

  it('returns an empty list when the body carries no fenced json block', () => {
    expect(extractFencedJsonBlocks('Please go ahead.', 'test')).toEqual([]);
  });

  it('skips an unparseable block, reports it, and still returns the parseable ones', () => {
    const consoleWarn = jest.spyOn(console, 'warn').mockImplementation();
    expect(
      extractFencedJsonBlocks(
        'From: :robot: agent (model)\n\n```json\n{ "broken": \n```\n\n```json\n{ "ok": true }\n```\n',
        'test',
      ),
    ).toEqual([{ ok: true }]);
    expect(consoleWarn).toHaveBeenCalledWith(
      'Invalid JSON in report body while checking test:',
      expect.anything(),
    );
    consoleWarn.mockRestore();
  });

  it('reads blocks whose code fence backticks are backslash escaped', () => {
    expect(
      extractFencedJsonBlocks(
        'From: :robot: agent (model)\n\n\\`\\`\\`json\n{ "nextStepAgent": "developer" }\n\\`\\`\\`\n',
        'test',
      ),
    ).toEqual([{ nextStepAgent: 'developer' }]);
  });
});
