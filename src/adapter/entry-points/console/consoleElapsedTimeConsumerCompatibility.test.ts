import { issueCommentsSplitByAuthorKind } from '../../../domain/usecases/storyGate/issueCommentSplit';

const elapsedMarker = '<!-- tdpm-console-elapsed-time -->';

describe('elapsed-only owner comments do not become owner replies', () => {
  test.each([
    {
      name: 'plain owner comment remains an owner comment',
      body: 'owner reply',
      ownerCommentCount: 1,
    },
    {
      name: 'owner comment with appended elapsed line remains an owner comment',
      body: `owner reply\n\nコンソールで開いてから 1分0秒 で「操作」を押しました${elapsedMarker}`,
      ownerCommentCount: 1,
    },
    {
      name: 'elapsed-only owner comment is not an owner reply',
      body: `コンソールで開いてから 1分0秒 で「操作」を押しました${elapsedMarker}`,
      ownerCommentCount: 0,
    },
  ])('$name', ({ body, ownerCommentCount }) => {
    const result = issueCommentsSplitByAuthorKind([
      {
        url: 'https://github.com/HiromiShikata/repo/issues/1#comment-1',
        createdAt: '2026-11-28T00:00:00Z',
        body,
      },
    ]);

    expect(result.ownerCommentCount).toBe(ownerCommentCount);
  });
});
