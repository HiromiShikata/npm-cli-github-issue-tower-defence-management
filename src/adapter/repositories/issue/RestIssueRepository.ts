import path from 'node:path';
import ky, { HTTPError, KyResponse } from 'ky';
import { BaseGitHubRepository } from '../BaseGitHubRepository';
import { tdpmCacheDirectory } from '../localStorageCacheDirectory';
import { Issue } from '../../../domain/entities/Issue';
import { IssueSummary } from '../../../domain/entities/IssueSummary';
import {
  IssueComment,
  IssueRepository,
} from '../../../domain/usecases/adapter-interfaces/IssueRepository';
import { Member } from '../../../domain/entities/Member';
import { SearchedIssue } from '../../../domain/entities/SearchedIssue';
import {
  computeRateLimitResetIso,
  computeSecondaryRateLimitBackoffMs,
  fetchWithGitHubRateLimitRetry,
  GitHubRateLimitError,
  hasRateLimitSignals,
  isSecondaryRateLimit,
} from './githubRateLimitRetry';
import {
  checkSecondaryRateLimitBreaker,
  secondaryRateLimitStateFilePath,
  writeSecondaryRateLimitState,
} from './githubSecondaryRateLimitBreaker';
import { RepositoryArchivedError } from '../../../domain/usecases/NotifyFinishedIssuePreparationUseCase';
import { GitHubCommentCreateHttpError } from '../GitHubIssueCommentRepository';

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

export type StoredIssueComment = {
  id: number;
  author: string;
  body: string;
  createdAt: string;
};

export type StoredIssueCommentPage = {
  etag: string | null;
  comments: StoredIssueComment[];
};

export type StoredIssueCommentList = {
  issueUpdatedAt: string | null;
  pages: StoredIssueCommentPage[];
};

export const ISSUE_COMMENTS_PER_PAGE = 100;

type IssueListResponseItem = {
  html_url: string;
  title: string;
  pull_request?: unknown;
};

type StoredIssueSummaryPage = {
  etag: string | null;
  rawItemCount: number;
  issueSummaries: IssueSummary[];
};

type StoredIssueSummaryList = {
  pages: StoredIssueSummaryPage[];
};

const ISSUE_SUMMARIES_PER_PAGE = 100;

type IssueSummaryListParams = Parameters<
  IssueRepository['getIssueSummariesByLabelAndState']
>[0];

const isIssueSummary = (value: unknown): value is IssueSummary =>
  typeof value === 'object' &&
  value !== null &&
  'url' in value &&
  typeof value.url === 'string' &&
  'title' in value &&
  typeof value.title === 'string';

const isStoredIssueSummaryPage = (
  value: unknown,
): value is StoredIssueSummaryPage =>
  typeof value === 'object' &&
  value !== null &&
  'etag' in value &&
  (value.etag === null || typeof value.etag === 'string') &&
  'rawItemCount' in value &&
  typeof value.rawItemCount === 'number' &&
  'issueSummaries' in value &&
  Array.isArray(value.issueSummaries) &&
  value.issueSummaries.every(isIssueSummary);

const isStoredIssueSummaryList = (
  value: unknown,
): value is StoredIssueSummaryList =>
  typeof value === 'object' &&
  value !== null &&
  'pages' in value &&
  Array.isArray(value.pages) &&
  value.pages.every(isStoredIssueSummaryPage);

const convertIssueListResponseItemsToStoredIssueSummaryPage = (
  etag: string | null,
  issueListResponseItems: IssueListResponseItem[],
): StoredIssueSummaryPage => ({
  etag,
  rawItemCount: issueListResponseItems.length,
  issueSummaries: issueListResponseItems
    .filter(
      (issueListResponseItem) => !('pull_request' in issueListResponseItem),
    )
    .map((issueListResponseItem) => ({
      url: issueListResponseItem.html_url,
      title: issueListResponseItem.title,
    })),
});

const commentedIssueUrlPattern =
  /^https:\/\/api\.github\.com\/repos\/[^/]+\/[^/]+\/issues\/(\d+)$/;

const readCommentedIssueNumberFromCommentResponse = async (
  response: KyResponse,
): Promise<number | null> => {
  try {
    const body: unknown = await response.json();
    if (
      typeof body !== 'object' ||
      body === null ||
      !('issue_url' in body) ||
      typeof body.issue_url !== 'string'
    ) {
      return null;
    }
    const matched = body.issue_url.match(commentedIssueUrlPattern);
    return matched === null ? null : parseInt(matched[1], 10);
  } catch {
    return null;
  }
};

