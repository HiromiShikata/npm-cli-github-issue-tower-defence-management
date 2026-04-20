import ky, { HTTPError } from 'ky';
import { BaseGitHubRepository } from '../BaseGitHubRepository';
import { Issue } from '../../../domain/entities/Issue';
import { IssueRepository } from '../../../domain/usecases/adapter-interfaces/IssueRepository';
import { Member } from '../../../domain/entities/Member';

export class RestIssueRepository
  extends BaseGitHubRepository
  implements Pick<IssueRepository, 'updateAssigneeList' | 'removeLabel'>
{
  createComment = async (issueUrl: string, comment: string) => {
    const { owner, repo, issueNumber } = this.extractIssueFromUrl(issueUrl);
    await ky.post(
      `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
      {
        json: { body: comment },
        headers: { Authorization: `token ${this.ghToken}` },
      },
    );
  };
  createNewIssue = async (
    owner: string,
    repo: string,
    title: string,
    body: string,
    assignees: string[],
    labels: string[],
  ): Promise<number> => {
    const response = await ky
      .post(`https://api.github.com/repos/${owner}/${repo}/issues`, {
        json: { title, body, assignees, labels },
        headers: { Authorization: `token ${this.ghToken}` },
      })
      .json<{ number: number }>();
    return response.number;
  };
  getIssue = async (
    issueUrl: string,
  ): Promise<{
    labels: string[];
    assignees: string[];
    title: string;
    body: string;
    number: number;
    state: string;
    created_at: string;
  }> => {
    const { owner, repo, issueNumber } = this.extractIssueFromUrl(issueUrl);
    const response = await ky
      .get(
        `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`,
        {
          headers: {
            Authorization: `token ${this.ghToken}`,
            Accept: 'application/vnd.github.v3+json',
          },
        },
      )
      .json<{
        labels: Array<{ name: string }>;
        assignees: Array<{ login: string }>;
        title: string;
        body: string;
        number: number;
        state: string;
        created_at: string;
      }>();
    return {
      labels: response.labels.map((label) => label.name),
      assignees: response.assignees.map((assignee) => assignee.login),
      title: response.title,
      body: response.body,
      number: response.number,
      state: response.state,
      created_at: response.created_at,
    };
  };
  updateIssue = async (issue: Issue) => {
    await ky.patch(
      `https://api.github.com/repos/${issue.org}/${issue.repo}/issues/${issue.number}`,
      {
        json: {
          title: issue.title,
          body: issue.body,
          assignees: issue.assignees,
          labels: issue.labels,
          state: issue.state,
        },
        headers: { Authorization: `token ${this.ghToken}` },
      },
    );
  };

  updateLabels = async (
    issue: Issue,
    labels: Issue['labels'],
  ): Promise<void> => {
    await ky.put(
      `https://api.github.com/repos/${issue.org}/${issue.repo}/issues/${issue.number}/labels`,
      {
        json: { labels },
        headers: {
          Authorization: `token ${this.ghToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      },
    );
    return;
  };

  removeLabel = async (issue: Issue, label: string): Promise<void> => {
    try {
      await ky.delete(
        `https://api.github.com/repos/${issue.org}/${issue.repo}/issues/${issue.number}/labels/${encodeURIComponent(label)}`,
        {
          headers: {
            Authorization: `token ${this.ghToken}`,
            Accept: 'application/vnd.github.v3+json',
          },
        },
      );
    } catch (e) {
      if (e instanceof HTTPError && e.response.status === 404) {
        return;
      }
      throw e;
    }
  };

  updateAssigneeList = async (
    issue: Issue,
    assigneeList: Member['name'][],
  ): Promise<void> => {
    await ky.patch(
      `https://api.github.com/repos/${issue.org}/${issue.repo}/issues/${issue.number}`,
      {
        json: { assignees: assigneeList },
        headers: { Authorization: `token ${this.ghToken}` },
      },
    );
  };
  getIssuesByLabel = async (
    owner: string,
    repo: string,
    label: string,
  ): Promise<
    {
      html_url: string;
      title: string;
      number: number;
      body: string;
      labels: string[];
      assignees: string[];
      state: string;
      created_at: string;
    }[]
  > => {
    const results: {
      html_url: string;
      title: string;
      number: number;
      body: string;
      labels: string[];
      assignees: string[];
      state: string;
      created_at: string;
    }[] = [];
    let page = 1;
    let hasMore = true;
    while (hasMore) {
      const response = await ky
        .get(
          `https://api.github.com/repos/${owner}/${repo}/issues?labels=${encodeURIComponent(label)}&state=open&per_page=100&page=${page}`,
          {
            headers: {
              Authorization: `token ${this.ghToken}`,
              Accept: 'application/vnd.github.v3+json',
            },
          },
        )
        .json<
          {
            html_url: string;
            title: string;
            number: number;
            body: string;
            labels: Array<{ name: string }>;
            assignees: Array<{ login: string }>;
            state: string;
            created_at: string;
          }[]
        >();
      results.push(
        ...response.map((item) => ({
          html_url: item.html_url,
          title: item.title,
          number: item.number,
          body: item.body,
          labels: item.labels.map((l) => l.name),
          assignees: item.assignees.map((a) => a.login),
          state: item.state,
          created_at: item.created_at,
        })),
      );
      hasMore = response.length === 100;
      page++;
    }
    return results;
  };
}
