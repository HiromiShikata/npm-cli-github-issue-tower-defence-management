import { Issue } from '../entities/Issue';

export const issueSessionIsOnHold = (
  issue: Pick<Issue, 'dependedIssueUrls' | 'nextActionDate' | 'nextActionHour'>,
): boolean =>
  issue.dependedIssueUrls.length > 0 ||
  issue.nextActionDate !== null ||
  issue.nextActionHour !== null;
