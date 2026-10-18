import { HTTPError } from 'ky';
import { mock } from 'jest-mock-extended';
import type { MockProxy } from 'jest-mock-extended';
import type { Issue } from '../../../domain/entities/Issue';
import type { Project } from '../../../domain/entities/Project';
import type {
  IssueRepository,
  OpenPullRequestCiStatus,
  RelatedPullRequest,
} from '../../../domain/usecases/adapter-interfaces/IssueRepository';
import { GitHubConfirmedNotFoundError } from '../../../domain/usecases/ClearDependedIssueURLUseCase';
import { GitHubRateLimitError } from '../../repositories/issue/githubRateLimitRetry';
import {
  buildReadIssueRepositoryResolver,
  createReadOnlyTokenRotatingIssueRepository,
} from './readOnlyTokenRotator';

const buildKyHttpError = (status: number): HTTPError => {
  const response = new Response(null, { status });
  const request = new Request('https://api.github.com/repos/o/r/issues/1');
  const normalizedOptions: ConstructorParameters<typeof HTTPError>[2] = {
    method: 'get',
    headers: new Headers(),
    retry: {
      limit: 0,
      methods: [],
      statusCodes: [],
      afterStatusCodes: [],
      maxRetryAfter: Number.POSITIVE_INFINITY,
      backoffLimit: Number.POSITIVE_INFINITY,
      delay: () => 0,
      jitter: false,
      retryOnTimeout: false,
    },
    prefix: '',
    onDownloadProgress: undefined,
    onUploadProgress: undefined,
    context: {},
  };
  return new HTTPError(response, request, normalizedOptions);
};

type SettledRead<T> =
  { status: 'resolved'; value: T } | { status: 'rejected'; reason: unknown };

const settleRead = async <T>(read: Promise<T>): Promise<SettledRead<T>> => {
  try {
    return { status: 'resolved', value: await read };
  } catch (reason) {
    return { status: 'rejected', reason };
  }
};

type ObservedOwnTokenRead = {
  name: string;
  status: SettledRead<unknown>['status'];
  returnsOwnTokenResult: boolean;
  ownTokenCalls: unknown[][];
};

