import axios from 'axios';
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
    created_at: string;
  }> => {
    const { owner, repo, issueNumber } = this.extractIssueFromUrl(issueUrl);
    const response = await axios.get<{
      labels: Array<{ name: string }>;
      assignees: Array<{ login: string }>;
      title: string;
      body: string;
      number: number;
      state: string;
      created_at: string;
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
      created_at: response.data.created_at,
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

  updateLabels = async (
    issue: Issue,
    labels: Issue['labels'],
  ): Promise<void> => {
    const response = await axios.put(
      `https://api.github.com/repos/${issue.org}/${issue.repo}/issues/${issue.number}/labels`,
      {
        labels: labels,
      },
      {
        headers: {
          Authorization: `token ${this.ghToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/vnd.github.v3+json',
        },
      },
    );
    if (response.status !== 200) {
      throw new Error(`Failed to update issue labels: ${response.status}`);
    }
    return;
  };

  removeLabel = async (issue: Issue, label: string): Promise<void> => {
    const response = await axios.delete(
      `https://api.github.com/repos/${issue.org}/${issue.repo}/issues/${issue.number}/labels/${encodeURIComponent(label)}`,
      {
        headers: {
          Authorization: `token ${this.ghToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      },
    );
    if (response.status !== 200) {
      throw new Error(`Failed to remove label: ${response.status}`);
    }
    return;
  };

  updateAssigneeList = async (
    issue: Issue,
    assigneeList: Member['name'][],
  ): Promise<void> => {
    try {
      const response = await axios.patch(
        `https://api.github.com/repos/${issue.org}/${issue.repo}/issues/${issue.number}`,
        {
          assignees: assigneeList,
        },
        {
          headers: {
            Authorization: `token ${this.ghToken}`,
            'Content-Type': 'application/json',
          },
        },
      );
      if (response.status !== 200) {
        throw new Error(
          `Failed to update issue assignees: ${response.status} ${issue.url}`,
        );
      }
    } catch (e) {
      const originalMessage = e instanceof Error ? e.message : String(e);
      throw new Error(
        `Failed to update issue assignees: ${originalMessage} ${issue.url}`,
      );
    }
  };
}
