import { IssueCheckpointRepository } from '../../domain/usecases/adapter-interfaces/IssueCheckpointRepository';

const CHECKPOINT_COMMENT_BODY =
  'From: :robot: preparation-daemon (-)\n\n```json\n{"pullRequestRequired": false}\n```\n\nThis implementation session was interrupted by the preparation daemon due to token near exhaustion. The task will be re-dispatched.';

export class GitHubIssueCheckpointRepository
  implements IssueCheckpointRepository
{
  constructor(private readonly ghToken: string) {}

  postCheckpoint = async (issueUrl: string): Promise<void> => {
    const { owner, repo, issueNumber } = this.parseIssueUrl(issueUrl);

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.ghToken}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ body: CHECKPOINT_COMMENT_BODY }),
      },
    );

    if (!response.ok) {
      throw new Error(
        `Failed to post checkpoint comment to ${issueUrl}: ${response.status} ${response.statusText}`,
      );
    }
  };

  private parseIssueUrl = (
    issueUrl: string,
  ): { owner: string; repo: string; issueNumber: number } => {
    const match = issueUrl.match(
      /github\.com\/([^/]+)\/([^/]+)\/(issues|pull)\/(\d+)/,
    );
    if (!match) {
      throw new Error(`Invalid GitHub issue URL: ${issueUrl}`);
    }
    return {
      owner: match[1],
      repo: match[2],
      issueNumber: parseInt(match[4], 10),
    };
  };
}
