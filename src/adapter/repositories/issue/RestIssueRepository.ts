import axios from 'axios';
import { BaseGitHubRepository } from '../BaseGitHubRepository';
import { Issue } from '../../../domain/entities/Issue';

export class RestIssueRepository extends BaseGitHubRepository {
  createComment = async (issueUrl: string, comment: string) => {
    const { owner, repo, issueNumber } = this.extractIssueFromUrl(issueUrl);
    const response = await axios.post(
      `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
      {
        body: comment,
      },
      {
        headers: {
          Authorization: `token ${this.ghToken}`,
          'Content-Type': 'application/json',
        },
      },
    );
    if (response.status !== 201) {
      throw new Error(`Failed to create comment: ${response.status}`);
    }
  };
  createNewIssue = async (
    owner: string,
    repo: string,
    title: string,
    body: string,
    assignees: string[],
    labels: string[],
  ): Promise<number> => {
    const response = await axios.post<{
      number: number;
    }>(
      `https://api.github.com/repos/${owner}/${repo}/issues`,
      {
        title,
        body,
        assignees,
        labels,
      },
      {
        headers: {
          Authorization: `token ${this.ghToken}`,
          'Content-Type': 'application/json',
        },
      },
    );
    if (response.status !== 201) {
      throw new Error(`Failed to create issue: ${response.status}`);
    }
    return response.data.number;
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
  }> => {
    const { owner, repo, issueNumber } = this.extractIssueFromUrl(issueUrl);
    const response = await axios.get<{
      labels: Array<{ name: string }>;
      assignees: Array<{ login: string }>;
      title: string;
      body: string;
      number: number;
      state: string;
    }>(`https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`, {
      headers: {
        Authorization: `token ${this.ghToken}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });
    return {
      labels: response.data.labels.map((label) => label.name),
      assignees: response.data.assignees.map((assignee) => assignee.login),
      title: response.data.title,
      body: response.data.body,
      number: response.data.number,
      state: response.data.state,
    };
  };
  updateIssue = async (issue: Issue) => {
    const response = await axios.patch(
      `https://api.github.com/repos/${issue.org}/${issue.repo}/issues/${issue.number}`,
      {
        title: issue.title,
        body: issue.body,
        assignees: issue.assignees,
        labels: issue.labels,
        state: issue.state,
      },
      {
        headers: {
          Authorization: `token ${this.ghToken}`,
          'Content-Type': 'application/json',
        },
      },
    );
    if (response.status !== 200) {
      throw new Error(`Failed to update issue: ${response.status}`);
    }
  };
}
