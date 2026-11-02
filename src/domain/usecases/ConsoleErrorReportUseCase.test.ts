import { mock } from 'jest-mock-extended';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { ConsoleErrorReportUseCase } from './ConsoleErrorReportUseCase';

describe('ConsoleErrorReportUseCase', () => {
  jest.setTimeout(30 * 1000);

  const mockIssueRepository = mock<IssueRepository>();
  const useCase = new ConsoleErrorReportUseCase(mockIssueRepository);

  beforeEach(() => {
    jest.clearAllMocks();
    mockIssueRepository.getIssueOrPullRequestComments.mockResolvedValue([]);
  });

  const owner = 'test-owner';
  const repo = 'test-repo';
  const requestPath = '/api/review';

  describe('run', () => {
    it('should call createNewIssue when searchIssue returns no matching open issue', async () => {
      const error = new Error('something went wrong');
      error.name = 'TypeError';
      mockIssueRepository.searchIssue.mockResolvedValue([]);
      mockIssueRepository.createNewIssue.mockResolvedValue(42);

      await useCase.run({ error, owner, repo, requestPath });

      expect(mockIssueRepository.searchIssue).toHaveBeenCalledWith({
        owner,
        repositoryName: repo,
        type: 'issue',
        state: 'open',
        title: 'Console error: TypeError: something went wrong',
      });
      expect(mockIssueRepository.createNewIssue).toHaveBeenCalledWith(
        owner,
        repo,
        'Console error: TypeError: something went wrong',
        expect.stringContaining('something went wrong'),
        [],
        [],
      );
      expect(mockIssueRepository.createCommentByUrl).not.toHaveBeenCalled();
    });

    it('should call createCommentByUrl when searchIssue returns a result whose title matches exactly', async () => {
      const error = new Error('something went wrong');
      error.name = 'TypeError';
      const title = 'Console error: TypeError: something went wrong';
      const existingIssueUrl =
        'https://github.com/test-owner/test-repo/issues/10';
      mockIssueRepository.searchIssue.mockResolvedValue([
        { url: existingIssueUrl, title, number: '10' },
      ]);
      mockIssueRepository.createCommentByUrl.mockResolvedValue({
        id: 1,
        author: 'bot',
        body: 'Console error: TypeError: something went wrong',
        createdAt: new Date(0),
      });

      await useCase.run({ error, owner, repo, requestPath });

      expect(mockIssueRepository.createCommentByUrl).toHaveBeenCalledWith(
        existingIssueUrl,
        expect.stringContaining('something went wrong'),
      );
      expect(mockIssueRepository.createNewIssue).not.toHaveBeenCalled();
    });

    it('should retry once and succeed when createCommentByUrl first fails with a transient 502 error, backing off via the injected sleep before retrying', async () => {
      const error = new Error('something went wrong');
      error.name = 'TypeError';
      const title = 'Console error: TypeError: something went wrong';
      const existingIssueUrl =
        'https://github.com/test-owner/test-repo/issues/10';
      mockIssueRepository.searchIssue.mockResolvedValue([
        { url: existingIssueUrl, title, number: '10' },
      ]);
      const mockSleep = jest
        .fn<Promise<void>, [number]>()
        .mockResolvedValue(undefined);
      const retryingUseCase = new ConsoleErrorReportUseCase(
        mockIssueRepository,
        mockSleep,
      );
      const transientError = Object.assign(
        new Error(
          'Failed to create comment via GitHub REST API: 502 Bad Gateway',
        ),
        { name: 'GitHubCommentCreateHttpError', statusCode: 502 },
      );
      mockIssueRepository.createCommentByUrl
        .mockRejectedValueOnce(transientError)
        .mockResolvedValueOnce({
          id: 2,
          author: 'bot',
          body: 'Console error: TypeError: something went wrong',
          createdAt: new Date(0),
        });

      await retryingUseCase.run({ error, owner, repo, requestPath });

      expect(mockIssueRepository.createCommentByUrl).toHaveBeenCalledTimes(2);
      expect(mockSleep).toHaveBeenCalledTimes(1);
    });

    it('should not re-post when createCommentByUrl first fails with a transient 502 error and a duplicate comment is found on re-check', async () => {
      const error = new Error('something went wrong');
      error.name = 'TypeError';
      const title = 'Console error: TypeError: something went wrong';
      const existingIssueUrl =
        'https://github.com/test-owner/test-repo/issues/10';
      mockIssueRepository.searchIssue.mockResolvedValue([
        { url: existingIssueUrl, title, number: '10' },
      ]);
      const mockSleep = jest
        .fn<Promise<void>, [number]>()
        .mockResolvedValue(undefined);
      const retryingUseCase = new ConsoleErrorReportUseCase(
        mockIssueRepository,
        mockSleep,
      );
      const transientError = Object.assign(
        new Error(
          'Failed to create comment via GitHub REST API: 502 Bad Gateway',
        ),
        { name: 'GitHubCommentCreateHttpError', statusCode: 502 },
      );
      mockIssueRepository.createCommentByUrl.mockRejectedValueOnce(
        transientError,
      );
      mockIssueRepository.getIssueOrPullRequestComments
        .mockResolvedValueOnce([])
        .mockImplementationOnce(async () => [
          {
            id: 3,
            author: 'bot',
            body:
              mockIssueRepository.createCommentByUrl.mock.calls[0]?.[1] ?? '',
            createdAt: new Date(),
          },
        ]);

      await retryingUseCase.run({ error, owner, repo, requestPath });

      expect(mockIssueRepository.createCommentByUrl).toHaveBeenCalledTimes(1);
      expect(mockSleep).toHaveBeenCalledTimes(1);
    });

    it('should not call createCommentByUrl when searchIssue returns a result with a different title', async () => {
      const error = new Error('something went wrong');
      error.name = 'TypeError';
      mockIssueRepository.searchIssue.mockResolvedValue([
        {
          url: 'https://github.com/test-owner/test-repo/issues/9',
          title: 'Console error: TypeError: something else entirely',
          number: '9',
        },
      ]);
      mockIssueRepository.createNewIssue.mockResolvedValue(11);

      await useCase.run({ error, owner, repo, requestPath });

      expect(mockIssueRepository.createNewIssue).toHaveBeenCalled();
      expect(mockIssueRepository.createCommentByUrl).not.toHaveBeenCalled();
    });

    it('should truncate long messages to 80 characters in the title', async () => {
      const longMessage = 'a'.repeat(120);
      const error = new Error(longMessage);
      mockIssueRepository.searchIssue.mockResolvedValue([]);
      mockIssueRepository.createNewIssue.mockResolvedValue(1);

      await useCase.run({ error, owner, repo, requestPath });

      const expectedTitle = `Console error: Error: ${'a'.repeat(80)}`;
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
        useCase.run({ error, owner, repo, requestPath }),
      ).resolves.toBeUndefined();
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should include the request path in the issue body', async () => {
      const error = new Error('cmd error');
      mockIssueRepository.searchIssue.mockResolvedValue([]);
      mockIssueRepository.createNewIssue.mockResolvedValue(2);

      await useCase.run({ error, owner, repo, requestPath });

      const bodyArg = mockIssueRepository.createNewIssue.mock.calls[0][3];
      expect(bodyArg).toContain(requestPath);
    });

    it('should not include the From: :robot: prefix in the new issue body', async () => {
      const error = new Error('prefix check');
      mockIssueRepository.searchIssue.mockResolvedValue([]);
      mockIssueRepository.createNewIssue.mockResolvedValue(5);

      await useCase.run({ error, owner, repo, requestPath });

      const bodyArg = mockIssueRepository.createNewIssue.mock.calls[0][3];
      expect(bodyArg).not.toContain('From: :robot:');
    });

    it('should include the request body in the issue body when requestBody is provided', async () => {
      const error = new Error('cmd error');
      const requestBody = {
        issueUrl: 'https://github.com/owner/repo/issues/123',
        storyName: 'my-story',
        action: 'set_story',
      };
      mockIssueRepository.searchIssue.mockResolvedValue([]);
      mockIssueRepository.createNewIssue.mockResolvedValue(2);

      await useCase.run({ error, owner, repo, requestPath, requestBody });

      const bodyArg = mockIssueRepository.createNewIssue.mock.calls[0][3];
      expect(bodyArg).toContain('https://github.com/owner/repo/issues/123');
      expect(bodyArg).toContain('my-story');
    });

    it('should redact a secret-shaped substring from the message and the serialized request body while preserving non-secret fields', async () => {
      const messageSecret = 'sk-ant-consoleReporterRealisticSecret665544';
      const requestBodySecret =
        'ghp_' + 'consoleReporterRealisticToken554433BB';
      const error = new Error(`auth failed, token=${messageSecret}`);
      const requestBody = {
        apiToken: requestBodySecret,
        requestId: 'req-123',
      };
      mockIssueRepository.searchIssue.mockResolvedValue([]);
      mockIssueRepository.createNewIssue.mockResolvedValue(9);

      await useCase.run({ error, owner, repo, requestPath, requestBody });

      const bodyArg = mockIssueRepository.createNewIssue.mock.calls[0][3];
      expect(bodyArg).not.toContain(messageSecret);
      expect(bodyArg).not.toContain(requestBodySecret);
      expect(bodyArg).toContain('requestId');
      expect(bodyArg).toContain('req-123');
      expect(bodyArg).toContain('auth failed, token=');
    });

    it('should not include a request body section when requestBody is not provided', async () => {
      const error = new Error('cmd error');
      mockIssueRepository.searchIssue.mockResolvedValue([]);
      mockIssueRepository.createNewIssue.mockResolvedValue(2);

      await useCase.run({ error, owner, repo, requestPath });

      const bodyArg = mockIssueRepository.createNewIssue.mock.calls[0][3];
      expect(bodyArg).not.toContain('Request body:');
    });

    it('should handle non-Error values', async () => {
      const error = 'plain string error';
      mockIssueRepository.searchIssue.mockResolvedValue([]);
      mockIssueRepository.createNewIssue.mockResolvedValue(3);

      await useCase.run({ error, owner, repo, requestPath });

      expect(mockIssueRepository.createNewIssue).toHaveBeenCalledWith(
        owner,
        repo,
        expect.stringContaining('Console error: Error:'),
        expect.any(String),
        [],
        [],
      );
    });
  });

  describe('run grouping and concurrency', () => {
    const graphQlRateLimitMessage =
      'GitHub GraphQL API returned no data for fetchProjectItemByUrl: API rate limit already exceeded for user ID 1234567.';
    const restRateLimitMessage =
      'API rate limit already exceeded for user ID 1234567.';
    const secondaryRateLimitMessage = 'secondary rate limit hit';
    const createdIssueNumber = 42;
    const createdIssueUrl = `https://github.com/${owner}/${repo}/issues/${createdIssueNumber}`;

    const buildError = (name: string, message: string): Error => {
      const error = new Error(message);
      error.name = name;
      return error;
    };

    const titleOf = (error: Error): string =>
      `Console error: ${error.name}: ${error.message}`;

    const createRepository = () => {
      const repository = mock<IssueRepository>();
      repository.searchIssue.mockResolvedValue([]);
      repository.getIssueOrPullRequestComments.mockResolvedValue([]);
      repository.createNewIssue.mockImplementation(async () => {
        await new Promise<void>((resolve) => setTimeout(resolve, 10));
        return createdIssueNumber;
      });
      repository.createCommentByUrl.mockResolvedValue({
        id: 1,
        author: 'bot',
        body: '',
        createdAt: new Date(0),
      });
      return repository;
    };

    const report = (
      useCaseUnderTest: ConsoleErrorReportUseCase,
      error: Error,
    ): Promise<void> =>
      useCaseUnderTest.run({ error, owner, repo, requestPath });

    it('should create exactly one issue and comment on that issue for every concurrent identical report', async () => {
      const repository = createRepository();
      const useCaseUnderTest = new ConsoleErrorReportUseCase(repository);
      const error = buildError('TypeError', 'concurrent problem');

      const reports = Array.from({ length: 11 }, () =>
        report(useCaseUnderTest, error),
      );

      await expect(Promise.all(reports)).resolves.toHaveLength(11);
      expect(repository.createNewIssue).toHaveBeenCalledTimes(1);
      expect(repository.createCommentByUrl).toHaveBeenCalledTimes(10);
      expect(
        repository.createCommentByUrl.mock.calls.map(([url]) => url),
      ).toEqual(Array(10).fill(createdIssueUrl));
    });

    it('should add a differently worded rate-limit report as a comment on the issue created by the earlier report when reported after it', async () => {
      const repository = createRepository();
      const useCaseUnderTest = new ConsoleErrorReportUseCase(repository);

      await report(
        useCaseUnderTest,
        buildError('Error', graphQlRateLimitMessage),
      );
      await report(useCaseUnderTest, buildError('Error', restRateLimitMessage));

      expect(repository.createNewIssue).toHaveBeenCalledTimes(1);
      expect(repository.createCommentByUrl).toHaveBeenCalledTimes(1);
      expect(repository.createCommentByUrl).toHaveBeenCalledWith(
        createdIssueUrl,
        expect.stringContaining(restRateLimitMessage),
      );
    });

    it('should add a differently worded rate-limit report as a comment on the issue created by the concurrent report when both run concurrently', async () => {
      const repository = createRepository();
      const useCaseUnderTest = new ConsoleErrorReportUseCase(repository);

      await Promise.all([
        report(useCaseUnderTest, buildError('Error', graphQlRateLimitMessage)),
        report(useCaseUnderTest, buildError('Error', restRateLimitMessage)),
      ]);

      expect(repository.createNewIssue).toHaveBeenCalledTimes(1);
      expect(repository.createCommentByUrl).toHaveBeenCalledTimes(1);
      expect(repository.createCommentByUrl).toHaveBeenCalledWith(
        createdIssueUrl,
        expect.any(String),
      );
    });

    it.each([
      {
        editedTitle: `Triaged by the team: Console error: TypeError: something went wrong`,
      },
      {
        editedTitle: `Console error: TypeError: something went wrong (reopened for investigation)`,
      },
    ])(
      'should comment on the open issue whose title was edited to "$editedTitle" instead of creating a new issue',
      async ({ editedTitle }) => {
        const existingIssueUrl =
          'https://github.com/test-owner/test-repo/issues/10';
        const repository = createRepository();
        repository.searchIssue.mockResolvedValue([
          { url: existingIssueUrl, title: editedTitle, number: '10' },
        ]);
        const useCaseUnderTest = new ConsoleErrorReportUseCase(repository);

        await report(
          useCaseUnderTest,
          buildError('TypeError', 'something went wrong'),
        );

        expect(repository.createCommentByUrl).toHaveBeenCalledWith(
          existingIssueUrl,
          expect.any(String),
        );
        expect(repository.createNewIssue).not.toHaveBeenCalled();
      },
    );

    it.each([
      {
        label: 'two unrelated errors',
        first: buildError('TypeError', 'first problem'),
        second: buildError('TypeError', 'second problem'),
      },
      {
        label: 'a rate-limit error and an unrelated error',
        first: buildError('Error', restRateLimitMessage),
        second: buildError('TypeError', 'first problem'),
      },
    ])(
      'should create one issue per error and no comment when $label are reported concurrently',
      async ({ first, second }) => {
        const repository = createRepository();
        const useCaseUnderTest = new ConsoleErrorReportUseCase(repository);

        await Promise.all([
          report(useCaseUnderTest, first),
          report(useCaseUnderTest, second),
        ]);

        expect(repository.createNewIssue).toHaveBeenCalledTimes(2);
        expect(
          repository.createNewIssue.mock.calls
            .map(([, , title]) => title)
            .sort(),
        ).toEqual([titleOf(first), titleOf(second)].sort());
        expect(repository.createCommentByUrl).not.toHaveBeenCalled();
      },
    );

    it('should group the GraphQL-prefixed, REST and secondary rate-limit reports into one issue when reported one after another', async () => {
      const repository = createRepository();
      const useCaseUnderTest = new ConsoleErrorReportUseCase(repository);

      await report(
        useCaseUnderTest,
        buildError('Error', graphQlRateLimitMessage),
      );
      await report(useCaseUnderTest, buildError('Error', restRateLimitMessage));
      await report(
        useCaseUnderTest,
        buildError('Error', secondaryRateLimitMessage),
      );

      expect(repository.createNewIssue).toHaveBeenCalledTimes(1);
      expect(
        repository.createCommentByUrl.mock.calls.map(([url]) => url),
      ).toEqual([createdIssueUrl, createdIssueUrl]);
    });

    it('should resolve every concurrent run and log the error when createNewIssue rejects for the first identical report', async () => {
      const repository = createRepository();
      repository.createNewIssue.mockRejectedValueOnce(
        new Error('issue creation failed'),
      );
      const useCaseUnderTest = new ConsoleErrorReportUseCase(repository);
      const consoleSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);

      try {
        const error = buildError('TypeError', 'failing problem');
        const reports = Array.from({ length: 3 }, () =>
          report(useCaseUnderTest, error),
        );

        await expect(Promise.all(reports)).resolves.toHaveLength(3);
        expect(consoleSpy).toHaveBeenCalled();
      } finally {
        consoleSpy.mockRestore();
      }
    });
  });
});
