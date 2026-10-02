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
});
