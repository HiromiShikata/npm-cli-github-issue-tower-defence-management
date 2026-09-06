import ky, { HTTPError } from 'ky';
import { BaseGitHubRepository } from '../BaseGitHubRepository';
import { Issue } from '../../../domain/entities/Issue';
import { IssueRepository } from '../../../domain/usecases/adapter-interfaces/IssueRepository';
import { Member } from '../../../domain/entities/Member';
import { SearchedIssue } from '../../../domain/entities/SearchedIssue';
import {
  computeRateLimitResetIso,
  computeSecondaryRateLimitBackoffMs,
  GitHubRateLimitError,
  hasRateLimitSignals,
  isSecondaryRateLimit,
} from './githubRateLimitRetry';
import {
  checkSecondaryRateLimitBreaker,
  secondaryRateLimitStateFilePath,
  writeSecondaryRateLimitState,
} from './githubSecondaryRateLimitBreaker';
import {
  isDuplicateWithinWindow,
  DUPLICATE_COMMENT_WINDOW_MS,
} from '../commentDeduplication';

type RestIssueCommentsResponseItem = {
  body: string | null;
  created_at: string;
};

function isStringRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isRestIssueCommentsResponse(
  value: unknown,
): value is RestIssueCommentsResponseItem[] {
  if (!Array.isArray(value)) return false;
  return value.every(
    (item: unknown) =>
      isStringRecord(item) && typeof item['created_at'] === 'string',
  );
}

type SearchIssuesResponseItem = {
  html_url: string;
  state: string;
  user: { login: string } | null;
  assignees: { login: string }[];
  pull_request?: { merged_at: string | null } | null;
};

type SearchIssuesResponse = {
  items: SearchIssuesResponseItem[];
};

