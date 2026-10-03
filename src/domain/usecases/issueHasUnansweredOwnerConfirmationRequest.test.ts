import { issueHasUnansweredOwnerConfirmationRequest } from './issueHasUnansweredOwnerConfirmationRequest';
import { Comment } from '../entities/Comment';

const trustTestUser = (author: string): boolean => author === 'test-user';

const at = (isoTimestamp: string): Date => new Date(isoTimestamp);

const reportWithoutFlag = (updatedAt: Date): Comment => ({
  author: 'test-user',
  content: 'From: :robot: developer (model)\n```json\n{"nextStep": null}\n```',
  createdAt: updatedAt,
  updatedAt,
});

const reportWithFlagTrue = (updatedAt: Date): Comment => ({
  author: 'test-user',
  content:
    'From: :robot: developer (model)\n```json\n{"needOwnerConfirmationOrApproval": true, "nextStep": null}\n```',
  createdAt: updatedAt,
  updatedAt,
});

const humanReply = (author: string, updatedAt: Date): Comment => ({
  author,
  content: 'Please proceed as planned.',
  createdAt: updatedAt,
  updatedAt,
});

const editedReportWithFlagTrue = (
  createdAt: Date,
  updatedAt: Date,
): Comment => ({
  author: 'test-user',
  content:
    'From: :robot: developer (model)\n```json\n{"needOwnerConfirmationOrApproval": true, "nextStep": null}\n```',
  createdAt,
  updatedAt,
});

const editedHumanReply = (
  author: string,
  createdAt: Date,
  updatedAt: Date,
): Comment => ({
  author,
  content: 'Please proceed as planned.',
  createdAt,
  updatedAt,
});

const machineGeneratedByTrustedAuthor = (updatedAt: Date): Comment => ({
  author: 'test-user',
  content: 'Auto Status Check: REJECTED\n- NO_REPORT_FROM_AGENT_BOT',
  createdAt: updatedAt,
  updatedAt,
});

