import { mock } from 'jest-mock-extended';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { CliErrorReportUseCase } from './CliErrorReportUseCase';

describe('CliErrorReportUseCase', () => {
  jest.setTimeout(30 * 1000);

  const mockIssueRepository = mock<IssueRepository>();
  const useCase = new CliErrorReportUseCase(mockIssueRepository);

  beforeEach(() => {
    jest.clearAllMocks();
    mockIssueRepository.getIssueOrPullRequestComments.mockResolvedValue([]);
  });

  const owner = 'test-owner';
  const repo = 'test-repo';
  const commandLine =
    'github-issue-tower-defence-management startDaemon --configFilePath config.yml';

  describe('run', () => {
    it('should call createNewIssue when searchIssue returns no matching open issue', async () => {
      const error = new Error('something went wrong');
      error.name = 'TypeError';
      mockIssueRepository.searchIssue.mockResolvedValue([]);
      mockIssueRepository.createNewIssue.mockResolvedValue(42);

      await useCase.run({ error, owner, repo, commandLine });

      expect(mockIssueRepository.searchIssue).toHaveBeenCalledWith({
        owner,
        repositoryName: repo,
        type: 'issue',
        state: 'open',
        title: 'CLI error: TypeError: something went wrong',
      });
      expect(mockIssueRepository.createNewIssue).toHaveBeenCalledWith(
        owner,
        repo,
        'CLI error: TypeError: something went wrong',
        expect.stringContaining('something went wrong'),
        [],
        [],
      );
      expect(mockIssueRepository.createCommentByUrl).not.toHaveBeenCalled();
    });

    it('should call createCommentByUrl when searchIssue returns a result whose title matches exactly', async () => {
      const error = new Error('something went wrong');
      error.name = 'TypeError';
      const title = 'CLI error: TypeError: something went wrong';
      const existingIssueUrl =
        'https://github.com/test-owner/test-repo/issues/10';
      mockIssueRepository.searchIssue.mockResolvedValue([
        { url: existingIssueUrl, title, number: '10' },
      ]);
      mockIssueRepository.createCommentByUrl.mockResolvedValue({
        author: 'bot',
        body: 'CLI error: TypeError: something went wrong',
        createdAt: new Date(0),
      });

      await useCase.run({ error, owner, repo, commandLine });

      expect(mockIssueRepository.createCommentByUrl).toHaveBeenCalledWith(
        existingIssueUrl,
        expect.stringContaining('something went wrong'),
      );
      expect(mockIssueRepository.createNewIssue).not.toHaveBeenCalled();
    });

    it('should not call createCommentByUrl when searchIssue returns a result with a different title', async () => {
      const error = new Error('something went wrong');
      error.name = 'TypeError';
      mockIssueRepository.searchIssue.mockResolvedValue([
        {
          url: 'https://github.com/test-owner/test-repo/issues/9',
          title: 'CLI error: TypeError: something else entirely',
          number: '9',
        },
      ]);
      mockIssueRepository.createNewIssue.mockResolvedValue(11);

      await useCase.run({ error, owner, repo, commandLine });

      expect(mockIssueRepository.createNewIssue).toHaveBeenCalled();
      expect(mockIssueRepository.createCommentByUrl).not.toHaveBeenCalled();
    });

    it('should truncate long messages to 80 characters in the title', async () => {
      const longMessage = 'a'.repeat(120);
      const error = new Error(longMessage);
      mockIssueRepository.searchIssue.mockResolvedValue([]);
      mockIssueRepository.createNewIssue.mockResolvedValue(1);

      await useCase.run({ error, owner, repo, commandLine });

      const expectedTitle = `CLI error: Error: ${'a'.repeat(80)}`;
      expect(mockIssueRepository.searchIssue).toHaveBeenCalledWith(
        expect.objectContaining({ title: expectedTitle }),
      );
      expect(mockIssueRepository.createNewIssue).toHaveBeenCalledWith(
        owner,
        repo,
        expectedTitle,
        expect.any(String),
        [],
        [],
      );
    });

    it('should not throw when searchIssue rejects', async () => {
      const error = new Error('some error');
      mockIssueRepository.searchIssue.mockRejectedValue(
        new Error('network error'),
      );
      const consoleSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);

      await expect(
        useCase.run({ error, owner, repo, commandLine }),
      ).resolves.toBeUndefined();
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should include the command line in the issue body', async () => {
      const error = new Error('cmd error');
      mockIssueRepository.searchIssue.mockResolvedValue([]);
      mockIssueRepository.createNewIssue.mockResolvedValue(2);

      await useCase.run({ error, owner, repo, commandLine });

      const bodyArg = mockIssueRepository.createNewIssue.mock.calls[0][3];
      expect(bodyArg).toContain(commandLine);
    });

    it('should not include the From: :robot: prefix in the new issue body', async () => {
      const error = new Error('prefix check');
      mockIssueRepository.searchIssue.mockResolvedValue([]);
      mockIssueRepository.createNewIssue.mockResolvedValue(5);

      await useCase.run({ error, owner, repo, commandLine });

      const bodyArg = mockIssueRepository.createNewIssue.mock.calls[0][3];
      expect(bodyArg).not.toContain('From: :robot:');
    });

    it('should handle non-Error values', async () => {
      const error = 'plain string error';
      mockIssueRepository.searchIssue.mockResolvedValue([]);
      mockIssueRepository.createNewIssue.mockResolvedValue(3);

      await useCase.run({ error, owner, repo, commandLine });

      expect(mockIssueRepository.createNewIssue).toHaveBeenCalledWith(
        owner,
        repo,
        expect.stringContaining('CLI error: Error:'),
        expect.any(String),
        [],
        [],
      );
    });

    it('should make no repository calls when the error has name GitHubRateLimitError', async () => {
      const error = new Error('rate limit exceeded');
      error.name = 'GitHubRateLimitError';
      const consoleSpy = jest
        .spyOn(console, 'warn')
        .mockImplementation(() => undefined);

      await useCase.run({ error, owner, repo, commandLine });

      expect(mockIssueRepository.searchIssue).not.toHaveBeenCalled();
      expect(mockIssueRepository.createNewIssue).not.toHaveBeenCalled();
      expect(mockIssueRepository.createCommentByUrl).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should make no repository calls when the error message contains HTTP 403 status', async () => {
      const error = new Error(
        'Failed to fetch comments from GitHub REST API: 403',
      );
      const consoleSpy = jest
        .spyOn(console, 'warn')
        .mockImplementation(() => undefined);

      await useCase.run({ error, owner, repo, commandLine });

      expect(mockIssueRepository.searchIssue).not.toHaveBeenCalled();
      expect(mockIssueRepository.createNewIssue).not.toHaveBeenCalled();
      expect(mockIssueRepository.createCommentByUrl).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should make no repository calls when the error message has HTTP 429 after a colon', async () => {
      const error = new Error(
        'Failed to fetch comments from GitHub REST API: 429 Too Many Requests',
      );
      const consoleSpy = jest
        .spyOn(console, 'warn')
        .mockImplementation(() => undefined);

      await useCase.run({ error, owner, repo, commandLine });

      expect(mockIssueRepository.searchIssue).not.toHaveBeenCalled();
      expect(mockIssueRepository.createNewIssue).not.toHaveBeenCalled();
      expect(mockIssueRepository.createCommentByUrl).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should report errors where 403 appears as an issue number, not an HTTP status', async () => {
      const error = new Error('Failed to update issue 403 in repository foo');
      mockIssueRepository.searchIssue.mockResolvedValue([]);
      mockIssueRepository.createNewIssue.mockResolvedValue(7);

      await useCase.run({ error, owner, repo, commandLine });

      expect(mockIssueRepository.searchIssue).toHaveBeenCalled();
      expect(mockIssueRepository.createNewIssue).toHaveBeenCalled();
    });

    it('should make no repository calls when the error message contains "secondary rate limit"', async () => {
      const error = new Error(
        'You have exceeded a secondary rate limit. Please wait a few minutes before you try again.',
      );
      const consoleSpy = jest
        .spyOn(console, 'warn')
        .mockImplementation(() => undefined);

      await useCase.run({ error, owner, repo, commandLine });

      expect(mockIssueRepository.searchIssue).not.toHaveBeenCalled();
      expect(mockIssueRepository.createNewIssue).not.toHaveBeenCalled();
      expect(mockIssueRepository.createCommentByUrl).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should make no repository calls when the error message contains a rate-limit phrase', async () => {
      const error = new Error('API rate limit exceeded for user ID 123456789');
      const consoleSpy = jest
        .spyOn(console, 'warn')
        .mockImplementation(() => undefined);

      await useCase.run({ error, owner, repo, commandLine });

      expect(mockIssueRepository.searchIssue).not.toHaveBeenCalled();
      expect(mockIssueRepository.createNewIssue).not.toHaveBeenCalled();
      expect(mockIssueRepository.createCommentByUrl).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should still report ordinary errors that are not rate-limit related', async () => {
      const error = new Error('unexpected null pointer');
      mockIssueRepository.searchIssue.mockResolvedValue([]);
      mockIssueRepository.createNewIssue.mockResolvedValue(99);

      await useCase.run({ error, owner, repo, commandLine });

      expect(mockIssueRepository.searchIssue).toHaveBeenCalled();
      expect(mockIssueRepository.createNewIssue).toHaveBeenCalled();
    });

    it('should make no repository calls when the error matches GitHub GraphQL transient "Something went wrong while executing your query"', async () => {
      const error = new Error(
        'Something went wrong while executing your query on 2026-09-09T23:34:05Z. Please include `BE9A:BD63D:2E4757E:95BB975:6AA1ECEC` when reporting this issue.',
      );
      const consoleSpy = jest
        .spyOn(console, 'warn')
        .mockImplementation(() => undefined);

      await useCase.run({ error, owner, repo, commandLine });

      expect(mockIssueRepository.searchIssue).not.toHaveBeenCalled();
      expect(mockIssueRepository.createNewIssue).not.toHaveBeenCalled();
      expect(mockIssueRepository.createCommentByUrl).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should report errors where "Something went wrong" appears in a non-GitHub-transient context', async () => {
      const error = new Error('Something went wrong in the database layer');
      mockIssueRepository.searchIssue.mockResolvedValue([]);
      mockIssueRepository.createNewIssue.mockResolvedValue(8);

      await useCase.run({ error, owner, repo, commandLine });

      expect(mockIssueRepository.searchIssue).toHaveBeenCalled();
      expect(mockIssueRepository.createNewIssue).toHaveBeenCalled();
    });
  });

  describe('shared transient-error classifier (isTransientApiError) consultation', () => {
    const transientErrorMessage =
      'The single select option Id does not belong to the field';
    const nonTransientErrorMessage = "Validation Failed: Title can't be blank";

    it('should make no repository calls and only log a warning when the shared classifier recognizes the error and no matching open issue exists', async () => {
      const error = new Error(transientErrorMessage);
      mockIssueRepository.searchIssue.mockResolvedValue([]);
      const consoleSpy = jest
        .spyOn(console, 'warn')
        .mockImplementation(() => undefined);

      await useCase.run({ error, owner, repo, commandLine });

      expect(mockIssueRepository.createNewIssue).not.toHaveBeenCalled();
      expect(mockIssueRepository.createCommentByUrl).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should still create a new issue for a non-transient error when no matching open issue exists (no regression)', async () => {
      const error = new Error(nonTransientErrorMessage);
      mockIssueRepository.searchIssue.mockResolvedValue([]);
      mockIssueRepository.createNewIssue.mockResolvedValue(21);

      await useCase.run({ error, owner, repo, commandLine });

      expect(mockIssueRepository.createNewIssue).toHaveBeenCalledWith(
        owner,
        repo,
        expect.stringContaining('CLI error:'),
        expect.any(String),
        [],
        [],
      );
      expect(mockIssueRepository.createCommentByUrl).not.toHaveBeenCalled();
    });

    it('should not comment on an existing matching open issue and should only log a warning when the shared classifier recognizes the error', async () => {
      const error = new Error(transientErrorMessage);
      const title = `CLI error: Error: ${transientErrorMessage}`;
      const existingIssueUrl =
        'https://github.com/test-owner/test-repo/issues/20';
      mockIssueRepository.searchIssue.mockResolvedValue([
        { url: existingIssueUrl, title, number: '20' },
      ]);
      const consoleSpy = jest
        .spyOn(console, 'warn')
        .mockImplementation(() => undefined);

      await useCase.run({ error, owner, repo, commandLine });

      expect(mockIssueRepository.createCommentByUrl).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should still comment on an existing matching open issue for a non-transient error (no regression)', async () => {
      const error = new Error(nonTransientErrorMessage);
      const title = `CLI error: Error: ${nonTransientErrorMessage}`;
      const existingIssueUrl =
        'https://github.com/test-owner/test-repo/issues/21';
      mockIssueRepository.searchIssue.mockResolvedValue([
        { url: existingIssueUrl, title, number: '21' },
      ]);
      mockIssueRepository.createCommentByUrl.mockResolvedValue({
        author: 'bot',
        body: 'CLI error recurrence',
        createdAt: new Date(0),
      });

      await useCase.run({ error, owner, repo, commandLine });

      expect(mockIssueRepository.createCommentByUrl).toHaveBeenCalledWith(
        existingIssueUrl,
        expect.any(String),
      );
      expect(mockIssueRepository.createNewIssue).not.toHaveBeenCalled();
    });
  });
});
