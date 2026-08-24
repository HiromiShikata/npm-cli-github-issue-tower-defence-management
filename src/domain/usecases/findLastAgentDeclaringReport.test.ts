import { findLastAgentDeclaringReport } from './findLastAgentDeclaringReport';

const trustEveryAuthor = (): boolean => true;

const report = (agent: string): string =>
  `From: :robot: agent (model)\n\`\`\`json\n{"nextStepAgent": "${agent}"}\n\`\`\``;

describe('findLastAgentDeclaringReport', () => {
  it('returns the only report that declares an agent', () => {
    expect(
      findLastAgentDeclaringReport(
        [{ author: 'bot', content: report('impl') }],
        trustEveryAuthor,
      )?.content,
    ).toBe(report('impl'));
  });

  it('skips a later bot comment that declares no agent', () => {
    expect(
      findLastAgentDeclaringReport(
        [
          { author: 'bot', content: report('impl') },
          {
            author: 'bot',
            content: 'From: :robot: agent (model)\n\n## PR URL\nhttps://e/p/1',
          },
        ],
        trustEveryAuthor,
      )?.content,
    ).toBe(report('impl'));
  });

  it('prefers the most recent report when several declare an agent', () => {
    expect(
      findLastAgentDeclaringReport(
        [
          { author: 'bot', content: report('impl') },
          { author: 'bot', content: report('pr-reviewer') },
        ],
        trustEveryAuthor,
      )?.content,
    ).toBe(report('pr-reviewer'));
  });

  it('ignores a declaration from an author that is not trusted', () => {
    expect(
      findLastAgentDeclaringReport(
        [{ author: 'stranger', content: report('impl') }],
        (author) => author === 'bot',
      ),
    ).toBeNull();
  });

  it('ignores a declaration that does not carry the agent report prefix', () => {
    expect(
      findLastAgentDeclaringReport(
        [
          {
            author: 'bot',
            content: '```json\n{"nextStepAgent": "impl"}\n```',
          },
        ],
        trustEveryAuthor,
      ),
    ).toBeNull();
  });

  it('returns null when no comment declares an agent', () => {
    expect(findLastAgentDeclaringReport([], trustEveryAuthor)).toBeNull();
  });

  it('returns null when a later report carries a report json block that omits the agent', () => {
    expect(
      findLastAgentDeclaringReport(
        [
          { author: 'bot', content: report('pr-reviewer') },
          {
            author: 'bot',
            content:
              'From: :robot: agent (model)\n```json\n{"pullRequestRequired": false, "reviewResult": "PASS", "nextStep": null}\n```',
          },
        ],
        trustEveryAuthor,
      ),
    ).toBeNull();
  });

  it('returns null when the later report json block is unparsable', () => {
    expect(
      findLastAgentDeclaringReport(
        [
          { author: 'bot', content: report('pr-reviewer') },
          {
            author: 'bot',
            content: 'From: :robot: agent (model)\n```json\n{not json}\n```',
          },
        ],
        trustEveryAuthor,
      ),
    ).toBeNull();
  });

  it('returns null when a later report written with escaped fences omits the agent', () => {
    expect(
      findLastAgentDeclaringReport(
        [
          { author: 'bot', content: report('pr-reviewer') },
          {
            author: 'bot',
            content:
              'From: :robot: agent (model)\n\\`\\`\\`json\r\n{"reviewResult": "PASS"}\r\n\\`\\`\\`',
          },
        ],
        trustEveryAuthor,
      ),
    ).toBeNull();
  });

  it('keeps the declaration when the later bot comment holds no report json block', () => {
    expect(
      findLastAgentDeclaringReport(
        [
          { author: 'bot', content: report('pr-reviewer') },
          {
            author: 'bot',
            content:
              'From: :robot: agent (model)\n\n## Review\nLeft an inline note on the pull request.',
          },
        ],
        trustEveryAuthor,
      )?.content,
    ).toBe(report('pr-reviewer'));
  });

  it('keeps the declaration when the later report comes from an author that is not trusted', () => {
    expect(
      findLastAgentDeclaringReport(
        [
          { author: 'bot', content: report('pr-reviewer') },
          {
            author: 'stranger',
            content:
              'From: :robot: agent (model)\n```json\n{"reviewResult": "PASS"}\n```',
          },
        ],
        (author) => author === 'bot',
      )?.content,
    ).toBe(report('pr-reviewer'));
  });
});
