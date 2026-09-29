import {
  isAutoStatusCheckComment,
  findEffectiveLastComment,
} from './autoStatusCheckComments';
import { Comment } from '../entities/Comment';

const validReportContent =
  'From: :robot: developer (claude-sonnet-5)\n```json\n{"nextStep": null}\n```';

const buildComment = (overrides: Partial<Comment> = {}): Comment => ({
  author: 'bot',
  content: '',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  ...overrides,
});

describe('isAutoStatusCheckComment', () => {
  const cases: { description: string; content: string; expected: boolean }[] =
    [
      {
        description: 'an Auto Status Check: REJECTED comment',
        content: 'Auto Status Check: REJECTED\n- ORPHANED_PREPARATION',
        expected: true,
      },
      {
        description: 'an Auto Status Check: APPROVED comment',
        content: 'Auto Status Check: APPROVED',
        expected: true,
      },
      {
        description:
          'an Auto Status Check: STRAY_TODO_BY_AGENT_REVERTED comment',
        content: 'Auto Status Check: STRAY_TODO_BY_AGENT_REVERTED',
        expected: true,
      },
      {
        description: 'a valid agent report body',
        content: validReportContent,
        expected: false,
      },
      {
        description: 'a plain question from the issue author',
        content: 'Can you clarify the deadline for this?',
        expected: false,
      },
      {
        description: 'an empty string',
        content: '',
        expected: false,
      },
    ];

  it.each(cases)(
    'returns $expected for $description',
    ({ content, expected }) => {
      expect(isAutoStatusCheckComment(content)).toBe(expected);
    },
  );
});

describe('findEffectiveLastComment', () => {
  const validReport = buildComment({
    author: 'developer',
    content: validReportContent,
  });
  const autoStatusRejected1 = buildComment({
    content: 'Auto Status Check: REJECTED\n- SOME_REASON',
  });
  const autoStatusRejected2 = buildComment({
    content: 'Auto Status Check: REJECTED\n- SOME_REASON',
  });
  const humanQuestion = buildComment({
    author: 'issue-author',
    content: 'Can you clarify the deadline for this?',
  });

  const cases: {
    description: string;
    comments: Comment[];
    expected: Comment | null;
  }[] = [
    {
      description: 'the only comment when it is a valid report',
      comments: [validReport],
      expected: validReport,
    },
    {
      description:
        'the report when a single automation status comment trails it',
      comments: [validReport, autoStatusRejected1],
      expected: validReport,
    },
    {
      description:
        'the report when a trailing run of automation status comments follows it',
      comments: [validReport, autoStatusRejected1, autoStatusRejected2],
      expected: validReport,
    },
    {
      description:
        'the human question when it directly follows the report, because it is not an automation status comment so stripping stops there',
      comments: [validReport, humanQuestion],
      expected: humanQuestion,
    },
    {
      description: 'null for an empty comment list',
      comments: [],
      expected: null,
    },
    {
      description:
        'null when only automation status comments exist and no report was ever posted',
      comments: [autoStatusRejected1],
      expected: null,
    },
    {
      description:
        'the human question when an automation status comment in the middle is not trailing',
      comments: [validReport, autoStatusRejected1, humanQuestion],
      expected: humanQuestion,
    },
  ];

  it.each(cases)('returns $description', ({ comments, expected }) => {
    if (expected === null) {
      expect(findEffectiveLastComment(comments)).toBeNull();
    } else {
      expect(findEffectiveLastComment(comments)).toBe(expected);
    }
  });
});