export type IssueCommentResponseItem = {
  id: number;
  user: { login: string } | null;
  body: string | null;
  created_at: string;
};

export const convertIssueCommentResponseItemsToStoredIssueCommentPage = (
  etag: string | null,
  issueCommentResponseItems: IssueCommentResponseItem[],
): StoredIssueCommentPage => ({
  etag,
  comments: issueCommentResponseItems.map((comment) => ({
    id: comment.id,
    author: comment.user?.login ?? '',
    body: comment.body ?? '',
    createdAt: comment.created_at,
  })),
});

export const convertStoredIssueCommentPagesToIssueComments = (
  pages: StoredIssueCommentPage[],
): IssueComment[] =>
  pages.flatMap((page) =>
    page.comments.map((comment) => ({
      id: comment.id,
      author: comment.author,
      body: comment.body,
      createdAt: new Date(comment.createdAt),
    })),
  );

export const findStoredIssueCommentsReusableForIssueUpdatedAt = (
  storedIssueCommentList: StoredIssueCommentList | null,
  issueUpdatedAt: string | null,
): IssueComment[] | null =>
  storedIssueCommentList !== null &&
  issueUpdatedAt !== null &&
  storedIssueCommentList.issueUpdatedAt === issueUpdatedAt
    ? convertStoredIssueCommentPagesToIssueComments(
        storedIssueCommentList.pages,
      )
    : null;

export const collectIssueCommentPagesReusingStoredPages = async (
  storedIssueCommentList: StoredIssueCommentList | null,
  fetchIssueCommentPage: (
    pageNumber: number,
    storedPage: StoredIssueCommentPage | null,
  ) => Promise<StoredIssueCommentPage>,
): Promise<StoredIssueCommentPage[]> => {
  const collectedPages: StoredIssueCommentPage[] = [];
  let hasMore = true;
  while (hasMore) {
    const storedPage =
      storedIssueCommentList?.pages[collectedPages.length] ?? null;
    const collectedPage = await fetchIssueCommentPage(
      collectedPages.length + 1,
      storedPage,
    );
    collectedPages.push(collectedPage);
    hasMore = collectedPage.comments.length >= ISSUE_COMMENTS_PER_PAGE;
  }
  return collectedPages;
};

