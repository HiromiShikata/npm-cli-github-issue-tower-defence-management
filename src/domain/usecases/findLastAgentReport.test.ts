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
    updatedAt: postedAt('2026-09-25T08:00:00Z'),
  };
  const laterReport = {
    author: 'bot',
    content: report('pr-reviewer'),
    createdAt: postedAt('2026-09-25T10:00:00Z'),
    updatedAt: postedAt('2026-09-25T10:00:00Z'),
  };
  const laterPlainComment = {
    author: 'bot',
    content: 'Auto Status Check: REJECTED\n- NO_REPORT_FROM_AGENT_BOT',
    createdAt: postedAt('2026-09-25T11:00:00Z'),
    updatedAt: postedAt('2026-09-25T11:00:00Z'),
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

  it('returns null for a comment created before the start time even though it was edited at or after it, with an untrusted-author comment created in between', () => {
    const postedSince = postedAt('2026-09-27T18:50:00Z');
    const editedTrustedReport = {
      author: 'bot',
      content: report('impl'),
      createdAt: postedAt('2026-09-27T18:46:11Z'),
      updatedAt: postedAt('2026-09-27T18:56:07Z'),
    };
    const untrustedComment = {
      author: 'stranger',
      content: 'Working on it, will update shortly.',
      createdAt: postedAt('2026-09-27T18:49:42Z'),
      updatedAt: postedAt('2026-09-27T18:49:42Z'),
    };
    const isTrustedAuthor = (author: string): boolean => author === 'bot';

    expect(
      findLastAgentReportPostedSince(
        [editedTrustedReport, untrustedComment],
        isTrustedAuthor,
        postedSince,
      ),
    ).toBeNull();
  });

  it('returns the most recently edited survivor even when it sits after the staler-edited survivor in creation order', () => {
    const postedSince = postedAt('2026-09-27T18:50:00Z');
    const createdFirstButEditedLessRecentlyReport = {
      author: 'bot',
      content: report('impl'),
      createdAt: postedAt('2026-09-27T18:51:00Z'),
      updatedAt: postedAt('2026-09-27T18:56:00Z'),
    };
    const createdSecondButEditedMostRecentlyReport = {
      author: 'bot',
      content: report('pr-reviewer'),
      createdAt: postedAt('2026-09-27T18:55:00Z'),
      updatedAt: postedAt('2026-09-27T19:10:00Z'),
    };

    expect(
      findLastAgentReportPostedSince(
        [
          createdFirstButEditedLessRecentlyReport,
          createdSecondButEditedMostRecentlyReport,
        ],
        trustEveryAuthor,
        postedSince,
      )?.content,
    ).toBe(report('pr-reviewer'));
  });

  it.each([
    {
      description:
        'a report created after the start time and edited later as the report',
      comments: [
        earlierReport,
        {
          author: 'bot',
          content: report('pr-reviewer'),
          createdAt: postedAt('2026-09-25T10:00:00Z'),
          updatedAt: postedAt('2026-09-25T12:00:00Z'),
        },
      ],
      postedSince: postedAt('2026-09-25T09:00:00Z'),
      expectedContent: report('pr-reviewer'),
    },
    {
      description:
        'a report created exactly at the start time and edited later as the report',
      comments: [
        earlierReport,
        {
          author: 'bot',
          content: report('pr-reviewer'),
          createdAt: postedAt('2026-09-25T09:00:00Z'),
          updatedAt: postedAt('2026-09-25T12:00:00Z'),
        },
      ],
      postedSince: postedAt('2026-09-25T09:00:00Z'),
      expectedContent: report('pr-reviewer'),
    },
    {
      description:
        'the most recently edited of two reports created after the start time even when it was created first',
      comments: [
        {
          author: 'bot',
          content: report('impl'),
          createdAt: postedAt('2026-09-25T09:10:00Z'),
          updatedAt: postedAt('2026-09-25T11:00:00Z'),
        },
        {
          author: 'bot',
          content: report('pr-reviewer'),
          createdAt: postedAt('2026-09-25T09:30:00Z'),
          updatedAt: postedAt('2026-09-25T09:30:00Z'),
        },
      ],
      postedSince: postedAt('2026-09-25T09:00:00Z'),
      expectedContent: report('impl'),
    },
    {
      description:
        'the last report in comment order when no start time is given even when an earlier report was edited more recently',
      comments: [
        {
          author: 'bot',
          content: report('impl'),
          createdAt: postedAt('2026-09-25T08:00:00Z'),
          updatedAt: postedAt('2026-09-25T12:00:00Z'),
        },
        laterReport,
      ],
      postedSince: null,
      expectedContent: report('pr-reviewer'),
    },
    {
      description: 'a report created long before when no start time is given',
      comments: [earlierReport, laterPlainComment],
      postedSince: null,
      expectedContent: report('impl'),
    },
  ])(
    'keeps returning $description',
    ({ comments, postedSince, expectedContent }) => {
      expect(
        findLastAgentReportPostedSince(comments, trustEveryAuthor, postedSince)
          ?.content ?? null,
      ).toBe(expectedContent);
    },
  );

  it.each([
    {
      description:
        'null when the only trusted report was created the day before the start time and edited after it, with an untrusted owner comment created in between',
      comments: [
        {
          author: 'bot',
          content: report('impl'),
          createdAt: postedAt('2026-10-02T08:40:52Z'),
          updatedAt: postedAt('2026-10-03T06:25:32Z'),
        },
        {
          author: 'owner',
          content: 'Why did this come to me?',
          createdAt: postedAt('2026-10-03T01:15:07Z'),
          updatedAt: postedAt('2026-10-03T01:15:07Z'),
        },
      ],
      postedSince: postedAt('2026-10-03T06:19:40.708Z'),
      expectedContent: null,
    },
    {
      description:
        'null when the only trusted report was created before the start time and edited exactly at it',
      comments: [
        {
          author: 'bot',
          content: report('impl'),
          createdAt: postedAt('2026-10-02T08:40:52Z'),
          updatedAt: postedAt('2026-10-03T06:19:40.708Z'),
        },
      ],
      postedSince: postedAt('2026-10-03T06:19:40.708Z'),
      expectedContent: null,
    },
    {
      description:
        'the report created after the start time when a report created before the start time was edited more recently',
      comments: [
        {
          author: 'bot',
          content: report('impl'),
          createdAt: postedAt('2026-10-02T08:40:52Z'),
          updatedAt: postedAt('2026-10-03T06:50:00Z'),
        },
        {
          author: 'bot',
          content: report('pr-reviewer'),
          createdAt: postedAt('2026-10-03T06:30:00Z'),
          updatedAt: postedAt('2026-10-03T06:30:00Z'),
        },
      ],
      postedSince: postedAt('2026-10-03T06:19:40.708Z'),
      expectedContent: report('pr-reviewer'),
    },
  ])(
    'ignores a report created before the start time even when edited after it and returns $description',
    ({ comments, postedSince, expectedContent }) => {
      const isTrustedAuthor = (author: string): boolean => author === 'bot';

      expect(
        findLastAgentReportPostedSince(comments, isTrustedAuthor, postedSince)
          ?.content ?? null,
      ).toBe(expectedContent);
    },
  );
});
