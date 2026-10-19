const mockPost = jest.fn();
const mockGet = jest.fn();
const mockPut = jest.fn();
const mockPatch = jest.fn();
const mockDelete = jest.fn();

const mockCheckSecondaryRateLimitBreaker = jest.fn(
  (): { isBlocked: boolean; resetTimeMs: number | null } => ({
    isBlocked: false,
    resetTimeMs: null,
  }),
);
const mockWriteSecondaryRateLimitState = jest.fn();

jest.mock('./githubSecondaryRateLimitBreaker', () => ({
  checkSecondaryRateLimitBreaker: mockCheckSecondaryRateLimitBreaker,
  writeSecondaryRateLimitState: mockWriteSecondaryRateLimitState,
  secondaryRateLimitStateFilePath: () => '/tmp/test-breaker-state.json',
}));

class MockHTTPError extends Error {
  response: {
    status: number;
    statusText?: string;
    headers: Headers;
    clone: () => { text: () => Promise<string> };
  };
  data?: unknown;
  constructor(response: {
    status: number;
    statusText?: string;
    headers: Headers;
    clone: () => { text: () => Promise<string> };
  }) {
    super(`Request failed with status code ${response.status}`);
    this.response = response;
  }
}

jest.mock('ky', () => ({
  default: {
    post: mockPost,
    get: mockGet,
    put: mockPut,
    patch: mockPatch,
    delete: mockDelete,
    extend: jest.fn(),
    create: jest.fn(),
    stop: jest.fn(),
  },
  HTTPError: MockHTTPError,
  __esModule: true,
}));

import { RestIssueRepository } from './RestIssueRepository';
import { LocalStorageRepository } from '../LocalStorageRepository';
import { Issue } from '../../../domain/entities/Issue';

const mockJsonResponse = <T>(data: T) => ({
  ok: true,
  status: 200,
  headers: new Headers(),
  json: jest.fn().mockResolvedValue(data),
});

const buildIssue = (overrides: Partial<Issue> = {}): Issue => ({
  nameWithOwner: 'HiromiShikata/test-repository',
  number: 40,
  title: 'Test Issue',
  state: 'OPEN',
  status: null,
  story: null,
  nextActionDate: null,
  nextActionHour: null,
  estimationMinutes: null,
  dependedIssueUrls: [],
  completionDate50PercentConfidence: null,
  url: 'https://github.com/HiromiShikata/test-repository/issues/40',
  assignees: [],
  labels: ['test'],
  org: 'HiromiShikata',
  repo: 'test-repository',
  body: 'Test body',
  itemId: '',
  isPr: false,
  isInProgress: false,
  isClosed: false,
  createdAt: new Date(),
  author: '',
  closingIssueReferenceUrls: [],
  plainCrossRepoIssueReferenceUrls: [],
  agent: null,
  stateReason: null,
  ...overrides,
});

const buildGetIssueResponse = (
  labels: string[],
  assignees: string[],
): {
  labels: Array<{ name: string }>;
  assignees: Array<{ login: string }>;
  title: string;
  body: string;
  number: number;
  state: string;
  created_at: string;
} => ({
  labels: labels.map((name) => ({ name })),
  assignees: assignees.map((login) => ({ login })),
  title: 'Test Issue',
  body: 'Test body',
  number: 40,
  state: 'OPEN',
  created_at: '2020-01-01T00:00:00Z',
});

