import { normalizeReportBody } from './normalizeReportBody';

const AUTOMATED_REPORT_FIRST_LINE_PREFIX = /^From: :robot: \S+/;

const INVESTIGATION_TASK_KEYWORDS = [
  '調査',
  '報告',
  'レポート',
  '分析',
  '評価',
  '調べ',
  '教えてください',
  '確認',
  '集計',
  '点検',
  '監査',
  'メトリクス',
  '列挙',
];

const isAutomatedReportBody = (body: string): boolean =>
  AUTOMATED_REPORT_FIRST_LINE_PREFIX.test(
    normalizeReportBody(body).split('\n')[0],
  );

const containsInvestigationTaskKeyword = (text: string): boolean =>
  INVESTIGATION_TASK_KEYWORDS.some((keyword) => text.includes(keyword));

export const isHumanAuthoredInvestigationTaskCloseOverride = (args: {
  title: string;
  body: string;
}): boolean =>
  !isAutomatedReportBody(args.body) &&
  (containsInvestigationTaskKeyword(args.title) ||
    containsInvestigationTaskKeyword(args.body));
