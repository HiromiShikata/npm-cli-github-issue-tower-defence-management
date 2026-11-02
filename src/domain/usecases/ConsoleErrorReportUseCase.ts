import type { IssueRepository } from './adapter-interfaces/IssueRepository';
import {
  commentCreateWithDedupRetry,
  realSleep,
  Sleep,
} from '../services/commentCreateWithDedupRetry';
import { redactSecrets } from '../services/secretRedaction';

type ConsoleErrorReportRepository = Pick<
  IssueRepository,
  | 'searchIssue'
  | 'createNewIssue'
  | 'createCommentByUrl'
  | 'getIssueOrPullRequestComments'
>;

const ISSUE_MEMORY_DURATION_MILLISECONDS = 3 * 60 * 60 * 1000;
const RATE_LIMIT_GROUP = 'API rate limit';
const RATE_LIMIT_MESSAGE_PATTERN = /rate limit/i;

type RememberedIssue = {
  issueUrl: string;
  rememberedAtMilliseconds: number;
};

export class ConsoleErrorReportUseCase {
  private readonly latestRunByGroupKey = new Map<string, Promise<void>>();
  private readonly rememberedIssueByGroupKey = new Map<
    string,
    RememberedIssue
  >();

  constructor(
    private readonly issueRepository: ConsoleErrorReportRepository,
    private readonly sleep: Sleep = realSleep,
  ) {}

  run = async (params: {
    error: unknown;
    owner: string;
    repo: string;
    requestPath: string;
    requestBody?: Record<string, unknown>;
  }): Promise<void> => {
    const { error, owner, repo, requestPath, requestBody } = params;
    const errorName =
      error instanceof Error ? (error.name ?? 'Error') : 'Error';
    const message = redactSecrets(
      error instanceof Error ? error.message : String(error),
    );
    const stack = redactSecrets(
      error instanceof Error && error.stack ? error.stack : String(error),
    );
    const title = `Console error: ${errorName}: ${message.slice(0, 80)}`;
    const occurredAt = new Date().toISOString();
    const group = RATE_LIMIT_MESSAGE_PATTERN.test(message)
      ? RATE_LIMIT_GROUP
      : title;
    const groupKey = `${owner}/${repo}|${group}`;

    const buildBody = (prefix: string): string =>
      [
        `${prefix}`,
        ``,
        `Error name: ${errorName}`,
        `Message: ${message}`,
        `Request path: \`${requestPath}\``,
        `Occurred at: ${occurredAt}`,
        ...(requestBody !== undefined
          ? [
              ``,
              `Request body:`,
              `\`\`\`json`,
              redactSecrets(JSON.stringify(requestBody, null, 2)),
              `\`\`\``,
            ]
          : []),
        ``,
        `Stack trace:`,
        `\`\`\``,
        stack,
        `\`\`\``,
      ].join('\n');

    const previousRun =
      this.latestRunByGroupKey.get(groupKey) ?? Promise.resolve();
    const currentRun = previousRun.then(() =>
      this.reportWithinTurn({ owner, repo, groupKey, title, buildBody }),
    );
    this.latestRunByGroupKey.set(groupKey, currentRun);
    try {
      await currentRun;
    } finally {
      if (this.latestRunByGroupKey.get(groupKey) === currentRun) {
        this.latestRunByGroupKey.delete(groupKey);
      }
    }
  };

  private reportWithinTurn = async (params: {
    owner: string;
    repo: string;
    groupKey: string;
    title: string;
    buildBody: (prefix: string) => string;
  }): Promise<void> => {
    const { owner, repo, groupKey, title, buildBody } = params;
    try {
      this.removeExpiredRememberedIssues();
      const remembered = this.findValidRememberedIssue(groupKey);
      if (remembered !== null) {
        await this.createCommentByUrlWithDedup(
          remembered.issueUrl,
          buildBody('Console error recurrence'),
        );
        return;
      }

      const results = await this.issueRepository.searchIssue({
        owner,
        repositoryName: repo,
        type: 'issue',
        state: 'open',
        title,
      });
      const existing = results.find((r) => r.title.includes(title));
      if (existing) {
        this.rememberIssue(groupKey, existing.url);
        await this.createCommentByUrlWithDedup(
          existing.url,
          buildBody('Console error recurrence'),
        );
        return;
      }

      const createdIssueNumber = await this.issueRepository.createNewIssue(
        owner,
        repo,
        title,
        buildBody('Console error'),
        [],
        [],
      );
      this.rememberIssue(
        groupKey,
        `https://github.com/${owner}/${repo}/issues/${createdIssueNumber}`,
      );
    } catch (reportError) {
      console.error(
        'ConsoleErrorReportUseCase: failed to report error:',
        reportError,
      );
    }
  };

  private removeExpiredRememberedIssues = (): void => {
    const nowMilliseconds = Date.now();
    for (const [groupKey, remembered] of this.rememberedIssueByGroupKey) {
      if (!this.isRememberedIssueValid(remembered, nowMilliseconds)) {
        this.rememberedIssueByGroupKey.delete(groupKey);
      }
    }
  };

  private findValidRememberedIssue = (
    groupKey: string,
  ): RememberedIssue | null => {
    const remembered = this.rememberedIssueByGroupKey.get(groupKey) ?? null;
    if (
      remembered !== null &&
      this.isRememberedIssueValid(remembered, Date.now())
    ) {
      return remembered;
    }
    return null;
  };

  private isRememberedIssueValid = (
    remembered: RememberedIssue,
    nowMilliseconds: number,
  ): boolean =>
    nowMilliseconds - remembered.rememberedAtMilliseconds <
    ISSUE_MEMORY_DURATION_MILLISECONDS;

  private rememberIssue = (groupKey: string, issueUrl: string): void => {
    this.rememberedIssueByGroupKey.set(groupKey, {
      issueUrl,
      rememberedAtMilliseconds: Date.now(),
    });
  };

  private createCommentByUrlWithDedup = async (
    url: string,
    commentBody: string,
  ): Promise<void> => {
    await commentCreateWithDedupRetry(
      commentBody,
      async () => {
        const existing =
          await this.issueRepository.getIssueOrPullRequestComments(url);
        return existing.map((c) => ({
          text: c.body,
          createdAt: c.createdAt,
        }));
      },
      async () => {
        await this.issueRepository.createCommentByUrl(url, commentBody);
      },
      () => new Date(),
      this.sleep,
    );
  };
}
