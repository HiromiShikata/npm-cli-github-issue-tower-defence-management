import { Issue } from '../entities/Issue';

const sanitizeSystemdUnitNameCharacters = (rawName: string): string =>
  rawName.replace(/[^a-zA-Z0-9._-]/g, '-');

export const workerScopeUnitNamePrefix = (
  org: Issue['org'],
  repo: Issue['repo'],
  issueNumber: Issue['number'],
): string =>
  sanitizeSystemdUnitNameCharacters(`aw-${org}-${repo}-${issueNumber}-`);

const WORKER_SCOPE_PID_SUFFIX_PATTERN = /^\d+\.scope$/;

export const resolveIssueForWorkerScopeUnitName = (
  scopeUnitName: string,
  issues: Issue[],
): Issue | null => {
  let matchedIssue: Issue | null = null;
  let matchedPrefixLength = -1;
  for (const issue of issues) {
    const prefix = workerScopeUnitNamePrefix(
      issue.org,
      issue.repo,
      issue.number,
    );
    if (!scopeUnitName.startsWith(prefix)) {
      continue;
    }
    const pidSuffix = scopeUnitName.slice(prefix.length);
    if (!WORKER_SCOPE_PID_SUFFIX_PATTERN.test(pidSuffix)) {
      continue;
    }
    if (prefix.length > matchedPrefixLength) {
      matchedIssue = issue;
      matchedPrefixLength = prefix.length;
    }
  }
  return matchedIssue;
};
