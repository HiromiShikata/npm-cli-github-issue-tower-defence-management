import type { Issue } from '../../entities/Issue';

export interface IssueLatestSessionBranchRepository {
  findBranchNameByIssue: (
    issue: Pick<Issue, 'org' | 'repo' | 'number'>,
  ) => Promise<string | null>;
}
