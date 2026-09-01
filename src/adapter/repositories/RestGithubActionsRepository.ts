import ky from 'ky';
import {
  ClosedItem,
  MergedPullRequest,
  WorkflowRun,
} from '../../domain/entities/DoraMetrics';
import { GithubActionsRepository } from '../../domain/usecases/adapter-interfaces/GithubActionsRepository';

type WorkflowRunResponse = {
  conclusion: string | null;
  created_at: string;
  updated_at: string;
};

type WorkflowRunsResponse = {
  workflow_runs: WorkflowRunResponse[];
};

type PullRequestResponse = {
  merged_at: string | null;
  created_at: string;
};

type MergedPullRequestResponse = {
  merged_at: string;
  created_at: string;
};

type IssueResponse = {
  created_at: string;
  closed_at: string | null;
};

type ClosedIssueResponse = {
  created_at: string;
  closed_at: string;
};

export class RestGithubActionsRepository implements GithubActionsRepository {
  constructor(
    private readonly defaultGhToken: string,
    private readonly tokenOverrides: Record<string, string> = {},
  ) {}

  private getToken = (owner: string): string => {
    return this.tokenOverrides[owner] ?? this.defaultGhToken;
  };

  getWorkflowRuns = async (
    owner: string,
    repo: string,
    workflowFile: string,
    branch: string | null,
    since: Date,
    until: Date,
  ): Promise<WorkflowRun[]> => {
    const searchParams: Record<string, string> = { per_page: '100' };
    if (branch) searchParams['branch'] = branch;

    const response = await ky
      .get(
        `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowFile}/runs`,
        {
          searchParams,
          headers: { Authorization: `token ${this.getToken(owner)}` },
        },
      )
      .json<WorkflowRunsResponse>();

    return response.workflow_runs
      .filter((run) => {
        const createdAt = new Date(run.created_at);
        return createdAt >= since && createdAt <= until;
      })
      .map((run) => ({
        conclusion:
          run.conclusion === 'success' || run.conclusion === 'failure'
            ? run.conclusion
            : null,
        createdAt: new Date(run.created_at),
        updatedAt: new Date(run.updated_at),
      }));
  };

  getMergedPullRequests = async (
    owner: string,
    repo: string,
    baseBranch: string | null,
    since: Date,
    until: Date,
  ): Promise<MergedPullRequest[]> => {
    const searchParams: Record<string, string> = {
      state: 'closed',
      per_page: '100',
    };
    if (baseBranch) searchParams['base'] = baseBranch;

    const prs = await ky
      .get(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
        searchParams,
        headers: { Authorization: `token ${this.getToken(owner)}` },
      })
      .json<PullRequestResponse[]>();

    const isMergedInWindow = (
      pr: PullRequestResponse,
    ): pr is MergedPullRequestResponse => {
      if (pr.merged_at === null) return false;
      const mergedAt = new Date(pr.merged_at);
      return mergedAt >= since && mergedAt <= until;
    };

    return prs.filter(isMergedInWindow).map((pr) => ({
      mergedAt: new Date(pr.merged_at),
      createdAt: new Date(pr.created_at),
    }));
  };

  getClosedItemsByLabels = async (
    owner: string,
    repo: string,
    labels: string[],
    since: Date,
    until: Date,
  ): Promise<ClosedItem[]> => {
    if (labels.length === 0) return [];

    const items = await ky
      .get(`https://api.github.com/repos/${owner}/${repo}/issues`, {
        searchParams: {
          state: 'closed',
          labels: labels.join(','),
          per_page: '100',
        },
        headers: { Authorization: `token ${this.getToken(owner)}` },
      })
      .json<IssueResponse[]>();

    const isClosedInWindow = (
      item: IssueResponse,
    ): item is ClosedIssueResponse => {
      if (item.closed_at === null) return false;
      const closedAt = new Date(item.closed_at);
      return closedAt >= since && closedAt <= until;
    };

    return items.filter(isClosedInWindow).map((item) => ({
      createdAt: new Date(item.created_at),
      closedAt: new Date(item.closed_at),
    }));
  };
}
