import { extractStory } from './extractStory';

describe('extractStory', () => {
  it('returns the declared story from a plain fenced json block', () => {
    expect(
      extractStory(
        'From: :robot: agent (model)\n\n```json\n{ "nextStepAgent": "tdpm-workflow-improver", "story": "regular / workflow improvement" }\n```\n\nbody text\n',
      ),
    ).toBe('regular / workflow improvement');
  });

  it('returns the declared story when the code fence backticks are backslash escaped', () => {
    expect(
      extractStory(
        'From: :robot: agent (model)\n\n\\`\\`\\`json\n{ "story": "regular / workflow improvement" }\n\\`\\`\\`\n\nbody text\n',
      ),
    ).toBe('regular / workflow improvement');
  });

  it('returns the declared story when the report body uses CRLF line endings', () => {
    expect(
      extractStory(
        'From: :robot: agent (model)\r\n\r\n```json\r\n{ "story": "regular / workflow improvement" }\r\n```\r\n\r\nbody text\r\n',
      ),
    ).toBe('regular / workflow improvement');
  });

  it('returns null when the report declares no story', () => {
    expect(
      extractStory(
        'From: :robot: agent (model)\n\n```json\n{ "nextStep": null }\n```\n',
      ),
    ).toBeNull();
  });

  it('returns null when the body carries no fenced json block', () => {
    expect(extractStory('Please go ahead with that.')).toBeNull();
  });

  it('returns the declared story when the routing block is not the first fenced json block', () => {
    expect(
      extractStory(
        'From: :robot: agent (model)\n\n```json\n{ "pullRequestRequired": false }\n```\n\n## review result\n\n```json\n{ "story": "regular / workflow improvement", "nextStepAgent": "tdpm-workflow-improver" }\n```\n',
      ),
    ).toBe('regular / workflow improvement');
  });

  it('returns the declared story from a later block and reports the earlier unparseable block', () => {
    const consoleWarn = jest.spyOn(console, 'warn').mockImplementation();
    expect(
      extractStory(
        'From: :robot: agent (model)\n\n```json\n{ "pullRequestRequired": false,\n```\n\n```json\n{ "story": "regular / workflow improvement" }\n```\n',
      ),
    ).toBe('regular / workflow improvement');
    expect(consoleWarn).toHaveBeenCalled();
    consoleWarn.mockRestore();
  });
});
