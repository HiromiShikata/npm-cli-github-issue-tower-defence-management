import {
  ClosedItem,
  MergedPullRequest,
  WorkflowRun,
} from '../../entities/DoraMetrics';

export interface GitHubActionsRepository {
  getWorkflowRuns: (
    owner: string,
    repo: string,
    workflowFile: string,
    branch: string | null,
    since: Date,
    until: Date,
  ) => Promise<WorkflowRun[]>;
  getMergedPullRequests: (
    owner: string,
    repo: string,
    baseBranch: string | null,
    since: Date,
    until: Date,
  ) => Promise<MergedPullRequest[]>;
  getClosedItemsByLabels: (
    owner: string,
    repo: string,
    labels: string[],
    since: Date,
    until: Date,
  ) => Promise<ClosedItem[]>;
}
