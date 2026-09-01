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
  ): Promise<WorkflowRun[]> => {
    const searchParams: Record<string, string> = { per_page: '100' };
    if (branch) searchParams['branch'] = branch;

    let response: WorkflowRunsResponse;
    try {
      response = await ky
        .get(
          `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowFile}/runs`,
          {
            searchParams,
            headers: { Authorization: `token ${this.getToken(owner)}` },
          },
        )
        .json<WorkflowRunsResponse>();
    } catch (error) {
      console.error(
        `[WARN] Failed to fetch workflow runs for ${owner}/${repo}/${workflowFile}: ${String(error)}`,
      );
      return [];
    }

    return response.workflow_runs
      .filter((run) => new Date(run.created_at) >= since)
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
  ): Promise<MergedPullRequest[]> => {
    const searchParams: Record<string, string> = {
      state: 'closed',
      per_page: '100',
    };
    if (baseBranch) searchParams['base'] = baseBranch;

    let prs: PullRequestResponse[];
    try {
      prs = await ky
        .get(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
          searchParams,
          headers: { Authorization: `token ${this.getToken(owner)}` },
        })
        .json<PullRequestResponse[]>();
    } catch (error) {
      console.error(
        `[WARN] Failed to fetch merged PRs for ${owner}/${repo}: ${String(error)}`,
      );
      return [];
    }

    const isMergedInWindow = (pr: PullRequestResponse): pr is MergedPullRequestResponse =>
      pr.merged_at !== null && new Date(pr.merged_at) >= since;

    return prs
      .filter(isMergedInWindow)
      .map((pr) => ({
        mergedAt: new Date(pr.merged_at),
        createdAt: new Date(pr.created_at),
      }));
  };

  getClosedItemsByLabels = async (
    owner: string,
    repo: string,
    labels: string[],
    since: Date,
  ): Promise<ClosedItem[]> => {
    if (labels.length === 0) return [];

    let items: IssueResponse[];
    try {
      items = await ky
        .get(`https://api.github.com/repos/${owner}/${repo}/issues`, {
          searchParams: {
            state: 'closed',
            labels: labels.join(','),
            per_page: '100',
          },
          headers: { Authorization: `token ${this.getToken(owner)}` },
        })
        .json<IssueResponse[]>();
    } catch (error) {
      console.error(
        `[WARN] Failed to fetch closed items for ${owner}/${repo} labels=${labels.join(',')}: ${String(error)}`,
      );
      return [];
    }

    const isClosedInWindow = (item: IssueResponse): item is ClosedIssueResponse =>
      item.closed_at !== null && new Date(item.closed_at) >= since;

    return items
      .filter(isClosedInWindow)
      .map((item) => ({
        createdAt: new Date(item.created_at),
        closedAt: new Date(item.closed_at),
      }));
  };
}
