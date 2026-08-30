import { IssueRepository } from './adapter-interfaces/IssueRepository';

export type SubscriptionDisabledTokenEntry = {
  name: string;
  subscriptionDisabled: boolean;
};

export class SubscriptionDisabledIssueUseCase {
  constructor(
    private readonly issueRepository: Pick<
      IssueRepository,
      'searchIssue' | 'createNewIssue' | 'createCommentByUrl'
    >,
  ) {}

  run = async (input: {
    tokenEntries: SubscriptionDisabledTokenEntry[];
    org: string;
    repo: string;
  }): Promise<void> => {
    for (const entry of input.tokenEntries) {
      if (!entry.subscriptionDisabled) {
        continue;
      }
      try {
        await this.handleDisabledToken(entry.name, input.org, input.repo);
      } catch (error) {
        console.error(
          `SubscriptionDisabledIssue: error handling token ${entry.name}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  };

  private handleDisabledToken = async (
    tokenName: string,
    org: string,
    repo: string,
  ): Promise<void> => {
    const issueTitle = `Restore Claude subscription access for ${tokenName}`;
    const existingIssues = await this.issueRepository.searchIssue({
      owner: org,
      repositoryName: repo,
      type: 'issue',
      state: 'open',
      title: issueTitle,
    });
    const existingIssue = existingIssues.find(
      (issue) => issue.title === issueTitle,
    );

    if (existingIssue) {
      await this.issueRepository.createCommentByUrl(
        existingIssue.url,
        `The Claude subscription access for the token displayed as \`${tokenName}\` remains disabled. Please restore the account's Claude Code subscription access.`,
      );
      console.log(
        `SubscriptionDisabledIssue: commented on existing issue for token ${tokenName}: ${existingIssue.url}`,
      );
    } else {
      const issueNumber = await this.issueRepository.createNewIssue(
        org,
        repo,
        issueTitle,
        `From: :robot: SubscriptionDisabledIssueUseCase\n\nThe Claude subscription access for the token displayed as \`${tokenName}\` has been disabled.\n\nPlease restore the account's Claude Code subscription access to resume operations.`,
        [],
        [],
      );
      console.log(
        `SubscriptionDisabledIssue: created issue #${issueNumber} for token ${tokenName}`,
      );
    }
  };
}
