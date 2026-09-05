import type { IssueRepository } from './adapter-interfaces/IssueRepository';

type ConsoleErrorReportRepository = Pick<
  IssueRepository,
  'searchIssue' | 'createNewIssue' | 'createCommentByUrl'
>;

export class ConsoleErrorReportUseCase {
  constructor(private readonly issueRepository: ConsoleErrorReportRepository) {}

  run = async (params: {
    error: unknown;
    owner: string;
    repo: string;
    requestPath: string;
  }): Promise<void> => {
    const { error, owner, repo, requestPath } = params;
    const errorName =
      error instanceof Error ? (error.name ?? 'Error') : 'Error';
    const message = error instanceof Error ? error.message : String(error);
    const stack =
      error instanceof Error && error.stack ? error.stack : String(error);
    const title = `Console error: ${errorName}: ${message.slice(0, 80)}`;
    const occurredAt = new Date().toISOString();

    const buildBody = (prefix: string): string =>
      [
        `${prefix}`,
        ``,
        `Error name: ${errorName}`,
        `Message: ${message}`,
        `Request path: \`${requestPath}\``,
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
          buildBody('Console error recurrence'),
        );
      } else {
        await this.issueRepository.createNewIssue(
          owner,
          repo,
          title,
          buildBody('Console error'),
          [],
          [],
        );
      }
    } catch (reportError) {
      console.error(
        'ConsoleErrorReportUseCase: failed to report error:',
        reportError,
      );
    }
  };
}
