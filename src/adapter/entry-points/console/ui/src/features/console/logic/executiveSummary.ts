import type { ConsoleComment } from './types';

const EXECUTIVE_SUMMARY_HEADING =
  /##\s+エグゼクティブサマリ(?:\s*\/\s*Executive\s+Summary)?\s*\n/i;
const FROM_LINE = /^From:\s+:robot:/m;

export const extractExecutiveSummary = (body: string): string | null => {
  const headingMatch = EXECUTIVE_SUMMARY_HEADING.exec(body);
  if (headingMatch === null) {
    return null;
  }
  const afterHeading = body.slice(headingMatch.index + headingMatch[0].length);
  const fromMatch = FROM_LINE.exec(afterHeading);
  const content =
    fromMatch !== null ? afterHeading.slice(0, fromMatch.index) : afterHeading;
  const trimmed = content.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const extractExecutiveSummaryFromComments = (
  comments: ConsoleComment[],
): string | null => {
  for (let i = comments.length - 1; i >= 0; i--) {
    const summary = extractExecutiveSummary(comments[i].body);
    if (summary !== null) {
      return summary;
    }
  }
  return null;
};
