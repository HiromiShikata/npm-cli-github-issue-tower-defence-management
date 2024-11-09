import { BaseGitHubRepository } from '../BaseGitHubRepository';
import { Octokit } from '@octokit/rest';

export class OctokitIssueRepository extends BaseGitHubRepository {
  private readonly octokit: Octokit;

  constructor() {
    super();
    this.octokit = new Octokit({ auth: this.ghToken });
  }

  public getIssue = async (
    issueUrl: string,
  ): Promise<Awaited<ReturnType<typeof this.octokit.issues.get>>['data']> => {
    const { owner, repo, issueNumber } = this.extractIssueFromUrl(issueUrl);
    const response = await this.octokit.issues.get({
      owner,
      repo,
      issue_number: issueNumber,
    });

    return response.data;
  };
}
