import { mock } from 'jest-mock-extended';
import { Issue } from '../../../domain/entities/Issue';
import { IssueRepository } from '../../../domain/usecases/adapter-interfaces/IssueRepository';

const buildIssueFixture = (title: string): Issue => ({
  nameWithOwner: 'o/r',
  number: 1,
  title,
  state: 'OPEN',
  status: null,
  story: null,
  nextActionDate: null,
  nextActionHour: null,
  estimationMinutes: null,
  dependedIssueUrls: [],
  completionDate50PercentConfidence: null,
  url: 'https://github.com/o/r/issues/1',
  assignees: [],
  labels: [],
  org: 'o',
  repo: 'r',
  body: '',
  itemId: 'itemId',
  isPr: false,
  isInProgress: false,
  isClosed: false,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  author: 'octocat',
  closingIssueReferenceUrls: [],
});
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
  handlePullRequestStatus,
  handleRelatedPrs,
} from './consoleReadApi';

describe('consoleReadApi', () => {
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
      });
      issueRepository.getIssueByUrl.mockResolvedValue(
        buildIssueFixture('Issue title from repository'),
      );
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
      expect(issueRepository.getIssueByUrl).toHaveBeenCalledTimes(1);
    });

    it('returns the pull request title from the summary for pull request urls', async () => {
      const issueRepository = mock<IssueRepository>();
      issueRepository.getIssueOrPullRequestState.mockResolvedValue({
        state: 'CLOSED',
        merged: true,
        isPullRequest: true,
      });
      issueRepository.getPullRequestSummary.mockResolvedValue({
        title: 'Pull request title from summary',
        body: 'body',
        additions: 1,
        deletions: 0,
        changedFiles: 1,
      });
      const cache = new IssueTitleStateCache(() => 0);
      const url = 'https://github.com/o/r/pull/2';
      const response = await handleIssueTitle(issueRepository, cache, url);
      expect(response.body).toEqual({
        state: 'CLOSED',
        merged: true,
        isPullRequest: true,
        title: 'Pull request title from summary',
      });
      expect(issueRepository.getPullRequestSummary).toHaveBeenCalledWith(url);
      expect(issueRepository.getIssueByUrl).not.toHaveBeenCalled();
    });

    it('falls back to an empty title when the title source returns nothing', async () => {
      const issueRepository = mock<IssueRepository>();
      issueRepository.getIssueOrPullRequestState.mockResolvedValue({
        state: 'OPEN',
        merged: false,
        isPullRequest: false,
      });
      issueRepository.getIssueByUrl.mockResolvedValue(null);
      const cache = new IssueTitleStateCache(() => 0);
      const response = await handleIssueTitle(
        issueRepository,
        cache,
        'https://github.com/o/r/issues/3',
      );
      expect(response.body).toEqual({
        state: 'OPEN',
        merged: false,
        isPullRequest: false,
        title: '',
      });
    });

    it('re-fetches a non-merged result after the TTL elapses', async () => {
      const issueRepository = mock<IssueRepository>();
      issueRepository.getIssueOrPullRequestState.mockResolvedValue({
        state: 'OPEN',
        merged: false,
        isPullRequest: true,
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
  });

  describe('handlePullRequestStatus with the TTL cache', () => {
    const openPullRequest = {
      url: 'https://github.com/o/r/pull/1',
      branchName: 'feature',
      createdAt: new Date('2026-01-02T03:04:05Z'),
      isDraft: false,
      isConflicted: true,
      isPassedAllCiJob: false,
      isCiStateSuccess: false,
      isResolvedAllReviewComments: false,
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
      issueRepository.getOpenPullRequest.mockResolvedValue(openPullRequest);
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
          isPassedAllCiJob: false,
          isCiStateSuccess: false,
          isBranchOutOfDate: true,
          missingRequiredCheckNames: ['build', 'test'],
        },
      });
    });

    it('reports not found when the repository returns no open pull request', async () => {
      const issueRepository = mock<IssueRepository>();
      issueRepository.getOpenPullRequest.mockResolvedValue(null);
      const cache = new PullRequestStatusCache(() => 0);
      const response = await handlePullRequestStatus(
        issueRepository,
        cache,
        'https://github.com/o/r/pull/9',
      );
      expect(response.body).toEqual({ found: false, status: null });
    });

    it('caches within the TTL and re-fetches after the TTL elapses', async () => {
      const issueRepository = mock<IssueRepository>();
      issueRepository.getOpenPullRequest.mockResolvedValue(openPullRequest);
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
      expect(issueRepository.getOpenPullRequest).toHaveBeenCalledTimes(1);
      now = PULL_REQUEST_STATUS_CACHE_TTL_MS;
      await handlePullRequestStatus(
        issueRepository,
        cache,
        openPullRequest.url,
      );
      expect(issueRepository.getOpenPullRequest).toHaveBeenCalledTimes(2);
    });
  });
});
