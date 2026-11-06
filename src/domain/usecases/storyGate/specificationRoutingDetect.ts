import { githubIssueUrlsExtractInOrder } from './githubIssueReferenceParse';

export const SPECIFICATION_ABSENT_LINE = '承認済み仕様: なし';
const APPROVED_SPECIFICATION_LINE_PATTERN = /^承認済み仕様:\s*(\S+)\s*$/;
const bodyLines = (body: string): string[] =>
  body.split('\n').map((line) => line.replace(/\r$/, '').trim());

export const approvedSpecificationUrlsExtract = (
  commentBody: string,
): string[] =>
  bodyLines(commentBody).flatMap((line) => {
    const match = line.match(APPROVED_SPECIFICATION_LINE_PATTERN);
    return match ? githubIssueUrlsExtractInOrder(match[1]) : [];
  });
