import { mock } from 'jest-mock-extended';
import type { IssueRepository } from '../../../domain/usecases/adapter-interfaces/IssueRepository';
import { GitHubRateLimitError } from '../../repositories/issue/githubRateLimitRetry';
import {
  buildReadIssueRepositoryResolver,
  createReadOnlyTokenRotatingIssueRepository,
} from './readOnlyTokenRotator';

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
  });
});

describe('buildReadIssueRepositoryResolver', () => {
  describe('readOnlyGithubTokens absent — falls back to standard owner-based resolver', () => {
    it('returns a resolver that calls the token resolver with the repository owner', () => {
      const primaryRepo = mock<IssueRepository>();
      const buildIssueRepositoryForToken = jest
        .fn()
        .mockReturnValue(primaryRepo);
      const resolveGithubToken = jest
        .fn()
        .mockReturnValue('resolved-write-token');

      const resolver = buildReadIssueRepositoryResolver(
        undefined,
        buildIssueRepositoryForToken,
        resolveGithubToken,
      );
      const repo = resolver('https://github.com/owner/repo/issues/1');

      expect(repo).toBe(primaryRepo);
      expect(resolveGithubToken).toHaveBeenCalledWith('owner');
      expect(buildIssueRepositoryForToken).toHaveBeenCalledWith(
        'resolved-write-token',
      );
    });

    it('returns a resolver when readOnlyGithubTokens is an empty array', () => {
      const primaryRepo = mock<IssueRepository>();
      const buildIssueRepositoryForToken = jest
        .fn()
        .mockReturnValue(primaryRepo);
      const resolveGithubToken = jest
        .fn()
        .mockReturnValue('resolved-write-token');

      const resolver = buildReadIssueRepositoryResolver(
        [],
        buildIssueRepositoryForToken,
        resolveGithubToken,
      );
      const repo = resolver('https://github.com/owner/repo/issues/1');

      expect(repo).toBe(primaryRepo);
      expect(resolveGithubToken).toHaveBeenCalledWith('owner');
    });
  });

  describe('readOnlyGithubTokens present — uses rotating resolver', () => {
    it('builds one repository per read-only token and routes reads through the rotating pool', async () => {
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

      const resolver = buildReadIssueRepositoryResolver(
        ['token-1', 'token-2'],
        buildIssueRepositoryForToken,
        resolveGithubToken,
      );

      expect(buildIssueRepositoryForToken).toHaveBeenCalledWith('token-1');
      expect(buildIssueRepositoryForToken).toHaveBeenCalledWith('token-2');
      expect(resolveGithubToken).not.toHaveBeenCalled();

      const repo = resolver('https://github.com/owner/repo/issues/1');
      const result = await repo.getIssueOrPullRequestBody(
        'https://github.com/owner/repo/issues/1',
      );
      expect(result).toBe('body from token-2');
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

      const resolver = buildReadIssueRepositoryResolver(
        ['token-1'],
        buildIssueRepositoryForToken,
        resolveGithubToken,
      );

      const repo = resolver('https://github.com/owner-a/repo/issues/1');
      await repo.deleteAllCommentsByUrl('https://github.com/o/r/issues/1');

      expect(writeRepo.deleteAllCommentsByUrl).toHaveBeenCalledWith(
        'https://github.com/o/r/issues/1',
      );
      expect(readRepo.deleteAllCommentsByUrl).not.toHaveBeenCalled();
      expect(resolveGithubToken).toHaveBeenCalledWith('owner-a');
    });
  });
});
