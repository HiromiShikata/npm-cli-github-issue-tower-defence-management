import { LocalStorageRepository } from './LocalStorageRepository';

export class BaseGitHubRepository {
  constructor(
    readonly localStorageRepository: LocalStorageRepository,
    readonly ghToken: string = process.env.GH_TOKEN || 'dummy',
    readonly readGhTokens: string[] = [],
  ) {}

  private readTokenRoundRobinIndex = 0;

  protected selectReadToken(): string {
    if (this.readGhTokens.length === 0) return this.ghToken;
    const token =
      this.readGhTokens[
        this.readTokenRoundRobinIndex % this.readGhTokens.length
      ];
    this.readTokenRoundRobinIndex =
      (this.readTokenRoundRobinIndex + 1) % this.readGhTokens.length;
    return token;
  }

  protected extractIssueFromUrl = (
    issueUrl: string,
  ): { owner: string; repo: string; issueNumber: number; isIssue: boolean } => {
    const match = issueUrl.match(
      /https:\/\/github.com\/([^/]+)\/([^/]+)\/(issues|pull)\/(\d+)/,
    );
    if (!match) {
      throw new Error(`Invalid issue URL: ${issueUrl}`);
    }
    const [, owner, repo, pullOrIssue, issueNumberStr] = match;
    const issueNumber = parseInt(issueNumberStr, 10);
    if (isNaN(issueNumber)) {
      throw new Error(
        `Invalid issue number: ${issueNumberStr}. URL: ${issueUrl}`,
      );
    }
    return { owner, repo, issueNumber, isIssue: pullOrIssue === 'issues' };
  };
}
