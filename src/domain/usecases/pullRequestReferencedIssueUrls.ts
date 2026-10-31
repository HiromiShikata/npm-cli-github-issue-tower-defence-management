import type { Issue } from '../entities/Issue';

export const pullRequestReferencedIssueUrls = (
  issue: Pick<
    Issue,
    'closingIssueReferenceUrls' | 'plainCrossRepoIssueReferenceUrls'
  >,
): string[] =>
  Array.from(
    new Set([
      ...issue.closingIssueReferenceUrls,
      ...(issue.plainCrossRepoIssueReferenceUrls ?? []),
    ]),
  );
