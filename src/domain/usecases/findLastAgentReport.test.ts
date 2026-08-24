import { findLastAgentReport } from './findLastAgentReport';

const trustEveryAuthor = (): boolean => true;

const report = (agent: string): string =>
  `From: :robot: agent (model)\n\`\`\`json\n{"nextStepAgent": "${agent}"}\n\`\`\``;

describe('findLastAgentReport', () => {
  it('returns the only agent report', () => {
    expect(
      findLastAgentReport(
        [{ author: 'bot', content: report('impl') }],
        trustEveryAuthor,
      )?.content,
    ).toBe(report('impl'));
  });

  it('returns the most recent agent report', () => {
    expect(
      findLastAgentReport(
        [
          { author: 'bot', content: report('impl') },
          { author: 'bot', content: report('pr-reviewer') },
        ],
        trustEveryAuthor,
      )?.content,
    ).toBe(report('pr-reviewer'));
  });

  it('returns the most recent agent report even when it declares no agent', () => {
    const withoutDeclaration =
      'From: :robot: agent (model)\n```json\n{"pullRequestRequired": false, "reviewResult": "PASS", "nextStep": null}\n```';
    expect(
      findLastAgentReport(
        [
          { author: 'bot', content: report('pr-reviewer') },
          { author: 'bot', content: withoutDeclaration },
        ],
        trustEveryAuthor,
      )?.content,
    ).toBe(withoutDeclaration);
  });

  it('returns the most recent agent report even when it carries no report json block', () => {
    const withoutReportJson =
      'From: :robot: agent (model)\n\n## PR URL\nhttps://e/p/1';
    expect(
      findLastAgentReport(
        [
          { author: 'bot', content: report('impl') },
          { author: 'bot', content: withoutReportJson },
        ],
        trustEveryAuthor,
      )?.content,
    ).toBe(withoutReportJson);
  });

  it('skips a later comment that does not carry the agent report prefix', () => {
    expect(
      findLastAgentReport(
        [
          { author: 'bot', content: report('impl') },
          {
            author: 'bot',
            content:
              'Auto Status Check: RETURNED_TO_AWAITING_WORKSPACE\nReturned once.',
          },
        ],
        trustEveryAuthor,
      )?.content,
    ).toBe(report('impl'));
  });

  it('skips a later report from an author that is not trusted', () => {
    expect(
      findLastAgentReport(
        [
          { author: 'bot', content: report('impl') },
          {
            author: 'stranger',
            content:
              'From: :robot: agent (model)\n```json\n{"reviewResult": "PASS"}\n```',
          },
        ],
        (author) => author === 'bot',
      )?.content,
    ).toBe(report('impl'));
  });

  it('returns null when no comment carries an agent report', () => {
    expect(findLastAgentReport([], trustEveryAuthor)).toBeNull();
  });
});
