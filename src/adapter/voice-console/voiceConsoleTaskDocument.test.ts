import { extractLatestReportSummary } from './voiceConsoleTaskDocument';

type Comment = { author: string; body: string; createdAt: string };

const olderRobotComment: Comment = {
  author: 'github-actions',
  body: [
    'From: :robot: developer (model-a)',
    '種別: 進捗',
    '古い要約',
    '- 回答: 古い',
  ].join('\n'),
  createdAt: '2026-11-20T01:00:00Z',
};

const latestRobotComment: Comment = {
  author: 'github-actions',
  body: [
    'From: :robot: developer (model-b)',
    '## 概要',
    '処理を進めました。',
    '種別: 判断',
    '判断が必要な点は次の通りです。',
    '- 判断A: 既存の列を残す',
    '- 25%案: 一部だけ反映する',
    '- 50%案: 全件反映する',
    '- 回答: 番号で返信してください',
    '次の行は要約に含まれません',
    '## 詳細',
    '本文',
  ].join('\n'),
  createdAt: '2026-11-21T01:00:00Z',
};

const humanCommentAfterRobot: Comment = {
  author: 'HiromiShikata',
  body: ['種別: 人間の書き込み', '- 回答: 無視されるべき'].join('\n'),
  createdAt: '2026-11-21T02:00:00Z',
};

describe('extractLatestReportSummary', () => {
  it('returns the summary block of the latest robot comment for each comment list', () => {
    const cases = [
      {
        name: 'ends at the 回答 line and ignores a human comment after it',
        comments: [
          olderRobotComment,
          latestRobotComment,
          humanCommentAfterRobot,
        ],
        expected: [
          '種別: 判断',
          '判断が必要な点は次の通りです。',
          '- 判断A: 既存の列を残す',
          '- 25%案: 一部だけ反映する',
          '- 50%案: 全件反映する',
          '- 回答: 番号で返信してください',
        ].join('\n'),
      },
      {
        name: 'without a 回答 line ends before the next ## heading and drops trailing empty lines',
        comments: [
          {
            author: 'github-actions',
            body: [
              'From: :robot: developer (model-c)',
              '種別: 進捗',
              '- 25%案: 一部',
              '- 50%案: 全件',
              '',
              '## 次',
              '本文',
            ].join('\n'),
            createdAt: '2026-11-22T01:00:00Z',
          },
        ],
        expected: ['種別: 進捗', '- 25%案: 一部', '- 50%案: 全件'].join('\n'),
      },
      {
        name: 'without a 回答 line or a ## heading ends at the end of the body',
        comments: [
          {
            author: 'github-actions',
            body: [
              'From: :robot: developer (model-d)',
              '種別: 進捗',
              '最後の行',
            ].join('\n'),
            createdAt: '2026-11-22T01:00:00Z',
          },
        ],
        expected: ['種別: 進捗', '最後の行'].join('\n'),
      },
      {
        name: 'a robot comment without a 種別 line gives null',
        comments: [
          {
            author: 'github-actions',
            body: ['From: :robot: developer (model-e)', '概要だけの本文'].join(
              '\n',
            ),
            createdAt: '2026-11-22T01:00:00Z',
          },
        ],
        expected: null,
      },
      {
        name: 'no robot comment gives null',
        comments: [humanCommentAfterRobot],
        expected: null,
      },
      {
        name: 'no comment gives null',
        comments: [],
        expected: null,
      },
    ];

    for (const testCase of cases) {
      expect({
        name: testCase.name,
        result: extractLatestReportSummary(testCase.comments),
      }).toEqual({ name: testCase.name, result: testCase.expected });
    }
  });
});
