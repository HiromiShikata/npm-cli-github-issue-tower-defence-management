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
  if (comments.length === 0) {
    return null;
  }
  return extractExecutiveSummary(comments[comments.length - 1].body);
};
