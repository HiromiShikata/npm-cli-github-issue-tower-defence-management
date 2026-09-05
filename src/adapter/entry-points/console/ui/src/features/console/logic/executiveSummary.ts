import type { ConsoleComment } from './types';

const EXECUTIVE_SUMMARY_HEADING =
  /##\s+エグゼクティブサマリ(?:\s*\/\s*Executive\s+Summary)?\s*\n/i;
const FROM_LINE = /^From:\s+:robot:/m;
const NEXT_SECTION_HEADING = /^##\s/m;

export const extractExecutiveSummary = (body: string): string | null => {
  const headingMatch = EXECUTIVE_SUMMARY_HEADING.exec(body);
  if (headingMatch === null) {
    return null;
  }
  const afterHeading = body.slice(headingMatch.index + headingMatch[0].length);
  const fromMatch = FROM_LINE.exec(afterHeading);
  const nextHeadingMatch = NEXT_SECTION_HEADING.exec(afterHeading);

  let endIndex = afterHeading.length;
  if (fromMatch !== null) endIndex = Math.min(endIndex, fromMatch.index);
  if (nextHeadingMatch !== null)
    endIndex = Math.min(endIndex, nextHeadingMatch.index);

  const trimmed = afterHeading.slice(0, endIndex).trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const extractLastCommentDisplayText = (
  comments: ConsoleComment[],
): string | null => {
  if (comments.length === 0) {
    return null;
  }
  const lastComment = comments[comments.length - 1];
  const summary = extractExecutiveSummary(lastComment.body);
  if (summary !== null) {
    return summary;
  }
  const trimmed = lastComment.body.trim();
  return trimmed.length > 0 ? trimmed : null;
};