describe('issueHasUnansweredOwnerConfirmationRequest', () => {
  it('returns the expected boolean for every combination of last-report content and reply timing', () => {
    const cases: {
      description: string;
      comments: Comment[];
      expected: boolean;
    }[] = [
      {
        description: 'no comments at all (P=none, R=no-reply-at-all)',
        comments: [],
        expected: false,
      },
      {
        description:
          'only a human reply with no report anywhere (P=none, R=reply-after-P)',
        comments: [humanReply('the-owner', at('2026-09-25T08:00:00Z'))],
        expected: false,
      },
      {
        description:
          'only an early human comment with no report anywhere (P=none, R=reply-only-before-P)',
        comments: [humanReply('the-owner', at('2026-09-25T07:00:00Z'))],
        expected: false,
      },
      {
        description:
          'a report without the flag and no reply (P=report-without-flag, R=no-reply-at-all)',
        comments: [reportWithoutFlag(at('2026-09-25T08:00:00Z'))],
        expected: false,
      },
      {
        description:
          'a report without the flag followed by a reply (P=report-without-flag, R=reply-after-P)',
        comments: [
          reportWithoutFlag(at('2026-09-25T08:00:00Z')),
          humanReply('the-owner', at('2026-09-25T09:00:00Z')),
        ],
        expected: false,
      },
      {
        description:
          'a report without the flag preceded by a reply (P=report-without-flag, R=reply-only-before-P)',
        comments: [
          humanReply('the-owner', at('2026-09-25T07:00:00Z')),
          reportWithoutFlag(at('2026-09-25T08:00:00Z')),
        ],
        expected: false,
      },
      {
        description:
          'a report with the flag true and no reply at all (P=report-with-flag-true, R=no-reply-at-all)',
        comments: [reportWithFlagTrue(at('2026-09-25T08:00:00Z'))],
        expected: true,
      },
      {
        description:
          'a report with the flag true followed by a human reply (P=report-with-flag-true, R=reply-after-P)',
        comments: [
          reportWithFlagTrue(at('2026-09-25T08:00:00Z')),
          humanReply('the-owner', at('2026-09-25T09:00:00Z')),
        ],
        expected: false,
      },
      {
        description:
          'a report with the flag true preceded only by a human reply, none after (P=report-with-flag-true, R=reply-only-before-P, regression guard)',
        comments: [
          humanReply('the-owner', at('2026-09-25T07:00:00Z')),
          reportWithFlagTrue(at('2026-09-25T08:00:00Z')),
        ],
        expected: true,
      },
      {
        description:
          'a report with the flag true followed by a machine-generated comment from a trusted author, which does not count as a human reply',
        comments: [
          reportWithFlagTrue(at('2026-09-25T08:00:00Z')),
          machineGeneratedByTrustedAuthor(at('2026-09-25T09:00:00Z')),
        ],
        expected: true,
      },
      {
        description:
          'a reply updated at exactly the same instant as the report does not count as strictly later',
        comments: [
          reportWithFlagTrue(at('2026-09-25T08:00:00Z')),
          humanReply('the-owner', at('2026-09-25T08:00:00Z')),
        ],
        expected: true,
      },
      {
        description:
          'the predicate picks the last trusted agent report by array order, not by re-sorting by date',
        comments: [
          reportWithFlagTrue(at('2026-09-25T10:00:00Z')),
          reportWithoutFlag(at('2026-09-25T08:00:00Z')),
        ],
        expected: false,
      },
      {
        description:
          'a report from an untrusted author is ignored by the lookup, so no report exists',
        comments: [
          {
            author: 'stranger',
            content:
              'From: :robot: developer (model)\n```json\n{"needOwnerConfirmationOrApproval": true}\n```',
            createdAt: at('2026-09-25T08:00:00Z'),
            updatedAt: at('2026-09-25T08:00:00Z'),
          },
        ],
        expected: false,
      },
    ];

    cases.forEach(({ comments, expected }) => {
      expect(
        issueHasUnansweredOwnerConfirmationRequest(comments, trustTestUser),
      ).toBe(expected);
    });
  });

  it('keeps judging a human comment edited after the report as a reply and a human comment older than an edited report as no reply', () => {
    const cases: {
      description: string;
      comments: Comment[];
      expected: boolean;
    }[] = [
      {
        description:
          'a human comment created before the report and edited after it counts as a reply',
        comments: [
          editedHumanReply(
            'the-owner',
            at('2026-09-25T07:00:00Z'),
            at('2026-09-25T09:00:00Z'),
          ),
          reportWithFlagTrue(at('2026-09-25T08:00:00Z')),
        ],
        expected: false,
      },
      {
        description:
          'a human comment older than the creation of a later edited report does not count as a reply',
        comments: [
          humanReply('the-owner', at('2026-09-25T07:00:00Z')),
          editedReportWithFlagTrue(
            at('2026-09-25T08:00:00Z'),
            at('2026-09-25T09:00:00Z'),
          ),
        ],
        expected: true,
      },
      {
        description:
          'a human comment posted after both the creation and the edit of the report counts as a reply',
        comments: [
          editedReportWithFlagTrue(
            at('2026-09-25T07:00:00Z'),
            at('2026-09-25T08:00:00Z'),
          ),
          humanReply('the-owner', at('2026-09-25T09:00:00Z')),
        ],
        expected: false,
      },
    ];

    cases.forEach(({ comments, expected }) => {
      expect(
        issueHasUnansweredOwnerConfirmationRequest(comments, trustTestUser),
      ).toBe(expected);
    });
  });

  it('counts a human comment posted after the report was created as a reply even when the report was edited after that comment', () => {
    const cases: {
      description: string;
      comments: Comment[];
      expected: boolean;
    }[] = [
      {
        description:
          'the owner question from the trusted login sits between the creation and the edit of the report',
        comments: [
          editedReportWithFlagTrue(
            at('2026-10-02T08:40:52Z'),
            at('2026-10-03T06:25:32Z'),
          ),
          humanReply('test-user', at('2026-10-03T01:15:07Z')),
        ],
        expected: false,
      },
      {
        description:
          'a reply from an untrusted author sits between the creation and the edit of the report',
        comments: [
          editedReportWithFlagTrue(
            at('2026-10-02T08:40:52Z'),
            at('2026-10-03T06:25:32Z'),
          ),
          humanReply('the-owner', at('2026-10-03T01:15:07Z')),
        ],
        expected: false,
      },
    ];

    cases.forEach(({ comments, expected }) => {
      expect(
        issueHasUnansweredOwnerConfirmationRequest(comments, trustTestUser),
      ).toBe(expected);
    });
  });
});
