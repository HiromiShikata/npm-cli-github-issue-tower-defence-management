import { mock } from 'jest-mock-extended';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { ConsoleErrorReportUseCase } from './ConsoleErrorReportUseCase';
import { GitHubConfirmedNotFoundError } from './ClearDependedIssueURLUseCase';

describe('ConsoleErrorReportUseCase', () => {
  jest.setTimeout(30 * 1000);

  const mockIssueRepository = mock<IssueRepository>();
  let useCase: ConsoleErrorReportUseCase;
  const openIssueState = {
    state: 'open',
    merged: false,
    isPullRequest: false,
    title: '',
    stateReason: '',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockIssueRepository.getIssueOrPullRequestComments.mockResolvedValue([]);
    mockIssueRepository.getIssueOrPullRequestState.mockResolvedValue(
      openIssueState,
    );
    useCase = new ConsoleErrorReportUseCase(mockIssueRepository);
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
    const canonicalRateLimitTitle = 'Console error: API rate limit exceeded';
    const rateLimitSearch = {
      owner,
      repositoryName: repo,
      type: 'issue',
      state: 'open',
      title: 'rate limit',
    };
    const issueUrl = (issueNumber: number): string =>
      `https://github.com/${owner}/${repo}/issues/${issueNumber}`;

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
      repository.getIssueOrPullRequestState.mockResolvedValue(openIssueState);
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
      expect(repository.createNewIssue).toHaveBeenCalledWith(
        owner,
        repo,
        canonicalRateLimitTitle,
        expect.stringContaining(graphQlRateLimitMessage),
        [],
        [],
      );
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
      expect(repository.createNewIssue).toHaveBeenCalledWith(
        owner,
        repo,
        canonicalRateLimitTitle,
        expect.any(String),
        [],
        [],
      );
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
        editedTitle: `Investigating Console error: TypeError: something went wrong`,
      },
    ])(
      'should comment on the open issue whose title has text added before the generated title, "$editedTitle", instead of creating a new issue',
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
        label: 'text added after the generated title',
        title:
          'Console error: TypeError: something went wrong (reopened for investigation)',
      },
      {
        label: 'a longer message after the generated title',
        title: 'Console error: TypeError: something went wrong and more',
      },
    ])(
      'should create a new issue and no comment when the only search result has $label',
      async ({ title }) => {
        const repository = createRepository();
        repository.searchIssue.mockResolvedValue([
          { url: issueUrl(10), title, number: '10' },
        ]);
        const useCaseUnderTest = new ConsoleErrorReportUseCase(repository);

        await report(
          useCaseUnderTest,
          buildError('TypeError', 'something went wrong'),
        );

        expect(repository.createNewIssue).toHaveBeenCalledWith(
          owner,
          repo,
          'Console error: TypeError: something went wrong',
          expect.any(String),
          [],
          [],
        );
        expect(repository.createCommentByUrl).not.toHaveBeenCalled();
      },
    );

    it('should create a new issue titled with the shorter generated title and no comment when the only search result has a longer title that starts with it', async () => {
      const repository = createRepository();
      repository.searchIssue.mockResolvedValue([
        {
          url: issueUrl(9),
          title: 'Console error: Error: Timeout waiting for X',
          number: '9',
        },
      ]);
      const useCaseUnderTest = new ConsoleErrorReportUseCase(repository);

      await report(useCaseUnderTest, buildError('Error', 'Timeout'));

      expect(repository.searchIssue).toHaveBeenCalledWith({
        owner,
        repositoryName: repo,
        type: 'issue',
        state: 'open',
        title: 'Console error: Error: Timeout',
      });
      expect(repository.createNewIssue).toHaveBeenCalledWith(
        owner,
        repo,
        'Console error: Error: Timeout',
        expect.any(String),
        [],
        [],
      );
      expect(repository.createCommentByUrl).not.toHaveBeenCalled();
    });

    it('should comment on the open issue whose title equals the generated title', async () => {
      const repository = createRepository();
      repository.searchIssue.mockResolvedValue([
        {
          url: issueUrl(10),
          title: 'Console error: Error: Timeout',
          number: '10',
        },
      ]);
      const useCaseUnderTest = new ConsoleErrorReportUseCase(repository);

      await report(useCaseUnderTest, buildError('Error', 'Timeout'));

      expect(repository.createCommentByUrl).toHaveBeenCalledTimes(1);
      expect(repository.createCommentByUrl).toHaveBeenCalledWith(
        issueUrl(10),
        expect.any(String),
      );
      expect(repository.createNewIssue).not.toHaveBeenCalled();
    });

    it('should comment on the issue whose title matches and not on the longer-titled issue when the search returns both', async () => {
      const repository = createRepository();
      repository.searchIssue.mockResolvedValue([
        {
          url: issueUrl(9),
          title: 'Console error: Error: Timeout waiting for X',
          number: '9',
        },
        {
          url: issueUrl(10),
          title: 'Console error: Error: Timeout',
          number: '10',
        },
      ]);
      const useCaseUnderTest = new ConsoleErrorReportUseCase(repository);

      await report(useCaseUnderTest, buildError('Error', 'Timeout'));

      expect(
        repository.createCommentByUrl.mock.calls.map(([url]) => url),
      ).toEqual([issueUrl(10)]);
      expect(repository.createNewIssue).not.toHaveBeenCalled();
    });

    it.each([
      {
        label: 'two unrelated errors',
        first: buildError('TypeError', 'first problem'),
        second: buildError('TypeError', 'second problem'),
        firstTitle: 'Console error: TypeError: first problem',
        secondTitle: 'Console error: TypeError: second problem',
      },
      {
        label: 'a rate-limit error and an unrelated error',
        first: buildError('Error', restRateLimitMessage),
        second: buildError('TypeError', 'first problem'),
        firstTitle: canonicalRateLimitTitle,
        secondTitle: 'Console error: TypeError: first problem',
      },
    ])(
      'should create one issue per error and no comment when $label are reported concurrently',
      async ({ first, second, firstTitle, secondTitle }) => {
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
        ).toEqual([firstTitle, secondTitle].sort());
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

    describe('with the Date clock faked', () => {
      const startTime = new Date('2026-01-01T00:00:00.000Z');
      const minutesAfterStart = (minutes: number): Date =>
        new Date(startTime.getTime() + minutes * 60 * 1000);

      beforeEach(() => {
        jest.useFakeTimers({
          doNotFake: [
            'hrtime',
            'nextTick',
            'performance',
            'queueMicrotask',
            'requestAnimationFrame',
            'cancelAnimationFrame',
            'requestIdleCallback',
            'cancelIdleCallback',
            'setImmediate',
            'clearImmediate',
            'setInterval',
            'clearInterval',
            'setTimeout',
            'clearTimeout',
          ],
        });
        jest.setSystemTime(startTime);
      });

      afterEach(() => {
        jest.useRealTimers();
      });

      it('should add a rate-limit report to the issue created earlier when it arrives within 3 hours of that issue creation', async () => {
        const repository = createRepository();
        const useCaseUnderTest = new ConsoleErrorReportUseCase(
          repository,
          async () => undefined,
        );

        await report(
          useCaseUnderTest,
          buildError('Error', restRateLimitMessage),
        );
        jest.setSystemTime(minutesAfterStart(179));
        await report(
          useCaseUnderTest,
          buildError('Error', restRateLimitMessage),
        );

        expect(repository.createNewIssue).toHaveBeenCalledTimes(1);
        expect(repository.getIssueOrPullRequestState).toHaveBeenCalledTimes(1);
        expect(repository.getIssueOrPullRequestState).toHaveBeenCalledWith(
          createdIssueUrl,
        );
        expect(repository.searchIssue).toHaveBeenCalledTimes(1);
        expect(repository.createCommentByUrl).toHaveBeenCalledTimes(1);
        expect(repository.createCommentByUrl).toHaveBeenCalledWith(
          createdIssueUrl,
          expect.any(String),
        );
      });

      it('should create a second issue and no comment when a rate-limit report arrives more than 3 hours after the issue creation and search finds no issue', async () => {
        const repository = createRepository();
        const useCaseUnderTest = new ConsoleErrorReportUseCase(
          repository,
          async () => undefined,
        );

        await report(
          useCaseUnderTest,
          buildError('Error', restRateLimitMessage),
        );
        jest.setSystemTime(minutesAfterStart(181));
        await report(
          useCaseUnderTest,
          buildError('Error', restRateLimitMessage),
        );

        expect(repository.getIssueOrPullRequestState).not.toHaveBeenCalled();
        expect(repository.searchIssue).toHaveBeenCalledTimes(2);
        expect(repository.searchIssue).toHaveBeenNthCalledWith(
          2,
          rateLimitSearch,
        );
        expect(repository.createNewIssue).toHaveBeenCalledTimes(2);
        expect(repository.createCommentByUrl).not.toHaveBeenCalled();
      });

      it('should comment on the open legacy-titled issue found by search when a differently worded rate-limit report arrives more than 3 hours after the issue creation', async () => {
        const legacyIssueUrl = issueUrl(10);
        const repository = createRepository();
        const useCaseUnderTest = new ConsoleErrorReportUseCase(
          repository,
          async () => undefined,
        );

        await report(
          useCaseUnderTest,
          buildError('Error', restRateLimitMessage),
        );
        jest.setSystemTime(minutesAfterStart(181));
        repository.searchIssue.mockResolvedValue([
          {
            url: legacyIssueUrl,
            title:
              'Console error: Error: API rate limit already exceeded for user ID 6440811.',
            number: '10',
          },
        ]);
        await report(
          useCaseUnderTest,
          buildError('Error', graphQlRateLimitMessage),
        );

        expect(repository.getIssueOrPullRequestState).not.toHaveBeenCalled();
        expect(repository.searchIssue).toHaveBeenCalledTimes(2);
        expect(repository.searchIssue).toHaveBeenNthCalledWith(
          2,
          rateLimitSearch,
        );
        expect(repository.createNewIssue).toHaveBeenCalledTimes(1);
        expect(repository.createCommentByUrl).toHaveBeenCalledTimes(1);
        expect(repository.createCommentByUrl).toHaveBeenCalledWith(
          legacyIssueUrl,
          expect.stringContaining(graphQlRateLimitMessage),
        );
      });

      it('should comment on the existing open issue found by search again when the same error is reported later and search no longer finds it', async () => {
        const existingIssueUrl =
          'https://github.com/test-owner/test-repo/issues/10';
        const error = buildError('TypeError', 'something went wrong');
        const repository = createRepository();
        repository.searchIssue
          .mockResolvedValueOnce([
            {
              url: existingIssueUrl,
              title: `Triaged by the team: ${titleOf(error)}`,
              number: '10',
            },
          ])
          .mockResolvedValue([]);
        const useCaseUnderTest = new ConsoleErrorReportUseCase(
          repository,
          async () => undefined,
        );

        await report(useCaseUnderTest, error);
        await report(useCaseUnderTest, error);

        expect(
          repository.createCommentByUrl.mock.calls.map(([url]) => url),
        ).toEqual([existingIssueUrl, existingIssueUrl]);
        expect(repository.createNewIssue).not.toHaveBeenCalled();
      });

      it('should create one issue per repository when the same rate-limit error is reported for two repositories of the same owner', async () => {
        const otherRepo = 'test-repo-b';
        const repository = createRepository();
        const useCaseUnderTest = new ConsoleErrorReportUseCase(
          repository,
          async () => undefined,
        );

        await report(
          useCaseUnderTest,
          buildError('Error', restRateLimitMessage),
        );
        await useCaseUnderTest.run({
          error: buildError('Error', restRateLimitMessage),
          owner,
          repo: otherRepo,
          requestPath,
        });

        expect(
          repository.createNewIssue.mock.calls.map(
            ([organization, repositoryName]) => [organization, repositoryName],
          ),
        ).toEqual([
          [owner, repo],
          [owner, otherRepo],
        ]);
        expect(repository.createCommentByUrl).not.toHaveBeenCalled();
      });
    });

    describe('rate-limit issue title and search', () => {
      it.each([
        {
          label: 'REST wording',
          name: 'Error',
          message: restRateLimitMessage,
        },
        {
          label: 'GraphQL-prefixed wording',
          name: 'Error',
          message: graphQlRateLimitMessage,
        },
        {
          label: 'a different user id',
          name: 'Error',
          message: 'API rate limit already exceeded for user ID 7654321.',
        },
        {
          label: 'a different error name',
          name: 'GitHubRateLimitError',
          message: restRateLimitMessage,
        },
      ])(
        'should title a new issue with the canonical rate-limit title for $label',
        async ({ name, message }) => {
          const repository = createRepository();
          const useCaseUnderTest = new ConsoleErrorReportUseCase(repository);

          await report(useCaseUnderTest, buildError(name, message));

          expect(repository.searchIssue).toHaveBeenCalledWith(rateLimitSearch);
          expect(repository.createNewIssue).toHaveBeenCalledWith(
            owner,
            repo,
            canonicalRateLimitTitle,
            expect.stringContaining(message),
            [],
            [],
          );
          expect(repository.createCommentByUrl).not.toHaveBeenCalled();
        },
      );

      it.each([
        {
          label: 'the canonical title',
          title: canonicalRateLimitTitle,
        },
        {
          label: 'a legacy title with the full message',
          title:
            'Console error: Error: API rate limit already exceeded for user ID 6440811.',
        },
        {
          label: 'a legacy GraphQL title truncated to 80 characters',
          title:
            'Console error: Error: GitHub GraphQL API returned no data for fetchProjectItemByUrl: API rate limit al',
        },
        {
          label: 'text added before the title',
          title: `Triaged by the team: ${canonicalRateLimitTitle}`,
        },
        {
          label: 'text added after the title',
          title: `${canonicalRateLimitTitle} (reopened for investigation)`,
        },
        {
          label: 'Rate Limit in other casing',
          title:
            'Console error: Error: Rate Limit exceeded for user ID 1234567.',
        },
      ])(
        'should comment on the open issue titled with $label instead of creating a new issue',
        async ({ title }) => {
          const existingIssueUrl = issueUrl(10);
          const repository = createRepository();
          repository.searchIssue.mockResolvedValue([
            { url: existingIssueUrl, title, number: '10' },
          ]);
          const useCaseUnderTest = new ConsoleErrorReportUseCase(repository);

          await report(
            useCaseUnderTest,
            buildError('Error', restRateLimitMessage),
          );

          expect(repository.searchIssue).toHaveBeenCalledWith(rateLimitSearch);
          expect(repository.createCommentByUrl).toHaveBeenCalledTimes(1);
          expect(repository.createCommentByUrl).toHaveBeenCalledWith(
            existingIssueUrl,
            expect.stringContaining(restRateLimitMessage),
          );
          expect(repository.createNewIssue).not.toHaveBeenCalled();
        },
      );

      it.each([
        {
          label: 'a title without "Console error"',
          title: 'Fix rate limit handling in the daemon',
        },
        {
          label: 'a title without "rate limit"',
          title: 'Console error: Error: Failed to fetch',
        },
      ])(
        'should create a new issue with the canonical title when the only search result has $label',
        async ({ title }) => {
          const repository = createRepository();
          repository.searchIssue.mockResolvedValue([
            { url: issueUrl(9), title, number: '9' },
          ]);
          const useCaseUnderTest = new ConsoleErrorReportUseCase(repository);

          await report(
            useCaseUnderTest,
            buildError('Error', restRateLimitMessage),
          );

          expect(repository.createNewIssue).toHaveBeenCalledWith(
            owner,
            repo,
            canonicalRateLimitTitle,
            expect.stringContaining(restRateLimitMessage),
            [],
            [],
          );
          expect(repository.createCommentByUrl).not.toHaveBeenCalled();
        },
      );

      it('should comment only on the first search result whose title has both "Console error" and "rate limit"', async () => {
        const repository = createRepository();
        repository.searchIssue.mockResolvedValue([
          {
            url: issueUrl(9),
            title: 'Fix rate limit handling in the daemon',
            number: '9',
          },
          {
            url: issueUrl(10),
            title: 'Console error: Error: Failed to fetch',
            number: '10',
          },
          { url: issueUrl(11), title: canonicalRateLimitTitle, number: '11' },
          {
            url: issueUrl(12),
            title:
              'Console error: Error: API rate limit already exceeded for user ID 6440811.',
            number: '12',
          },
        ]);
        const useCaseUnderTest = new ConsoleErrorReportUseCase(repository);

        await report(
          useCaseUnderTest,
          buildError('Error', restRateLimitMessage),
        );

        expect(repository.createCommentByUrl).toHaveBeenCalledTimes(1);
        expect(repository.createCommentByUrl).toHaveBeenCalledWith(
          issueUrl(11),
          expect.stringContaining(restRateLimitMessage),
        );
        expect(repository.createNewIssue).not.toHaveBeenCalled();
      });

      it('should search a non-rate-limit error by its exact generated title and not comment on a rate-limit issue', async () => {
        const error = buildError('TypeError', 'something went wrong');
        const repository = createRepository();
        repository.searchIssue.mockResolvedValue([
          { url: issueUrl(10), title: canonicalRateLimitTitle, number: '10' },
        ]);
        const useCaseUnderTest = new ConsoleErrorReportUseCase(repository);

        await report(useCaseUnderTest, error);

        expect(repository.searchIssue).toHaveBeenCalledWith({
          owner,
          repositoryName: repo,
          type: 'issue',
          state: 'open',
          title: titleOf(error),
        });
        expect(repository.createCommentByUrl).not.toHaveBeenCalled();
        expect(repository.createNewIssue).toHaveBeenCalledWith(
          owner,
          repo,
          titleOf(error),
          expect.any(String),
          [],
          [],
        );
      });

      it('should comment on the issue created before a restart when a differently worded rate-limit report is reported by a new use case instance', async () => {
        const repository = createRepository();
        await report(
          new ConsoleErrorReportUseCase(repository),
          buildError('Error', restRateLimitMessage),
        );
        repository.searchIssue.mockResolvedValue([
          {
            url: createdIssueUrl,
            title: canonicalRateLimitTitle,
            number: String(createdIssueNumber),
          },
        ]);
        const restartedUseCase = new ConsoleErrorReportUseCase(repository);

        await report(
          restartedUseCase,
          buildError('Error', graphQlRateLimitMessage),
        );

        expect(repository.getIssueOrPullRequestState).not.toHaveBeenCalled();
        expect(repository.searchIssue).toHaveBeenCalledTimes(2);
        expect(repository.searchIssue).toHaveBeenNthCalledWith(
          2,
          rateLimitSearch,
        );
        expect(repository.createNewIssue).toHaveBeenCalledTimes(1);
        expect(repository.createCommentByUrl).toHaveBeenCalledTimes(1);
        expect(repository.createCommentByUrl).toHaveBeenCalledWith(
          createdIssueUrl,
          expect.stringContaining(graphQlRateLimitMessage),
        );
      });
    });

    describe('remembered issue validation', () => {
      const closedIssueState = {
        state: 'closed',
        merged: false,
        isPullRequest: false,
        title: '',
        stateReason: 'completed',
      };
      const secondCreatedIssueNumber = 43;

      it('should create a new issue and remember it when the remembered issue no longer exists, without logging an error', async () => {
        const repository = createRepository();
        repository.createNewIssue
          .mockResolvedValueOnce(createdIssueNumber)
          .mockResolvedValueOnce(secondCreatedIssueNumber);
        const useCaseUnderTest = new ConsoleErrorReportUseCase(repository);
        const consoleSpy = jest
          .spyOn(console, 'error')
          .mockImplementation(() => undefined);

        try {
          await report(
            useCaseUnderTest,
            buildError('Error', restRateLimitMessage),
          );
          repository.getIssueOrPullRequestState.mockRejectedValueOnce(
            new GitHubConfirmedNotFoundError(createdIssueUrl),
          );
          await report(
            useCaseUnderTest,
            buildError('Error', restRateLimitMessage),
          );
          await report(
            useCaseUnderTest,
            buildError('Error', restRateLimitMessage),
          );

          expect(repository.getIssueOrPullRequestState.mock.calls).toEqual([
            [createdIssueUrl],
            [issueUrl(secondCreatedIssueNumber)],
          ]);
          expect(repository.searchIssue).toHaveBeenCalledTimes(2);
          expect(repository.searchIssue).toHaveBeenNthCalledWith(
            2,
            rateLimitSearch,
          );
          expect(repository.createNewIssue).toHaveBeenCalledTimes(2);
          expect(
            repository.createCommentByUrl.mock.calls.map(([url]) => url),
          ).toEqual([issueUrl(secondCreatedIssueNumber)]);
          expect(consoleSpy).not.toHaveBeenCalled();
        } finally {
          consoleSpy.mockRestore();
        }
      });

      it('should comment on the open matching issue found by search when the remembered issue no longer exists, instead of creating a new issue', async () => {
        const otherIssueUrl = issueUrl(12);
        const repository = createRepository();
        const useCaseUnderTest = new ConsoleErrorReportUseCase(repository);
        const consoleSpy = jest
          .spyOn(console, 'error')
          .mockImplementation(() => undefined);

        try {
          await report(
            useCaseUnderTest,
            buildError('Error', restRateLimitMessage),
          );
          repository.getIssueOrPullRequestState.mockRejectedValueOnce(
            new GitHubConfirmedNotFoundError(createdIssueUrl),
          );
          repository.searchIssue.mockResolvedValueOnce([
            {
              url: otherIssueUrl,
              title: canonicalRateLimitTitle,
              number: '12',
            },
          ]);
          await report(
            useCaseUnderTest,
            buildError('Error', restRateLimitMessage),
          );

          expect(repository.searchIssue).toHaveBeenNthCalledWith(
            2,
            rateLimitSearch,
          );
          expect(repository.createNewIssue).toHaveBeenCalledTimes(1);
          expect(
            repository.createCommentByUrl.mock.calls.map(([url]) => url),
          ).toEqual([otherIssueUrl]);
          expect(consoleSpy).not.toHaveBeenCalled();
        } finally {
          consoleSpy.mockRestore();
        }
      });

      it('should treat a state of OPEN in any letter case as open and comment on the remembered issue without searching', async () => {
        const repository = createRepository();
        const useCaseUnderTest = new ConsoleErrorReportUseCase(repository);

        await report(
          useCaseUnderTest,
          buildError('Error', restRateLimitMessage),
        );
        repository.getIssueOrPullRequestState.mockResolvedValueOnce({
          ...openIssueState,
          state: 'OPEN',
        });
        await report(
          useCaseUnderTest,
          buildError('Error', restRateLimitMessage),
        );

        expect(repository.searchIssue).toHaveBeenCalledTimes(1);
        expect(repository.createNewIssue).toHaveBeenCalledTimes(1);
        expect(
          repository.createCommentByUrl.mock.calls.map(([url]) => url),
        ).toEqual([createdIssueUrl]);
      });

      it('should treat a state of Closed in any letter case as not open and create a new issue instead of commenting on the remembered issue', async () => {
        const repository = createRepository();
        repository.createNewIssue
          .mockResolvedValueOnce(createdIssueNumber)
          .mockResolvedValueOnce(secondCreatedIssueNumber);
        const useCaseUnderTest = new ConsoleErrorReportUseCase(repository);

        await report(
          useCaseUnderTest,
          buildError('Error', restRateLimitMessage),
        );
        repository.getIssueOrPullRequestState.mockResolvedValueOnce({
          ...closedIssueState,
          state: 'Closed',
        });
        await report(
          useCaseUnderTest,
          buildError('Error', restRateLimitMessage),
        );

        expect(repository.searchIssue).toHaveBeenCalledTimes(2);
        expect(repository.createNewIssue).toHaveBeenCalledTimes(2);
        expect(repository.createNewIssue).toHaveBeenNthCalledWith(
          2,
          owner,
          repo,
          canonicalRateLimitTitle,
          expect.stringContaining(restRateLimitMessage),
          [],
          [],
        );
        expect(repository.createCommentByUrl).not.toHaveBeenCalled();
      });

      it('should comment on the remembered issue without searching when its state is open', async () => {
        const repository = createRepository();
        const useCaseUnderTest = new ConsoleErrorReportUseCase(repository);

        await report(
          useCaseUnderTest,
          buildError('Error', restRateLimitMessage),
        );
        await report(
          useCaseUnderTest,
          buildError('Error', restRateLimitMessage),
        );

        expect(repository.getIssueOrPullRequestState).toHaveBeenCalledTimes(1);
        expect(repository.getIssueOrPullRequestState).toHaveBeenCalledWith(
          createdIssueUrl,
        );
        expect(repository.searchIssue).toHaveBeenCalledTimes(1);
        expect(repository.createNewIssue).toHaveBeenCalledTimes(1);
        expect(repository.createCommentByUrl).toHaveBeenCalledTimes(1);
        expect(repository.createCommentByUrl).toHaveBeenCalledWith(
          createdIssueUrl,
          expect.stringContaining(restRateLimitMessage),
        );
      });

      it('should create a new issue when the remembered issue is closed and search finds nothing, then comment on that new issue for the next report', async () => {
        const repository = createRepository();
        repository.createNewIssue
          .mockResolvedValueOnce(createdIssueNumber)
          .mockResolvedValueOnce(secondCreatedIssueNumber);
        const useCaseUnderTest = new ConsoleErrorReportUseCase(repository);

        await report(
          useCaseUnderTest,
          buildError('Error', restRateLimitMessage),
        );
        repository.getIssueOrPullRequestState.mockResolvedValueOnce(
          closedIssueState,
        );
        await report(
          useCaseUnderTest,
          buildError('Error', restRateLimitMessage),
        );
        await report(
          useCaseUnderTest,
          buildError('Error', restRateLimitMessage),
        );

        expect(repository.getIssueOrPullRequestState.mock.calls).toEqual([
          [createdIssueUrl],
          [issueUrl(secondCreatedIssueNumber)],
        ]);
        expect(repository.searchIssue).toHaveBeenCalledTimes(2);
        expect(repository.createNewIssue).toHaveBeenCalledTimes(2);
        expect(
          repository.createCommentByUrl.mock.calls.map(([url]) => url),
        ).toEqual([issueUrl(secondCreatedIssueNumber)]);
      });

      it('should comment on the open issue found by search when the remembered issue is closed', async () => {
        const otherIssueUrl = issueUrl(12);
        const repository = createRepository();
        const useCaseUnderTest = new ConsoleErrorReportUseCase(repository);

        await report(
          useCaseUnderTest,
          buildError('Error', restRateLimitMessage),
        );
        repository.getIssueOrPullRequestState.mockResolvedValueOnce(
          closedIssueState,
        );
        repository.searchIssue.mockResolvedValueOnce([
          { url: otherIssueUrl, title: canonicalRateLimitTitle, number: '12' },
        ]);
        await report(
          useCaseUnderTest,
          buildError('Error', restRateLimitMessage),
        );

        expect(repository.getIssueOrPullRequestState).toHaveBeenCalledTimes(1);
        expect(repository.getIssueOrPullRequestState).toHaveBeenCalledWith(
          createdIssueUrl,
        );
        expect(repository.searchIssue).toHaveBeenNthCalledWith(
          2,
          rateLimitSearch,
        );
        expect(repository.createNewIssue).toHaveBeenCalledTimes(1);
        expect(
          repository.createCommentByUrl.mock.calls.map(([url]) => url),
        ).toEqual([otherIssueUrl]);
      });

      it('should resolve, log the error and not comment or create when the state lookup rejects, then comment on the same issue once the lookup recovers', async () => {
        const repository = createRepository();
        const useCaseUnderTest = new ConsoleErrorReportUseCase(repository);
        await report(
          useCaseUnderTest,
          buildError('Error', restRateLimitMessage),
        );
        repository.getIssueOrPullRequestState.mockRejectedValueOnce(
          new Error('state lookup failed'),
        );
        const consoleSpy = jest
          .spyOn(console, 'error')
          .mockImplementation(() => undefined);

        try {
          await expect(
            report(useCaseUnderTest, buildError('Error', restRateLimitMessage)),
          ).resolves.toBeUndefined();
          expect(consoleSpy).toHaveBeenCalledTimes(1);
          expect(repository.createCommentByUrl).not.toHaveBeenCalled();
          expect(repository.createNewIssue).toHaveBeenCalledTimes(1);

          await report(
            useCaseUnderTest,
            buildError('Error', restRateLimitMessage),
          );

          expect(repository.getIssueOrPullRequestState.mock.calls).toEqual([
            [createdIssueUrl],
            [createdIssueUrl],
          ]);
          expect(repository.createNewIssue).toHaveBeenCalledTimes(1);
          expect(
            repository.createCommentByUrl.mock.calls.map(([url]) => url),
          ).toEqual([createdIssueUrl]);
        } finally {
          consoleSpy.mockRestore();
        }
      });
    });
  });
});
