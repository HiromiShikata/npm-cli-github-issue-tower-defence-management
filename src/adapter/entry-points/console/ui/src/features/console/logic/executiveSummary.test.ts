import {
  extractExecutiveSummary,
  extractExecutiveSummaryFromComments,
} from './executiveSummary';
import type { ConsoleComment } from './types';

const makeComment = (body: string): ConsoleComment => ({
  author: 'bot',
  body,
  createdAt: '2026-08-31T00:00:00.000Z',
});

const AGENT_COMMENT = `From: :robot: tdpm-workflow-improver (claude-sonnet-4-6)
\`\`\`json
{ "nextStepAgent": "pr-reviewer" }
\`\`\`
## Loaded skills
general-development-policy, markdown-writing-rules

## PR URL
https://github.com/HiromiShikata/npm-cli/pull/123

## セルフチェック
- 🟢 このソースコードが本番環境に反映されることで本番環境を破壊する可能性がある

## エグゼクティブサマリ / Executive Summary
タスクのゴール: Awaiting Quality Check 一覧にボタンと要約を表示する
実施内容: ConsoleItemList と ConsoleItemSummary を拡張した
残りの作業と判断: レビュー待ち
From: :robot: tdpm-workflow-improver (claude-sonnet-4-6)`;

describe('extractExecutiveSummary', () => {
  it('returns null when the comment has no executive summary heading', () => {
    expect(
      extractExecutiveSummary('Some comment without a summary.'),
    ).toBeNull();
  });

  it('extracts content between the heading and the From line', () => {
    const result = extractExecutiveSummary(AGENT_COMMENT);
    expect(result).toBe(
      'タスクのゴール: Awaiting Quality Check 一覧にボタンと要約を表示する\n実施内容: ConsoleItemList と ConsoleItemSummary を拡張した\n残りの作業と判断: レビュー待ち',
    );
  });

  it('returns null when the summary section exists but its body is empty', () => {
    const body = `## エグゼクティブサマリ / Executive Summary\nFrom: :robot: agent (model)`;
    expect(extractExecutiveSummary(body)).toBeNull();
  });

  it('handles the heading without the English subtitle', () => {
    const body = `## エグゼクティブサマリ\nタスクのゴール: some goal\nFrom: :robot: agent (model)`;
    const result = extractExecutiveSummary(body);
    expect(result).toBe('タスクのゴール: some goal');
  });

  it('returns content to end of body when From line is absent', () => {
    const body = `## エグゼクティブサマリ / Executive Summary\nタスクのゴール: partial summary`;
    expect(extractExecutiveSummary(body)).toBe(
      'タスクのゴール: partial summary',
    );
  });
});

describe('extractExecutiveSummaryFromComments', () => {
  it('returns null for an empty comments array', () => {
    expect(extractExecutiveSummaryFromComments([])).toBeNull();
  });

  it('extracts the summary from the last comment', () => {
    const comments: ConsoleComment[] = [
      makeComment('First comment, no summary.'),
      makeComment(AGENT_COMMENT),
    ];
    const result = extractExecutiveSummaryFromComments(comments);
    expect(result).toContain('タスクのゴール:');
  });

  it('returns null when the last comment has no executive summary heading', () => {
    const comments: ConsoleComment[] = [
      makeComment(AGENT_COMMENT),
      makeComment('A follow-up comment without a summary.'),
    ];
    expect(extractExecutiveSummaryFromComments(comments)).toBeNull();
  });
});
