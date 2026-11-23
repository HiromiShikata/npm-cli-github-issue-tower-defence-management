export type VoiceConsoleTaskComment = {
  author: string;
  body: string;
  createdAt: string;
};

const ROBOT_REPORT_PREFIX = 'From: :robot:';
const REPORT_KIND_PREFIX = '種別:';
const REPORT_ANSWER_LINE_PATTERN = /^- 回答:/;
const MARKDOWN_HEADING_PREFIX = '## ';

const isRobotComment = (comment: VoiceConsoleTaskComment): boolean =>
  comment.body.startsWith(ROBOT_REPORT_PREFIX);

const findLatestRobotComment = (
  comments: VoiceConsoleTaskComment[],
): VoiceConsoleTaskComment | null => {
  let latest: VoiceConsoleTaskComment | null = null;
  for (const comment of comments) {
    if (!isRobotComment(comment)) {
      continue;
    }
    if (
      latest === null ||
      Date.parse(comment.createdAt) >= Date.parse(latest.createdAt)
    ) {
      latest = comment;
    }
  }
  return latest;
};

const extractSummaryLines = (lines: string[]): string[] | null => {
  const kindIndex = lines.findIndex((line) =>
    line.startsWith(REPORT_KIND_PREFIX),
  );
  if (kindIndex === -1) {
    return null;
  }
  const collected: string[] = [];
  for (const line of lines.slice(kindIndex)) {
    if (REPORT_ANSWER_LINE_PATTERN.test(line)) {
      collected.push(line);
      break;
    }
    if (line.startsWith(MARKDOWN_HEADING_PREFIX)) {
      break;
    }
    collected.push(line);
  }
  while (collected.length > 0 && collected[collected.length - 1] === '') {
    collected.pop();
  }
  return collected;
};

export const extractLatestReportSummary = (
  comments: VoiceConsoleTaskComment[],
): string | null => {
  const latest = findLatestRobotComment(comments);
  if (latest === null) {
    return null;
  }
  const summaryLines = extractSummaryLines(latest.body.split('\n'));
  return summaryLines === null ? null : summaryLines.join('\n');
};
