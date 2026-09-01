import { Issue } from '../entities/Issue';

export const buildRelatedOpenPrUrlsByIssueUrl = (
  issues: Issue[],
): Map<string, string[]> => {
  const openPrUrlsByIssueUrl = new Map<string, Set<string>>();
  for (const issue of issues) {
    if (!issue.isPr || issue.isClosed) {
      continue;
    }
    for (const referencedIssueUrl of issue.closingIssueReferenceUrls) {
      const existing = openPrUrlsByIssueUrl.get(referencedIssueUrl);
      if (existing) {
        existing.add(issue.url);
      } else {
        openPrUrlsByIssueUrl.set(referencedIssueUrl, new Set([issue.url]));
      }
    }
  }
  const result = new Map<string, string[]>();
  for (const [issueUrl, prUrls] of openPrUrlsByIssueUrl) {
    result.set(issueUrl, Array.from(prUrls));
  }
  return result;
};
