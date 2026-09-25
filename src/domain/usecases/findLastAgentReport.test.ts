import {
  findLastAgentReport,
  findLastAgentReportPostedSince,
} from './findLastAgentReport';

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
      'From: :robot: agent (model)\n```json\n{"reviewResult": "PASS", "nextStep": null}\n```';
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

  it('returns the earlier agent report when the latest trusted comment carries no json object block', () => {
    const withoutJsonBlock =
      'From: :robot: agent (model)\n\n## PR URL\nhttps://e/p/1';
    expect(
      findLastAgentReport(
        [
          { author: 'bot', content: report('impl') },
          { author: 'bot', content: withoutJsonBlock },
        ],
        trustEveryAuthor,
      )?.content,
    ).toBe(report('impl'));
  });

  it('returns the most recent agent report whose prefix follows a leading fenced json block', () => {
    const fencedBeforePrefix =
      '```json\n{ "nextStep": null }\n```\n\nFrom: :robot: agent (model)\n\n## Result\nDone.';
    expect(
      findLastAgentReport(
        [
          { author: 'bot', content: report('impl') },
          { author: 'bot', content: fencedBeforePrefix },
        ],
        trustEveryAuthor,
      )?.content,
    ).toBe(fencedBeforePrefix);
  });

  it('skips a later comment whose only agent report prefix sits inside a fenced block', () => {
    const prefixInsideFence =
      '```\nFrom: :robot: agent (model)\n```\n\nQuoted for reference.';
    expect(
      findLastAgentReport(
        [
          { author: 'bot', content: report('impl') },
          { author: 'bot', content: prefixInsideFence },
        ],
        trustEveryAuthor,
      )?.content,
    ).toBe(report('impl'));
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

describe('findLastAgentReportPostedSince', () => {
  const postedAt = (isoTimestamp: string): Date => new Date(isoTimestamp);
  const earlierReport = {
    author: 'bot',
    content: report('impl'),
    createdAt: postedAt('2026-09-25T08:00:00Z'),
  };
  const laterReport = {
    author: 'bot',
    content: report('pr-reviewer'),
    createdAt: postedAt('2026-09-25T10:00:00Z'),
  };
  const laterPlainComment = {
    author: 'bot',
    content: 'Auto Status Check: REJECTED\n- NO_REPORT_FROM_AGENT_BOT',
    createdAt: postedAt('2026-09-25T11:00:00Z'),
  };

  it.each([
    {
      description: 'the latest report when no start time is given',
      comments: [earlierReport, laterReport],
      postedSince: null,
      expectedContent: report('pr-reviewer'),
    },
    {
      description: 'the latest report when it was posted after the start time',
      comments: [earlierReport, laterReport],
      postedSince: postedAt('2026-09-25T09:00:00Z'),
      expectedContent: report('pr-reviewer'),
    },
    {
      description:
        'the latest report when it was posted exactly at the start time',
      comments: [earlierReport, laterReport],
      postedSince: postedAt('2026-09-25T10:00:00Z'),
      expectedContent: report('pr-reviewer'),
    },
    {
      description:
        'null when only a plain comment was posted after the start time',
      comments: [earlierReport, laterReport, laterPlainComment],
      postedSince: postedAt('2026-09-25T10:30:00Z'),
      expectedContent: null,
    },
    {
      description: 'null when the only report was posted before the start time',
      comments: [earlierReport],
      postedSince: postedAt('2026-09-25T09:00:00Z'),
      expectedContent: null,
    },
  ])('returns $description', ({ comments, postedSince, expectedContent }) => {
    expect(
      findLastAgentReportPostedSince(comments, trustEveryAuthor, postedSince)
        ?.content ?? null,
    ).toBe(expectedContent);
  });
});
