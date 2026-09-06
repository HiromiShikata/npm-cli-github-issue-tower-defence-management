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
    headers: Headers;
    clone: () => { text: () => Promise<string> };
  };
  constructor(response: {
    status: number;
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
    let fetchSpy: jest.SpyInstance<
      ReturnType<typeof global.fetch>,
      Parameters<typeof global.fetch>
    >;
    beforeEach(() => {
      fetchSpy = jest
        .spyOn(global, 'fetch')
        .mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));
    });

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

    it('rethrows non-rate-limit HTTPError from ky unchanged', async () => {
      const mockHeaders = new Headers({ 'x-ratelimit-remaining': '100' });
      mockPost.mockImplementation(() => ({
        json: jest.fn().mockRejectedValue(
          new MockHTTPError({
            status: 403,
            headers: mockHeaders,
            clone: () => ({ text: async () => 'Forbidden' }),
          }),
        ),
      }));

      await expect(
        restIssueRepository.createComment(
          'https://github.com/HiromiShikata/test-repository/issues/40',
          'test comment',
        ),
      ).rejects.toBeInstanceOf(MockHTTPError);
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

    it('skips posting when a comment with the same body was posted within 2 hours', async () => {
      const dedupIssueUrl =
        'https://github.com/HiromiShikata/test-repository/issues/501';
      const recentTs = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            { body: 'Auto Status Check: REJECTED', created_at: recentTs },
          ]),
          { status: 200, headers: { ETag: '"etag-1"' } },
        ),
      );

      const result = await restIssueRepository.createComment(
        dedupIssueUrl,
        'Auto Status Check: REJECTED',
      );

      expect(mockPost).not.toHaveBeenCalled();
      expect(result.url).toBeNull();
    });

    it('still posts when the identical comment was posted more than 2 hours ago', async () => {
      const dedupIssueUrl =
        'https://github.com/HiromiShikata/test-repository/issues/502';
      const oldTs = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            { body: 'Auto Status Check: REJECTED', created_at: oldTs },
          ]),
          { status: 200, headers: { ETag: '"etag-2"' } },
        ),
      );
      mockPost.mockReturnValue(
        mockJsonResponse({
          user: { login: 'bot' },
          body: 'Auto Status Check: REJECTED',
          created_at: new Date().toISOString(),
          html_url: `${dedupIssueUrl}#issuecomment-1`,
        }),
      );

      await restIssueRepository.createComment(
        dedupIssueUrl,
        'Auto Status Check: REJECTED',
      );

      expect(mockPost).toHaveBeenCalledTimes(1);
    });

    it('still posts when recent comment body differs', async () => {
      const dedupIssueUrl =
        'https://github.com/HiromiShikata/test-repository/issues/503';
      const recentTs = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              body: 'Auto Status Check: AWAITING_OWNER_APPROVAL',
              created_at: recentTs,
            },
          ]),
          { status: 200, headers: { ETag: '"etag-3"' } },
        ),
      );
      mockPost.mockReturnValue(
        mockJsonResponse({
          user: { login: 'bot' },
          body: 'Auto Status Check: REJECTED',
          created_at: new Date().toISOString(),
          html_url: `${dedupIssueUrl}#issuecomment-2`,
        }),
      );

      await restIssueRepository.createComment(
        dedupIssueUrl,
        'Auto Status Check: REJECTED',
      );

      expect(mockPost).toHaveBeenCalledTimes(1);
    });

    it('treats bodies differing only in timestamps as duplicates after normalisation', async () => {
      const dedupIssueUrl =
        'https://github.com/HiromiShikata/test-repository/issues/504';
      const recentTs = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              body: 'CLI error recurrence at 2026-09-05T10:00:00Z: some error',
              created_at: recentTs,
            },
          ]),
          { status: 200, headers: { ETag: '"etag-4"' } },
        ),
      );

      const result = await restIssueRepository.createComment(
        dedupIssueUrl,
        'CLI error recurrence at 2026-09-05T11:30:00Z: some error',
      );

      expect(mockPost).not.toHaveBeenCalled();
      expect(result.url).toBeNull();
    });

    it('detects a duplicate that lies beyond the first page of comments by following Link rel="next" pagination', async () => {
      const dedupIssueUrl =
        'https://github.com/HiromiShikata/test-repository/issues/505';
      const recentTs = new Date(Date.now() - 30 * 60 * 1000).toISOString();

      fetchSpy
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify([
              { body: 'Some other comment', created_at: recentTs },
            ]),
            {
              status: 200,
              headers: {
                Link: '<https://api.github.com/repos/HiromiShikata/test-repository/issues/505/comments?page=2>; rel="next"',
              },
            },
          ),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify([
              {
                body: 'Auto Status Check: REJECTED',
                created_at: recentTs,
              },
            ]),
            { status: 200 },
          ),
        );

      const result = await restIssueRepository.createComment(
        dedupIssueUrl,
        'Auto Status Check: REJECTED',
      );

      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(mockPost).not.toHaveBeenCalled();
      expect(result.url).toBeNull();
    });

    it('skips comment but does not prevent other operations from running', async () => {
      const dedupIssueUrl =
        'https://github.com/HiromiShikata/test-repository/issues/506';
      const recentTs = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            { body: 'Auto Status Check: REJECTED', created_at: recentTs },
          ]),
          { status: 200, headers: { ETag: '"etag-6"' } },
        ),
      );

      const result = await restIssueRepository.createComment(
        dedupIssueUrl,
        'Auto Status Check: REJECTED',
      );

      expect(mockPost).not.toHaveBeenCalled();
      expect(result).toEqual(
        expect.objectContaining({
          body: 'Auto Status Check: REJECTED',
          url: null,
        }),
      );
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

    it('throws GitHubRateLimitError and does not call ky.post when dedup preflight returns 403 with rate-limit signals', async () => {
      const { GitHubRateLimitError } = await import('./githubRateLimitRetry');
      const resetEpoch = 1725547200;
      fetchSpy.mockResolvedValueOnce(
        new Response('API rate limit exceeded for user ID 42', {
          status: 403,
          headers: {
            'x-ratelimit-remaining': '0',
            'x-ratelimit-reset': String(resetEpoch),
          },
        }),
      );

      await expect(
        restIssueRepository.createComment(
          'https://github.com/HiromiShikata/test-repository/issues/901',
          'completion comment',
        ),
      ).rejects.toBeInstanceOf(GitHubRateLimitError);

      expect(mockPost).not.toHaveBeenCalled();
    });

    it('includes rate-limit reset time in thrown error when dedup preflight returns 403', async () => {
      const { GitHubRateLimitError } = await import('./githubRateLimitRetry');
      const resetEpoch = 1725547200;
      fetchSpy.mockResolvedValueOnce(
        new Response('API rate limit exceeded', {
          status: 403,
          headers: {
            'x-ratelimit-remaining': '0',
            'x-ratelimit-reset': String(resetEpoch),
          },
        }),
      );

      let thrownError: unknown;
      try {
        await restIssueRepository.createComment(
          'https://github.com/HiromiShikata/test-repository/issues/902',
          'completion comment',
        );
      } catch (e) {
        thrownError = e;
      }

      expect(thrownError).toBeInstanceOf(GitHubRateLimitError);
      expect(thrownError).toMatchObject({
        rateLimitResetAt: new Date(resetEpoch * 1000).toISOString(),
      });
    });

    it('throws GitHubRateLimitError and does not call ky.post when dedup preflight returns 429 with retry-after', async () => {
      const { GitHubRateLimitError } = await import('./githubRateLimitRetry');
      fetchSpy.mockResolvedValueOnce(
        new Response('secondary rate limit', {
          status: 429,
          headers: { 'retry-after': '60' },
        }),
      );

      await expect(
        restIssueRepository.createComment(
          'https://github.com/HiromiShikata/test-repository/issues/903',
          'completion comment',
        ),
      ).rejects.toBeInstanceOf(GitHubRateLimitError);

      expect(mockPost).not.toHaveBeenCalled();
    });

    it('calls ky.post when dedup preflight returns a non-rate-limit HTTP error (fail open)', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response('Not Found', { status: 404 }),
      );
      mockPost.mockReturnValue(
        mockJsonResponse({
          user: { login: 'bot' },
          body: 'completion comment',
          created_at: new Date().toISOString(),
          html_url:
            'https://github.com/HiromiShikata/test-repository/issues/904#issuecomment-1',
        }),
      );

      await restIssueRepository.createComment(
        'https://github.com/HiromiShikata/test-repository/issues/904',
        'completion comment',
      );

      expect(mockPost).toHaveBeenCalledTimes(1);
    });

    it('calls ky.post when dedup preflight returns a response with an unexpected shape (fail open)', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ unexpected: true }), { status: 200 }),
      );
      mockPost.mockReturnValue(
        mockJsonResponse({
          user: { login: 'bot' },
          body: 'completion comment',
          created_at: new Date().toISOString(),
          html_url:
            'https://github.com/HiromiShikata/test-repository/issues/905#issuecomment-2',
        }),
      );

      await restIssueRepository.createComment(
        'https://github.com/HiromiShikata/test-repository/issues/905',
        'completion comment',
      );

      expect(mockPost).toHaveBeenCalledTimes(1);
    });

    it('skips ky.post when successful dedup preflight finds an identical recent comment', async () => {
      const recentTs = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            { body: 'completion comment', created_at: recentTs },
          ]),
          { status: 200 },
        ),
      );

      const result = await restIssueRepository.createComment(
        'https://github.com/HiromiShikata/test-repository/issues/906',
        'completion comment',
      );

      expect(mockPost).not.toHaveBeenCalled();
      expect(result.url).toBeNull();
    });

    it('calls ky.post when successful dedup preflight finds no matching recent comment', async () => {
      const recentTs = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            { body: 'a different comment', created_at: recentTs },
          ]),
          { status: 200 },
        ),
      );
      mockPost.mockReturnValue(
        mockJsonResponse({
          user: { login: 'bot' },
          body: 'completion comment',
          created_at: new Date().toISOString(),
          html_url:
            'https://github.com/HiromiShikata/test-repository/issues/907#issuecomment-3',
        }),
      );

      await restIssueRepository.createComment(
        'https://github.com/HiromiShikata/test-repository/issues/907',
        'completion comment',
      );

      expect(mockPost).toHaveBeenCalledTimes(1);
    });
  });
  describe('createNewIssue', () => {
    it('should create a new issue', async () => {
      mockPost.mockReturnValue(mockJsonResponse({ number: 123 }));

      const issueNumber = await restIssueRepository.createNewIssue(
        'HiromiShikata',
        'test-repository',
        'test issue',
        'test body',
        ['HiromiShikata'],
        ['test'],
      );

      expect(issueNumber).toBe(123);
      expect(mockPost).toHaveBeenCalledTimes(1);
      expect(mockPost).toHaveBeenCalledWith(
        'https://api.github.com/repos/HiromiShikata/test-repository/issues',
        {
          json: {
            title: 'test issue',
            body: 'test body',
            assignees: ['HiromiShikata'],
            labels: ['test'],
          },
          headers: { Authorization: 'token dummy-token' },
        },
      );
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
  });
});