describe('createReadOnlyTokenRotatingIssueRepository', () => {
  describe('single repository', () => {
    it('returns the result from the only repository', async () => {
      const repo = mock<IssueRepository>();
      const writeRepo = mock<IssueRepository>();
      repo.getIssueOrPullRequestBody.mockResolvedValue('body text');

      const rotating = createReadOnlyTokenRotatingIssueRepository(
        [repo],
        writeRepo,
      );
      const result = await rotating.getIssueOrPullRequestBody(
        'https://github.com/o/r/issues/1',
      );

      expect(result).toBe('body text');
      expect(repo.getIssueOrPullRequestBody).toHaveBeenCalledWith(
        'https://github.com/o/r/issues/1',
      );
    });

    it('forwards the bypassCache option to the underlying repository', async () => {
      const repo = mock<IssueRepository>();
      const writeRepo = mock<IssueRepository>();
      const issue = mock<Issue>();
      repo.getIssueByUrl.mockResolvedValue(issue);

      const rotating = createReadOnlyTokenRotatingIssueRepository(
        [repo],
        writeRepo,
      );
      await rotating.getIssueByUrl('https://github.com/o/r/issues/1', {
        bypassCache: true,
      });

      expect(repo.getIssueByUrl).toHaveBeenCalledWith(
        'https://github.com/o/r/issues/1',
        { bypassCache: true },
      );
    });

    it('forwards the bypassCache option to findRelatedOpenPRs on the underlying repository', async () => {
      const repo = mock<IssueRepository>();
      const writeRepo = mock<IssueRepository>();
      repo.findRelatedOpenPRs.mockResolvedValue([]);

      const rotating = createReadOnlyTokenRotatingIssueRepository(
        [repo],
        writeRepo,
      );
      await rotating.findRelatedOpenPRs('https://github.com/o/r/issues/1', {
        bypassCache: true,
      });

      expect(repo.findRelatedOpenPRs).toHaveBeenCalledWith(
        'https://github.com/o/r/issues/1',
        { bypassCache: true },
      );
    });

    it('forwards a findRelatedOpenPRs call with only an issueUrl to the underlying repository', async () => {
      const repo = mock<IssueRepository>();
      const writeRepo = mock<IssueRepository>();
      repo.findRelatedOpenPRs.mockResolvedValue([]);

      const rotating = createReadOnlyTokenRotatingIssueRepository(
        [repo],
        writeRepo,
      );
      const result = await rotating.findRelatedOpenPRs(
        'https://github.com/o/r/issues/1',
      );

      expect(result).toEqual([]);
      expect(repo.findRelatedOpenPRs).toHaveBeenCalledWith(
        'https://github.com/o/r/issues/1',
      );
    });

    it('forwards the issueUpdatedAt option of getIssueOrPullRequestComments to the underlying repository', async () => {
      const repo = mock<IssueRepository>();
      const writeRepo = mock<IssueRepository>();
      repo.getIssueOrPullRequestComments.mockResolvedValue([]);
      const issueUpdatedAt = new Date('2026-07-06T00:00:00.000Z');

      const rotating = createReadOnlyTokenRotatingIssueRepository(
        [repo],
        writeRepo,
      );
      await rotating.getIssueOrPullRequestComments(
        'https://github.com/o/r/issues/1',
        { issueUpdatedAt },
      );

      expect(repo.getIssueOrPullRequestComments.mock.calls).toStrictEqual([
        ['https://github.com/o/r/issues/1', { issueUpdatedAt }],
      ]);
    });

    it('forwards a getIssueOrPullRequestComments call with only a URL to the underlying repository with that URL as the only argument', async () => {
      const repo = mock<IssueRepository>();
      const writeRepo = mock<IssueRepository>();
      repo.getIssueOrPullRequestComments.mockResolvedValue([]);

      const rotating = createReadOnlyTokenRotatingIssueRepository(
        [repo],
        writeRepo,
      );
      await rotating.getIssueOrPullRequestComments(
        'https://github.com/o/r/issues/1',
      );

      expect(repo.getIssueOrPullRequestComments.mock.calls).toStrictEqual([
        ['https://github.com/o/r/issues/1'],
      ]);
    });

    it('looks up the authenticated user login with the write repository and never asks a read repository whose App installation token cannot read the user', async () => {
      const readRepo = mock<IssueRepository>();
      const writeRepo = mock<IssueRepository>();
      readRepo.getAuthenticatedUserLogin.mockRejectedValue(
        new Error(
          'Failed to fetch authenticated user: 403 Resource not accessible by integration',
        ),
      );
      writeRepo.getAuthenticatedUserLogin.mockResolvedValue('primary-login');

      const rotating = createReadOnlyTokenRotatingIssueRepository(
        [readRepo],
        writeRepo,
      );

      await expect(rotating.getAuthenticatedUserLogin()).resolves.toBe(
        'primary-login',
      );
      expect(readRepo.getAuthenticatedUserLogin).not.toHaveBeenCalled();
    });

    it('re-throws any error from the single repository without rotating', async () => {
      const repo = mock<IssueRepository>();
      const writeRepo = mock<IssueRepository>();
      const error = new GitHubRateLimitError('rate limited');
      repo.getIssueOrPullRequestBody.mockRejectedValue(error);

      const rotating = createReadOnlyTokenRotatingIssueRepository(
        [repo],
        writeRepo,
      );
      await expect(
        rotating.getIssueOrPullRequestBody('https://github.com/o/r/issues/1'),
      ).rejects.toBe(error);
    });
  });

  describe('multiple repositories — rate-limit rotation', () => {
    it('tries the second repository when the first throws GitHubRateLimitError', async () => {
      const repo1 = mock<IssueRepository>();
      const repo2 = mock<IssueRepository>();
      const writeRepo = mock<IssueRepository>();
      repo1.getIssueOrPullRequestBody.mockRejectedValue(
        new GitHubRateLimitError('rate limited token-1'),
      );
      repo2.getIssueOrPullRequestBody.mockResolvedValue('body from token-2');

      const rotating = createReadOnlyTokenRotatingIssueRepository(
        [repo1, repo2],
        writeRepo,
      );
      const result = await rotating.getIssueOrPullRequestBody(
        'https://github.com/o/r/issues/1',
      );

      expect(result).toBe('body from token-2');
      expect(repo1.getIssueOrPullRequestBody).toHaveBeenCalledWith(
        'https://github.com/o/r/issues/1',
      );
      expect(repo2.getIssueOrPullRequestBody).toHaveBeenCalledWith(
        'https://github.com/o/r/issues/1',
      );
    });

    it('re-throws the last GitHubRateLimitError when all repositories are exhausted', async () => {
      const repo1 = mock<IssueRepository>();
      const repo2 = mock<IssueRepository>();
      const writeRepo = mock<IssueRepository>();
      const error1 = new GitHubRateLimitError('rate limited token-1');
      const error2 = new GitHubRateLimitError('rate limited token-2');
      repo1.getIssueOrPullRequestBody.mockRejectedValue(error1);
      repo2.getIssueOrPullRequestBody.mockRejectedValue(error2);

      const rotating = createReadOnlyTokenRotatingIssueRepository(
        [repo1, repo2],
        writeRepo,
      );
      await expect(
        rotating.getIssueOrPullRequestBody('https://github.com/o/r/issues/1'),
      ).rejects.toBe(error2);
    });

    it('does not rotate when the error is not a GitHubRateLimitError', async () => {
      const repo1 = mock<IssueRepository>();
      const repo2 = mock<IssueRepository>();
      const writeRepo = mock<IssueRepository>();
      const networkError = new Error('Connection refused');
      repo1.getIssueOrPullRequestBody.mockRejectedValue(networkError);

      const rotating = createReadOnlyTokenRotatingIssueRepository(
        [repo1, repo2],
        writeRepo,
      );
      await expect(
        rotating.getIssueOrPullRequestBody('https://github.com/o/r/issues/1'),
      ).rejects.toBe(networkError);
      expect(repo2.getIssueOrPullRequestBody).not.toHaveBeenCalled();
    });

    it('rotates through three repositories until one succeeds', async () => {
      const repo1 = mock<IssueRepository>();
      const repo2 = mock<IssueRepository>();
      const repo3 = mock<IssueRepository>();
      const writeRepo = mock<IssueRepository>();
      repo1.getIssueOrPullRequestBody.mockRejectedValue(
        new GitHubRateLimitError('rate limited token-1'),
      );
      repo2.getIssueOrPullRequestBody.mockRejectedValue(
        new GitHubRateLimitError('rate limited token-2'),
      );
      repo3.getIssueOrPullRequestBody.mockResolvedValue('body from token-3');

      const rotating = createReadOnlyTokenRotatingIssueRepository(
        [repo1, repo2, repo3],
        writeRepo,
      );
      const result = await rotating.getIssueOrPullRequestBody(
        'https://github.com/o/r/issues/1',
      );

      expect(result).toBe('body from token-3');
    });

    it('rotates on findRelatedOpenPrUrls as well', async () => {
      const repo1 = mock<IssueRepository>();
      const repo2 = mock<IssueRepository>();
      const writeRepo = mock<IssueRepository>();
      const expected = new Map([
        ['https://github.com/o/r/issues/1', ['https://github.com/o/r/pull/2']],
      ]);
      repo1.findRelatedOpenPrUrls.mockRejectedValue(
        new GitHubRateLimitError('rate limited token-1'),
      );
      repo2.findRelatedOpenPrUrls.mockResolvedValue(expected);

      const rotating = createReadOnlyTokenRotatingIssueRepository(
        [repo1, repo2],
        writeRepo,
      );
      const result = await rotating.findRelatedOpenPrUrls([
        'https://github.com/o/r/issues/1',
      ]);

      expect(result).toEqual(expected);
      expect(repo1.findRelatedOpenPrUrls).toHaveBeenCalledWith([
        'https://github.com/o/r/issues/1',
      ]);
      expect(repo2.findRelatedOpenPrUrls).toHaveBeenCalledWith([
        'https://github.com/o/r/issues/1',
      ]);
    });

    it('rotates on findRelatedOpenPRs when the first repository throws GitHubRateLimitError', async () => {
      const repo1 = mock<IssueRepository>();
      const repo2 = mock<IssueRepository>();
      const writeRepo = mock<IssueRepository>();
      repo1.findRelatedOpenPRs.mockRejectedValue(
        new GitHubRateLimitError('rate limited token-1'),
      );
      repo2.findRelatedOpenPRs.mockResolvedValue([]);

      const rotating = createReadOnlyTokenRotatingIssueRepository(
        [repo1, repo2],
        writeRepo,
      );
      const result = await rotating.findRelatedOpenPRs(
        'https://github.com/o/r/issues/1',
      );

      expect(result).toEqual([]);
      expect(repo1.findRelatedOpenPRs).toHaveBeenCalledWith(
        'https://github.com/o/r/issues/1',
      );
      expect(repo2.findRelatedOpenPRs).toHaveBeenCalledWith(
        'https://github.com/o/r/issues/1',
      );
    });

    it('rotates on getIssueOrPullRequestComments as well', async () => {
      const repo1 = mock<IssueRepository>();
      const repo2 = mock<IssueRepository>();
      const writeRepo = mock<IssueRepository>();
      repo1.getIssueOrPullRequestComments.mockRejectedValue(
        new GitHubRateLimitError('rate limited token-1'),
      );
      repo2.getIssueOrPullRequestComments.mockResolvedValue([]);

      const rotating = createReadOnlyTokenRotatingIssueRepository(
        [repo1, repo2],
        writeRepo,
      );
      const result = await rotating.getIssueOrPullRequestComments(
        'https://github.com/o/r/issues/1',
      );

      expect(result).toEqual([]);
      expect(repo1.getIssueOrPullRequestComments).toHaveBeenCalledWith(
        'https://github.com/o/r/issues/1',
      );
      expect(repo2.getIssueOrPullRequestComments).toHaveBeenCalledWith(
        'https://github.com/o/r/issues/1',
      );
    });

    it('rotates on getLatestReopenedEventAt as well', async () => {
      const repo1 = mock<IssueRepository>();
      const repo2 = mock<IssueRepository>();
      const writeRepo = mock<IssueRepository>();
      const issue = mock<Issue>();
      const expected = new Date('2024-01-01T00:00:00Z');
      repo1.getLatestReopenedEventAt.mockRejectedValue(
        new GitHubRateLimitError('rate limited token-1'),
      );
      repo2.getLatestReopenedEventAt.mockResolvedValue(expected);

      const rotating = createReadOnlyTokenRotatingIssueRepository(
        [repo1, repo2],
        writeRepo,
      );
      const result = await rotating.getLatestReopenedEventAt(issue);

      expect(result).toEqual(expected);
      expect(repo1.getLatestReopenedEventAt).toHaveBeenCalledWith(issue);
      expect(repo2.getLatestReopenedEventAt).toHaveBeenCalledWith(issue);
    });

    it('delegates write methods to the dedicated write repository, not any read repository', async () => {
      const repo1 = mock<IssueRepository>();
      const repo2 = mock<IssueRepository>();
      const writeRepo = mock<IssueRepository>();
      writeRepo.deleteAllCommentsByUrl.mockResolvedValue(undefined);

      const rotating = createReadOnlyTokenRotatingIssueRepository(
        [repo1, repo2],
        writeRepo,
      );
      await rotating.deleteAllCommentsByUrl('https://github.com/o/r/issues/1');

      expect(writeRepo.deleteAllCommentsByUrl).toHaveBeenCalledWith(
        'https://github.com/o/r/issues/1',
      );
      expect(repo1.deleteAllCommentsByUrl).not.toHaveBeenCalled();
      expect(repo2.deleteAllCommentsByUrl).not.toHaveBeenCalled();
    });

    it('delegates appendIssueToProjectCache to the write repository, not read repositories', async () => {
      const repo1 = mock<IssueRepository>();
      const repo2 = mock<IssueRepository>();
      const writeRepo = mock<IssueRepository>();
      writeRepo.appendIssueToProjectCache.mockResolvedValue(undefined);

      const rotating = createReadOnlyTokenRotatingIssueRepository(
        [repo1, repo2],
        writeRepo,
      );
      const issue = mock<Issue>();
      await rotating.appendIssueToProjectCache('proj-1', issue);

      expect(writeRepo.appendIssueToProjectCache).toHaveBeenCalledWith(
        'proj-1',
        issue,
      );
      expect(repo1.appendIssueToProjectCache).not.toHaveBeenCalled();
      expect(repo2.appendIssueToProjectCache).not.toHaveBeenCalled();
    });

    it('delegates removeIssueFromProjectCache to the write repository, not read repositories', async () => {
      const repo1 = mock<IssueRepository>();
      const repo2 = mock<IssueRepository>();
      const writeRepo = mock<IssueRepository>();
      writeRepo.removeIssueFromProjectCache.mockResolvedValue(undefined);

      const rotating = createReadOnlyTokenRotatingIssueRepository(
        [repo1, repo2],
        writeRepo,
      );
      const issue = mock<Issue>();
      await rotating.removeIssueFromProjectCache('proj-1', issue);

      expect(writeRepo.removeIssueFromProjectCache).toHaveBeenCalledWith(
        'proj-1',
        issue,
      );
      expect(repo1.removeIssueFromProjectCache).not.toHaveBeenCalled();
      expect(repo2.removeIssueFromProjectCache).not.toHaveBeenCalled();
    });
  });

  describe('fallback to the write repository holding the project own token', () => {
    const issueUrl = 'https://github.com/o/r/issues/1';
    const prUrl = 'https://github.com/o/r/pull/2';
    const project: Project = {
      id: 'project-1',
      url: 'https://github.com/users/o/projects/1',
      databaseId: 1,
      name: 'project',
      status: { name: 'Status', fieldId: 'status-field', statuses: [] },
      nextActionDate: null,
      nextActionHour: null,
      story: null,
      remainingEstimationMinutes: null,
      dependedIssueUrlSeparatedByComma: null,
      completionDate50PercentConfidence: null,
      agent: null,
    };
    const ownTokenOpenPullRequest: RelatedPullRequest = {
      url: prUrl,
      branchName: 'feature',
      createdAt: new Date('2026-10-18T00:00:00.000Z'),
      isDraft: false,
      isConflicted: false,
      mergeable: 'MERGEABLE',
      isPassedAllCiJob: true,
      isCiStateSuccess: true,
      isResolvedAllReviewComments: true,
      isBranchOutOfDate: false,
      missingRequiredCheckNames: [],
      reviewDecision: null,
    };
    const ownTokenCiStatus: OpenPullRequestCiStatus = {
      url: prUrl,
      branchName: 'feature',
      createdAt: '2026-10-18T00:00:00.000Z',
      isDraft: false,
      isConflicted: false,
      mergeable: 'MERGEABLE',
      isPassedAllCiJob: true,
      isCiStateSuccess: true,
      isBranchOutOfDate: false,
      missingRequiredCheckNames: [],
    };

    it('repeats a read refused with HTTP 403 or HTTP 404 on the write repository with the same arguments and returns its result', async () => {
      const refusedReadCases: { name: string; error: Error }[] = [
        { name: 'ky HTTPError with status 403', error: buildKyHttpError(403) },
        { name: 'ky HTTPError with status 404', error: buildKyHttpError(404) },
        {
          name: 'GitHubConfirmedNotFoundError',
          error: new GitHubConfirmedNotFoundError(issueUrl),
        },
        {
          name: 'plain Error whose message carries HTTP 403',
          error: new Error(
            'Failed to fetch issue o/r#1: HTTP 403 permission denied, the token cannot perform this operation Resource not accessible by integration',
          ),
        },
        {
          name: 'plain Error whose message carries HTTP 404',
          error: new Error('Failed to fetch issue o/r#1: HTTP 404 Not Found'),
        },
      ];

      const observed: ObservedOwnTokenRead[] = [];
      for (const refusedReadCase of refusedReadCases) {
        const readRepo = mock<IssueRepository>();
        const writeRepo = mock<IssueRepository>();
        const ownTokenIssue = mock<Issue>();
        readRepo.getIssueByUrl.mockRejectedValue(refusedReadCase.error);
        writeRepo.getIssueByUrl.mockResolvedValue(ownTokenIssue);
        const rotating = createReadOnlyTokenRotatingIssueRepository(
          [readRepo],
          writeRepo,
        );

        const settled = await settleRead(
          rotating.getIssueByUrl(issueUrl, { bypassCache: true }),
        );
        observed.push({
          name: refusedReadCase.name,
          status: settled.status,
          returnsOwnTokenResult:
            settled.status === 'resolved' && settled.value === ownTokenIssue,
          ownTokenCalls: writeRepo.getIssueByUrl.mock.calls,
        });
      }

      expect(observed).toEqual(
        refusedReadCases.map((refusedReadCase) => ({
          name: refusedReadCase.name,
          status: 'resolved',
          returnsOwnTokenResult: true,
          ownTokenCalls: [[issueUrl, { bypassCache: true }]],
        })),
      );
    });

    it('repeats a read that resolves to no result on the write repository with the same arguments and returns its result', async () => {
      const noResultReadCases: {
        name: string;
        arrange: (
          readRepo: MockProxy<IssueRepository>,
          writeRepo: MockProxy<IssueRepository>,
        ) => unknown;
        read: (repository: IssueRepository) => Promise<unknown>;
        ownTokenCalls: (writeRepo: MockProxy<IssueRepository>) => unknown[][];
        expectedOwnTokenCalls: unknown[][];
      }[] = [
        {
          name: 'getIssueByUrl',
          arrange: (readRepo, writeRepo) => {
            const ownTokenIssue = mock<Issue>();
            readRepo.getIssueByUrl.mockResolvedValue(null);
            writeRepo.getIssueByUrl.mockResolvedValue(ownTokenIssue);
            return ownTokenIssue;
          },
          read: (repository) =>
            repository.getIssueByUrl(issueUrl, { bypassCache: true }),
          ownTokenCalls: (writeRepo) => writeRepo.getIssueByUrl.mock.calls,
          expectedOwnTokenCalls: [[issueUrl, { bypassCache: true }]],
        },
        {
          name: 'getIssueBodyByUrl',
          arrange: (readRepo, writeRepo) => {
            readRepo.getIssueBodyByUrl.mockResolvedValue(null);
            writeRepo.getIssueBodyByUrl.mockResolvedValue(
              'issue body via own token',
            );
            return 'issue body via own token';
          },
          read: (repository) => repository.getIssueBodyByUrl(issueUrl),
          ownTokenCalls: (writeRepo) => writeRepo.getIssueBodyByUrl.mock.calls,
          expectedOwnTokenCalls: [[issueUrl]],
        },
        {
          name: 'get',
          arrange: (readRepo, writeRepo) => {
            const ownTokenIssue = mock<Issue>();
            readRepo.get.mockResolvedValue(null);
            writeRepo.get.mockResolvedValue(ownTokenIssue);
            return ownTokenIssue;
          },
          read: (repository) => repository.get(issueUrl, project),
          ownTokenCalls: (writeRepo) => writeRepo.get.mock.calls,
          expectedOwnTokenCalls: [[issueUrl, project]],
        },
        {
          name: 'getOpenPullRequest',
          arrange: (readRepo, writeRepo) => {
            readRepo.getOpenPullRequest.mockResolvedValue(null);
            writeRepo.getOpenPullRequest.mockResolvedValue(
              ownTokenOpenPullRequest,
            );
            return ownTokenOpenPullRequest;
          },
          read: (repository) => repository.getOpenPullRequest(prUrl),
          ownTokenCalls: (writeRepo) => writeRepo.getOpenPullRequest.mock.calls,
          expectedOwnTokenCalls: [[prUrl]],
        },
        {
          name: 'getOpenPullRequestCiStatus',
          arrange: (readRepo, writeRepo) => {
            readRepo.getOpenPullRequestCiStatus.mockResolvedValue(null);
            writeRepo.getOpenPullRequestCiStatus.mockResolvedValue(
              ownTokenCiStatus,
            );
            return ownTokenCiStatus;
          },
          read: (repository) => repository.getOpenPullRequestCiStatus(prUrl),
          ownTokenCalls: (writeRepo) =>
            writeRepo.getOpenPullRequestCiStatus.mock.calls,
          expectedOwnTokenCalls: [[prUrl]],
        },
      ];

      const observed: ObservedOwnTokenRead[] = [];
      for (const noResultReadCase of noResultReadCases) {
        const readRepo = mock<IssueRepository>();
        const writeRepo = mock<IssueRepository>();
        const ownTokenResult = noResultReadCase.arrange(readRepo, writeRepo);
        const rotating = createReadOnlyTokenRotatingIssueRepository(
          [readRepo],
          writeRepo,
        );

        const settled = await settleRead(noResultReadCase.read(rotating));
        observed.push({
          name: noResultReadCase.name,
          status: settled.status,
          returnsOwnTokenResult:
            settled.status === 'resolved' && settled.value === ownTokenResult,
          ownTokenCalls: noResultReadCase.ownTokenCalls(writeRepo),
        });
      }

      expect(observed).toEqual(
        noResultReadCases.map((noResultReadCase) => ({
          name: noResultReadCase.name,
          status: 'resolved',
          returnsOwnTokenResult: true,
          ownTokenCalls: noResultReadCase.expectedOwnTokenCalls,
        })),
      );
    });

    it('moves past a rate-limited read repository and then repeats the read refused with HTTP 404 on the write repository', async () => {
      const repo1 = mock<IssueRepository>();
      const repo2 = mock<IssueRepository>();
      const writeRepo = mock<IssueRepository>();
      repo1.getIssueBodyByUrl.mockRejectedValue(
        new GitHubRateLimitError('rate limited token-1'),
      );
      repo2.getIssueBodyByUrl.mockRejectedValue(buildKyHttpError(404));
      writeRepo.getIssueBodyByUrl.mockResolvedValue('issue body via own token');

      const rotating = createReadOnlyTokenRotatingIssueRepository(
        [repo1, repo2],
        writeRepo,
      );

      await expect(rotating.getIssueBodyByUrl(issueUrl)).resolves.toBe(
        'issue body via own token',
      );
      expect(repo1.getIssueBodyByUrl.mock.calls).toStrictEqual([[issueUrl]]);
      expect(repo2.getIssueBodyByUrl.mock.calls).toStrictEqual([[issueUrl]]);
      expect(writeRepo.getIssueBodyByUrl.mock.calls).toStrictEqual([
        [issueUrl],
      ]);
    });

    it('returns the write repository result for a read refused with HTTP 403 without asking the remaining read repositories', async () => {
      const repo1 = mock<IssueRepository>();
      const repo2 = mock<IssueRepository>();
      const writeRepo = mock<IssueRepository>();
      repo1.getIssueOrPullRequestBody.mockRejectedValue(buildKyHttpError(403));
      repo2.getIssueOrPullRequestBody.mockResolvedValue('body via token-2');
      writeRepo.getIssueOrPullRequestBody.mockResolvedValue(
        'body via own token',
      );

      const rotating = createReadOnlyTokenRotatingIssueRepository(
        [repo1, repo2],
        writeRepo,
      );

      await expect(rotating.getIssueOrPullRequestBody(issueUrl)).resolves.toBe(
        'body via own token',
      );
      expect(repo2.getIssueOrPullRequestBody).not.toHaveBeenCalled();
      expect(writeRepo.getIssueOrPullRequestBody.mock.calls).toStrictEqual([
        [issueUrl],
      ]);
    });

    it('rejects with the write repository error when the repeated read with the project own token fails', async () => {
      const readRepo = mock<IssueRepository>();
      const writeRepo = mock<IssueRepository>();
      const ownTokenError = new Error(
        'Failed to fetch issue o/r#1: HTTP 404 Not Found',
      );
      readRepo.getIssueOrPullRequestBody.mockRejectedValue(
        buildKyHttpError(404),
      );
      writeRepo.getIssueOrPullRequestBody.mockRejectedValue(ownTokenError);

      const rotating = createReadOnlyTokenRotatingIssueRepository(
        [readRepo],
        writeRepo,
      );

      await expect(rotating.getIssueOrPullRequestBody(issueUrl)).rejects.toBe(
        ownTokenError,
      );
      expect(writeRepo.getIssueOrPullRequestBody.mock.calls).toStrictEqual([
        [issueUrl],
      ]);
    });

    it('returns a read result that is not null as is, an empty array or an empty string included, without asking the write repository', async () => {
      const presentResultCases: {
        name: string;
        arrange: (readRepo: MockProxy<IssueRepository>) => unknown;
        read: (repository: IssueRepository) => Promise<unknown>;
        ownTokenCalls: (writeRepo: MockProxy<IssueRepository>) => unknown[][];
      }[] = [
        {
          name: 'getIssueOrPullRequestComments resolving an empty array',
          arrange: (readRepo) => {
            const emptyComments: Awaited<
              ReturnType<IssueRepository['getIssueOrPullRequestComments']>
            > = [];
            readRepo.getIssueOrPullRequestComments.mockResolvedValue(
              emptyComments,
            );
            return emptyComments;
          },
          read: (repository) =>
            repository.getIssueOrPullRequestComments(issueUrl),
          ownTokenCalls: (writeRepo) =>
            writeRepo.getIssueOrPullRequestComments.mock.calls,
        },
        {
          name: 'findRelatedOpenPRs resolving an empty array',
          arrange: (readRepo) => {
            const emptyPullRequests: RelatedPullRequest[] = [];
            readRepo.findRelatedOpenPRs.mockResolvedValue(emptyPullRequests);
            return emptyPullRequests;
          },
          read: (repository) => repository.findRelatedOpenPRs(issueUrl),
          ownTokenCalls: (writeRepo) => writeRepo.findRelatedOpenPRs.mock.calls,
        },
        {
          name: 'getIssueOrPullRequestBody resolving an empty string',
          arrange: (readRepo) => {
            readRepo.getIssueOrPullRequestBody.mockResolvedValue('');
            return '';
          },
          read: (repository) => repository.getIssueOrPullRequestBody(issueUrl),
          ownTokenCalls: (writeRepo) =>
            writeRepo.getIssueOrPullRequestBody.mock.calls,
        },
        {
          name: 'getIssueBodyByUrl resolving a body',
          arrange: (readRepo) => {
            readRepo.getIssueBodyByUrl.mockResolvedValue(
              'issue body via App token',
            );
            return 'issue body via App token';
          },
          read: (repository) => repository.getIssueBodyByUrl(issueUrl),
          ownTokenCalls: (writeRepo) => writeRepo.getIssueBodyByUrl.mock.calls,
        },
      ];

      const observed: {
        name: string;
        status: SettledRead<unknown>['status'];
        returnsTheReadResult: boolean;
        ownTokenCalls: unknown[][];
      }[] = [];
      for (const presentResultCase of presentResultCases) {
        const readRepo = mock<IssueRepository>();
        const writeRepo = mock<IssueRepository>();
        const readResult = presentResultCase.arrange(readRepo);
        const rotating = createReadOnlyTokenRotatingIssueRepository(
          [readRepo],
          writeRepo,
        );

        const settled = await settleRead(presentResultCase.read(rotating));
        observed.push({
          name: presentResultCase.name,
          status: settled.status,
          returnsTheReadResult:
            settled.status === 'resolved' && settled.value === readResult,
          ownTokenCalls: presentResultCase.ownTokenCalls(writeRepo),
        });
      }

      expect(observed).toEqual(
        presentResultCases.map((presentResultCase) => ({
          name: presentResultCase.name,
          status: 'resolved',
          returnsTheReadResult: true,
          ownTokenCalls: [],
        })),
      );
    });

    it('re-throws the last GitHubRateLimitError without asking the write repository when every read repository is rate-limited', async () => {
      const repo1 = mock<IssueRepository>();
      const repo2 = mock<IssueRepository>();
      const writeRepo = mock<IssueRepository>();
      const error2 = new GitHubRateLimitError('rate limited token-2');
      repo1.getIssueBodyByUrl.mockRejectedValue(
        new GitHubRateLimitError('rate limited token-1'),
      );
      repo2.getIssueBodyByUrl.mockRejectedValue(error2);
      writeRepo.getIssueBodyByUrl.mockResolvedValue('issue body via own token');

      const rotating = createReadOnlyTokenRotatingIssueRepository(
        [repo1, repo2],
        writeRepo,
      );

      await expect(rotating.getIssueBodyByUrl(issueUrl)).rejects.toBe(error2);
      expect(writeRepo.getIssueBodyByUrl).not.toHaveBeenCalled();
    });

    it('re-throws an error that is neither a rate limit nor HTTP 403 or HTTP 404 without asking the write repository', async () => {
      const rethrownErrorCases: { name: string; error: Error }[] = [
        { name: 'plain Error HTTP 500', error: new Error('HTTP 500') },
        {
          name: 'plain Error whose message carries HTTP 401',
          error: new Error(
            'Failed to fetch issue o/r#1: HTTP 401 Bad credentials',
          ),
        },
        { name: 'ky HTTPError with status 500', error: buildKyHttpError(500) },
        { name: 'ky HTTPError with status 401', error: buildKyHttpError(401) },
        { name: 'network Error', error: new Error('Connection refused') },
      ];

      const observed: {
        name: string;
        rejectsWithTheReadError: boolean;
        ownTokenCalls: unknown[][];
      }[] = [];
      for (const rethrownErrorCase of rethrownErrorCases) {
        const readRepo = mock<IssueRepository>();
        const writeRepo = mock<IssueRepository>();
        readRepo.getIssueBodyByUrl.mockRejectedValue(rethrownErrorCase.error);
        writeRepo.getIssueBodyByUrl.mockResolvedValue(
          'issue body via own token',
        );
        const rotating = createReadOnlyTokenRotatingIssueRepository(
          [readRepo],
          writeRepo,
        );

        const settled = await settleRead(rotating.getIssueBodyByUrl(issueUrl));
        observed.push({
          name: rethrownErrorCase.name,
          rejectsWithTheReadError:
            settled.status === 'rejected' &&
            settled.reason === rethrownErrorCase.error,
          ownTokenCalls: writeRepo.getIssueBodyByUrl.mock.calls,
        });
      }

      expect(observed).toEqual(
        rethrownErrorCases.map((rethrownErrorCase) => ({
          name: rethrownErrorCase.name,
          rejectsWithTheReadError: true,
          ownTokenCalls: [],
        })),
      );
    });
  });
});