describe('RestIssueRepository', () => {
  const localStorageRepository = new LocalStorageRepository();
  const restIssueRepository: RestIssueRepository = new RestIssueRepository(
    localStorageRepository,
    'dummy-token',
  );

  afterEach(() => {
    mockPost.mockReset();
    mockGet.mockReset();
    mockPut.mockReset();
    mockPatch.mockReset();
    mockDelete.mockReset();
    mockCheckSecondaryRateLimitBreaker.mockReset();
    mockCheckSecondaryRateLimitBreaker.mockImplementation(
      (): { isBlocked: boolean; resetTimeMs: number | null } => ({
        isBlocked: false,
        resetTimeMs: null,
      }),
    );
    mockWriteSecondaryRateLimitState.mockReset();
    jest.restoreAllMocks();
  });

  describe('createComment', () => {
    it('should create a comment and return the created comment data', async () => {
      mockPost.mockReturnValue(
        mockJsonResponse({
          user: { login: 'HiromiShikata' },
          body: 'test comment',
          created_at: '2026-08-30T09:00:00Z',
          html_url:
            'https://github.com/HiromiShikata/test-repository/issues/40#issuecomment-999',
        }),
      );

      const result = await restIssueRepository.createComment(
        'https://github.com/HiromiShikata/test-repository/issues/40',
        'test comment',
      );

      expect(mockPost).toHaveBeenCalledTimes(1);
      expect(mockPost).toHaveBeenCalledWith(
        'https://api.github.com/repos/HiromiShikata/test-repository/issues/40/comments',
        {
          json: { body: 'test comment' },
          headers: { Authorization: 'token dummy-token' },
        },
      );
      expect(result).toEqual({
        author: 'HiromiShikata',
        body: 'test comment',
        createdAt: new Date('2026-08-30T09:00:00Z'),
        url: 'https://github.com/HiromiShikata/test-repository/issues/40#issuecomment-999',
      });
    });

    it('should return empty author when user is null', async () => {
      mockPost.mockReturnValue(
        mockJsonResponse({
          user: null,
          body: 'test comment',
          created_at: '2026-08-30T09:00:00Z',
          html_url:
            'https://github.com/HiromiShikata/test-repository/issues/40#issuecomment-998',
        }),
      );

      const result = await restIssueRepository.createComment(
        'https://github.com/HiromiShikata/test-repository/issues/40',
        'test comment',
      );

      expect(result.author).toBe('');
    });

    it('throws GitHubRateLimitError with reset time when ky returns 403 with rate-limit headers', async () => {
      const resetEpoch = 1725547200;
      const mockHeaders = new Headers({
        'x-ratelimit-remaining': '0',
        'x-ratelimit-reset': String(resetEpoch),
      });
      mockPost.mockImplementation(() => ({
        json: jest.fn().mockRejectedValue(
          new MockHTTPError({
            status: 403,
            headers: mockHeaders,
            clone: () => ({
              text: async () => 'API rate limit exceeded for user ID 6440811',
            }),
          }),
        ),
      }));

      const { GitHubRateLimitError } = await import('./githubRateLimitRetry');
      let thrownError: unknown;
      try {
        await restIssueRepository.createComment(
          'https://github.com/HiromiShikata/test-repository/issues/40',
          'test comment',
        );
      } catch (e) {
        thrownError = e;
      }
      expect(thrownError).toBeInstanceOf(GitHubRateLimitError);
      expect(thrownError).toMatchObject({
        rateLimitResetAt: new Date(resetEpoch * 1000).toISOString(),
      });
    });

    it.each([
      { status: 403, statusText: 'Forbidden', bodyText: 'Forbidden' },
      { status: 502, statusText: 'Bad Gateway', bodyText: 'Bad Gateway' },
      { status: 404, statusText: 'Not Found', bodyText: 'Not Found' },
      {
        status: 422,
        statusText: 'Unprocessable Entity',
        bodyText: 'Unprocessable Entity',
      },
    ])(
      'throws GitHubCommentCreateHttpError with statusCode $status and the exact message format when ky throws a non-rate-limit HTTPError with status $status',
      async ({ status, statusText, bodyText }) => {
        const mockHeaders = new Headers({ 'x-ratelimit-remaining': '100' });
        mockPost.mockImplementation(() => ({
          json: jest.fn().mockRejectedValue(
            new MockHTTPError({
              status,
              statusText,
              headers: mockHeaders,
              clone: () => ({ text: async () => bodyText }),
            }),
          ),
        }));

        const { GitHubCommentCreateHttpError } =
          await import('../GitHubIssueCommentRepository');

        await expect(
          restIssueRepository.createComment(
            'https://github.com/HiromiShikata/test-repository/issues/40',
            'test comment',
          ),
        ).rejects.toBeInstanceOf(GitHubCommentCreateHttpError);
        await expect(
          restIssueRepository.createComment(
            'https://github.com/HiromiShikata/test-repository/issues/40',
            'test comment',
          ),
        ).rejects.toMatchObject({
          name: 'GitHubCommentCreateHttpError',
          statusCode: status,
          message: `Failed to create comment via GitHub REST API: ${status} ${statusText}`,
        });
      },
    );

    it('rethrows a non-HTTPError exception unchanged without converting it to GitHubCommentCreateHttpError', async () => {
      const originalError = new Error('network socket hang up');
      mockPost.mockImplementation(() => ({
        json: jest.fn().mockRejectedValue(originalError),
      }));

      let thrownError: unknown;
      try {
        await restIssueRepository.createComment(
          'https://github.com/HiromiShikata/test-repository/issues/40',
          'test comment',
        );
      } catch (e) {
        thrownError = e;
      }

      expect(thrownError).toBe(originalError);
      expect(thrownError).not.toBeInstanceOf(MockHTTPError);
    });

    it('throws GitHubRateLimitError even when clone() throws (body already consumed by ky 2.x)', async () => {
      const resetEpoch = 1725547200;
      const mockHeaders = new Headers({
        'x-ratelimit-remaining': '0',
        'x-ratelimit-reset': String(resetEpoch),
      });
      mockPost.mockImplementation(() => ({
        json: jest.fn().mockRejectedValue(
          new MockHTTPError({
            status: 403,
            headers: mockHeaders,
            clone: () => ({
              text: async () => {
                throw new TypeError(
                  'Response.clone: Body has already been consumed.',
                );
              },
            }),
          }),
        ),
      }));

      const { GitHubRateLimitError } = await import('./githubRateLimitRetry');
      let thrownError: unknown;
      try {
        await restIssueRepository.createComment(
          'https://github.com/HiromiShikata/test-repository/issues/40',
          'test comment',
        );
      } catch (e) {
        thrownError = e;
      }
      expect(thrownError).toBeInstanceOf(GitHubRateLimitError);
      expect(thrownError).toMatchObject({
        rateLimitResetAt: new Date(resetEpoch * 1000).toISOString(),
      });
    });

    it('posts comment without a preflight comment fetch', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch');
      const issueUrl =
        'https://github.com/HiromiShikata/test-repository/issues/507';
      mockPost.mockReturnValue(
        mockJsonResponse({
          user: { login: 'bot' },
          body: 'Auto Status Check: REJECTED',
          created_at: new Date().toISOString(),
          html_url: `${issueUrl}#issuecomment-1`,
        }),
      );

      const result = await restIssueRepository.createComment(
        issueUrl,
        'Auto Status Check: REJECTED',
      );

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(mockPost).toHaveBeenCalledTimes(1);
      expect(typeof result.url).toBe('string');
      expect(result.url).not.toBeNull();
    });

    describe('circuit breaker', () => {
      it('issues the POST when the circuit breaker is not blocked', async () => {
        mockPost.mockReturnValue(
          mockJsonResponse({
            user: { login: 'bot' },
            body: 'hello',
            created_at: '2026-09-06T00:00:00Z',
            html_url:
              'https://github.com/HiromiShikata/test-repository/issues/40#issuecomment-1',
          }),
        );

        await restIssueRepository.createComment(
          'https://github.com/HiromiShikata/test-repository/issues/40',
          'hello',
        );

        expect(mockPost).toHaveBeenCalledTimes(1);
      });

      it('throws GitHubRateLimitError and does not issue the POST when the circuit breaker is open', async () => {
        const resetTimeMs = Date.now() + 90_000;
        mockCheckSecondaryRateLimitBreaker.mockReturnValue({
          isBlocked: true,
          resetTimeMs,
        });

        const { GitHubRateLimitError } = await import('./githubRateLimitRetry');
        await expect(
          restIssueRepository.createComment(
            'https://github.com/HiromiShikata/test-repository/issues/40',
            'hello',
          ),
        ).rejects.toBeInstanceOf(GitHubRateLimitError);

        expect(mockPost).not.toHaveBeenCalled();
      });

      it('writes to the breaker state file and throws GitHubRateLimitError when ky returns a secondary rate limit response', async () => {
        const mockHeaders = new Headers({ 'retry-after': '60' });
        mockPost.mockImplementation(() => ({
          json: jest.fn().mockRejectedValue(
            new MockHTTPError({
              status: 403,
              headers: mockHeaders,
              clone: () => ({
                text: async () =>
                  'You have exceeded a secondary rate limit and have been temporarily blocked from content creation.',
              }),
            }),
          ),
        }));

        const { GitHubRateLimitError } = await import('./githubRateLimitRetry');
        await expect(
          restIssueRepository.createComment(
            'https://github.com/HiromiShikata/test-repository/issues/40',
            'hello',
          ),
        ).rejects.toBeInstanceOf(GitHubRateLimitError);

        expect(mockWriteSecondaryRateLimitState).toHaveBeenCalledTimes(1);
      });
    });
  });
  describe('createNewIssue', () => {
    it('should create a new issue via fetch and return the issue number', async () => {
      const mockFetch = jest.fn().mockResolvedValue(
        new Response(JSON.stringify({ number: 123 }), {
          status: 201,
          headers: { 'content-type': 'application/json' },
        }),
      );
      global.fetch = mockFetch;

      const issueNumber = await restIssueRepository.createNewIssue(
        'HiromiShikata',
        'test-repository',
        'test issue',
        'test body',
        ['HiromiShikata'],
        ['test'],
      );

      expect(issueNumber).toBe(123);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/HiromiShikata/test-repository/issues',
        {
          method: 'POST',
          body: JSON.stringify({
            title: 'test issue',
            body: 'test body',
            assignees: ['HiromiShikata'],
            labels: ['test'],
          }),
          headers: {
            Authorization: 'token dummy-token',
            'Content-Type': 'application/json',
          },
        },
      );
    });

    it('logs rate-limit information via githubRestClient on successful createNewIssue', async () => {
      const consoleLogSpy = jest
        .spyOn(console, 'log')
        .mockImplementation(() => {});
      const resetEpoch = Math.floor(Date.now() / 1000) + 3600;
      const mockFetch = jest.fn().mockResolvedValue(
        new Response(JSON.stringify({ number: 456 }), {
          status: 201,
          headers: {
            'content-type': 'application/json',
            'x-ratelimit-remaining': '4999',
            'x-ratelimit-used': '1',
            'x-ratelimit-limit': '5000',
            'x-ratelimit-resource': 'core',
            'x-ratelimit-reset': String(resetEpoch),
          },
        }),
      );
      global.fetch = mockFetch;

      await restIssueRepository.createNewIssue(
        'HiromiShikata',
        'test-repository',
        'logged-issue',
        'body',
        [],
        [],
      );

      const logCalls = consoleLogSpy.mock.calls.map((args) => String(args[0]));
      const rateLimitLog = logCalls.find((msg) =>
        msg.includes('githubRestClient:'),
      );
      expect(rateLimitLog).toBeDefined();
      expect(rateLimitLog).toContain('method=POST');
      expect(rateLimitLog).toContain(
        'path=/repos/HiromiShikata/test-repository/issues',
      );
      expect(rateLimitLog).toContain('remaining=4999');
      consoleLogSpy.mockRestore();
    });

    it('throws for owner or repo containing URL-unsafe characters', async () => {
      await expect(
        restIssueRepository.createNewIssue(
          'owner with spaces',
          'valid-repo',
          'title',
          'body',
          [],
          [],
        ),
      ).rejects.toThrow('Invalid owner or repo name');

      await expect(
        restIssueRepository.createNewIssue(
          'valid-owner',
          'repo/with/slashes',
          'title',
          'body',
          [],
          [],
        ),
      ).rejects.toThrow('Invalid owner or repo name');
    });
  });
  describe('updateLabels', () => {
    it('should update issue labels', async () => {
      const issue = buildIssue();

      mockPut.mockResolvedValue(undefined);
      mockGet
        .mockReturnValueOnce(
          mockJsonResponse(buildGetIssueResponse(['default'], [])),
        )
        .mockReturnValueOnce(
          mockJsonResponse(buildGetIssueResponse(['test', 'updated'], [])),
        );

      await restIssueRepository.updateLabels(issue, ['default']);
      const issueDefault = await restIssueRepository.getIssue(issue.url);
      expect(issueDefault.labels).toContain('default');
      await restIssueRepository.updateLabels(issue, ['test', 'updated']);
      const updatedIssue = await restIssueRepository.getIssue(issue.url);
      expect(updatedIssue.labels).toContain('updated');
      expect(updatedIssue.labels).toContain('test');
      expect(updatedIssue.labels).not.toContain('default');

      expect(mockPut).toHaveBeenCalledTimes(2);
      expect(mockPut).toHaveBeenNthCalledWith(
        1,
        'https://api.github.com/repos/HiromiShikata/test-repository/issues/40/labels',
        {
          json: { labels: ['default'] },
          headers: {
            Authorization: 'token dummy-token',
            Accept: 'application/vnd.github.v3+json',
          },
        },
      );
      expect(mockPut).toHaveBeenNthCalledWith(
        2,
        'https://api.github.com/repos/HiromiShikata/test-repository/issues/40/labels',
        {
          json: { labels: ['test', 'updated'] },
          headers: {
            Authorization: 'token dummy-token',
            Accept: 'application/vnd.github.v3+json',
          },
        },
      );
    });
  });
  describe('removeLabel', () => {
    it('should remove a specific label from issue', async () => {
      const issue = buildIssue();

      mockPut.mockResolvedValue(undefined);
      mockDelete.mockResolvedValue(undefined);
      mockGet
        .mockReturnValueOnce(
          mockJsonResponse(buildGetIssueResponse(['test', 'to-remove'], [])),
        )
        .mockReturnValueOnce(
          mockJsonResponse(buildGetIssueResponse(['test'], [])),
        );

      await restIssueRepository.updateLabels(issue, ['test', 'to-remove']);
      const issueBefore = await restIssueRepository.getIssue(issue.url);
      expect(issueBefore.labels).toContain('to-remove');
      expect(issueBefore.labels).toContain('test');

      await restIssueRepository.removeLabel(issue, 'to-remove');
      const issueAfter = await restIssueRepository.getIssue(issue.url);
      expect(issueAfter.labels).not.toContain('to-remove');
      expect(issueAfter.labels).toContain('test');

      expect(mockDelete).toHaveBeenCalledTimes(1);
      expect(mockDelete).toHaveBeenCalledWith(
        'https://api.github.com/repos/HiromiShikata/test-repository/issues/40/labels/to-remove',
        {
          headers: {
            Authorization: 'token dummy-token',
            Accept: 'application/vnd.github.v3+json',
          },
        },
      );
    });
  });
  describe('updateAssigneeList', () => {
    it('should update issue assignees', async () => {
      const issue = buildIssue();

      mockPatch.mockResolvedValue(undefined);
      mockGet
        .mockReturnValueOnce(
          mockJsonResponse(buildGetIssueResponse(['test'], ['HiromiShikata'])),
        )
        .mockReturnValueOnce(
          mockJsonResponse(buildGetIssueResponse(['test'], [])),
        );

      await restIssueRepository.updateAssigneeList(issue, ['HiromiShikata']);
      const issueWithAssignee = await restIssueRepository.getIssue(issue.url);
      expect(issueWithAssignee.assignees).toContain('HiromiShikata');
      await restIssueRepository.updateAssigneeList(issue, []);
      const issueWithoutAssignee = await restIssueRepository.getIssue(
        issue.url,
      );
      expect(issueWithoutAssignee.assignees).not.toContain('HiromiShikata');

      expect(mockPatch).toHaveBeenCalledTimes(2);
      expect(mockPatch).toHaveBeenNthCalledWith(
        1,
        'https://api.github.com/repos/HiromiShikata/test-repository/issues/40',
        {
          json: { assignees: ['HiromiShikata'] },
          headers: { Authorization: 'token dummy-token' },
        },
      );
      expect(mockPatch).toHaveBeenNthCalledWith(
        2,
        'https://api.github.com/repos/HiromiShikata/test-repository/issues/40',
        {
          json: { assignees: [] },
          headers: { Authorization: 'token dummy-token' },
        },
      );
    });
  });

  describe('updateIssueBody', () => {
    it('sends only the body so the title, labels, assignees and state are left untouched', async () => {
      const issue = buildIssue();

      mockPatch.mockResolvedValue(undefined);

      await restIssueRepository.updateIssueBody(issue, 'rewritten body');

      expect(mockPatch).toHaveBeenCalledTimes(1);
      expect(mockPatch).toHaveBeenCalledWith(
        'https://api.github.com/repos/HiromiShikata/test-repository/issues/40',
        {
          json: { body: 'rewritten body' },
          headers: { Authorization: 'token dummy-token' },
        },
      );
    });
  });

  describe('updateIssueCommentBody', () => {
    it('sends only the body to the comment-specific endpoint derived from org, repo and commentId', async () => {
      mockPatch.mockResolvedValue(undefined);

      await restIssueRepository.updateIssueCommentBody(
        { org: 'HiromiShikata', repo: 'test-repository', commentId: 999 },
        'rewritten comment body',
      );

      expect(mockPatch).toHaveBeenCalledTimes(1);
      expect(mockPatch).toHaveBeenCalledWith(
        'https://api.github.com/repos/HiromiShikata/test-repository/issues/comments/999',
        {
          json: { body: 'rewritten comment body' },
          headers: { Authorization: 'token dummy-token' },
        },
      );
    });

    const commentedIssueNumberTestCases: {
      name: string;
      patchResponse: unknown;
      expectedCommentedIssueNumber: number | null;
    }[] = [
      {
        name: 'returns the issue number read from the issue_url of the updated comment',
        patchResponse: mockJsonResponse({
          id: 999,
          issue_url:
            'https://api.github.com/repos/HiromiShikata/test-repository/issues/40',
        }),
        expectedCommentedIssueNumber: 40,
      },
      {
        name: 'returns null when the response carries no issue_url',
        patchResponse: mockJsonResponse({ id: 999 }),
        expectedCommentedIssueNumber: null,
      },
      {
        name: 'returns null when issue_url is not a string',
        patchResponse: mockJsonResponse({ id: 999, issue_url: 40 }),
        expectedCommentedIssueNumber: null,
      },
      {
        name: 'returns null when issue_url does not end with an issue number',
        patchResponse: mockJsonResponse({
          id: 999,
          issue_url:
            'https://api.github.com/repos/HiromiShikata/test-repository/issues/comments/999',
        }),
        expectedCommentedIssueNumber: null,
      },
      {
        name: 'returns null when the response body is null',
        patchResponse: mockJsonResponse(null),
        expectedCommentedIssueNumber: null,
      },
      {
        name: 'returns null when the response body cannot be read as JSON',
        patchResponse: {
          json: jest.fn().mockRejectedValue(new SyntaxError('Unexpected end')),
        },
        expectedCommentedIssueNumber: null,
      },
    ];

    test.each(commentedIssueNumberTestCases)('$name', async (tc) => {
      mockPatch.mockResolvedValue(tc.patchResponse);

      const result = await restIssueRepository.updateIssueCommentBody(
        { org: 'HiromiShikata', repo: 'test-repository', commentId: 999 },
        'rewritten comment body',
      );

      expect(result).toEqual({
        commentedIssueNumber: tc.expectedCommentedIssueNumber,
      });
    });

    it('rejects with the error of the comment update request', async () => {
      const patchError = new Error('network down');
      mockPatch.mockRejectedValue(patchError);

      await expect(
        restIssueRepository.updateIssueCommentBody(
          { org: 'HiromiShikata', repo: 'test-repository', commentId: 999 },
          'rewritten comment body',
        ),
      ).rejects.toBe(patchError);
    });
  });

  describe('searchIssues', () => {
    const buildSearchItem = (
      overrides: Partial<{
        html_url: string;
        state: string;
        user: { login: string } | null;
        assignees: { login: string }[];
        pull_request: { merged_at: string | null } | null;
      }> = {},
    ) => ({
      html_url: 'https://github.com/HiromiShikata/test-repository/pull/12',
      state: 'open',
      user: { login: 'dependabot[bot]' },
      assignees: [],
      pull_request: { merged_at: null },
      ...overrides,
    });

    it('sends the query to the search endpoint and maps the response', async () => {
      mockGet.mockReturnValueOnce(
        mockJsonResponse({ items: [buildSearchItem()] }),
      );

      const searchedIssues = await restIssueRepository.searchIssues(
        'repo:HiromiShikata/test-repository is:open no:project',
      );

      expect(mockGet).toHaveBeenCalledWith(
        'https://api.github.com/search/issues',
        {
          searchParams: {
            q: 'repo:HiromiShikata/test-repository is:open no:project',
            per_page: 100,
            page: 1,
            advanced_search: 'true',
          },
          headers: { Authorization: 'token dummy-token' },
        },
      );
      expect(searchedIssues).toEqual([
        {
          url: 'https://github.com/HiromiShikata/test-repository/pull/12',
          org: 'HiromiShikata',
          repo: 'test-repository',
          number: 12,
          state: 'OPEN',
          author: 'dependabot',
          assignees: [],
          isPr: true,
        },
      ]);
    });

    it('sets isPr to false for an issue (non-pull-request) search result', async () => {
      mockGet.mockReturnValueOnce(
        mockJsonResponse({
          items: [
            buildSearchItem({
              html_url:
                'https://github.com/HiromiShikata/test-repository/issues/13',
              pull_request: null,
            }),
          ],
        }),
      );

      const searchedIssues = await restIssueRepository.searchIssues(
        'repo:HiromiShikata/test-repository is:open no:project',
      );

      expect(searchedIssues).toEqual([
        {
          url: 'https://github.com/HiromiShikata/test-repository/issues/13',
          org: 'HiromiShikata',
          repo: 'test-repository',
          number: 13,
          state: 'OPEN',
          author: 'dependabot',
          assignees: [],
          isPr: false,
        },
      ]);
    });

    it('keeps the author login of a human account unchanged', async () => {
      mockGet.mockReturnValueOnce(
        mockJsonResponse({
          items: [buildSearchItem({ user: { login: 'HiromiShikata' } })],
        }),
      );

      const searchedIssues = await restIssueRepository.searchIssues('anything');

      expect(searchedIssues[0].author).toBe('HiromiShikata');
    });

    it('maps a merged pull request and a closed issue to their states', async () => {
      mockGet.mockReturnValueOnce(
        mockJsonResponse({
          items: [
            buildSearchItem({
              state: 'closed',
              pull_request: { merged_at: '2026-08-09T00:00:00Z' },
            }),
            buildSearchItem({
              html_url:
                'https://github.com/HiromiShikata/test-repository/issues/13',
              state: 'closed',
              pull_request: null,
            }),
          ],
        }),
      );

      const searchedIssues = await restIssueRepository.searchIssues('anything');

      expect(searchedIssues.map((issue) => issue.state)).toEqual([
        'MERGED',
        'CLOSED',
      ]);
    });

    it('requests the next page while a full page is returned', async () => {
      const fullPage = Array.from({ length: 100 }, (_unused, index) =>
        buildSearchItem({
          html_url: `https://github.com/HiromiShikata/test-repository/pull/${index + 1}`,
        }),
      );
      mockGet
        .mockReturnValueOnce(mockJsonResponse({ items: fullPage }))
        .mockReturnValueOnce(mockJsonResponse({ items: [buildSearchItem()] }));

      const searchedIssues = await restIssueRepository.searchIssues('anything');

      expect(mockGet).toHaveBeenCalledTimes(2);
      expect(searchedIssues).toHaveLength(101);
    });
  });

  describe('getIssueSummariesByLabelAndState', () => {
    type IssueListParams = {
      owner: string;
      repositoryName: string;
      label: string;
      state: 'open' | 'closed';
    };
    type RawListedItem = {
      url: string;
      html_url: string;
      number: number;
      title: string;
      state: string;
      labels: { name: string }[];
      pull_request?: { url: string; html_url: string };
    };
    type KyListRequestOptions = {
      headers?: Record<string, string> | Headers;
      searchParams?:
        Record<string, string | number | boolean> | URLSearchParams | string;
      throwHttpErrors?: boolean | ((status: number) => boolean);
    };
    type ListRequest = {
      origin: string;
      pathname: string;
      query: Record<string, string>;
      headers: Headers;
    };

    const rawItemsPerPage = 100;
    const storyOpenParams: IssueListParams = {
      owner: 'HiromiShikata',
      repositoryName: 'test-repository',
      label: 'story',
      state: 'open',
    };

    class InMemoryLocalStorageRepository extends LocalStorageRepository {
      readonly savedTextByPath = new Map<string, string>();
      readonly createdDirectoryPaths = new Set<string>();
      private readonly buildMissingFileError = (path: string): Error =>
        Object.assign(
          new Error(`ENOENT: no such file or directory, open '${path}'`),
          { code: 'ENOENT' },
        );
      write = (path: string, value: string): void => {
        this.savedTextByPath.set(path, value);
      };
      read = (path: string): string | null => {
        const savedText = this.savedTextByPath.get(path);
        if (savedText === undefined) {
          throw this.buildMissingFileError(path);
        }
        return savedText;
      };
      readOrNull = (path: string): string | null =>
        this.savedTextByPath.get(path) ?? null;
      rename = (oldPath: string, newPath: string): void => {
        const savedText = this.savedTextByPath.get(oldPath);
        if (savedText === undefined) {
          throw this.buildMissingFileError(oldPath);
        }
        this.savedTextByPath.set(newPath, savedText);
        this.savedTextByPath.delete(oldPath);
      };
      listFiles = (dirPath: string): string[] =>
        Array.from(
          new Set(
            Array.from(this.savedTextByPath.keys())
              .filter((path) => path.startsWith(`${dirPath}/`))
              .map((path) => path.slice(dirPath.length + 1).split('/')[0]),
          ),
        );
      mkdir = (dirPath: string): void => {
        this.createdDirectoryPaths.add(dirPath);
      };
      remove = (path: string): void => {
        for (const savedPath of Array.from(this.savedTextByPath.keys())) {
          if (savedPath === path || savedPath.startsWith(`${path}/`)) {
            this.savedTextByPath.delete(savedPath);
          }
        }
      };
      tryCreateExclusive = (path: string): boolean => {
        if (this.savedTextByPath.has(path)) {
          return false;
        }
        this.savedTextByPath.set(path, '');
        return true;
      };
      statMtimeMs = (path: string): number | null =>
        this.savedTextByPath.has(path) ? 0 : null;
    }

    const buildRawIssue = (number: number): RawListedItem => ({
      url: `https://api.github.com/repos/HiromiShikata/test-repository/issues/${number}`,
      html_url: `https://github.com/HiromiShikata/test-repository/issues/${number}`,
      number,
      title: `story ${number}`,
      state: 'open',
      labels: [{ name: 'story' }],
    });
    const buildRawPullRequest = (number: number): RawListedItem => ({
      ...buildRawIssue(number),
      html_url: `https://github.com/HiromiShikata/test-repository/pull/${number}`,
      pull_request: {
        url: `https://api.github.com/repos/HiromiShikata/test-repository/pulls/${number}`,
        html_url: `https://github.com/HiromiShikata/test-repository/pull/${number}`,
      },
    });
    const buildRawItemsNewestFirst = (
      newestNumber: number,
      count: number,
      isPullRequestNumber: (number: number) => boolean = () => false,
    ): RawListedItem[] =>
      Array.from({ length: count }, (_unused, index) => {
        const number = newestNumber - index;
        return isPullRequestNumber(number)
          ? buildRawPullRequest(number)
          : buildRawIssue(number);
      });
    const toIssueSummaries = (
      rawItems: RawListedItem[],
    ): { url: string; title: string }[] =>
      rawItems
        .filter((rawItem) => rawItem.pull_request === undefined)
        .map((rawItem) => ({ url: rawItem.html_url, title: rawItem.title }));

    const toListRequest = (
      requestedUrl: string | URL,
      options: KyListRequestOptions | undefined,
    ): ListRequest => {
      const parsedUrl = new URL(String(requestedUrl));
      const query = new URLSearchParams(parsedUrl.search);
      const searchParams = options?.searchParams;
      if (
        typeof searchParams === 'string' ||
        searchParams instanceof URLSearchParams
      ) {
        new URLSearchParams(searchParams).forEach((value, name) =>
          query.set(name, value),
        );
      } else if (searchParams) {
        Object.entries(searchParams).forEach(([name, value]) =>
          query.set(name, String(value)),
        );
      }
      return {
        origin: parsedUrl.origin,
        pathname: parsedUrl.pathname,
        query: Object.fromEntries(query.entries()),
        headers: new Headers(options?.headers),
      };
    };
    const readListRequests = (): ListRequest[] =>
      mockGet.mock.calls.map(
        (call: [string | URL, KyListRequestOptions | undefined]) =>
          toListRequest(call[0], call[1]),
      );
    const readRequestedPages = (): string[] =>
      readListRequests().map((request) => request.query.page);

    const createFakeIssueListServer = () => {
      const publishedByListKey = new Map<
        string,
        { etagVersion: string; rawItems: RawListedItem[] }
      >();
      const failureStatusByPage = new Map<number, number>();
      const respondedStatuses: number[] = [];
      const buildListKey = (
        pathname: string,
        label: string,
        state: string,
      ): string => `${pathname}|${label}|${state}`;
      const respondWithStatus = (response: Response): Response => {
        respondedStatuses.push(response.status);
        return response;
      };
      return {
        respondedStatuses,
        publish: (
          params: IssueListParams,
          etagVersion: string,
          rawItems: RawListedItem[],
        ): void => {
          publishedByListKey.set(
            buildListKey(
              `/repos/${params.owner}/${params.repositoryName}/issues`,
              params.label,
              params.state,
            ),
            { etagVersion, rawItems },
          );
        },
        failPage: (page: number, status: number): void => {
          failureStatusByPage.set(page, status);
        },
        respond: (request: ListRequest): Response => {
          const page = Number(request.query.page);
          const failureStatus = failureStatusByPage.get(page);
          if (failureStatus !== undefined) {
            return respondWithStatus(
              new Response('failure', { status: failureStatus }),
            );
          }
          const published = publishedByListKey.get(
            buildListKey(
              request.pathname,
              request.query.labels,
              request.query.state,
            ),
          );
          const pageEtag = `W/"${published?.etagVersion ?? 'unpublished'}-page-${page}"`;
          if (request.headers.get('if-none-match') === pageEtag) {
            return respondWithStatus(new Response(null, { status: 304 }));
          }
          const pageItems = (published?.rawItems ?? []).slice(
            (page - 1) * rawItemsPerPage,
            page * rawItemsPerPage,
          );
          return respondWithStatus(
            new Response(JSON.stringify(pageItems), {
              status: 200,
              headers: { 'Content-Type': 'application/json', ETag: pageEtag },
            }),
          );
        },
      };
    };
    type FakeIssueListServer = ReturnType<typeof createFakeIssueListServer>;

    const connectFakeIssueListServer = (server: FakeIssueListServer): void => {
      mockGet.mockImplementation(
        async (
          requestedUrl: string | URL,
          options: KyListRequestOptions | undefined,
        ) => {
          const response = server.respond(toListRequest(requestedUrl, options));
          const throwHttpErrors = options?.throwHttpErrors ?? true;
          const mustThrow =
            typeof throwHttpErrors === 'function'
              ? throwHttpErrors(response.status)
              : throwHttpErrors;
          if (!response.ok && mustThrow) {
            throw new MockHTTPError(response);
          }
          return response;
        },
      );
    };

    const createRepositoryOver = (
      localStorage: LocalStorageRepository,
    ): RestIssueRepository =>
      new RestIssueRepository(localStorage, 'dummy-token');

    it('sends If-None-Match and reuses the previous list on a 304 response', async () => {
      const server = createFakeIssueListServer();
      const publishedItems = buildRawItemsNewestFirst(52, 3);
      server.publish(storyOpenParams, 'etag-1', publishedItems);
      connectFakeIssueListServer(server);
      const repository = createRepositoryOver(
        new InMemoryLocalStorageRepository(),
      );

      const firstList =
        await repository.getIssueSummariesByLabelAndState(storyOpenParams);
      const secondList =
        await repository.getIssueSummariesByLabelAndState(storyOpenParams);

      const requests = readListRequests();
      expect(requests).toHaveLength(2);
      expect(requests[0].headers.get('if-none-match')).toBeNull();
      expect(requests[1].headers.get('if-none-match')).toBe(
        'W/"etag-1-page-1"',
      );
      expect(server.respondedStatuses).toEqual([200, 304]);
      expect(firstList).toEqual(toIssueSummaries(publishedItems));
      expect(secondList).toEqual(toIssueSummaries(publishedItems));
    });

    it.each([
      { label: 'story', state: 'open' as const },
      { label: 'story', state: 'closed' as const },
      { label: 'bug', state: 'open' as const },
    ])(
      'requests the repository issues list endpoint with labels $label, state $state, per_page 100 and page 1 using the token authorization header',
      async ({ label, state }) => {
        const server = createFakeIssueListServer();
        connectFakeIssueListServer(server);
        const repository = createRepositoryOver(
          new InMemoryLocalStorageRepository(),
        );

        await repository.getIssueSummariesByLabelAndState({
          owner: 'HiromiShikata',
          repositoryName: 'test-repository',
          label,
          state,
        });

        const requests = readListRequests();
        expect(requests).toHaveLength(1);
        expect(requests[0].origin).toBe('https://api.github.com');
        expect(requests[0].pathname).toBe(
          '/repos/HiromiShikata/test-repository/issues',
        );
        expect(requests[0].query).toMatchObject({
          labels: label,
          state,
          per_page: '100',
          page: '1',
        });
        expect(requests[0].headers.get('authorization')).toBe(
          'token dummy-token',
        );
      },
    );

    it('excludes pull requests from the returned list and keeps the list order of the remaining issues', async () => {
      const server = createFakeIssueListServer();
      server.publish(storyOpenParams, 'etag-1', [
        buildRawIssue(90),
        buildRawPullRequest(89),
        buildRawIssue(88),
        buildRawPullRequest(87),
        buildRawIssue(86),
      ]);
      connectFakeIssueListServer(server);
      const repository = createRepositoryOver(
        new InMemoryLocalStorageRepository(),
      );

      const issueSummaries =
        await repository.getIssueSummariesByLabelAndState(storyOpenParams);

      expect(issueSummaries).toEqual([
        {
          url: 'https://github.com/HiromiShikata/test-repository/issues/90',
          title: 'story 90',
        },
        {
          url: 'https://github.com/HiromiShikata/test-repository/issues/88',
          title: 'story 88',
        },
        {
          url: 'https://github.com/HiromiShikata/test-repository/issues/86',
          title: 'story 86',
        },
      ]);
    });

    it.each([
      { totalItemCount: 0, expectedRequestedPages: ['1'] },
      { totalItemCount: 99, expectedRequestedPages: ['1'] },
      { totalItemCount: 100, expectedRequestedPages: ['1', '2'] },
      { totalItemCount: 137, expectedRequestedPages: ['1', '2'] },
      { totalItemCount: 200, expectedRequestedPages: ['1', '2', '3'] },
      { totalItemCount: 201, expectedRequestedPages: ['1', '2', '3'] },
      { totalItemCount: 305, expectedRequestedPages: ['1', '2', '3', '4'] },
    ])(
      'requests the next page only while the previous page returned 100 raw items and returns every issue across pages in list order for $totalItemCount issues',
      async ({ totalItemCount, expectedRequestedPages }) => {
        const server = createFakeIssueListServer();
        const publishedItems = buildRawItemsNewestFirst(1000, totalItemCount);
        server.publish(storyOpenParams, 'etag-1', publishedItems);
        connectFakeIssueListServer(server);
        const repository = createRepositoryOver(
          new InMemoryLocalStorageRepository(),
        );

        const issueSummaries =
          await repository.getIssueSummariesByLabelAndState(storyOpenParams);

        expect(readRequestedPages()).toEqual(expectedRequestedPages);
        expect(issueSummaries).toHaveLength(totalItemCount);
        expect(issueSummaries).toEqual(toIssueSummaries(publishedItems));
      },
    );

    it('requests the next page when a page returned 100 raw items of which pull requests make the returned issues fewer than 100', async () => {
      const server = createFakeIssueListServer();
      const publishedItems = buildRawItemsNewestFirst(
        150,
        150,
        (number) => number % 5 === 0,
      );
      server.publish(storyOpenParams, 'etag-1', publishedItems);
      connectFakeIssueListServer(server);
      const repository = createRepositoryOver(
        new InMemoryLocalStorageRepository(),
      );

      const issueSummaries =
        await repository.getIssueSummariesByLabelAndState(storyOpenParams);

      expect(readRequestedPages()).toEqual(['1', '2']);
      expect(issueSummaries).toHaveLength(120);
      expect(issueSummaries).toEqual(toIssueSummaries(publishedItems));
    });

    it('persists each page ETag and its items through the local storage so that a later instance sends the saved ETag of each page and returns the saved list on 304', async () => {
      const server = createFakeIssueListServer();
      const publishedItems = buildRawItemsNewestFirst(
        150,
        150,
        (number) => number % 5 === 0,
      );
      server.publish(storyOpenParams, 'etag-1', publishedItems);
      connectFakeIssueListServer(server);
      const sharedLocalStorage = new InMemoryLocalStorageRepository();

      const listFromFirstInstance =
        await createRepositoryOver(
          sharedLocalStorage,
        ).getIssueSummariesByLabelAndState(storyOpenParams);
      const listFromLaterInstance =
        await createRepositoryOver(
          sharedLocalStorage,
        ).getIssueSummariesByLabelAndState(storyOpenParams);

      const requests = readListRequests();
      expect(requests.map((request) => request.query.page)).toEqual([
        '1',
        '2',
        '1',
        '2',
      ]);
      expect(
        requests.map((request) => request.headers.get('if-none-match')),
      ).toEqual([null, null, 'W/"etag-1-page-1"', 'W/"etag-1-page-2"']);
      expect(server.respondedStatuses).toEqual([200, 200, 304, 304]);
      expect(listFromFirstInstance).toEqual(toIssueSummaries(publishedItems));
      expect(listFromLaterInstance).toEqual(toIssueSummaries(publishedItems));
    });

    it('sends no If-None-Match from an instance whose local storage holds no saved list', async () => {
      const server = createFakeIssueListServer();
      server.publish(storyOpenParams, 'etag-1', buildRawItemsNewestFirst(5, 5));
      connectFakeIssueListServer(server);
      await createRepositoryOver(
        new InMemoryLocalStorageRepository(),
      ).getIssueSummariesByLabelAndState(storyOpenParams);

      await createRepositoryOver(
        new InMemoryLocalStorageRepository(),
      ).getIssueSummariesByLabelAndState(storyOpenParams);

      expect(
        readListRequests().map((request) =>
          request.headers.get('if-none-match'),
        ),
      ).toEqual([null, null]);
      expect(server.respondedStatuses).toEqual([200, 200]);
    });

    it('replaces the saved ETag and items when a 200 arrives so that the next instance sends the new ETag and gets the new list on 304', async () => {
      const server = createFakeIssueListServer();
      const itemsBeforeChange = buildRawItemsNewestFirst(52, 2);
      const itemsAfterChange = buildRawItemsNewestFirst(60, 4);
      server.publish(storyOpenParams, 'etag-1', itemsBeforeChange);
      connectFakeIssueListServer(server);
      const sharedLocalStorage = new InMemoryLocalStorageRepository();
      const listBeforeChange =
        await createRepositoryOver(
          sharedLocalStorage,
        ).getIssueSummariesByLabelAndState(storyOpenParams);
      server.publish(storyOpenParams, 'etag-2', itemsAfterChange);

      const listOnChange =
        await createRepositoryOver(
          sharedLocalStorage,
        ).getIssueSummariesByLabelAndState(storyOpenParams);
      const listAfterChange =
        await createRepositoryOver(
          sharedLocalStorage,
        ).getIssueSummariesByLabelAndState(storyOpenParams);

      expect(
        readListRequests().map((request) =>
          request.headers.get('if-none-match'),
        ),
      ).toEqual([null, 'W/"etag-1-page-1"', 'W/"etag-2-page-1"']);
      expect(server.respondedStatuses).toEqual([200, 200, 304]);
      expect(listBeforeChange).toEqual(toIssueSummaries(itemsBeforeChange));
      expect(listOnChange).toEqual(toIssueSummaries(itemsAfterChange));
      expect(listAfterChange).toEqual(toIssueSummaries(itemsAfterChange));
    });

    it('drops the saved second page when a 200 shows the list now fits on one page', async () => {
      const server = createFakeIssueListServer();
      const itemsBeforeChange = buildRawItemsNewestFirst(500, 150);
      const itemsAfterChange = buildRawItemsNewestFirst(500, 40);
      server.publish(storyOpenParams, 'etag-1', itemsBeforeChange);
      connectFakeIssueListServer(server);
      const sharedLocalStorage = new InMemoryLocalStorageRepository();
      await createRepositoryOver(
        sharedLocalStorage,
      ).getIssueSummariesByLabelAndState(storyOpenParams);
      server.publish(storyOpenParams, 'etag-2', itemsAfterChange);
      mockGet.mockClear();

      const listOnChange =
        await createRepositoryOver(
          sharedLocalStorage,
        ).getIssueSummariesByLabelAndState(storyOpenParams);
      const listAfterChange =
        await createRepositoryOver(
          sharedLocalStorage,
        ).getIssueSummariesByLabelAndState(storyOpenParams);

      expect(readRequestedPages()).toEqual(['1', '1']);
      expect(listOnChange).toHaveLength(40);
      expect(listAfterChange).toEqual(toIssueSummaries(itemsAfterChange));
    });

    it.each([
      {
        differingField: 'state',
        otherParams: { ...storyOpenParams, state: 'closed' as const },
      },
      {
        differingField: 'label',
        otherParams: { ...storyOpenParams, label: 'bug' },
      },
      {
        differingField: 'repository name',
        otherParams: { ...storyOpenParams, repositoryName: 'other-repository' },
      },
      {
        differingField: 'owner',
        otherParams: { ...storyOpenParams, owner: 'other-owner' },
      },
    ])(
      'keeps the saved ETag and list of each list separate when only the $differingField differs',
      async ({ otherParams }) => {
        const server = createFakeIssueListServer();
        const storyOpenItems = buildRawItemsNewestFirst(52, 3);
        const otherItems = buildRawItemsNewestFirst(900, 2);
        server.publish(storyOpenParams, 'etag-story-open', storyOpenItems);
        server.publish(otherParams, 'etag-other', otherItems);
        connectFakeIssueListServer(server);
        const sharedLocalStorage = new InMemoryLocalStorageRepository();
        await createRepositoryOver(
          sharedLocalStorage,
        ).getIssueSummariesByLabelAndState(storyOpenParams);

        const otherList =
          await createRepositoryOver(
            sharedLocalStorage,
          ).getIssueSummariesByLabelAndState(otherParams);
        const storyOpenListAgain =
          await createRepositoryOver(
            sharedLocalStorage,
          ).getIssueSummariesByLabelAndState(storyOpenParams);

        expect(
          readListRequests().map((request) =>
            request.headers.get('if-none-match'),
          ),
        ).toEqual([null, null, 'W/"etag-story-open-page-1"']);
        expect(server.respondedStatuses).toEqual([200, 200, 304]);
        expect(otherList).toEqual(toIssueSummaries(otherItems));
        expect(storyOpenListAgain).toEqual(toIssueSummaries(storyOpenItems));
      },
    );

    it.each([
      { failingPage: 1, failingStatus: 500 },
      { failingPage: 1, failingStatus: 403 },
      { failingPage: 1, failingStatus: 404 },
      { failingPage: 2, failingStatus: 502 },
    ])(
      'rejects instead of returning a partial list when page $failingPage responds with status $failingStatus',
      async ({ failingPage, failingStatus }) => {
        const server = createFakeIssueListServer();
        server.publish(
          storyOpenParams,
          'etag-1',
          buildRawItemsNewestFirst(500, 150),
        );
        server.failPage(failingPage, failingStatus);
        connectFakeIssueListServer(server);
        const repository = createRepositoryOver(
          new InMemoryLocalStorageRepository(),
        );

        await expect(
          repository.getIssueSummariesByLabelAndState(storyOpenParams),
        ).rejects.toThrow();
      },
    );

    describe('saved list that cannot be used', () => {
      const savedEtagOfPageOne = 'W/"etag-old-page-1"';
      const savedEtagOfPageTwo = 'W/"etag-old-page-2"';
      const savedIssueSummary = {
        url: 'https://github.com/HiromiShikata/test-repository/issues/7',
        title: 'story 7',
      };
      const buildSavedPage = (
        overrides: Record<string, unknown> = {},
      ): Record<string, unknown> => ({
        etag: savedEtagOfPageOne,
        rawItemCount: 1,
        issueSummaries: [savedIssueSummary],
        ...overrides,
      });
      const unusableSavedTexts: { name: string; savedText: string }[] = [
        {
          name: 'text that is not valid JSON',
          savedText: 'issue summary list that is not JSON',
        },
        {
          name: 'a JSON document cut off in the middle',
          savedText: JSON.stringify({ pages: [buildSavedPage()] }).slice(0, -6),
        },
        { name: 'an empty file', savedText: '' },
        { name: 'JSON null', savedText: 'null' },
        { name: 'a JSON number', savedText: '42' },
        { name: 'a JSON string', savedText: JSON.stringify('pages') },
        {
          name: 'a JSON array holding pages',
          savedText: JSON.stringify([buildSavedPage()]),
        },
        {
          name: 'an object without pages',
          savedText: JSON.stringify({ lists: [buildSavedPage()] }),
        },
        {
          name: 'an object whose pages is not an array',
          savedText: JSON.stringify({ pages: buildSavedPage() }),
        },
        {
          name: 'an object whose pages holds null',
          savedText: JSON.stringify({ pages: [null] }),
        },
        {
          name: 'a page without its saved items',
          savedText: JSON.stringify({
            pages: [
              {
                etag: savedEtagOfPageOne,
                rawItemCount: 1,
              },
            ],
          }),
        },
        {
          name: 'a page whose saved items are not an array',
          savedText: JSON.stringify({
            pages: [buildSavedPage({ issueSummaries: 'story 7' })],
          }),
        },
        {
          name: 'a saved item whose url is not a string',
          savedText: JSON.stringify({
            pages: [
              buildSavedPage({
                issueSummaries: [{ url: 7, title: savedIssueSummary.title }],
              }),
            ],
          }),
        },
        {
          name: 'a saved item without its url',
          savedText: JSON.stringify({
            pages: [
              buildSavedPage({
                issueSummaries: [{ title: savedIssueSummary.title }],
              }),
            ],
          }),
        },
        {
          name: 'a saved item whose title is not a string',
          savedText: JSON.stringify({
            pages: [
              buildSavedPage({
                issueSummaries: [{ url: savedIssueSummary.url, title: null }],
              }),
            ],
          }),
        },
        {
          name: 'a saved item without its title',
          savedText: JSON.stringify({
            pages: [
              buildSavedPage({
                issueSummaries: [{ url: savedIssueSummary.url }],
              }),
            ],
          }),
        },
        {
          name: 'a saved item that is not an object',
          savedText: JSON.stringify({
            pages: [buildSavedPage({ issueSummaries: ['story 7'] })],
          }),
        },
        {
          name: 'a saved ETag that is a number',
          savedText: JSON.stringify({
            pages: [buildSavedPage({ etag: 7 })],
          }),
        },
        {
          name: 'a saved ETag that is an object',
          savedText: JSON.stringify({
            pages: [buildSavedPage({ etag: { value: savedEtagOfPageOne } })],
          }),
        },
        {
          name: 'a saved ETag that is true',
          savedText: JSON.stringify({
            pages: [buildSavedPage({ etag: true })],
          }),
        },
        {
          name: 'a saved raw item count that is not a number',
          savedText: JSON.stringify({
            pages: [buildSavedPage({ rawItemCount: '1' })],
          }),
        },
        {
          name: 'a usable first page followed by a second page without its saved items',
          savedText: JSON.stringify({
            pages: [
              buildSavedPage({ rawItemCount: rawItemsPerPage }),
              { etag: savedEtagOfPageTwo, rawItemCount: 1 },
            ],
          }),
        },
      ];

      const overwriteSavedListText = async (
        localStorage: InMemoryLocalStorageRepository,
        savedText: string,
      ): Promise<void> => {
        const seedServer = createFakeIssueListServer();
        seedServer.publish(
          storyOpenParams,
          'etag-seed',
          buildRawItemsNewestFirst(7, 1),
        );
        connectFakeIssueListServer(seedServer);
        await createRepositoryOver(
          localStorage,
        ).getIssueSummariesByLabelAndState(storyOpenParams);
        const savedListPaths = Array.from(localStorage.savedTextByPath.keys());
        expect(savedListPaths).toHaveLength(1);
        localStorage.savedTextByPath.set(savedListPaths[0], savedText);
        mockGet.mockClear();
      };

      it.each(unusableSavedTexts)(
        'sends no If-None-Match on any page and returns the freshly fetched items when the saved list is $name',
        async ({ savedText }) => {
          const sharedLocalStorage = new InMemoryLocalStorageRepository();
          await overwriteSavedListText(sharedLocalStorage, savedText);
          const server = createFakeIssueListServer();
          const publishedItems = buildRawItemsNewestFirst(500, 150);
          server.publish(storyOpenParams, 'etag-new', publishedItems);
          connectFakeIssueListServer(server);

          const issueSummaries =
            await createRepositoryOver(
              sharedLocalStorage,
            ).getIssueSummariesByLabelAndState(storyOpenParams);

          expect(readRequestedPages()).toEqual(['1', '2']);
          expect(
            readListRequests().map((request) =>
              request.headers.get('if-none-match'),
            ),
          ).toEqual([null, null]);
          expect(server.respondedStatuses).toEqual([200, 200]);
          expect(issueSummaries).toEqual(toIssueSummaries(publishedItems));
        },
      );

      it.each(unusableSavedTexts)(
        'replaces the saved list with the fetched one so that the next instance sends the new ETag of each page and gets the fetched items on 304 when the saved list is $name',
        async ({ savedText }) => {
          const sharedLocalStorage = new InMemoryLocalStorageRepository();
          await overwriteSavedListText(sharedLocalStorage, savedText);
          const server = createFakeIssueListServer();
          const publishedItems = buildRawItemsNewestFirst(500, 150);
          server.publish(storyOpenParams, 'etag-new', publishedItems);
          connectFakeIssueListServer(server);
          await createRepositoryOver(
            sharedLocalStorage,
          ).getIssueSummariesByLabelAndState(storyOpenParams);

          const issueSummariesFromNextInstance =
            await createRepositoryOver(
              sharedLocalStorage,
            ).getIssueSummariesByLabelAndState(storyOpenParams);

          expect(
            readListRequests().map((request) =>
              request.headers.get('if-none-match'),
            ),
          ).toEqual([null, null, 'W/"etag-new-page-1"', 'W/"etag-new-page-2"']);
          expect(server.respondedStatuses).toEqual([200, 200, 304, 304]);
          expect(issueSummariesFromNextInstance).toEqual(
            toIssueSummaries(publishedItems),
          );
        },
      );
    });
  });

  describe('updateIssue', () => {
    it('throws GitHubRateLimitError with reset time when ky returns 403 with primary rate-limit headers', async () => {
      const resetEpoch = 1725547200;
      const mockHeaders = new Headers({
        'x-ratelimit-remaining': '0',
        'x-ratelimit-reset': String(resetEpoch),
      });
      mockPatch.mockRejectedValue(
        new MockHTTPError({
          status: 403,
          headers: mockHeaders,
          clone: () => ({
            // Non-secondary body: exercises the primary-rate-limit path
            text: async () => 'API rate limit exceeded',
          }),
        }),
      );

      const { GitHubRateLimitError } = await import('./githubRateLimitRetry');
      let thrownError: unknown;
      try {
        await restIssueRepository.updateIssue(buildIssue());
      } catch (e) {
        thrownError = e;
      }
      expect(thrownError).toBeInstanceOf(GitHubRateLimitError);
      expect(thrownError).toMatchObject({
        rateLimitResetAt: new Date(resetEpoch * 1000).toISOString(),
      });
    });

    it('rethrows non-rate-limit HTTPError from ky unchanged', async () => {
      const mockHeaders = new Headers({ 'x-ratelimit-remaining': '100' });
      mockPatch.mockRejectedValue(
        new MockHTTPError({
          status: 403,
          headers: mockHeaders,
          clone: () => ({ text: async () => 'Forbidden' }),
        }),
      );

      await expect(
        restIssueRepository.updateIssue(buildIssue()),
      ).rejects.toBeInstanceOf(MockHTTPError);
    });

    it('throws GitHubRateLimitError even when clone() throws (body already consumed by ky 2.x)', async () => {
      const resetEpoch = 1725547200;
      const mockHeaders = new Headers({
        'x-ratelimit-remaining': '0',
        'x-ratelimit-reset': String(resetEpoch),
      });
      mockPatch.mockRejectedValue(
        new MockHTTPError({
          status: 403,
          headers: mockHeaders,
          clone: () => ({
            text: async () => {
              throw new TypeError(
                'Response.clone: Body has already been consumed.',
              );
            },
          }),
        }),
      );

      const { GitHubRateLimitError } = await import('./githubRateLimitRetry');
      let thrownError: unknown;
      try {
        await restIssueRepository.updateIssue(buildIssue());
      } catch (e) {
        thrownError = e;
      }
      expect(thrownError).toBeInstanceOf(GitHubRateLimitError);
      expect(thrownError).toMatchObject({
        rateLimitResetAt: new Date(resetEpoch * 1000).toISOString(),
      });
    });

    it('throws GitHubRateLimitError when clone() itself throws synchronously (body already consumed by ky 2.x)', async () => {
      const resetEpoch = 1725547200;
      const mockHeaders = new Headers({
        'x-ratelimit-remaining': '0',
        'x-ratelimit-reset': String(resetEpoch),
      });
      mockPatch.mockRejectedValue(
        new MockHTTPError({
          status: 403,
          headers: mockHeaders,
          clone: (): { text: () => Promise<string> } => {
            throw new TypeError(
              'Response.clone: Body has already been consumed.',
            );
          },
        }),
      );

      const { GitHubRateLimitError } = await import('./githubRateLimitRetry');
      let thrownError: unknown;
      try {
        await restIssueRepository.updateIssue(buildIssue());
      } catch (e) {
        thrownError = e;
      }
      expect(thrownError).toBeInstanceOf(GitHubRateLimitError);
      expect(thrownError).toMatchObject({
        rateLimitResetAt: new Date(resetEpoch * 1000).toISOString(),
      });
    });

    it('throws RepositoryArchivedError when ky returns 403 with archived repository body', async () => {
      const mockHeaders = new Headers({ 'x-ratelimit-remaining': '100' });
      mockPatch.mockRejectedValue(
        new MockHTTPError({
          status: 403,
          headers: mockHeaders,
          clone: () => ({
            text: async () => 'Repository was archived so is read-only.',
          }),
        }),
      );

      const { RepositoryArchivedError } =
        await import('../../../domain/usecases/NotifyFinishedIssuePreparationUseCase');
      await expect(
        restIssueRepository.updateIssue(buildIssue()),
      ).rejects.toBeInstanceOf(RepositoryArchivedError);
    });

    it('throws RepositoryArchivedError when clone() throws but error.data has archived message', async () => {
      const mockHeaders = new Headers({ 'x-ratelimit-remaining': '100' });
      const archivedError = new MockHTTPError({
        status: 403,
        headers: mockHeaders,
        clone: (): { text: () => Promise<string> } => {
          throw new TypeError(
            'Response.clone: Body has already been consumed.',
          );
        },
      });
      archivedError.data = {
        message: 'Repository was archived so is read-only.',
      };
      mockPatch.mockRejectedValue(archivedError);

      const { RepositoryArchivedError } =
        await import('../../../domain/usecases/NotifyFinishedIssuePreparationUseCase');
      await expect(
        restIssueRepository.updateIssue(buildIssue()),
      ).rejects.toBeInstanceOf(RepositoryArchivedError);
    });

    it('throws RepositoryArchivedError when clone() throws and error.data is a plain string with archived text', async () => {
      const mockHeaders = new Headers({ 'x-ratelimit-remaining': '100' });
      const archivedError = new MockHTTPError({
        status: 403,
        headers: mockHeaders,
        clone: (): { text: () => Promise<string> } => {
          throw new TypeError(
            'Response.clone: Body has already been consumed.',
          );
        },
      });
      archivedError.data = 'Repository was archived so is read-only.';
      mockPatch.mockRejectedValue(archivedError);

      const { RepositoryArchivedError } =
        await import('../../../domain/usecases/NotifyFinishedIssuePreparationUseCase');
      await expect(
        restIssueRepository.updateIssue(buildIssue()),
      ).rejects.toBeInstanceOf(RepositoryArchivedError);
    });

    it('does not send state field to preserve agent-closed issue state', async () => {
      mockPatch.mockResolvedValue(undefined);
      await restIssueRepository.updateIssue(buildIssue({ state: 'OPEN' }));
      expect(mockPatch).toHaveBeenCalledWith(
        'https://api.github.com/repos/HiromiShikata/test-repository/issues/40',
        {
          json: {
            title: 'Test Issue',
            body: 'Test body',
            assignees: [],
            labels: ['test'],
          },
          headers: { Authorization: 'token dummy-token' },
        },
      );
    });

    it('does not send state field when domain state is "CLOSED"', async () => {
      mockPatch.mockResolvedValue(undefined);
      await restIssueRepository.updateIssue(buildIssue({ state: 'CLOSED' }));
      expect(mockPatch).toHaveBeenCalledWith(
        'https://api.github.com/repos/HiromiShikata/test-repository/issues/40',
        {
          json: {
            title: 'Test Issue',
            body: 'Test body',
            assignees: [],
            labels: ['test'],
          },
          headers: { Authorization: 'token dummy-token' },
        },
      );
    });

    it('does not send state field when domain state is "MERGED"', async () => {
      mockPatch.mockResolvedValue(undefined);
      await restIssueRepository.updateIssue(buildIssue({ state: 'MERGED' }));
      expect(mockPatch).toHaveBeenCalledWith(
        'https://api.github.com/repos/HiromiShikata/test-repository/issues/40',
        {
          json: {
            title: 'Test Issue',
            body: 'Test body',
            assignees: [],
            labels: ['test'],
          },
          headers: { Authorization: 'token dummy-token' },
        },
      );
    });
  });

  describe('getIssueOrPullRequestComments', () => {
    const issueUrl =
      'https://github.com/HiromiShikata/test-repository/issues/40';

    it('returns empty array when first page has no comments', async () => {
      mockGet.mockReturnValueOnce(mockJsonResponse([]));

      const result =
        await restIssueRepository.getIssueOrPullRequestComments(issueUrl);

      expect(result).toEqual([]);
      expect(mockGet).toHaveBeenCalledTimes(1);
    });

    it('returns comments from a single page when response has fewer than 100 items, including the numeric id from the raw REST response', async () => {
      const created = '2026-09-01T00:00:00Z';
      mockGet.mockReturnValueOnce(
        mockJsonResponse([
          {
            id: 555123,
            user: { login: 'alice' },
            body: 'hello',
            created_at: created,
            html_url: `${issueUrl}#issuecomment-1`,
          },
        ]),
      );

      const result =
        await restIssueRepository.getIssueOrPullRequestComments(issueUrl);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 555123,
        author: 'alice',
        body: 'hello',
        createdAt: new Date(created),
      });
      expect(mockGet).toHaveBeenCalledTimes(1);
    });

    it('fetches subsequent pages until the page is smaller than 100 items, carrying each comment id through from the mocked REST response', async () => {
      const makePage = (
        n: number,
        startId: number,
      ): Array<{
        id: number;
        user: { login: string };
        body: string;
        created_at: string;
        html_url: string;
      }> =>
        Array.from({ length: n }, (_, i) => ({
          id: startId + i,
          user: { login: 'bot' },
          body: `comment ${startId + i}`,
          created_at: '2026-09-01T00:00:00Z',
          html_url: `${issueUrl}#issuecomment-${startId + i}`,
        }));

      mockGet
        .mockReturnValueOnce(mockJsonResponse(makePage(100, 1)))
        .mockReturnValueOnce(mockJsonResponse(makePage(3, 101)));

      const result =
        await restIssueRepository.getIssueOrPullRequestComments(issueUrl);

      expect(result).toHaveLength(103);
      expect(result.map((comment) => comment.id)).toEqual(
        Array.from({ length: 103 }, (_, i) => i + 1),
      );
      expect(mockGet).toHaveBeenCalledTimes(2);
      expect(mockGet).toHaveBeenNthCalledWith(
        1,
        'https://api.github.com/repos/HiromiShikata/test-repository/issues/40/comments?per_page=100&page=1',
        expect.objectContaining({
          headers: { Authorization: 'token dummy-token' },
        }),
      );
      expect(mockGet).toHaveBeenNthCalledWith(
        2,
        'https://api.github.com/repos/HiromiShikata/test-repository/issues/40/comments?per_page=100&page=2',
        expect.objectContaining({
          headers: { Authorization: 'token dummy-token' },
        }),
      );
    });
  });

  describe('getIssueOrPullRequestComments reuse of the stored comment list', () => {
    const issueUrl =
      'https://github.com/HiromiShikata/test-repository/issues/40';
    const firstPageUrl =
      'https://api.github.com/repos/HiromiShikata/test-repository/issues/40/comments?per_page=100&page=1';
    type CommentResponseItem = {
      id: number;
      user: { login: string } | null;
      body: string | null;
      created_at: string;
    };
    const firstCommentResponseItem: CommentResponseItem = {
      id: 91001,
      user: { login: 'alice' },
      body: 'first comment',
      created_at: '2026-07-01T00:00:00Z',
    };
    const secondCommentResponseItem: CommentResponseItem = {
      id: 91002,
      user: { login: 'bob' },
      body: 'second comment',
      created_at: '2026-07-02T00:00:00Z',
    };
    const firstIssueComment = {
      id: 91001,
      author: 'alice',
      body: 'first comment',
      createdAt: new Date('2026-07-01T00:00:00Z'),
    };
    const secondIssueComment = {
      id: 91002,
      author: 'bob',
      body: 'second comment',
      createdAt: new Date('2026-07-02T00:00:00Z'),
    };
    const buildCommentsPageResponse = (
      comments: CommentResponseItem[],
      etag: string,
    ): Response =>
      new Response(JSON.stringify(comments), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ETag: etag },
      });
    const createRestIssueRepository = (): RestIssueRepository =>
      new RestIssueRepository(new LocalStorageRepository(), 'dummy-token');

    it('requests the comment list once for two calls carrying the same issueUpdatedAt on one instance and returns the stored list with createdAt as a Date on the second call', async () => {
      mockGet.mockImplementation(() =>
        buildCommentsPageResponse(
          [firstCommentResponseItem, secondCommentResponseItem],
          '"rest-etag-1"',
        ),
      );
      const repository = createRestIssueRepository();

      const firstResult = await repository.getIssueOrPullRequestComments(
        issueUrl,
        { issueUpdatedAt: new Date('2026-07-06T00:00:00.000Z') },
      );
      const secondResult = await repository.getIssueOrPullRequestComments(
        issueUrl,
        { issueUpdatedAt: new Date('2026-07-06T00:00:00.000Z') },
      );

      expect(mockGet).toHaveBeenCalledTimes(1);
      expect(firstResult).toEqual([firstIssueComment, secondIssueComment]);
      expect(secondResult).toEqual([firstIssueComment, secondIssueComment]);
    });

    it('sends the stored ETag as If-None-Match when issueUpdatedAt changed, returns the stored list on 304, and stores the new list and ETag on 200', async () => {
      mockGet
        .mockReturnValueOnce(
          buildCommentsPageResponse(
            [firstCommentResponseItem],
            '"rest-etag-1"',
          ),
        )
        .mockReturnValueOnce(new Response(null, { status: 304 }))
        .mockReturnValueOnce(
          buildCommentsPageResponse(
            [firstCommentResponseItem, secondCommentResponseItem],
            '"rest-etag-2"',
          ),
        )
        .mockReturnValueOnce(new Response(null, { status: 304 }));
      const repository = createRestIssueRepository();

      const resultOnFirstRequest =
        await repository.getIssueOrPullRequestComments(issueUrl, {
          issueUpdatedAt: new Date('2026-07-06T00:00:00.000Z'),
        });
      const resultOnNotModified =
        await repository.getIssueOrPullRequestComments(issueUrl, {
          issueUpdatedAt: new Date('2026-07-06T01:00:00.000Z'),
        });
      const resultOnModified = await repository.getIssueOrPullRequestComments(
        issueUrl,
        { issueUpdatedAt: new Date('2026-07-06T02:00:00.000Z') },
      );
      const resultAfterModified =
        await repository.getIssueOrPullRequestComments(issueUrl, {
          issueUpdatedAt: new Date('2026-07-06T03:00:00.000Z'),
        });

      expect(mockGet).toHaveBeenCalledTimes(4);
      expect(mockGet).toHaveBeenNthCalledWith(
        1,
        firstPageUrl,
        expect.objectContaining({
          headers: { Authorization: 'token dummy-token' },
        }),
      );
      expect(mockGet).toHaveBeenNthCalledWith(
        2,
        firstPageUrl,
        expect.objectContaining({
          headers: {
            Authorization: 'token dummy-token',
            'If-None-Match': '"rest-etag-1"',
          },
          throwHttpErrors: false,
        }),
      );
      expect(mockGet).toHaveBeenNthCalledWith(
        3,
        firstPageUrl,
        expect.objectContaining({
          headers: {
            Authorization: 'token dummy-token',
            'If-None-Match': '"rest-etag-1"',
          },
          throwHttpErrors: false,
        }),
      );
      expect(mockGet).toHaveBeenNthCalledWith(
        4,
        firstPageUrl,
        expect.objectContaining({
          headers: {
            Authorization: 'token dummy-token',
            'If-None-Match': '"rest-etag-2"',
          },
          throwHttpErrors: false,
        }),
      );
      expect(resultOnFirstRequest).toEqual([firstIssueComment]);
      expect(resultOnNotModified).toEqual([firstIssueComment]);
      expect(resultOnModified).toEqual([firstIssueComment, secondIssueComment]);
      expect(resultAfterModified).toEqual([
        firstIssueComment,
        secondIssueComment,
      ]);
    });

    it('requests the comment list on every call made without issueUpdatedAt', async () => {
      mockGet.mockImplementation(() =>
        buildCommentsPageResponse([firstCommentResponseItem], '"rest-etag-1"'),
      );
      const repository = createRestIssueRepository();

      await repository.getIssueOrPullRequestComments(issueUrl);
      const secondResult =
        await repository.getIssueOrPullRequestComments(issueUrl);

      expect(mockGet).toHaveBeenCalledTimes(2);
      expect(secondResult).toEqual([firstIssueComment]);
    });

    it('maps a comment whose user and body are null to an empty author and an empty body', async () => {
      mockGet.mockReturnValueOnce(
        buildCommentsPageResponse(
          [
            {
              id: 91003,
              user: null,
              body: null,
              created_at: '2026-07-03T00:00:00Z',
            },
          ],
          '"rest-etag-null"',
        ),
      );
      const repository = createRestIssueRepository();

      const result = await repository.getIssueOrPullRequestComments(issueUrl);

      expect(result).toEqual([
        {
          id: 91003,
          author: '',
          body: '',
          createdAt: new Date('2026-07-03T00:00:00Z'),
        },
      ]);
    });

    it('rejects when the comments endpoint answers with a non-2xx status other than 304', async () => {
      mockGet.mockReturnValueOnce(
        new Response(JSON.stringify({ message: 'Not Found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      const repository = createRestIssueRepository();

      await expect(
        repository.getIssueOrPullRequestComments(issueUrl),
      ).rejects.toThrow();
    });

    const sameIssueUpdatedAt = new Date('2026-07-06T00:00:00.000Z');
    const editedFirstCommentResponseItem: CommentResponseItem = {
      ...firstCommentResponseItem,
      body: 'edited first comment',
    };
    const editedFirstIssueComment = {
      ...firstIssueComment,
      body: 'edited first comment',
    };
    const mockCommentPost = (): void => {
      mockPost.mockReturnValue(
        mockJsonResponse({
          id: 91002,
          user: { login: 'bob' },
          body: 'second comment',
          created_at: '2026-07-02T00:00:00Z',
          html_url: `${issueUrl}#issuecomment-91002`,
        }),
      );
    };

    const storedListRevalidationAfterWriteTestCases: {
      name: string;
      writeToComments: (repository: RestIssueRepository) => Promise<unknown>;
      expectedGetCallCount: number;
      expectedSecondResult: unknown[];
    }[] = [
      {
        name: 'sends the stored ETag as If-None-Match on the next read with the same issueUpdatedAt and returns the new list when createComment posted on the same issue',
        writeToComments: (repository) => {
          mockCommentPost();
          return repository.createComment(issueUrl, 'second comment');
        },
        expectedGetCallCount: 2,
        expectedSecondResult: [firstIssueComment, secondIssueComment],
      },
      {
        name: 'sends the stored ETag as If-None-Match on the next read with the same issueUpdatedAt and returns the new list when createComment posted on the same pull request number under the pull path',
        writeToComments: (repository) => {
          mockCommentPost();
          return repository.createComment(
            'https://github.com/HiromiShikata/test-repository/pull/40',
            'second comment',
          );
        },
        expectedGetCallCount: 2,
        expectedSecondResult: [firstIssueComment, secondIssueComment],
      },
      {
        name: 'keeps returning the stored list without a request when createComment posted on a different issue number',
        writeToComments: (repository) => {
          mockCommentPost();
          return repository.createComment(
            'https://github.com/HiromiShikata/test-repository/issues/41',
            'second comment',
          );
        },
        expectedGetCallCount: 1,
        expectedSecondResult: [firstIssueComment],
      },
      {
        name: 'keeps returning the stored list without a request when createComment posted on the same issue number of a different repository',
        writeToComments: (repository) => {
          mockCommentPost();
          return repository.createComment(
            'https://github.com/HiromiShikata/other-repository/issues/40',
            'second comment',
          );
        },
        expectedGetCallCount: 1,
        expectedSecondResult: [firstIssueComment],
      },
      {
        name: 'sends the stored ETag as If-None-Match on the next read with the same issueUpdatedAt and returns the edited list when updateIssueCommentBody edited a comment of the stored list',
        writeToComments: (repository) => {
          mockPatch.mockReturnValue(
            mockJsonResponse({
              id: 91001,
              issue_url:
                'https://api.github.com/repos/HiromiShikata/test-repository/issues/40',
            }),
          );
          return repository.updateIssueCommentBody(
            { org: 'HiromiShikata', repo: 'test-repository', commentId: 91001 },
            'edited first comment',
          );
        },
        expectedGetCallCount: 2,
        expectedSecondResult: [editedFirstIssueComment],
      },
      {
        name: 'keeps returning the stored list without a request when updateIssueCommentBody edited a comment that is in no stored list',
        writeToComments: (repository) => {
          mockPatch.mockReturnValue(
            mockJsonResponse({
              id: 99999,
              issue_url:
                'https://api.github.com/repos/HiromiShikata/test-repository/issues/41',
            }),
          );
          return repository.updateIssueCommentBody(
            { org: 'HiromiShikata', repo: 'test-repository', commentId: 99999 },
            'edited other comment',
          );
        },
        expectedGetCallCount: 1,
        expectedSecondResult: [firstIssueComment],
      },
    ];

    test.each(storedListRevalidationAfterWriteTestCases)(
      '$name',
      async (tc) => {
        mockGet
          .mockReturnValueOnce(
            buildCommentsPageResponse(
              [firstCommentResponseItem],
              '"rest-etag-1"',
            ),
          )
          .mockReturnValueOnce(
            buildCommentsPageResponse(
              tc.expectedSecondResult.length === 2
                ? [firstCommentResponseItem, secondCommentResponseItem]
                : [editedFirstCommentResponseItem],
              '"rest-etag-2"',
            ),
          );
        const repository = createRestIssueRepository();

        const firstResult = await repository.getIssueOrPullRequestComments(
          issueUrl,
          { issueUpdatedAt: sameIssueUpdatedAt },
        );
        await tc.writeToComments(repository);
        const secondResult = await repository.getIssueOrPullRequestComments(
          issueUrl,
          { issueUpdatedAt: sameIssueUpdatedAt },
        );

        expect(firstResult).toEqual([firstIssueComment]);
        expect(mockGet).toHaveBeenCalledTimes(tc.expectedGetCallCount);
        if (tc.expectedGetCallCount === 2) {
          expect(mockGet).toHaveBeenNthCalledWith(
            2,
            firstPageUrl,
            expect.objectContaining({
              headers: {
                Authorization: 'token dummy-token',
                'If-None-Match': '"rest-etag-1"',
              },
            }),
          );
        }
        expect(secondResult).toEqual(tc.expectedSecondResult);
      },
    );

    it('requests the comment list again on the next read with the same issueUpdatedAt when createComment posted on the issue while an earlier read was waiting for its response', async () => {
      let answerFirstCommentListRequest: (response: Response) => void = () =>
        undefined;
      const firstCommentListResponse = new Promise<Response>((resolve) => {
        answerFirstCommentListRequest = resolve;
      });
      mockGet
        .mockReturnValueOnce(firstCommentListResponse)
        .mockReturnValueOnce(
          buildCommentsPageResponse(
            [firstCommentResponseItem, secondCommentResponseItem],
            '"rest-etag-2"',
          ),
        );
      mockCommentPost();
      const repository = createRestIssueRepository();

      const earlierRead = repository.getIssueOrPullRequestComments(issueUrl, {
        issueUpdatedAt: sameIssueUpdatedAt,
      });
      await repository.createComment(issueUrl, 'second comment');
      answerFirstCommentListRequest(
        buildCommentsPageResponse([firstCommentResponseItem], '"rest-etag-1"'),
      );
      const earlierResult = await earlierRead;
      const laterResult = await repository.getIssueOrPullRequestComments(
        issueUrl,
        { issueUpdatedAt: sameIssueUpdatedAt },
      );

      expect(earlierResult).toEqual([firstIssueComment]);
      expect(mockGet).toHaveBeenCalledTimes(2);
      expect(laterResult).toEqual([firstIssueComment, secondIssueComment]);
    });

    it('keeps the stored list reusable when createComment fails before posting the comment', async () => {
      mockGet.mockReturnValueOnce(
        buildCommentsPageResponse([firstCommentResponseItem], '"rest-etag-1"'),
      );
      const postError = new Error('network down');
      mockPost.mockImplementation(() => ({
        json: jest.fn().mockRejectedValue(postError),
      }));
      const repository = createRestIssueRepository();

      await repository.getIssueOrPullRequestComments(issueUrl, {
        issueUpdatedAt: sameIssueUpdatedAt,
      });
      await expect(
        repository.createComment(issueUrl, 'second comment'),
      ).rejects.toBe(postError);
      const secondResult = await repository.getIssueOrPullRequestComments(
        issueUrl,
        { issueUpdatedAt: sameIssueUpdatedAt },
      );

      expect(mockGet).toHaveBeenCalledTimes(1);
      expect(secondResult).toEqual([firstIssueComment]);
    });
  });
});
