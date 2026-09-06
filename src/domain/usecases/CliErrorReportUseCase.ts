import type { IssueRepository } from './adapter-interfaces/IssueRepository';

type CliErrorReportRepository = Pick<
  IssueRepository,
  'searchIssue' | 'createNewIssue' | 'createCommentByUrl'
>;

const isGitHubRateLimitError = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }
  if (error.name === 'GitHubRateLimitError') {
    return true;
  }
  return (
    /:\s*(403|429)\b/.test(error.message) ||
    /rate limit|secondary rate limit|abuse/i.test(error.message)
  );
};

export class CliErrorReportUseCase {
  constructor(private readonly issueRepository: CliErrorReportRepository) {}

  run = async (params: {
    error: unknown;
    owner: string;
    repo: string;
    commandLine: string;
  }): Promise<void> => {
    const { error, owner, repo, commandLine } = params;

    if (isGitHubRateLimitError(error)) {
      console.warn(
        'CliErrorReportUseCase: suppressing rate-limit error to prevent write amplification:',
        error instanceof Error ? error.message : String(error),
      );
      return;
    }

    const errorName =
      error instanceof Error ? (error.name ?? 'Error') : 'Error';
    const message = error instanceof Error ? error.message : String(error);
    const stack =
      error instanceof Error && error.stack ? error.stack : String(error);
    const title = `CLI error: ${errorName}: ${message.slice(0, 80)}`;
    const occurredAt = new Date().toISOString();

    const buildBody = (prefix: string): string =>
      [
        `${prefix}`,
        ``,
        `Error name: ${errorName}`,
        `Message: ${message}`,
        `Command: \`${commandLine}\``,
        `Occurred at: ${occurredAt}`,
        ``,
        `Stack trace:`,
        `\`\`\``,
        stack,
        `\`\`\``,
      ].join('\n');

    try {
      const results = await this.issueRepository.searchIssue({
        owner,
        repositoryName: repo,
        type: 'issue',
        state: 'open',
        title,
      });
      const existing = results.find((r) => r.title === title);
      if (existing) {
        await this.issueRepository.createCommentByUrl(
          existing.url,
          buildBody('CLI error recurrence'),
        );
      } else {
        await this.issueRepository.createNewIssue(
          owner,
          repo,
          title,
          buildBody('CLI error'),
          [],
          [],
        );
      }
    } catch (reportError) {
      console.error(
        'CliErrorReportUseCase: failed to report error:',
        reportError,
      );
    }
  };
}
