import ky, { HTTPError } from 'ky';
import { BaseGitHubRepository } from '../BaseGitHubRepository';
import { Issue } from '../../../domain/entities/Issue';
import { IssueRepository } from '../../../domain/usecases/adapter-interfaces/IssueRepository';
import { Member } from '../../../domain/entities/Member';
import { SearchedIssue } from '../../../domain/entities/SearchedIssue';

type SearchIssuesResponseItem = {
  html_url: string;
  state: string;
  user: { login: string } | null;
  assignees: { login: string }[];
  pull_request?: { merged_at: string | null } | null;
};

type SearchIssuesResponse = {
  items: SearchIssuesResponseItem[];
};

export class RestIssueRepository
  extends BaseGitHubRepository
  implements
    Pick<IssueRepository, 'updateAssigneeList' | 'removeLabel' | 'searchIssues'>
{
  createComment = async (
    issueUrl: string,
    comment: string,
  ): Promise<{
    author: string;
    body: string;
    createdAt: Date;
    url: string | null;
  }> => {
    const { owner, repo, issueNumber } = this.extractIssueFromUrl(issueUrl);
    const response = await ky
      .post(
        `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
        {
          json: { body: comment },
          headers: { Authorization: `token ${this.ghToken}` },
        },
      )
      .json<{
        user: { login: string } | null;
        body: string;
        created_at: string;
        html_url: string;
      }>();
    return {
      author: response.user?.login ?? '',
      body: response.body,
      createdAt: new Date(response.created_at),
      url: response.html_url,
    };
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

  updateIssueBody = async (
    issue: Pick<Issue, 'org' | 'repo' | 'number'>,
    body: string,
  ): Promise<void> => {
    await ky.patch(
      `https://api.github.com/repos/${issue.org}/${issue.repo}/issues/${issue.number}`,
      {
        json: { body },
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

  getOrCreateLabel = async (
    org: string,
    repo: string,
    labelName: string,
  ): Promise<void> => {
    try {
      await ky.get(
        `https://api.github.com/repos/${org}/${repo}/labels/${encodeURIComponent(labelName)}`,
        {
          headers: {
            Authorization: `token ${this.ghToken}`,
            Accept: 'application/vnd.github.v3+json',
          },
        },
      );
    } catch (e) {
      if (e instanceof HTTPError && e.response.status === 404) {
        await ky.post(`https://api.github.com/repos/${org}/${repo}/labels`, {
          json: { name: labelName, color: 'ededed' },
          headers: {
            Authorization: `token ${this.ghToken}`,
            Accept: 'application/vnd.github.v3+json',
          },
        });
      } else {
        throw e;
      }
    }
  };

  updateAssigneeList = async (
    issue: Pick<Issue, 'org' | 'repo' | 'number'>,
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

  searchIssues = async (query: string): Promise<SearchedIssue[]> => {
    const perPage = 100;
    const maxPageCount = 10;
    const searchedIssues: SearchedIssue[] = [];
    for (let page = 1; page <= maxPageCount; page++) {
      const response = await ky
        .get('https://api.github.com/search/issues', {
          searchParams: {
            q: query,
            per_page: perPage,
            page,
            advanced_search: 'true',
          },
          headers: { Authorization: `token ${this.ghToken}` },
        })
        .json<SearchIssuesResponse>();
      for (const item of response.items) {
        const parsed = this.parseSearchedIssue(item);
        if (parsed) {
          searchedIssues.push(parsed);
        }
      }
      if (response.items.length < perPage) {
        break;
      }
    }
    return searchedIssues;
  };

  private parseSearchedIssue = (
    item: SearchIssuesResponseItem,
  ): SearchedIssue | null => {
    const matched = item.html_url.match(
      /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/(?:issues|pull)\/(\d+)$/,
    );
    if (!matched) {
      return null;
    }
    return {
      url: item.html_url,
      org: matched[1],
      repo: matched[2],
      number: Number(matched[3]),
      state: item.pull_request?.merged_at
        ? 'MERGED'
        : item.state === 'open'
          ? 'OPEN'
          : 'CLOSED',
      author: (item.user?.login ?? '').replace(/\[bot\]$/, ''),
      assignees: item.assignees.map((assignee) => assignee.login),
    };
  };
}
