import axios from 'axios';
import { BaseGitHubRepository } from './BaseGitHubRepository';

export class ApiV3IssueRepository extends BaseGitHubRepository {
  searchIssue = async (query: {
    owner: string;
    repositoryName: string;
    type?: 'issue' | 'pr';
    state?: 'open' | 'closed' | 'all';
    title?: string;
    createdFrom?: string;
    assignee?: string;
  }): Promise<
    {
      url: string;
      title: string;
      number: string;
    }[]
  > => {
    // example: curl -H "Authorization: token $GH_TOKEN"      -H "Accept: application/vnd.github.v3+json"      "https://api.github.com/search/issues?q=repo:$OWNER/$REPO+type:issue+state:open+in:title+'Maintain%20Kanban'&created=2024-05-08&assignee=HiromiShkata"
    let url = `https://api.github.com/search/issues?q=repo:${query.owner}/${query.repositoryName}`;
    if (query.type) {
      url += `+type:${query.type}`;
    }
    if (query.state) {
      url += `+state:${query.state}`;
    }
    if (query.title) {
      url += `+in:title+'${query.title}'`;
    }
    if (query.createdFrom) {
      url += `+created:>=${query.createdFrom}`;
    }
    if (query.assignee) {
      url += `&assignee=${query.assignee}`;
    }

    const response = await axios.get<{
      items: {
        html_url: string;
        title: string;
        number: string;
      }[];
    }>(url, {
      headers: {
        Authorization: `token ${this.ghToken}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });
    if (response.status !== 200) {
      throw new Error(`Failed to search issue: ${response.status}`);
    }
    return response.data.items.map((item) => ({
      url: item.html_url,
      title: item.title,
      number: item.number,
    }));
  };
}
