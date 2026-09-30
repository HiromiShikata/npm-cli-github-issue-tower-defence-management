import { isRecord } from '../isRecord';
import { githubIssueUrlsExtractInOrder } from './githubIssueReferenceParse';

export const SPECIFICATION_ABSENT_LINE = '承認済み仕様: なし';
const APPROVED_SPECIFICATION_LINE_PATTERN = /^承認済み仕様:\s*(\S+)\s*$/;
const FENCED_BLOCK_PATTERN = /```[^\n]*\n([\s\S]*?)```/g;

const bodyLines = (body: string): string[] =>
  body.split('\n').map((line) => line.replace(/\r$/, '').trim());

const fencedJsonObjects = (body: string): Record<string, unknown>[] =>
  [...body.matchAll(FENCED_BLOCK_PATTERN)].flatMap((match) => {
    try {
      const parsed: unknown = JSON.parse(match[1]);
      return isRecord(parsed) ? [parsed] : [];
    } catch {
      return [];
    }
  });

export const isSpecificationRoutingAlreadyPosted = (
  commentBody: string,
  specificationAgentName: string,
): boolean =>
  bodyLines(commentBody).includes(SPECIFICATION_ABSENT_LINE) &&
  fencedJsonObjects(commentBody).some(
    (json) => json.nextStepAgent === specificationAgentName,
  );

export const approvedSpecificationUrlsExtract = (
  commentBody: string,
): string[] =>
  bodyLines(commentBody).flatMap((line) => {
    const match = line.match(APPROVED_SPECIFICATION_LINE_PATTERN);
    return match ? githubIssueUrlsExtractInOrder(match[1]) : [];
  });
