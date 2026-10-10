import {
  findLastAgentReport,
  findLastAgentReportPostedSince,
} from './findLastAgentReport';

const trustEveryAuthor = (): boolean => true;

const report = (agent: string): string =>
  `From: :robot: agent (model)\n\`\`\`json\n{"nextStepAgent": "${agent}"}\n\`\`\``;

// Unlike `report` above, this helper varies the self-declared posting agent
// in the `From: :robot: {name}` line itself, so it can be used to prove the
// selection functions filter candidates by who actually posted them.
const reportPostedByAgent = (agentName: string): string =>
  `From: :robot: ${agentName} (model)\n\`\`\`json\n{"nextStepAgent": "${agentName}"}\n\`\`\``;

// A report-shaped comment (a fenced JSON object block) that carries no
// `From: :robot: {name}` line at all, so it has no self-declared posting agent.
const reportWithoutPostingAgentDeclared =
  '```json\n{"nextStepAgent": "developer"}\n```';

describe('findLastAgentReport', () => {
  it('returns the only agent report', () => {
    expect(
      findLastAgentReport(
        [{ author: 'bot', content: report('impl') }],
        trustEveryAuthor,
        null,
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
        null,
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
        null,
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
        null,
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
        null,
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
        null,
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
        null,
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
        null,
      )?.content,
    ).toBe(report('impl'));
  });

  it('returns null when no comment carries an agent report', () => {
    expect(findLastAgentReport([], trustEveryAuthor, null)).toBeNull();
  });

  describe('agent-identity filtering (agentFieldValue)', () => {
    const trustBotOnly = (author: string): boolean => author === 'bot';

    it.each([
      {
        description: 'no identity filter requested',
        comments: [{ author: 'bot', content: reportPostedByAgent('developer') }],
        isTrustedAuthor: trustEveryAuthor,
        agentFieldValue: null,
        expectedContent: reportPostedByAgent('developer'),
      },
      {
        description: 'identity matches',
        comments: [{ author: 'bot', content: reportPostedByAgent('developer') }],
        isTrustedAuthor: trustEveryAuthor,
        agentFieldValue: 'developer',
        expectedContent: reportPostedByAgent('developer'),
      },
      {
        description: 'identity mismatch, no earlier candidate',
        comments: [{ author: 'bot', content: reportPostedByAgent('pr-reviewer') }],
        isTrustedAuthor: trustEveryAuthor,
        agentFieldValue: 'developer',
        expectedContent: null,
      },
      {
        description:
          'core fix: a later mismatched comment must not hide an earlier matching one',
        comments: [
          { author: 'bot', content: reportPostedByAgent('developer') },
          { author: 'bot', content: reportPostedByAgent('pr-reviewer') },
        ],
        isTrustedAuthor: trustEveryAuthor,
        agentFieldValue: 'developer',
        expectedContent: reportPostedByAgent('developer'),
      },
      {
        description:
          'comment has a JSON body but no self-declared posting agent at all, identity requested',
        comments: [{ author: 'bot', content: reportWithoutPostingAgentDeclared }],
        isTrustedAuthor: trustEveryAuthor,
        agentFieldValue: 'developer',
        expectedContent: null,
      },
      {
        description: 'same comment as the previous case, no identity requested',
        comments: [{ author: 'bot', content: reportWithoutPostingAgentDeclared }],
        isTrustedAuthor: trustEveryAuthor,
        agentFieldValue: null,
        expectedContent: reportWithoutPostingAgentDeclared,
      },
      {
        description: 'untrusted author, identity would otherwise match',
        comments: [
          { author: 'stranger', content: reportPostedByAgent('developer') },
        ],
        isTrustedAuthor: trustBotOnly,
        agentFieldValue: 'developer',
        expectedContent: null,
      },
    ])(
      'returns $description',
      ({ comments, isTrustedAuthor, agentFieldValue, expectedContent }) => {
        expect(
          findLastAgentReport(comments, isTrustedAuthor, agentFieldValue)
            ?.content ?? null,
        ).toBe(expectedContent);
      },
    );
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
      findLastAgentReportPostedSince(comments, trustEveryAuthor, postedSince, null)
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
        null,
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
        null,
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
        findLastAgentReportPostedSince(comments, trustEveryAuthor, postedSince, null)
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
        findLastAgentReportPostedSince(comments, isTrustedAuthor, postedSince, null)
          ?.content ?? null,
      ).toBe(expectedContent);
    },
  );

  describe('agent-identity filtering combined with the time window (agentFieldValue)', () => {
    it('returns no report when the identity-matching comment falls outside the time window', () => {
      const windowStart = postedAt('2026-09-25T10:00:00Z');
      const beforeWindowMatching = {
        author: 'bot',
        content: reportPostedByAgent('developer'),
        createdAt: postedAt('2026-09-25T08:00:00Z'),
        updatedAt: postedAt('2026-09-25T08:00:00Z'),
      };
      const afterWindowMismatching = {
        author: 'bot',
        content: reportPostedByAgent('pr-reviewer'),
        createdAt: postedAt('2026-09-25T11:00:00Z'),
        updatedAt: postedAt('2026-09-25T11:00:00Z'),
      };

      expect(
        findLastAgentReportPostedSince(
          [beforeWindowMatching, afterWindowMismatching],
          trustEveryAuthor,
          windowStart,
          'developer',
        ),
      ).toBeNull();
    });

    it('prefers an earlier identity-matching comment inside the window over a later, more-recently-updated mismatching one also inside the window', () => {
      const windowStart = postedAt('2026-09-25T09:00:00Z');
      const insideWindowMatching = {
        author: 'bot',
        content: reportPostedByAgent('developer'),
        createdAt: postedAt('2026-09-25T09:30:00Z'),
        updatedAt: postedAt('2026-09-25T09:30:00Z'),
      };
      const insideWindowMismatchingUpdatedLater = {
        author: 'bot',
        content: reportPostedByAgent('pr-reviewer'),
        createdAt: postedAt('2026-09-25T09:40:00Z'),
        updatedAt: postedAt('2026-09-25T12:00:00Z'),
      };

      expect(
        findLastAgentReportPostedSince(
          [insideWindowMatching, insideWindowMismatchingUpdatedLater],
          trustEveryAuthor,
          windowStart,
          'developer',
        )?.content,
      ).toBe(reportPostedByAgent('developer'));
    });
  });
});
