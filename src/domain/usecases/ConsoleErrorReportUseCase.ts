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
  | 'getIssueOrPullRequestState'
>;

const ISSUE_MEMORY_DURATION_MILLISECONDS = 3 * 60 * 60 * 1000;
const RATE_LIMIT_GROUP = 'API rate limit';
const RATE_LIMIT_CANONICAL_TITLE = 'Console error: API rate limit exceeded';
const RATE_LIMIT_SEARCH_PHRASE = 'rate limit';
const RATE_LIMIT_MESSAGE_PATTERN = /rate limit/i;
const CONSOLE_ERROR_TITLE_PREFIX = 'Console error';

type RememberedIssue = {
  issueUrl: string;
  rememberedAtMilliseconds: number;
};

type IssueGroup = {
  groupKey: string;
  createTitle: string;
  searchTitle: string;
  matchesSearchResultTitle: (resultTitle: string) => boolean;
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
    const title = `${CONSOLE_ERROR_TITLE_PREFIX}: ${errorName}: ${message.slice(0, 80)}`;
    const occurredAt = new Date().toISOString();
    const group: IssueGroup = RATE_LIMIT_MESSAGE_PATTERN.test(message)
      ? {
          groupKey: `${owner}/${repo}|${RATE_LIMIT_GROUP}`,
          createTitle: RATE_LIMIT_CANONICAL_TITLE,
          searchTitle: RATE_LIMIT_SEARCH_PHRASE,
          matchesSearchResultTitle: (resultTitle) =>
            resultTitle.includes(CONSOLE_ERROR_TITLE_PREFIX) &&
            RATE_LIMIT_MESSAGE_PATTERN.test(resultTitle),
        }
      : {
          groupKey: `${owner}/${repo}|${title}`,
          createTitle: title,
          searchTitle: title,
          matchesSearchResultTitle: (resultTitle) =>
            resultTitle.includes(title),
        };

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
      this.latestRunByGroupKey.get(group.groupKey) ?? Promise.resolve();
    const currentRun = previousRun.then(() =>
      this.reportWithinTurn({ owner, repo, group, buildBody }),
    );
    this.latestRunByGroupKey.set(group.groupKey, currentRun);
    try {
      await currentRun;
    } finally {
      if (this.latestRunByGroupKey.get(group.groupKey) === currentRun) {
        this.latestRunByGroupKey.delete(group.groupKey);
      }
    }
  };

  private reportWithinTurn = async (params: {
    owner: string;
    repo: string;
    group: IssueGroup;
    buildBody: (prefix: string) => string;
  }): Promise<void> => {
    const { owner, repo, group, buildBody } = params;
    try {
      this.removeExpiredRememberedIssues();
      const rememberedIssueUrl = await this.findOpenRememberedIssueUrl(
        group.groupKey,
      );
      if (rememberedIssueUrl !== null) {
        await this.createCommentByUrlWithDedup(
          rememberedIssueUrl,
          buildBody('Console error recurrence'),
        );
        return;
      }

      const results = await this.issueRepository.searchIssue({
        owner,
        repositoryName: repo,
        type: 'issue',
        state: 'open',
        title: group.searchTitle,
      });
      const existing = results.find((r) =>
        group.matchesSearchResultTitle(r.title),
      );
      if (existing) {
        this.rememberIssue(group.groupKey, existing.url);
        await this.createCommentByUrlWithDedup(
          existing.url,
          buildBody('Console error recurrence'),
        );
        return;
      }

      const createdIssueNumber = await this.issueRepository.createNewIssue(
        owner,
        repo,
        group.createTitle,
        buildBody('Console error'),
        [],
        [],
      );
      this.rememberIssue(
        group.groupKey,
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

  private findOpenRememberedIssueUrl = async (
    groupKey: string,
  ): Promise<string | null> => {
    const remembered = this.rememberedIssueByGroupKey.get(groupKey) ?? null;
    if (remembered === null) {
      return null;
    }
    const issueState = await this.issueRepository.getIssueOrPullRequestState(
      remembered.issueUrl,
    );
    if (issueState.state === 'open') {
      return remembered.issueUrl;
    }
    this.rememberedIssueByGroupKey.delete(groupKey);
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
