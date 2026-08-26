import { isPullRequestDeclaredUnnecessary } from './isPullRequestDeclaredUnnecessary';

const trustEveryAuthor = (): boolean => true;

const reportComment = (
  reportJson: string,
  author = 'agent-bot',
): { author: string; content: string } => ({
  author,
  content: `From: :robot: agent report\n\`\`\`json\n${reportJson}\n\`\`\``,
});

describe('isPullRequestDeclaredUnnecessary', () => {
  it('returns true when the last report declares pullRequestRequired as false', () => {
    expect(
      isPullRequestDeclaredUnnecessary(
        [reportComment('{"pullRequestRequired": false}')],
        trustEveryAuthor,
      ),
    ).toBe(true);
  });

  it('returns true when the code fence backticks of that report are backslash escaped', () => {
    expect(
      isPullRequestDeclaredUnnecessary(
        [
          {
            author: 'agent-bot',
            content:
              'From: :robot: agent report\n\\`\\`\\`json\n{"pullRequestRequired": false}\n\\`\\`\\`',
          },
        ],
        trustEveryAuthor,
      ),
    ).toBe(true);
  });

  it('returns false when the last report declares pullRequestRequired as true', () => {
    expect(
      isPullRequestDeclaredUnnecessary(
        [reportComment('{"pullRequestRequired": true}')],
        trustEveryAuthor,
      ),
    ).toBe(false);
  });

  it('returns false when the report carries no pullRequestRequired field', () => {
    expect(
      isPullRequestDeclaredUnnecessary(
        [reportComment('{"nextStep": null}')],
        trustEveryAuthor,
      ),
    ).toBe(false);
  });

  it('returns false when pullRequestRequired is the string false rather than the boolean', () => {
    expect(
      isPullRequestDeclaredUnnecessary(
        [reportComment('{"pullRequestRequired": "false"}')],
        trustEveryAuthor,
      ),
    ).toBe(false);
  });

  it('returns false when the author of the last comment is not trusted', () => {
    expect(
      isPullRequestDeclaredUnnecessary(
        [reportComment('{"pullRequestRequired": false}', 'stranger')],
        (author) => author === 'agent-bot',
      ),
    ).toBe(false);
  });

  it('returns false when the last comment is not an agent report', () => {
    expect(
      isPullRequestDeclaredUnnecessary(
        [
          reportComment('{"pullRequestRequired": false}'),
          {
            author: 'agent-bot',
            content:
              'A later human comment\n```json\n{"pullRequestRequired": false}\n```',
          },
        ],
        trustEveryAuthor,
      ),
    ).toBe(false);
  });

  it('reads only the last comment and ignores an earlier declaration', () => {
    expect(
      isPullRequestDeclaredUnnecessary(
        [
          reportComment('{"pullRequestRequired": false}'),
          reportComment('{"pullRequestRequired": true}'),
        ],
        trustEveryAuthor,
      ),
    ).toBe(false);
  });

  it('returns false when there is no comment at all', () => {
    expect(isPullRequestDeclaredUnnecessary([], trustEveryAuthor)).toBe(false);
  });

  it('returns false when the JSON block cannot be parsed', () => {
    const consoleWarn = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => {});

    expect(
      isPullRequestDeclaredUnnecessary(
        [reportComment('{"pullRequestRequired": false')],
        trustEveryAuthor,
      ),
    ).toBe(false);

    consoleWarn.mockRestore();
  });

  it('returns false when the report carries no JSON block', () => {
    expect(
      isPullRequestDeclaredUnnecessary(
        [{ author: 'agent-bot', content: 'From: :robot: agent report' }],
        trustEveryAuthor,
      ),
    ).toBe(false);
  });

  it('returns true when pullRequestRequired is declared in a later fenced json block', () => {
    expect(
      isPullRequestDeclaredUnnecessary(
        [
          {
            author: 'agent-bot',
            content:
              'From: :robot: agent report\n\n```json\n{ "nextStepAgent": "pr-reviewer" }\n```\n\n## summary\n\n```json\n{ "pullRequestRequired": false }\n```',
          },
        ],
        trustEveryAuthor,
      ),
    ).toBe(true);
  });

  it('reads a later block and reports the earlier unparseable block', () => {
    const consoleWarn = jest.spyOn(console, 'warn').mockImplementation();
    expect(
      isPullRequestDeclaredUnnecessary(
        [
          {
            author: 'agent-bot',
            content:
              'From: :robot: agent report\n\n```json\n{ "pullRequestRequired": false,\n```\n\n```json\n{ "pullRequestRequired": false }\n```',
          },
        ],
        trustEveryAuthor,
      ),
    ).toBe(true);
    expect(consoleWarn).toHaveBeenCalled();
    consoleWarn.mockRestore();
  });
});