export class RestIssueRepository
  extends BaseGitHubRepository
  implements
    Pick<IssueRepository, 'updateAssigneeList' | 'removeLabel' | 'searchIssues'>
{
  private async fetchCommentsForDedupCheck(
    owner: string,
    repo: string,
    issueNumber: number,
  ): Promise<ReadonlyArray<{ text: string; createdAt: Date }> | null> {
    const since = new Date(
      Date.now() - DUPLICATE_COMMENT_WINDOW_MS,
    ).toISOString();
    const comments: Array<{ text: string; createdAt: Date }> = [];
    const headers: Record<string, string> = {
      Authorization: `token ${this.ghToken}`,
      Accept: 'application/vnd.github+json',
    };

    let url: string | null =
      `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/comments?per_page=100&since=${encodeURIComponent(since)}`;

    while (url !== null) {
      let response: Response;
      try {
        response = await fetch(url, { headers });
      } catch {
        return null;
      }

      if (!response.ok) {
        const bodyText = await response.text().catch(() => '');
        if (hasRateLimitSignals(response.status, response.headers, bodyText)) {
          throw new GitHubRateLimitError(
            `GitHub API rate limit during dedup preflight: HTTP ${response.status}`,
            computeRateLimitResetIso(response.headers),
          );
        }
        return null;
      }

      const body: unknown = await response.json();
      if (!isRestIssueCommentsResponse(body)) {
        return null;
      }

      for (const item of body) {
        comments.push({
          text: item.body ?? '',
          createdAt: new Date(item.created_at),
        });
      }

      const linkHeader = response.headers.get('Link') ?? '';
      const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
      url = nextMatch?.[1] ?? null;
    }

    return comments;
  }

  private get stateFilePath(): string {
    return secondaryRateLimitStateFilePath();
  }

  /**
   * Throws GitHubRateLimitError when the shared secondary rate-limit circuit
   * breaker is open.  Call before every content-creating request.
   */
  private checkBreakerOrThrow(): void {
    const nowMs = Date.now();
    const breaker = checkSecondaryRateLimitBreaker(nowMs, this.stateFilePath);
    if (breaker.isBlocked && breaker.resetTimeMs !== null) {
      throw new GitHubRateLimitError(
        `GitHub secondary rate limit is active until ${new Date(breaker.resetTimeMs).toISOString()}`,
        new Date(breaker.resetTimeMs).toISOString(),
      );
    }
  }

  /**
   * If `e` is an HTTPError caused by a secondary rate limit, records the block
   * to the shared state file and re-throws as GitHubRateLimitError.
   * Returns without throwing when `e` is not a secondary rate limit.
   */
  private async detectAndRecordSecondaryRateLimit(e: unknown): Promise<void> {
    if (!(e instanceof HTTPError)) return;
    let bodyText = '';
    try {
      bodyText = await e.response.clone().text();
    } catch {
      // ky 2.x may have already consumed the body
    }
    const nowMs = Date.now();
    if (!isSecondaryRateLimit(e.response.headers, bodyText)) return;
    const backoffMs = computeSecondaryRateLimitBackoffMs(
      e.response.headers,
      nowMs,
    );
    writeSecondaryRateLimitState(nowMs + backoffMs, nowMs, this.stateFilePath);
    throw new GitHubRateLimitError(
      `HTTP ${e.response.status} GitHub API secondary rate limit exceeded`,
      new Date(nowMs + backoffMs).toISOString(),
    );
  }

  createComment = async (
    issueUrl: string,
    comment: string,
  ): Promise<{
    author: string;
    body: string;
    createdAt: Date;
    url: string | null;
  }> => {
    const { owner, repo, issueNumber } = this.extractIssueFromUrl(issueUrl);

    const existingComments = await this.fetchCommentsForDedupCheck(
      owner,
      repo,
      issueNumber,
    );
    if (existingComments !== null) {
      const now = new Date();
      if (isDuplicateWithinWindow(comment, existingComments, now)) {
        console.warn(
          `RestIssueRepository: skipping duplicate comment within ${DUPLICATE_COMMENT_WINDOW_MS / 60000} minutes on ${issueUrl}`,
        );
        return { author: '', body: comment, createdAt: now, url: null };
      }
    }

    this.checkBreakerOrThrow();

    let result: {
      user: { login: string } | null;
      body: string;
      created_at: string;
      html_url: string;
    };
    try {
      result = await ky
        .post(
          `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
          {
            json: { body: comment },
            headers: { Authorization: `token ${this.ghToken}` },
          },
        )
        .json<{
          user: { login: string } | null;
          body: string;
          created_at: string;
          html_url: string;
        }>();
    } catch (e) {
      await this.detectAndRecordSecondaryRateLimit(e);
      if (e instanceof HTTPError) {
        let bodyText = '';
        try {
          bodyText = await e.response.clone().text();
        } catch {
          // ky 2.x consumes the response body into error.data before throwing,
          // making clone() fail; fall back to headers-only detection
          // (x-ratelimit-remaining: 0 is sufficient to identify rate limits)
        }
        if (
          hasRateLimitSignals(e.response.status, e.response.headers, bodyText)
        ) {
          throw new GitHubRateLimitError(
            `HTTP ${e.response.status} GitHub API rate limit exceeded`,
            computeRateLimitResetIso(e.response.headers),
          );
        }
      }
      throw e;
    }
    return {
      author: result.user?.login ?? '',
      body: result.body,
      createdAt: new Date(result.created_at),
      url: result.html_url,
    };
  };
  createNewIssue = async (
    owner: string,
    repo: string,
    title: string,
    body: string,
    assignees: string[],
    labels: string[],
  ): Promise<number> => {
    this.checkBreakerOrThrow();
    try {
      const response = await ky
        .post(`https://api.github.com/repos/${owner}/${repo}/issues`, {
          json: { title, body, assignees, labels },
          headers: { Authorization: `token ${this.ghToken}` },
        })
        .json<{ number: number }>();
      return response.number;
    } catch (e) {
      await this.detectAndRecordSecondaryRateLimit(e);
      throw e;
    }
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
    const response = await ky
      .get(
        `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`,
        {
          headers: {
            Authorization: `token ${this.selectReadToken()}`,
            Accept: 'application/vnd.github.v3+json',
          },
        },
      )
      .json<{
        labels: Array<{ name: string }>;
        assignees: Array<{ login: string }>;
        title: string;
        body: string;
        number: number;
        state: string;
        created_at: string;
      }>();
    return {
      labels: response.labels.map((label) => label.name),
      assignees: response.assignees.map((assignee) => assignee.login),
      title: response.title,
      body: response.body,
      number: response.number,
      state: response.state,
      created_at: response.created_at,
    };
  };
  updateIssue = async (issue: Issue) => {
    this.checkBreakerOrThrow();
    try {
      await ky.patch(
        `https://api.github.com/repos/${issue.org}/${issue.repo}/issues/${issue.number}`,
        {
          json: {
            title: issue.title,
            body: issue.body,
            assignees: issue.assignees,
            labels: issue.labels,
            state: issue.state,
          },
          headers: { Authorization: `token ${this.ghToken}` },
        },
      );
    } catch (e) {
      await this.detectAndRecordSecondaryRateLimit(e);
      if (e instanceof HTTPError) {
        const bodyText = await e.response
          .clone()
          .text()
          .catch(() => '');
        if (
          hasRateLimitSignals(e.response.status, e.response.headers, bodyText)
        ) {
          throw new GitHubRateLimitError(
            `HTTP ${e.response.status} GitHub API rate limit exceeded`,
            computeRateLimitResetIso(e.response.headers),
          );
        }
      }
      throw e;
    }
  };

  updateIssueBody = async (
    issue: Pick<Issue, 'org' | 'repo' | 'number'>,
    body: string,
  ): Promise<void> => {
    this.checkBreakerOrThrow();
    try {
      await ky.patch(
        `https://api.github.com/repos/${issue.org}/${issue.repo}/issues/${issue.number}`,
        {
          json: { body },
          headers: { Authorization: `token ${this.ghToken}` },
        },
      );
    } catch (e) {
      await this.detectAndRecordSecondaryRateLimit(e);
      throw e;
    }
  };

  updateLabels = async (
    issue: Issue,
    labels: Issue['labels'],
  ): Promise<void> => {
    this.checkBreakerOrThrow();
    try {
      await ky.put(
        `https://api.github.com/repos/${issue.org}/${issue.repo}/issues/${issue.number}/labels`,
        {
          json: { labels },
          headers: {
            Authorization: `token ${this.ghToken}`,
            Accept: 'application/vnd.github.v3+json',
          },
        },
      );
    } catch (e) {
      await this.detectAndRecordSecondaryRateLimit(e);
      throw e;
    }
    return;
  };

  removeLabel = async (issue: Issue, label: string): Promise<void> => {
    this.checkBreakerOrThrow();
    try {
      await ky.delete(
        `https://api.github.com/repos/${issue.org}/${issue.repo}/issues/${issue.number}/labels/${encodeURIComponent(label)}`,
        {
          headers: {
            Authorization: `token ${this.ghToken}`,
            Accept: 'application/vnd.github.v3+json',
          },
        },
      );
    } catch (e) {
      await this.detectAndRecordSecondaryRateLimit(e);
      if (e instanceof HTTPError && e.response.status === 404) {
        return;
      }
      throw e;
    }
  };

  getOrCreateLabel = async (
    org: string,
    repo: string,
    labelName: string,
  ): Promise<void> => {
    try {
      await ky.get(
        `https://api.github.com/repos/${org}/${repo}/labels/${encodeURIComponent(labelName)}`,
        {
          headers: {
            Authorization: `token ${this.selectReadToken()}`,
            Accept: 'application/vnd.github.v3+json',
          },
        },
      );
    } catch (e) {
      if (e instanceof HTTPError && e.response.status === 404) {
        this.checkBreakerOrThrow();
        try {
          await ky.post(`https://api.github.com/repos/${org}/${repo}/labels`, {
            json: { name: labelName, color: 'ededed' },
            headers: {
              Authorization: `token ${this.ghToken}`,
              Accept: 'application/vnd.github.v3+json',
            },
          });
        } catch (postErr) {
          await this.detectAndRecordSecondaryRateLimit(postErr);
          throw postErr;
        }
      } else {
        throw e;
      }
    }
  };

  updateAssigneeList = async (
    issue: Pick<Issue, 'org' | 'repo' | 'number'>,
    assigneeList: Member['name'][],
  ): Promise<void> => {
    this.checkBreakerOrThrow();
    try {
      await ky.patch(
        `https://api.github.com/repos/${issue.org}/${issue.repo}/issues/${issue.number}`,
        {
          json: { assignees: assigneeList },
          headers: { Authorization: `token ${this.ghToken}` },
        },
      );
    } catch (e) {
      await this.detectAndRecordSecondaryRateLimit(e);
      throw e;
    }
  };

  searchIssues = async (query: string): Promise<SearchedIssue[]> => {
    const perPage = 100;
    const maxPageCount = 10;
    const searchedIssues: SearchedIssue[] = [];
    for (let page = 1; page <= maxPageCount; page++) {
      const response = await ky
        .get('https://api.github.com/search/issues', {
          searchParams: {
            q: query,
            per_page: perPage,
            page,
            advanced_search: 'true',
          },
          headers: { Authorization: `token ${this.selectReadToken()}` },
        })
        .json<SearchIssuesResponse>();
      for (const item of response.items) {
        const parsed = this.parseSearchedIssue(item);
        if (parsed) {
          searchedIssues.push(parsed);
        }
      }
      if (response.items.length < perPage) {
        break;
      }
    }
    return searchedIssues;
  };

  private parseSearchedIssue = (
    item: SearchIssuesResponseItem,
  ): SearchedIssue | null => {
    const matched = item.html_url.match(
      /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/(?:issues|pull)\/(\d+)$/,
    );
    if (!matched) {
      return null;
    }
    return {
      url: item.html_url,
      org: matched[1],
      repo: matched[2],
      number: Number(matched[3]),
      state: item.pull_request?.merged_at
        ? 'MERGED'
        : item.state === 'open'
          ? 'OPEN'
          : 'CLOSED',
      author: (item.user?.login ?? '').replace(/\[bot\]$/, ''),
      assignees: item.assignees.map((assignee) => assignee.login),
    };
  };
}