export class RestIssueRepository
  extends BaseGitHubRepository
  implements
    Pick<
      IssueRepository,
      | 'updateAssigneeList'
      | 'removeLabel'
      | 'searchIssues'
      | 'getIssueSummariesByLabelAndState'
      | 'getIssueOrPullRequestComments'
    >
{
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
    id: number;
    author: string;
    body: string;
    createdAt: Date;
    url: string;
  }> => {
    const { owner, repo, issueNumber } = this.extractIssueFromUrl(issueUrl);

    this.checkBreakerOrThrow();

    let result: {
      id: number;
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
          id: number;
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
        throw new GitHubCommentCreateHttpError(
          e.response.status,
          `Failed to create comment via GitHub REST API: ${e.response.status} ${e.response.statusText}`,
        );
      }
      throw e;
    }
    this.markStoredIssueCommentListsForRevalidation((storedIssueUrl) =>
      this.isUrlOfIssue(storedIssueUrl, { owner, repo, issueNumber }),
    );
    return {
      id: result.id,
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
    if (!/^[\w.-]+$/.test(owner) || !/^[\w.-]+$/.test(repo)) {
      throw new Error(
        `Invalid owner or repo name: owner=${owner} repo=${repo}`,
      );
    }
    const url = `https://api.github.com/repos/${owner}/${repo}/issues`;
    const response = await fetchWithGitHubRateLimitRetry(
      () =>
        fetch(url, {
          method: 'POST',
          body: JSON.stringify({ title, body, assignees, labels }),
          headers: {
            Authorization: `token ${this.ghToken}`,
            'Content-Type': 'application/json',
          },
        }),
      undefined,
      undefined,
      false,
      true,
      this.stateFilePath,
      { method: 'POST', path: `/repos/${owner}/${repo}/issues` },
    );
    if (!response.ok) {
      const bodyText = await response.text();
      throw new Error(
        `GitHub API error creating issue: ${response.status} ${bodyText}`,
      );
    }
    const data: unknown = await response.json();
    if (typeof data !== 'object' || data === null || !('number' in data)) {
      throw new Error(
        `Unexpected response format from GitHub issue creation API`,
      );
    }
    const issueNumber: unknown = data.number;
    if (typeof issueNumber !== 'number') {
      throw new Error(
        `Unexpected response format from GitHub issue creation API`,
      );
    }
    return issueNumber;
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
          },
          headers: { Authorization: `token ${this.ghToken}` },
        },
      );
    } catch (e) {
      await this.detectAndRecordSecondaryRateLimit(e);
      if (e instanceof HTTPError) {
        let bodyText = '';
        try {
          bodyText = await e.response.clone().text();
        } catch {
          if (e.data != null) {
            bodyText =
              typeof e.data === 'string' ? e.data : JSON.stringify(e.data);
          }
        }
        if (
          hasRateLimitSignals(e.response.status, e.response.headers, bodyText)
        ) {
          throw new GitHubRateLimitError(
            `HTTP ${e.response.status} GitHub API rate limit exceeded`,
            computeRateLimitResetIso(e.response.headers),
          );
        }
        if (
          e.response.status === 403 &&
          bodyText.toLowerCase().includes('archived')
        ) {
          throw new RepositoryArchivedError(issue.org, issue.repo);
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

  updateIssueCommentBody = async (
    comment: Pick<Issue, 'org' | 'repo'> & { commentId: number },
    body: string,
  ): Promise<{ commentedIssueNumber: number | null }> => {
    this.checkBreakerOrThrow();
    let response: KyResponse;
    try {
      response = await ky.patch(
        `https://api.github.com/repos/${comment.org}/${comment.repo}/issues/comments/${comment.commentId}`,
        {
          json: { body },
          headers: { Authorization: `token ${this.ghToken}` },
        },
      );
    } catch (e) {
      await this.detectAndRecordSecondaryRateLimit(e);
      throw e;
    }
    this.markStoredIssueCommentListsForRevalidation((_storedIssueUrl, list) =>
      list.pages.some((page) =>
        page.comments.some(
          (storedComment) => storedComment.id === comment.commentId,
        ),
      ),
    );
    return {
      commentedIssueNumber:
        await readCommentedIssueNumberFromCommentResponse(response),
    };
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

  getIssueSummariesByLabelAndState = async (
    params: IssueSummaryListParams,
  ): Promise<IssueSummary[]> => {
    const storedIssueSummaryListFilePath =
      this.buildStoredIssueSummaryListFilePath(params);
    const storedIssueSummaryList = this.readStoredIssueSummaryList(
      storedIssueSummaryListFilePath,
    );
    const fetchedPages: StoredIssueSummaryPage[] = [];
    let hasMore = true;
    while (hasMore) {
      const fetchedPage = await this.fetchIssueSummaryPage(
        params,
        fetchedPages.length + 1,
        storedIssueSummaryList?.pages[fetchedPages.length] ?? null,
      );
      fetchedPages.push(fetchedPage);
      hasMore = fetchedPage.rawItemCount >= ISSUE_SUMMARIES_PER_PAGE;
    }
    this.writeStoredIssueSummaryList(storedIssueSummaryListFilePath, {
      pages: fetchedPages,
    });
    return fetchedPages.flatMap((page) => page.issueSummaries);
  };

  private readonly buildStoredIssueSummaryListFilePath = (
    params: IssueSummaryListParams,
  ): string =>
    path.join(
      tdpmCacheDirectory(),
      'issue-summary-list',
      `${[params.owner, params.repositoryName, params.label, params.state]
        .map(encodeURIComponent)
        .join(',')}.json`,
    );

  private readonly readStoredIssueSummaryList = (
    storedIssueSummaryListFilePath: string,
  ): StoredIssueSummaryList | null => {
    const storedText = this.localStorageRepository.readOrNull(
      storedIssueSummaryListFilePath,
    );
    if (storedText === null) {
      return null;
    }
    try {
      const storedValue: unknown = JSON.parse(storedText);
      return isStoredIssueSummaryList(storedValue) ? storedValue : null;
    } catch {
      return null;
    }
  };

  private readonly writeStoredIssueSummaryList = (
    storedIssueSummaryListFilePath: string,
    storedIssueSummaryList: StoredIssueSummaryList,
  ): void => {
    const temporaryFilePath = `${storedIssueSummaryListFilePath}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
    this.localStorageRepository.write(
      temporaryFilePath,
      JSON.stringify(storedIssueSummaryList),
    );
    this.localStorageRepository.rename(
      temporaryFilePath,
      storedIssueSummaryListFilePath,
    );
  };

  private readonly fetchIssueSummaryPage = async (
    params: IssueSummaryListParams,
    pageNumber: number,
    storedPage: StoredIssueSummaryPage | null,
  ): Promise<StoredIssueSummaryPage> => {
    const response = await ky.get(
      `https://api.github.com/repos/${encodeURIComponent(params.owner)}/${encodeURIComponent(params.repositoryName)}/issues`,
      {
        searchParams: {
          labels: params.label,
          state: params.state,
          per_page: ISSUE_SUMMARIES_PER_PAGE,
          page: pageNumber,
        },
        headers: {
          Authorization: `token ${this.selectReadToken()}`,
          ...(storedPage?.etag ? { 'If-None-Match': storedPage.etag } : {}),
        },
        throwHttpErrors: (status) => status !== 304,
      },
    );
    if (response.status === 304 && storedPage !== null) {
      return storedPage;
    }
    return convertIssueListResponseItemsToStoredIssueSummaryPage(
      response.headers.get('ETag'),
      await response.json<IssueListResponseItem[]>(),
    );
  };

  private readonly storedIssueCommentListByIssueUrl = new Map<
    string,
    StoredIssueCommentList
  >();

  private storedIssueCommentListRevalidationCount = 0;

  private readonly isUrlOfIssue = (
    url: string,
    issue: { owner: string; repo: string; issueNumber: number },
  ): boolean => {
    const parsed = this.extractIssueFromUrl(url);
    return (
      parsed.owner === issue.owner &&
      parsed.repo === issue.repo &&
      parsed.issueNumber === issue.issueNumber
    );
  };

  private readonly markStoredIssueCommentListsForRevalidation = (
    isAffected: (
      storedIssueUrl: string,
      storedIssueCommentList: StoredIssueCommentList,
    ) => boolean,
  ): void => {
    this.storedIssueCommentListRevalidationCount += 1;
    for (const [storedIssueUrl, storedIssueCommentList] of this
      .storedIssueCommentListByIssueUrl) {
      if (isAffected(storedIssueUrl, storedIssueCommentList)) {
        this.storedIssueCommentListByIssueUrl.set(storedIssueUrl, {
          ...storedIssueCommentList,
          issueUpdatedAt: null,
        });
      }
    }
  };

  getIssueOrPullRequestComments = async (
    url: string,
    options?: { issueUpdatedAt?: Date },
  ): Promise<IssueComment[]> => {
    const issueUpdatedAt = options?.issueUpdatedAt?.toISOString() ?? null;
    const revalidationCountAtReadStart =
      this.storedIssueCommentListRevalidationCount;
    const storedIssueCommentList =
      this.storedIssueCommentListByIssueUrl.get(url) ?? null;
    const reusableStoredComments =
      findStoredIssueCommentsReusableForIssueUpdatedAt(
        storedIssueCommentList,
        issueUpdatedAt,
      );
    if (reusableStoredComments !== null) {
      return reusableStoredComments;
    }
    const { owner, repo, issueNumber } = this.extractIssueFromUrl(url);
    const fetchedPages = await collectIssueCommentPagesReusingStoredPages(
      storedIssueCommentList,
      async (pageNumber, storedPage) => {
        const commentsUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${issueNumber}/comments?per_page=${ISSUE_COMMENTS_PER_PAGE}&page=${pageNumber}`;
        const response = await ky.get(commentsUrl, {
          headers: {
            Authorization: `token ${this.ghToken}`,
            ...(storedPage?.etag ? { 'If-None-Match': storedPage.etag } : {}),
          },
          throwHttpErrors: false,
        });
        return response.status === 304 && storedPage !== null
          ? storedPage
          : this.parseIssueCommentsPageResponse(url, response);
      },
    );
    this.storedIssueCommentListByIssueUrl.set(url, {
      issueUpdatedAt:
        this.storedIssueCommentListRevalidationCount ===
        revalidationCountAtReadStart
          ? issueUpdatedAt
          : null,
      pages: fetchedPages,
    });
    return convertStoredIssueCommentPagesToIssueComments(fetchedPages);
  };

  private parseIssueCommentsPageResponse = async (
    url: string,
    response: KyResponse,
  ): Promise<StoredIssueCommentPage> => {
    if (!response.ok) {
      throw new Error(
        `Failed to fetch comments for ${url}: HTTP ${response.status}`,
      );
    }
    const body = await response.json<IssueCommentResponseItem[]>();
    return convertIssueCommentResponseItemsToStoredIssueCommentPage(
      response.headers.get('ETag'),
      body,
    );
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
      isPr: Boolean(item.pull_request),
    };
  };
}
