import { StoryGateIssueComment } from '../adapter-interfaces/StoryGateIssueRepository';
import {
  hasFoldMarkerLine,
  isAgentReportBody,
  issueCommentsAfterLatestFold,
  issueCommentsSplitByAuthorKind,
} from './issueCommentSplit';

const commentsFrom = (bodies: string[]): StoryGateIssueComment[] =>
  bodies.map((body, index) => ({
    url: `https://github.com/owner/repo/issues/1#issuecomment-${index + 1}`,
    createdAt: new Date(Date.UTC(2026, 8, 1, 0, index)).toISOString(),
    body,
  }));

const agentBody = (text: string): string =>
  `From: :robot: developer-agent (model)\n${text}`;

const numbered = (prefix: string, count: number): string[] =>
  Array.from(
    { length: count },
    (_, index) => `${prefix}-${String(index + 1).padStart(3, '0')}`,
  );

describe('issueCommentSplit', () => {
  it.each([
    { body: 'From: :robot: developer-agent (model)\nDone', expected: true },
    { body: 'Please check this', expected: false },
    { body: ' From: :robot: developer-agent', expected: false },
  ])('isAgentReportBody is $expected for $body', ({ body, expected }) => {
    expect(isAgentReportBody(body)).toBe(expected);
  });

  it.each([
    { body: 'From: :robot: agent\n## Fold\nsummary', expected: true },
    { body: 'From: :robot: agent\r\n## Fold\r\nsummary', expected: true },
    { body: '## Fold', expected: true },
    { body: 'From: :robot: agent\n## Fold notes', expected: false },
    { body: 'From: :robot: agent\n## Folded', expected: false },
    { body: 'From: :robot: agent\n ## Fold', expected: false },
    { body: 'Mentions ## Fold inline', expected: false },
  ])('hasFoldMarkerLine is $expected for $body', ({ body, expected }) => {
    expect(hasFoldMarkerLine(body)).toBe(expected);
  });

  it.each([
    {
      name: 'no fold comment keeps every comment',
      bodies: ['first', agentBody('second')],
      expected: ['first', agentBody('second')],
    },
    {
      name: 'comments after the latest fold only',
      bodies: [
        'before',
        agentBody('## Fold\nold summary'),
        'middle',
        agentBody('## Fold\nnew summary'),
        'after',
        agentBody('after agent'),
      ],
      expected: ['after', agentBody('after agent')],
    },
    {
      name: 'a fold comment as the newest comment',
      bodies: ['before', agentBody('## Fold\nsummary')],
      expected: [],
    },
    {
      name: 'a heading that is not exactly the fold line',
      bodies: ['before', agentBody('## Fold notes'), 'after'],
      expected: ['before', agentBody('## Fold notes'), 'after'],
    },
  ])('issueCommentsAfterLatestFold keeps $name', ({ bodies, expected }) => {
    expect(
      issueCommentsAfterLatestFold(commentsFrom(bodies)).map(
        (comment) => comment.body,
      ),
    ).toEqual(expected);
  });

  it('keeps every owner comment and the newest 40 agent comments newest first', () => {
    const ownerBodies = numbered('owner-comment', 50);
    const agentBodies = numbered('agent-comment', 45).map(agentBody);
    const comments = commentsFrom([
      ...ownerBodies.slice(0, 25),
      ...agentBodies,
      ...ownerBodies.slice(25),
    ]);

    const split = issueCommentsSplitByAuthorKind(comments);

    expect(split.ownerComments.map((comment) => comment.body)).toEqual(
      ownerBodies,
    );
    expect(split.ownerCommentCount).toBe(50);
    expect(
      split.agentCommentsNewestFirst.map((comment) => comment.body),
    ).toEqual([...agentBodies].reverse().slice(0, 40));
    expect(split.agentCommentCountRead).toBe(40);
    expect(split.agentCommentCountTotal).toBe(45);
  });

  it('reads every agent comment when there are fewer than 40', () => {
    const comments = commentsFrom([
      'owner question',
      agentBody('first report'),
      agentBody('second report'),
    ]);

    const split = issueCommentsSplitByAuthorKind(comments);

    expect(split).toEqual({
      ownerComments: [comments[0]],
      agentCommentsNewestFirst: [comments[2], comments[1]],
      ownerCommentCount: 1,
      agentCommentCountRead: 2,
      agentCommentCountTotal: 2,
    });
  });
});
