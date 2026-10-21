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
  'research',
  'リサーチ',
];

const CALENDAR_TEMPLATE_LINK_PATTERN =
  /\[[^\]]*template[^\]]*\]\(https:\/\/calendar\.google\.com\//i;

const isAutomatedReportBody = (body: string): boolean =>
  AUTOMATED_REPORT_FIRST_LINE_PREFIX.test(
    normalizeReportBody(body).split('\n')[0],
  );

const containsInvestigationTaskKeyword = (text: string): boolean => {
  const lowerCaseText = text.toLowerCase();
  return INVESTIGATION_TASK_KEYWORDS.some((keyword) =>
    lowerCaseText.includes(keyword.toLowerCase()),
  );
};

export const isHumanAuthoredInvestigationTaskCloseOverride = (args: {
  title: string;
  body: string;
}): boolean =>
  !isAutomatedReportBody(args.body) &&
  !args.body.includes('[edit this template](') &&
  !CALENDAR_TEMPLATE_LINK_PATTERN.test(args.body) &&
  (containsInvestigationTaskKeyword(args.title) ||
    containsInvestigationTaskKeyword(args.body));