describe('buildReadIssueRepositoryResolver', () => {
  describe('consoleGithubAppPrivateKeyPaths absent, empty or minting no token — falls back to standard owner-based resolver', () => {
    it('returns a resolver that calls the token resolver with the repository owner', async () => {
      const primaryRepo = mock<IssueRepository>();
      const buildIssueRepositoryForToken = jest
        .fn()
        .mockReturnValue(primaryRepo);
      const resolveGithubToken = jest
        .fn()
        .mockReturnValue('resolved-write-token');
      const mintTokens = jest.fn().mockResolvedValue([]);
      const resolveProjectName = jest.fn().mockReturnValue('umino');

      const resolver = await buildReadIssueRepositoryResolver(
        undefined,
        mintTokens,
        buildIssueRepositoryForToken,
        resolveGithubToken,
        resolveProjectName,
      );
      const repo = resolver('https://github.com/owner/repo/issues/1');

      expect(repo).toBe(primaryRepo);
      expect(resolveGithubToken).toHaveBeenCalledWith('owner');
      expect(buildIssueRepositoryForToken).toHaveBeenCalledWith(
        'resolved-write-token',
      );
      expect(mintTokens).not.toHaveBeenCalled();
    });

    it('returns a resolver when consoleGithubAppPrivateKeyPaths is an empty map', async () => {
      const primaryRepo = mock<IssueRepository>();
      const buildIssueRepositoryForToken = jest
        .fn()
        .mockReturnValue(primaryRepo);
      const resolveGithubToken = jest
        .fn()
        .mockReturnValue('resolved-write-token');
      const mintTokens = jest.fn().mockResolvedValue([]);
      const resolveProjectName = jest.fn().mockReturnValue('umino');

      const resolver = await buildReadIssueRepositoryResolver(
        {},
        mintTokens,
        buildIssueRepositoryForToken,
        resolveGithubToken,
        resolveProjectName,
      );
      const repo = resolver('https://github.com/owner/repo/issues/1');

      expect(repo).toBe(primaryRepo);
      expect(resolveGithubToken).toHaveBeenCalledWith('owner');
      expect(mintTokens).not.toHaveBeenCalled();
    });

    it('falls back to owner-based resolver when mintTokens returns empty array', async () => {
      const primaryRepo = mock<IssueRepository>();
      const buildIssueRepositoryForToken = jest
        .fn()
        .mockReturnValue(primaryRepo);
      const resolveGithubToken = jest
        .fn()
        .mockReturnValue('resolved-write-token');
      const mintTokens = jest.fn().mockResolvedValue([]);
      const resolveProjectName = jest.fn().mockReturnValue('umino');

      const resolver = await buildReadIssueRepositoryResolver(
        {
          umino: ['/path/key1-private-key.pem', '/path/key2-private-key.pem'],
        },
        mintTokens,
        buildIssueRepositoryForToken,
        resolveGithubToken,
        resolveProjectName,
      );
      const repo = resolver('https://github.com/owner/repo/issues/1');

      expect(repo).toBe(primaryRepo);
      expect(mintTokens).toHaveBeenCalledWith([
        '/path/key1-private-key.pem',
        '/path/key2-private-key.pem',
      ]);
    });
  });

  describe('consoleGithubAppPrivateKeyPaths holding the umino project key paths — mints tokens and uses rotating resolver', () => {
    it('mints tokens and routes reads through the rotating pool', async () => {
      const readRepo1 = mock<IssueRepository>();
      const readRepo2 = mock<IssueRepository>();
      const writeRepo = mock<IssueRepository>();
      readRepo1.getIssueOrPullRequestBody.mockRejectedValue(
        new GitHubRateLimitError('rate limited token-1'),
      );
      readRepo2.getIssueOrPullRequestBody.mockResolvedValue(
        'body from token-2',
      );

      const buildIssueRepositoryForToken = jest
        .fn()
        .mockImplementationOnce(() => readRepo1)
        .mockImplementationOnce(() => readRepo2)
        .mockImplementation(() => writeRepo);
      const resolveGithubToken = jest.fn().mockReturnValue('write-token');
      const mintTokens = jest.fn().mockResolvedValue(['token-1', 'token-2']);
      const resolveProjectName = jest.fn().mockReturnValue('umino');

      const resolver = await buildReadIssueRepositoryResolver(
        {
          umino: ['/path/key1-private-key.pem', '/path/key2-private-key.pem'],
        },
        mintTokens,
        buildIssueRepositoryForToken,
        resolveGithubToken,
        resolveProjectName,
      );

      expect(mintTokens).toHaveBeenCalledWith([
        '/path/key1-private-key.pem',
        '/path/key2-private-key.pem',
      ]);
      expect(buildIssueRepositoryForToken).toHaveBeenCalledWith('token-1');
      expect(buildIssueRepositoryForToken).toHaveBeenCalledWith('token-2');
      expect(resolveGithubToken).not.toHaveBeenCalled();

      const repo = resolver('https://github.com/owner/repo/issues/1');
      const result = await repo.getIssueOrPullRequestBody(
        'https://github.com/owner/repo/issues/1',
      );
      expect(result).toBe('body from token-2');
    });

    it('skips the first key path when it yields no token and uses the second', async () => {
      const readRepo = mock<IssueRepository>();
      const writeRepo = mock<IssueRepository>();
      readRepo.getIssueOrPullRequestBody.mockResolvedValue(
        'body from second key',
      );

      const buildIssueRepositoryForToken = jest
        .fn()
        .mockImplementationOnce(() => readRepo)
        .mockImplementation(() => writeRepo);
      const resolveGithubToken = jest.fn().mockReturnValue('write-token');
      const mintTokens = jest.fn().mockResolvedValue(['token-from-second-key']);
      const resolveProjectName = jest.fn().mockReturnValue('umino');

      const resolver = await buildReadIssueRepositoryResolver(
        {
          umino: ['/path/key1-private-key.pem', '/path/key2-private-key.pem'],
        },
        mintTokens,
        buildIssueRepositoryForToken,
        resolveGithubToken,
        resolveProjectName,
      );

      expect(buildIssueRepositoryForToken).toHaveBeenCalledTimes(1);
      expect(buildIssueRepositoryForToken).toHaveBeenCalledWith(
        'token-from-second-key',
      );

      const repo = resolver('https://github.com/owner/repo/issues/1');
      const result = await repo.getIssueOrPullRequestBody(
        'https://github.com/owner/repo/issues/1',
      );
      expect(result).toBe('body from second key');
    });

    it('routes write operations to the URL-specific write repository, not a read-only token', async () => {
      const readRepo = mock<IssueRepository>();
      const writeRepo = mock<IssueRepository>();
      writeRepo.deleteAllCommentsByUrl.mockResolvedValue(undefined);

      const buildIssueRepositoryForToken = jest
        .fn()
        .mockImplementationOnce(() => readRepo)
        .mockImplementation(() => writeRepo);
      const resolveGithubToken = jest.fn().mockReturnValue('write-token');
      const mintTokens = jest.fn().mockResolvedValue(['token-1']);
      const resolveProjectName = jest.fn().mockReturnValue('umino');

      const resolver = await buildReadIssueRepositoryResolver(
        { umino: ['/path/key1-private-key.pem'] },
        mintTokens,
        buildIssueRepositoryForToken,
        resolveGithubToken,
        resolveProjectName,
      );

      const repo = resolver('https://github.com/owner-a/repo/issues/1');
      await repo.deleteAllCommentsByUrl('https://github.com/o/r/issues/1');

      expect(writeRepo.deleteAllCommentsByUrl).toHaveBeenCalledWith(
        'https://github.com/o/r/issues/1',
      );
      expect(readRepo.deleteAllCommentsByUrl).not.toHaveBeenCalled();
      expect(resolveGithubToken).toHaveBeenCalledWith('owner-a');
    });

    it('looks up the authenticated user login with the primary-token write repository when the read pool holds only an App installation token', async () => {
      const readRepo = mock<IssueRepository>();
      const writeRepo = mock<IssueRepository>();
      readRepo.getAuthenticatedUserLogin.mockRejectedValue(
        new Error(
          'Failed to fetch authenticated user: 403 Resource not accessible by integration',
        ),
      );
      writeRepo.getAuthenticatedUserLogin.mockResolvedValue('primary-login');

      const buildIssueRepositoryForToken = jest
        .fn()
        .mockImplementationOnce(() => readRepo)
        .mockImplementation(() => writeRepo);
      const resolveGithubToken = jest.fn().mockReturnValue('write-token');
      const mintTokens = jest.fn().mockResolvedValue(['token-1']);
      const resolveProjectName = jest.fn().mockReturnValue('umino');

      const resolver = await buildReadIssueRepositoryResolver(
        { umino: ['/path/key1-private-key.pem'] },
        mintTokens,
        buildIssueRepositoryForToken,
        resolveGithubToken,
        resolveProjectName,
      );

      const repo = resolver('https://github.com/owner-a/repo/issues/1');

      await expect(repo.getAuthenticatedUserLogin()).resolves.toBe(
        'primary-login',
      );
      expect(readRepo.getAuthenticatedUserLogin).not.toHaveBeenCalled();
      expect(resolveGithubToken).toHaveBeenCalledWith('owner-a');
      expect(buildIssueRepositoryForToken).toHaveBeenCalledWith('write-token');
    });
  });

  describe('consoleGithubAppPrivateKeyPaths keyed by console project name — each project reads with its own App tokens and every other repository with its own token', () => {
    const uminoIssueUrl =
      'https://github.com/umino-owner/umino-repository/issues/1';
    const otherIssueUrl =
      'https://github.com/other-owner/other-repository/issues/2';
    const strangerIssueUrl =
      'https://github.com/stranger-owner/stranger-repository/issues/3';

    const buildResolverFixture = (
      mintedTokensByJoinedKeyPaths: Map<string, string[]>,
    ) => {
      const repositoriesByToken = new Map<string, MockProxy<IssueRepository>>();
      const repositoryForToken = (
        token: string,
      ): MockProxy<IssueRepository> => {
        const existingRepository = repositoriesByToken.get(token);
        if (existingRepository !== undefined) {
          return existingRepository;
        }
        const createdRepository = mock<IssueRepository>();
        repositoriesByToken.set(token, createdRepository);
        return createdRepository;
      };
      const mintTokens = jest.fn((keyPaths: string[]): Promise<string[]> =>
        Promise.resolve(
          mintedTokensByJoinedKeyPaths.get(keyPaths.join(',')) ?? [],
        ),
      );
      const buildIssueRepositoryForToken = jest.fn(
        (token: string): IssueRepository => repositoryForToken(token),
      );
      const resolveGithubToken = jest.fn(
        (repositoryOwner: string): string => `own-token-of-${repositoryOwner}`,
      );
      const projectNameByRepositoryOwner = new Map<string, string>([
        ['umino-owner', 'umino'],
        ['other-owner', 'other'],
      ]);
      const resolveProjectName = jest.fn(
        (repositoryOwner: string): string | null =>
          projectNameByRepositoryOwner.get(repositoryOwner) ?? null,
      );
      return {
        repositoryForToken,
        mintTokens,
        buildIssueRepositoryForToken,
        resolveGithubToken,
        resolveProjectName,
      };
    };

    it('reads an issue of the umino project through the umino App installation token, not the own token, after asking the project name of the repository owner', async () => {
      const fixture = buildResolverFixture(
        new Map([['/umino.pem', ['umino-app-token']]]),
      );
      fixture
        .repositoryForToken('umino-app-token')
        .getIssueBodyByUrl.mockResolvedValue('body read with umino-app-token');
      const uminoOwnRepository = fixture.repositoryForToken(
        'own-token-of-umino-owner',
      );
      uminoOwnRepository.getIssueBodyByUrl.mockResolvedValue(
        'body read with own-token-of-umino-owner',
      );

      const resolver = await buildReadIssueRepositoryResolver(
        { umino: ['/umino.pem'] },
        fixture.mintTokens,
        fixture.buildIssueRepositoryForToken,
        fixture.resolveGithubToken,
        fixture.resolveProjectName,
      );
      const body =
        await resolver(uminoIssueUrl).getIssueBodyByUrl(uminoIssueUrl);

      expect({
        body,
        projectNameLookups: fixture.resolveProjectName.mock.calls,
        ownTokenReads: uminoOwnRepository.getIssueBodyByUrl.mock.calls,
      }).toEqual({
        body: 'body read with umino-app-token',
        projectNameLookups: [['umino-owner']],
        ownTokenReads: [],
      });
    });

    it('returns the own-token repository unchanged for a repository whose console project has no App key paths or that belongs to no console project, while the umino project still reads through its App token', async () => {
      const ownTokenCases: { name: string; url: string; ownToken: string }[] = [
        {
          name: 'console project without an App key path entry',
          url: otherIssueUrl,
          ownToken: 'own-token-of-other-owner',
        },
        {
          name: 'repository owner of no console project',
          url: strangerIssueUrl,
          ownToken: 'own-token-of-stranger-owner',
        },
      ];

      const observed: {
        name: string;
        returnsTheOwnTokenRepository: boolean;
        ownTokenBody: string | null;
        uminoBody: string | null;
        uminoAppReads: unknown[][];
      }[] = [];
      for (const ownTokenCase of ownTokenCases) {
        const fixture = buildResolverFixture(
          new Map([['/umino.pem', ['umino-app-token']]]),
        );
        const uminoAppRepository =
          fixture.repositoryForToken('umino-app-token');
        uminoAppRepository.getIssueBodyByUrl.mockResolvedValue(
          'body read with umino-app-token',
        );
        const ownTokenRepository = fixture.repositoryForToken(
          ownTokenCase.ownToken,
        );
        ownTokenRepository.getIssueBodyByUrl.mockResolvedValue(
          `body read with ${ownTokenCase.ownToken}`,
        );

        const resolver = await buildReadIssueRepositoryResolver(
          { umino: ['/umino.pem'] },
          fixture.mintTokens,
          fixture.buildIssueRepositoryForToken,
          fixture.resolveGithubToken,
          fixture.resolveProjectName,
        );
        const resolvedRepository = resolver(ownTokenCase.url);
        const ownTokenBody = await resolvedRepository.getIssueBodyByUrl(
          ownTokenCase.url,
        );
        const uminoBody =
          await resolver(uminoIssueUrl).getIssueBodyByUrl(uminoIssueUrl);

        observed.push({
          name: ownTokenCase.name,
          returnsTheOwnTokenRepository:
            resolvedRepository === ownTokenRepository,
          ownTokenBody,
          uminoBody,
          uminoAppReads: uminoAppRepository.getIssueBodyByUrl.mock.calls,
        });
      }

      expect(observed).toEqual(
        ownTokenCases.map((ownTokenCase) => ({
          name: ownTokenCase.name,
          returnsTheOwnTokenRepository: true,
          ownTokenBody: `body read with ${ownTokenCase.ownToken}`,
          uminoBody: 'body read with umino-app-token',
          uminoAppReads: [[uminoIssueUrl]],
        })),
      );
    });

    it('mints the App installation tokens once per console project holding at least one key path, when the resolver is built and never again while resolving', async () => {
      const fixture = buildResolverFixture(
        new Map([
          ['/umino.pem', ['umino-app-token']],
          [
            '/other-1.pem,/other-2.pem',
            ['other-app-token-1', 'other-app-token-2'],
          ],
        ]),
      );

      const resolver = await buildReadIssueRepositoryResolver(
        {
          umino: ['/umino.pem'],
          other: ['/other-1.pem', '/other-2.pem'],
          empty: [],
        },
        fixture.mintTokens,
        fixture.buildIssueRepositoryForToken,
        fixture.resolveGithubToken,
        fixture.resolveProjectName,
      );
      const mintedKeyPathsAtBuild = fixture.mintTokens.mock.calls
        .map(([keyPaths]) => keyPaths.join(','))
        .sort();
      resolver(uminoIssueUrl);
      resolver(otherIssueUrl);
      resolver(uminoIssueUrl);

      expect({
        mintedKeyPathsAtBuild,
        mintCallCountAfterResolving: fixture.mintTokens.mock.calls.length,
      }).toEqual({
        mintedKeyPathsAtBuild: ['/other-1.pem,/other-2.pem', '/umino.pem'],
        mintCallCountAfterResolving: 2,
      });
    });

    it('reads each console project through the App installation tokens minted from that project key paths only', async () => {
      const fixture = buildResolverFixture(
        new Map([
          ['/umino.pem', ['umino-app-token']],
          ['/other.pem', ['other-app-token']],
        ]),
      );
      const tokens = [
        'umino-app-token',
        'other-app-token',
        'own-token-of-umino-owner',
        'own-token-of-other-owner',
      ];
      for (const token of tokens) {
        fixture
          .repositoryForToken(token)
          .getIssueBodyByUrl.mockResolvedValue(`body read with ${token}`);
      }

      const resolver = await buildReadIssueRepositoryResolver(
        { umino: ['/umino.pem'], other: ['/other.pem'] },
        fixture.mintTokens,
        fixture.buildIssueRepositoryForToken,
        fixture.resolveGithubToken,
        fixture.resolveProjectName,
      );
      const projectReadCases: {
        name: string;
        url: string;
        expectedBody: string;
      }[] = [
        {
          name: 'umino project',
          url: uminoIssueUrl,
          expectedBody: 'body read with umino-app-token',
        },
        {
          name: 'other project',
          url: otherIssueUrl,
          expectedBody: 'body read with other-app-token',
        },
      ];

      const observed: { name: string; body: string | null }[] = [];
      for (const projectReadCase of projectReadCases) {
        observed.push({
          name: projectReadCase.name,
          body: await resolver(projectReadCase.url).getIssueBodyByUrl(
            projectReadCase.url,
          ),
        });
      }

      expect({
        observed,
        uminoAppReads:
          fixture.repositoryForToken('umino-app-token').getIssueBodyByUrl.mock
            .calls,
        otherAppReads:
          fixture.repositoryForToken('other-app-token').getIssueBodyByUrl.mock
            .calls,
      }).toEqual({
        observed: projectReadCases.map((projectReadCase) => ({
          name: projectReadCase.name,
          body: projectReadCase.expectedBody,
        })),
        uminoAppReads: [[uminoIssueUrl]],
        otherAppReads: [[otherIssueUrl]],
      });
    });

    it('returns the own-token repository unchanged for a console project whose key paths mint no App installation token, while the umino project still reads through its App token', async () => {
      const fixture = buildResolverFixture(
        new Map([['/umino.pem', ['umino-app-token']]]),
      );
      fixture
        .repositoryForToken('umino-app-token')
        .getIssueBodyByUrl.mockResolvedValue('body read with umino-app-token');

      const resolver = await buildReadIssueRepositoryResolver(
        { umino: ['/umino.pem'], other: ['/other.pem'] },
        fixture.mintTokens,
        fixture.buildIssueRepositoryForToken,
        fixture.resolveGithubToken,
        fixture.resolveProjectName,
      );
      const otherRepository = resolver(otherIssueUrl);
      const uminoBody =
        await resolver(uminoIssueUrl).getIssueBodyByUrl(uminoIssueUrl);

      expect({
        returnsTheOwnTokenRepository:
          otherRepository ===
          fixture.repositoryForToken('own-token-of-other-owner'),
        uminoBody,
      }).toEqual({
        returnsTheOwnTokenRepository: true,
        uminoBody: 'body read with umino-app-token',
      });
    });

    it('throws for an operated url whose repository owner cannot be read, without asking the project name', async () => {
      const fixture = buildResolverFixture(
        new Map([['/umino.pem', ['umino-app-token']]]),
      );

      const resolver = await buildReadIssueRepositoryResolver(
        { umino: ['/umino.pem'] },
        fixture.mintTokens,
        fixture.buildIssueRepositoryForToken,
        fixture.resolveGithubToken,
        fixture.resolveProjectName,
      );

      expect(() =>
        resolver('https://github.com/umino-owner/umino-repository'),
      ).toThrow(
        'The repository owner cannot be read from the operated url: https://github.com/umino-owner/umino-repository',
      );
      expect(fixture.resolveProjectName).not.toHaveBeenCalled();
    });

    it('repeats a umino read refused with HTTP 404 or resolving to no result on the umino own-token repository with the same arguments', async () => {
      const fixture = buildResolverFixture(
        new Map([['/umino.pem', ['umino-app-token']]]),
      );
      const uminoAppRepository = fixture.repositoryForToken('umino-app-token');
      const uminoOwnRepository = fixture.repositoryForToken(
        'own-token-of-umino-owner',
      );
      const ownTokenIssue = mock<Issue>();
      uminoAppRepository.getIssueByUrl.mockRejectedValue(buildKyHttpError(404));
      uminoOwnRepository.getIssueByUrl.mockResolvedValue(ownTokenIssue);
      uminoAppRepository.getIssueBodyByUrl.mockResolvedValue(null);
      uminoOwnRepository.getIssueBodyByUrl.mockResolvedValue(
        'body read with own-token-of-umino-owner',
      );

      const resolver = await buildReadIssueRepositoryResolver(
        { umino: ['/umino.pem'] },
        fixture.mintTokens,
        fixture.buildIssueRepositoryForToken,
        fixture.resolveGithubToken,
        fixture.resolveProjectName,
      );
      const uminoRepository = resolver(uminoIssueUrl);
      const issue = await uminoRepository.getIssueByUrl(uminoIssueUrl, {
        bypassCache: true,
      });
      const body = await uminoRepository.getIssueBodyByUrl(uminoIssueUrl);

      expect({
        returnsTheOwnTokenIssue: issue === ownTokenIssue,
        body,
        appIssueReads: uminoAppRepository.getIssueByUrl.mock.calls,
        ownTokenIssueReads: uminoOwnRepository.getIssueByUrl.mock.calls,
        appBodyReads: uminoAppRepository.getIssueBodyByUrl.mock.calls,
        ownTokenBodyReads: uminoOwnRepository.getIssueBodyByUrl.mock.calls,
      }).toEqual({
        returnsTheOwnTokenIssue: true,
        body: 'body read with own-token-of-umino-owner',
        appIssueReads: [[uminoIssueUrl, { bypassCache: true }]],
        ownTokenIssueReads: [[uminoIssueUrl, { bypassCache: true }]],
        appBodyReads: [[uminoIssueUrl]],
        ownTokenBodyReads: [[uminoIssueUrl]],
      });
    });
  });
});
