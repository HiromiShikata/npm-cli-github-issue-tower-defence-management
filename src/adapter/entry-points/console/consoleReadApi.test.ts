import { mock } from 'jest-mock-extended';
import { Project } from '../../../domain/entities/Project';
import { IssueRepository } from '../../../domain/usecases/adapter-interfaces/IssueRepository';
import { GitHubRateLimitError } from '../../repositories/issue/githubRateLimitRetry';
import {
  ISSUE_TITLE_CACHE_TTL_MS,
  IssueTitleStateCache,
  PULL_REQUEST_STATUS_CACHE_TTL_MS,
  PullRequestStatusCache,
  handleComments,
  handleIssueTitle,
  handleItemBody,
  handlePrCommits,
  handlePrFiles,
  handleProjectReadmeConfig,
  handlePullRequestStatus,
  handleRelatedPrs,
} from './consoleReadApi';
import * as projectConfig from '../cli/projectConfig';
import type { ConsoleProjectResolver } from './consoleOperationApi';

describe('consoleReadApi', () => {
  const RATE_LIMIT_ERROR_MESSAGE =
    'Failed to fetch body for https://github.com/o/r/issues/1: HTTP 403 GitHub rate limit exceeded, please retry shortly (resets at 2026-01-01T01:00:00.000Z)';

  describe('handleItemBody', () => {
    it('returns 400 when url is missing', async () => {
      const issueRepository = mock<IssueRepository>();
      const response = await handleItemBody(issueRepository, null);
      expect(response.statusCode).toBe(400);
    });

    it('returns the body from the repository', async () => {
      const issueRepository = mock<IssueRepository>();
      issueRepository.getIssueOrPullRequestBody.mockResolvedValue('body text');
      const response = await handleItemBody(
        issueRepository,
        'https://github.com/o/r/issues/1',
      );
      expect(response.statusCode).toBe(200);
      expect(response.body).toEqual({ body: 'body text' });
      expect(issueRepository.getIssueOrPullRequestBody).toHaveBeenCalledWith(
        'https://github.com/o/r/issues/1',
      );
    });

    it('returns 429 with the error message when the repository throws a GitHub rate limit error', async () => {
      const issueRepository = mock<IssueRepository>();
      issueRepository.getIssueOrPullRequestBody.mockRejectedValue(
        new GitHubRateLimitError(RATE_LIMIT_ERROR_MESSAGE),
      );
      const response = await handleItemBody(
        issueRepository,
        'https://github.com/o/r/issues/1',
      );
      expect(response.statusCode).toBe(429);
      expect(response.body).toEqual({ error: RATE_LIMIT_ERROR_MESSAGE });
    });

    it('re-throws non-rate-limit errors from the repository', async () => {
      const issueRepository = mock<IssueRepository>();
      issueRepository.getIssueOrPullRequestBody.mockRejectedValue(
        new Error('Network timeout'),
      );
      await expect(
        handleItemBody(issueRepository, 'https://github.com/o/r/issues/1'),
      ).rejects.toThrow('Network timeout');
    });
  });

  describe('handleComments', () => {
    it('serializes comment createdAt to ISO string', async () => {
      const issueRepository = mock<IssueRepository>();
      issueRepository.getIssueOrPullRequestComments.mockResolvedValue([
        {
          author: 'octocat',
          body: 'hello',
          createdAt: new Date('2026-01-02T03:04:05Z'),
        },
      ]);
      const response = await handleComments(
        issueRepository,
        'https://github.com/o/r/issues/1',
      );
      expect(response.statusCode).toBe(200);
      expect(response.body).toEqual({
        comments: [
          {
            author: 'octocat',
            body: 'hello',
            createdAt: '2026-01-02T03:04:05.000Z',
          },
        ],
      });
    });

    it('returns 400 when url is missing', async () => {
      const issueRepository = mock<IssueRepository>();
      const response = await handleComments(issueRepository, null);
      expect(response.statusCode).toBe(400);
    });

    it('returns 429 with the error message when the repository throws a GitHub rate limit error', async () => {
      const issueRepository = mock<IssueRepository>();
      const rateLimitMessage =
        'Failed to fetch comments for https://github.com/o/r/issues/1: HTTP 403 GitHub rate limit exceeded, please retry shortly (resets at 2026-01-01T01:00:00.000Z)';
      issueRepository.getIssueOrPullRequestComments.mockRejectedValue(
        new GitHubRateLimitError(rateLimitMessage),
      );
      const response = await handleComments(
        issueRepository,
        'https://github.com/o/r/issues/1',
      );
      expect(response.statusCode).toBe(429);
      expect(response.body).toEqual({ error: rateLimitMessage });
    });

    it('re-throws non-rate-limit errors from the repository', async () => {
      const issueRepository = mock<IssueRepository>();
      issueRepository.getIssueOrPullRequestComments.mockRejectedValue(
        new Error('Network timeout'),
      );
      await expect(
        handleComments(issueRepository, 'https://github.com/o/r/issues/1'),
      ).rejects.toThrow('Network timeout');
    });
  });

  describe('handlePrFiles', () => {
    it('returns the files of the pull request detail', async () => {
      const issueRepository = mock<IssueRepository>();
      issueRepository.getPullRequestDetail.mockResolvedValue({
        title: 't',
        state: 'OPEN',
        merged: false,
        isDraft: false,
        additions: 1,
        deletions: 0,
        changedFiles: 1,
        headRefName: 'feature',
        baseRefName: 'main',
        author: 'octocat',
        files: [
          {
            filename: 'a.ts',
            status: 'modified',
            additions: 1,
            deletions: 0,
            patch: '@@ -1 +1 @@',
            rawUrl: null,
          },
        ],
      });
      const response = await handlePrFiles(
        issueRepository,
        'https://github.com/o/r/pull/1',
      );
      expect(response.statusCode).toBe(200);
      expect(response.body).toEqual({
        files: [
          {
            filename: 'a.ts',
            status: 'modified',
            additions: 1,
            deletions: 0,
            patch: '@@ -1 +1 @@',
            rawUrl: null,
          },
        ],
      });
    });

    it('returns null files when detail is null', async () => {
      const issueRepository = mock<IssueRepository>();
      issueRepository.getPullRequestDetail.mockResolvedValue(null);
      const response = await handlePrFiles(
        issueRepository,
        'https://github.com/o/r/pull/1',
      );
      expect(response.statusCode).toBe(200);
      expect(response.body).toEqual({ files: null });
    });

    it('returns 400 when url is missing', async () => {
      const issueRepository = mock<IssueRepository>();
      const response = await handlePrFiles(issueRepository, null);
      expect(response.statusCode).toBe(400);
    });

    it('returns 429 with the error message when the repository throws a GitHub rate limit error', async () => {
      const issueRepository = mock<IssueRepository>();
      const rateLimitMessage =
        'Failed to fetch PR detail for https://github.com/o/r/pull/1: HTTP 403 GitHub rate limit exceeded, please retry shortly (resets at 2026-01-01T01:00:00.000Z)';
      issueRepository.getPullRequestDetail.mockRejectedValue(
        new GitHubRateLimitError(rateLimitMessage),
      );
      const response = await handlePrFiles(
        issueRepository,
        'https://github.com/o/r/pull/1',
      );
      expect(response.statusCode).toBe(429);
      expect(response.body).toEqual({ error: rateLimitMessage });
    });

    it('re-throws non-rate-limit errors from the repository', async () => {
      const issueRepository = mock<IssueRepository>();
      issueRepository.getPullRequestDetail.mockRejectedValue(
        new Error('Network timeout'),
      );
      await expect(
        handlePrFiles(issueRepository, 'https://github.com/o/r/pull/1'),
      ).rejects.toThrow('Network timeout');
    });
  });

  describe('handlePrCommits', () => {
    it('serializes commit authoredAt to ISO string', async () => {
      const issueRepository = mock<IssueRepository>();
      issueRepository.getPullRequestCommits.mockResolvedValue([
        {
          sha: 'abc',
          message: 'msg',
          author: 'octocat',
          authoredAt: new Date('2026-01-02T03:04:05Z'),
        },
      ]);
      const response = await handlePrCommits(
        issueRepository,
        'https://github.com/o/r/pull/1',
      );
      expect(response.statusCode).toBe(200);
      expect(response.body).toEqual({
        commits: [
          {
            sha: 'abc',
            message: 'msg',
            author: 'octocat',
            authoredAt: '2026-01-02T03:04:05.000Z',
          },
        ],
      });
    });

    it('returns 400 when url is missing', async () => {
      const issueRepository = mock<IssueRepository>();
      const response = await handlePrCommits(issueRepository, null);
      expect(response.statusCode).toBe(400);
    });

    it('returns 429 with the error message when the repository throws a GitHub rate limit error', async () => {
      const issueRepository = mock<IssueRepository>();
      const rateLimitMessage =
        'Failed to fetch commits for https://github.com/o/r/pull/1: HTTP 403 GitHub rate limit exceeded, please retry shortly (resets at 2026-01-01T01:00:00.000Z)';
      issueRepository.getPullRequestCommits.mockRejectedValue(
        new GitHubRateLimitError(rateLimitMessage),
      );
      const response = await handlePrCommits(
        issueRepository,
        'https://github.com/o/r/pull/1',
      );
      expect(response.statusCode).toBe(429);
      expect(response.body).toEqual({ error: rateLimitMessage });
    });

    it('re-throws non-rate-limit errors from the repository', async () => {
      const issueRepository = mock<IssueRepository>();
      issueRepository.getPullRequestCommits.mockRejectedValue(
        new Error('Network timeout'),
      );
      await expect(
        handlePrCommits(issueRepository, 'https://github.com/o/r/pull/1'),
      ).rejects.toThrow('Network timeout');
    });
  });

  describe('handleRelatedPrs', () => {
    it('combines related pull requests with their summaries', async () => {
      const issueRepository = mock<IssueRepository>();
      issueRepository.findRelatedOpenPRs.mockResolvedValue([
        {
          url: 'https://github.com/o/r/pull/2',
          branchName: 'feature',
          createdAt: new Date('2026-01-02T03:04:05Z'),
          isDraft: false,
          isConflicted: false,
          mergeable: 'MERGEABLE',
          isPassedAllCiJob: true,
          isCiStateSuccess: true,
          isResolvedAllReviewComments: true,
          isBranchOutOfDate: false,
          missingRequiredCheckNames: [],
        },
      ]);
      issueRepository.getPullRequestSummary.mockResolvedValue({
        title: 'summary title',
        body: 'summary body',
        additions: 3,
        deletions: 1,
        changedFiles: 2,
      });
      const response = await handleRelatedPrs(
        issueRepository,
        'https://github.com/o/r/issues/1',
      );
      expect(response.statusCode).toBe(200);
      expect(response.body).toEqual({
        relatedPullRequests: [
          {
            url: 'https://github.com/o/r/pull/2',
            branchName: 'feature',
            createdAt: '2026-01-02T03:04:05.000Z',
            isDraft: false,
            isConflicted: false,
            mergeableStatus: 'MERGEABLE',
            isPassedAllCiJob: true,
            isCiStateSuccess: true,
            isResolvedAllReviewComments: true,
            isBranchOutOfDate: false,
            missingRequiredCheckNames: [],
            summary: {
              title: 'summary title',
              body: 'summary body',
              additions: 3,
              deletions: 1,
              changedFiles: 2,
            },
          },
        ],
      });
    });

    it('returns 400 when url is missing', async () => {
      const issueRepository = mock<IssueRepository>();
      const response = await handleRelatedPrs(issueRepository, null);
      expect(response.statusCode).toBe(400);
    });

    it('returns 429 with the error message when the repository throws a GitHub rate limit error', async () => {
      const issueRepository = mock<IssueRepository>();
      const rateLimitMessage =
        'Failed to fetch related PRs for https://github.com/o/r/issues/1: HTTP 403 GitHub rate limit exceeded, please retry shortly (resets at 2026-01-01T01:00:00.000Z)';
      issueRepository.findRelatedOpenPRs.mockRejectedValue(
        new GitHubRateLimitError(rateLimitMessage),
      );
      const response = await handleRelatedPrs(
        issueRepository,
        'https://github.com/o/r/issues/1',
      );
      expect(response.statusCode).toBe(429);
      expect(response.body).toEqual({ error: rateLimitMessage });
    });

    it('re-throws non-rate-limit errors from the repository', async () => {
      const issueRepository = mock<IssueRepository>();
      issueRepository.findRelatedOpenPRs.mockRejectedValue(
        new Error('Network timeout'),
      );
      await expect(
        handleRelatedPrs(issueRepository, 'https://github.com/o/r/issues/1'),
      ).rejects.toThrow('Network timeout');
    });
  });

  describe('handleIssueTitle with the TTL cache', () => {
    it('returns 400 when url is missing', async () => {
      const issueRepository = mock<IssueRepository>();
      const cache = new IssueTitleStateCache();
      const response = await handleIssueTitle(issueRepository, cache, null);
      expect(response.statusCode).toBe(400);
    });

    it('fetches on a cache miss and caches the result', async () => {
      const issueRepository = mock<IssueRepository>();
      issueRepository.getIssueOrPullRequestState.mockResolvedValue({
        state: 'OPEN',
        merged: false,
        isPullRequest: false,
        title: 'Issue title from repository',
      });
      const cache = new IssueTitleStateCache(() => 0);
      const url = 'https://github.com/o/r/issues/1';
      const first = await handleIssueTitle(issueRepository, cache, url);
      expect(first.body).toEqual({
        state: 'OPEN',
        merged: false,
        isPullRequest: false,
        title: 'Issue title from repository',
      });
      const second = await handleIssueTitle(issueRepository, cache, url);
      expect(second.body).toEqual(first.body);
      expect(issueRepository.getIssueOrPullRequestState).toHaveBeenCalledTimes(
        1,
      );
      expect(issueRepository.getIssueByUrl).not.toHaveBeenCalled();
    });

    it('returns the pull request title for pull request urls', async () => {
      const issueRepository = mock<IssueRepository>();
      issueRepository.getIssueOrPullRequestState.mockResolvedValue({
        state: 'CLOSED',
        merged: true,
        isPullRequest: true,
        title: 'Pull request title from state',
      });
      const cache = new IssueTitleStateCache(() => 0);
      const url = 'https://github.com/o/r/pull/2';
      const response = await handleIssueTitle(issueRepository, cache, url);
      expect(response.body).toEqual({
        state: 'CLOSED',
        merged: true,
        isPullRequest: true,
        title: 'Pull request title from state',
      });
      expect(issueRepository.getPullRequestSummary).not.toHaveBeenCalled();
      expect(issueRepository.getIssueByUrl).not.toHaveBeenCalled();
    });

    it('returns the title of an issue that is not an item on the project board', async () => {
      const issueRepository = mock<IssueRepository>();
      issueRepository.getIssueOrPullRequestState.mockResolvedValue({
        state: 'CLOSED',
        merged: false,
        isPullRequest: false,
        title: 'Title of an issue outside the board',
      });
      issueRepository.getIssueByUrl.mockResolvedValue(null);
      const cache = new IssueTitleStateCache(() => 0);
      const response = await handleIssueTitle(
        issueRepository,
        cache,
        'https://github.com/o/off-board-repository/issues/656',
      );
      expect(response.body).toEqual({
        state: 'CLOSED',
        merged: false,
        isPullRequest: false,
        title: 'Title of an issue outside the board',
      });
      expect(issueRepository.getIssueByUrl).not.toHaveBeenCalled();
    });

    it('re-fetches a non-merged result after the TTL elapses', async () => {
      const issueRepository = mock<IssueRepository>();
      issueRepository.getIssueOrPullRequestState.mockResolvedValue({
        state: 'OPEN',
        merged: false,
        isPullRequest: true,
        title: 'Open pull request title',
      });
      let now = 0;
      const cache = new IssueTitleStateCache(() => now);
      const url = 'https://github.com/o/r/pull/1';
      await handleIssueTitle(issueRepository, cache, url);
      now = ISSUE_TITLE_CACHE_TTL_MS - 1;
      await handleIssueTitle(issueRepository, cache, url);
      expect(issueRepository.getIssueOrPullRequestState).toHaveBeenCalledTimes(
        1,
      );
      now = ISSUE_TITLE_CACHE_TTL_MS;
      await handleIssueTitle(issueRepository, cache, url);
      expect(issueRepository.getIssueOrPullRequestState).toHaveBeenCalledTimes(
        2,
      );
    });

    it('caches a merged result permanently', async () => {
      const issueRepository = mock<IssueRepository>();
      issueRepository.getIssueOrPullRequestState.mockResolvedValue({
        state: 'CLOSED',
        merged: true,
        isPullRequest: true,
        title: 'Merged pull request title',
      });
      let now = 0;
      const cache = new IssueTitleStateCache(() => now);
      const url = 'https://github.com/o/r/pull/1';
      await handleIssueTitle(issueRepository, cache, url);
      now = ISSUE_TITLE_CACHE_TTL_MS * 1000;
      await handleIssueTitle(issueRepository, cache, url);
      expect(issueRepository.getIssueOrPullRequestState).toHaveBeenCalledTimes(
        1,
      );
    });

    it('returns 429 with the error message when the repository throws a GitHub rate limit error and cache is empty', async () => {
      const issueRepository = mock<IssueRepository>();
      const rateLimitMessage =
        'Failed to fetch state for https://github.com/o/r/issues/1: HTTP 403 GitHub rate limit exceeded, please retry shortly (resets at 2026-01-01T01:00:00.000Z)';
      issueRepository.getIssueOrPullRequestState.mockRejectedValue(
        new GitHubRateLimitError(rateLimitMessage),
      );
      const cache = new IssueTitleStateCache(() => 0);
      const response = await handleIssueTitle(
        issueRepository,
        cache,
        'https://github.com/o/r/issues/1',
      );
      expect(response.statusCode).toBe(429);
      expect(response.body).toEqual({ error: rateLimitMessage });
    });

    it('serves the stale cached value when the repository throws a GitHub rate limit error and a cache entry exists', async () => {
      const issueRepository = mock<IssueRepository>();
      const staleState = {
        state: 'OPEN',
        merged: false,
        isPullRequest: false,
        title: 'Stale title',
      };
      const rateLimitMessage =
        'Failed to fetch state for https://github.com/o/r/issues/1: HTTP 403 GitHub rate limit exceeded, please retry shortly';
      issueRepository.getIssueOrPullRequestState
        .mockResolvedValueOnce(staleState)
        .mockRejectedValue(new GitHubRateLimitError(rateLimitMessage));
      let now = 0;
      const cache = new IssueTitleStateCache(() => now);
      const url = 'https://github.com/o/r/issues/1';
      await handleIssueTitle(issueRepository, cache, url);
      now = ISSUE_TITLE_CACHE_TTL_MS + 1;
      const response = await handleIssueTitle(issueRepository, cache, url);
      expect(response.statusCode).toBe(200);
      expect(response.body).toEqual(staleState);
    });

    it('re-throws non-rate-limit errors from the repository', async () => {
      const issueRepository = mock<IssueRepository>();
      issueRepository.getIssueOrPullRequestState.mockRejectedValue(
        new Error('Network timeout'),
      );
      const cache = new IssueTitleStateCache(() => 0);
      await expect(
        handleIssueTitle(
          issueRepository,
          cache,
          'https://github.com/o/r/issues/1',
        ),
      ).rejects.toThrow('Network timeout');
    });
  });

  describe('handlePullRequestStatus with the TTL cache', () => {
    const openPullRequest = {
      url: 'https://github.com/o/r/pull/1',
      isConflicted: true,
      mergeable: 'CONFLICTING',
      isPassedAllCiJob: false,
      isCiStateSuccess: false,
      isBranchOutOfDate: true,
      missingRequiredCheckNames: ['build', 'test'],
    };

    it('returns 400 when url is missing', async () => {
      const issueRepository = mock<IssueRepository>();
      const cache = new PullRequestStatusCache();
      const response = await handlePullRequestStatus(
        issueRepository,
        cache,
        null,
      );
      expect(response.statusCode).toBe(400);
    });

    it('serializes the open pull request status fields', async () => {
      const issueRepository = mock<IssueRepository>();
      issueRepository.getOpenPullRequestCiStatus.mockResolvedValue(
        openPullRequest,
      );
      const cache = new PullRequestStatusCache(() => 0);
      const response = await handlePullRequestStatus(
        issueRepository,
        cache,
        openPullRequest.url,
      );
      expect(response.statusCode).toBe(200);
      expect(response.body).toEqual({
        found: true,
        status: {
          isConflicted: true,
          mergeableStatus: 'CONFLICTING',
          isPassedAllCiJob: false,
          isCiStateSuccess: false,
          isBranchOutOfDate: true,
          missingRequiredCheckNames: ['build', 'test'],
        },
      });
    });

    it('reports not found when the repository returns no open pull request', async () => {
      const issueRepository = mock<IssueRepository>();
      issueRepository.getOpenPullRequestCiStatus.mockResolvedValue(null);
      const cache = new PullRequestStatusCache(() => 0);
      const response = await handlePullRequestStatus(
        issueRepository,
        cache,
        'https://github.com/o/r/pull/9',
      );
      expect(response.body).toEqual({ found: false, status: null });
    });

    it('does not reach the review thread read, which no field of this response needs', async () => {
      const issueRepository = mock<IssueRepository>();
      issueRepository.getOpenPullRequestCiStatus.mockResolvedValue(
        openPullRequest,
      );
      const cache = new PullRequestStatusCache(() => 0);
      await handlePullRequestStatus(
        issueRepository,
        cache,
        openPullRequest.url,
      );
      expect(issueRepository.getOpenPullRequest).not.toHaveBeenCalled();
    });

    it('caches within the TTL and re-fetches after the TTL elapses', async () => {
      const issueRepository = mock<IssueRepository>();
      issueRepository.getOpenPullRequestCiStatus.mockResolvedValue(
        openPullRequest,
      );
      let now = 0;
      const cache = new PullRequestStatusCache(() => now);
      await handlePullRequestStatus(
        issueRepository,
        cache,
        openPullRequest.url,
      );
      now = PULL_REQUEST_STATUS_CACHE_TTL_MS - 1;
      await handlePullRequestStatus(
        issueRepository,
        cache,
        openPullRequest.url,
      );
      expect(issueRepository.getOpenPullRequestCiStatus).toHaveBeenCalledTimes(
        1,
      );
      now = PULL_REQUEST_STATUS_CACHE_TTL_MS;
      await handlePullRequestStatus(
        issueRepository,
        cache,
        openPullRequest.url,
      );
      expect(issueRepository.getOpenPullRequestCiStatus).toHaveBeenCalledTimes(
        2,
      );
    });

    it('returns 429 with the error message when the repository throws a GitHub rate limit error and cache is empty', async () => {
      const issueRepository = mock<IssueRepository>();
      const rateLimitMessage =
        'Failed to fetch CI status for https://github.com/o/r/pull/1: HTTP 403 GitHub rate limit exceeded, please retry shortly (resets at 2026-01-01T01:00:00.000Z)';
      issueRepository.getOpenPullRequestCiStatus.mockRejectedValue(
        new GitHubRateLimitError(rateLimitMessage),
      );
      const cache = new PullRequestStatusCache(() => 0);
      const response = await handlePullRequestStatus(
        issueRepository,
        cache,
        'https://github.com/o/r/pull/1',
      );
      expect(response.statusCode).toBe(429);
      expect(response.body).toEqual({ error: rateLimitMessage });
    });

    it('serves the stale cached value when the repository throws a GitHub rate limit error and a cache entry exists', async () => {
      const issueRepository = mock<IssueRepository>();
      const openPullRequest = {
        url: 'https://github.com/o/r/pull/1',
        isConflicted: false,
        mergeable: 'MERGEABLE',
        isPassedAllCiJob: true,
        isCiStateSuccess: true,
        isBranchOutOfDate: false,
        missingRequiredCheckNames: [],
      };
      const rateLimitMessage =
        'Failed to fetch CI status for https://github.com/o/r/pull/1: HTTP 403 GitHub rate limit exceeded, please retry shortly';
      issueRepository.getOpenPullRequestCiStatus
        .mockResolvedValueOnce(openPullRequest)
        .mockRejectedValue(new GitHubRateLimitError(rateLimitMessage));
      let now = 0;
      const cache = new PullRequestStatusCache(() => now);
      const url = 'https://github.com/o/r/pull/1';
      await handlePullRequestStatus(issueRepository, cache, url);
      now = PULL_REQUEST_STATUS_CACHE_TTL_MS + 1;
      const response = await handlePullRequestStatus(
        issueRepository,
        cache,
        url,
      );
      expect(response.statusCode).toBe(200);
      expect(response.body).toEqual({
        found: true,
        status: {
          isConflicted: false,
          mergeableStatus: 'MERGEABLE',
          isPassedAllCiJob: true,
          isCiStateSuccess: true,
          isBranchOutOfDate: false,
          missingRequiredCheckNames: [],
        },
      });
    });

    it('re-throws non-rate-limit errors from the repository', async () => {
      const issueRepository = mock<IssueRepository>();
      issueRepository.getOpenPullRequestCiStatus.mockRejectedValue(
        new Error('Network timeout'),
      );
      const cache = new PullRequestStatusCache(() => 0);
      await expect(
        handlePullRequestStatus(
          issueRepository,
          cache,
          'https://github.com/o/r/pull/1',
        ),
      ).rejects.toThrow('Network timeout');
    });
  });

  describe('handleProjectReadmeConfig', () => {
    const projectUrl = 'https://github.com/orgs/acme/projects/1';

    const makeResolver = (): ConsoleProjectResolver => {
      const project = mock<Project>();
      project.id = 'PVT_1';
      project.url = projectUrl;
      return async (pjcode) =>
        pjcode === 'acme' ? { pjcode, project } : null;
    };

    let fetchProjectReadmeSpy: jest.SpyInstance;

    beforeEach(() => {
      fetchProjectReadmeSpy = jest
        .spyOn(projectConfig, 'fetchProjectReadme')
        .mockResolvedValue(
          '# P\n<details>\n<summary>config</summary>\nmaximumPreparingIssuesCount: 7\n</details>\n',
        );
    });

    afterEach(() => {
      fetchProjectReadmeSpy.mockRestore();
    });

    it('returns 502 when resolveProject is null', async () => {
      const response = await handleProjectReadmeConfig(null, 'token', 'acme');
      expect(response.statusCode).toBe(502);
    });

    it('returns 502 when githubToken is null', async () => {
      const response = await handleProjectReadmeConfig(
        makeResolver(),
        null,
        'acme',
      );
      expect(response.statusCode).toBe(502);
    });

    it('returns 400 when pjcode is null', async () => {
      const response = await handleProjectReadmeConfig(
        makeResolver(),
        'token',
        null,
      );
      expect(response.statusCode).toBe(400);
    });

    it('returns 404 when project is not found', async () => {
      const response = await handleProjectReadmeConfig(
        makeResolver(),
        'token',
        'unknown',
      );
      expect(response.statusCode).toBe(404);
    });

    it('returns maximumPreparingIssuesCount null when readme is null', async () => {
      fetchProjectReadmeSpy.mockResolvedValue(null);
      const response = await handleProjectReadmeConfig(
        makeResolver(),
        'token',
        'acme',
      );
      expect(response.statusCode).toBe(200);
      expect(response.body).toEqual({ maximumPreparingIssuesCount: null });
    });

    it('returns maximumPreparingIssuesCount from parsed readme config', async () => {
      const response = await handleProjectReadmeConfig(
        makeResolver(),
        'gh-token',
        'acme',
      );
      expect(response.statusCode).toBe(200);
      expect(response.body).toEqual({ maximumPreparingIssuesCount: 7 });
      expect(fetchProjectReadmeSpy).toHaveBeenCalledWith(projectUrl, 'gh-token');
    });
  });
});
