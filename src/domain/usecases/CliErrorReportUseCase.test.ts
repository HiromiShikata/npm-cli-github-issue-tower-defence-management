import { mock } from 'jest-mock-extended';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { CliErrorReportUseCase } from './CliErrorReportUseCase';

describe('CliErrorReportUseCase', () => {
  jest.setTimeout(30 * 1000);

  const mockIssueRepository = mock<IssueRepository>();
  const useCase = new CliErrorReportUseCase(mockIssueRepository);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const owner = 'test-owner';
  const repo = 'test-repo';
  const commandLine = 'github-issue-tower-defence-management startDaemon --configFilePath config.yml';

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
      const existingIssueUrl = 'https://github.com/test-owner/test-repo/issues/10';
      mockIssueRepository.searchIssue.mockResolvedValue([
        { url: existingIssueUrl, title, number: '10' },
      ]);
      mockIssueRepository.createCommentByUrl.mockResolvedValue(undefined);

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
      mockIssueRepository.searchIssue.mockRejectedValue(new Error('network error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

      await expect(useCase.run({ error, owner, repo, commandLine })).resolves.toBeUndefined();
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
  });
});
