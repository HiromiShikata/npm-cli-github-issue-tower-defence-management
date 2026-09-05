import { GitHubIssueCommentRepository } from './GitHubIssueCommentRepository';
import { Issue } from '../../domain/entities/Issue';

const buildIssue = (url: string): Issue => ({
  url,
  nameWithOwner: 'HiromiShikata/test-repo',
  number: 123,
  title: 'Test Issue',
  state: 'OPEN',
  status: null,
  story: null,
  nextActionDate: null,
  nextActionHour: null,
  estimationMinutes: null,
  dependedIssueUrls: [],
  completionDate50PercentConfidence: null,
  assignees: [],
  labels: [],
  org: 'HiromiShikata',
  repo: 'test-repo',
  body: '',
  itemId: 'item-1',
  isPr: false,
  isInProgress: false,
  isClosed: false,
  createdAt: new Date('2024-01-01T00:00:00Z'),
  author: 'testuser',
  closingIssueReferenceUrls: [],
  agent: null,
  stateReason: null,
});

const TEST_URL = 'https://github.com/HiromiShikata/test-repo/issues/123';
const EXPECTED_REST_URL =
  'https://api.github.com/repos/HiromiShikata/test-repo/issues/123/comments?per_page=100&page=1';

const buildCommentCacheRepository = () => ({
  getSingle: jest.fn<Promise<unknown>, [string]>(),
  setSingle: jest.fn<Promise<void>, [string, unknown]>(),
});

describe('GitHubIssueCommentRepository', () => {
  let repository: GitHubIssueCommentRepository;

  beforeEach(() => {
    jest.restoreAllMocks();
    repository = new GitHubIssueCommentRepository('test-token');
  });

  describe('getCommentsFromIssue', () => {
    it('fetches single page with correct REST endpoint URL and headers, and maps comments correctly', async () => {
      const commentPayloads = [
        {
          user: { login: 'testuser' },
          body: 'Comment body',
          created_at: '2024-01-01T00:00:00Z',
        },
      ];
      const fetchSpy = jest
        .spyOn(global, 'fetch')
        .mockResolvedValue(
          new Response(JSON.stringify(commentPayloads), { status: 200 }),
        );

      const result = await repository.getCommentsFromIssue(
        buildIssue(TEST_URL),
      );

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy).toHaveBeenCalledWith(EXPECTED_REST_URL, {
        headers: {
          Authorization: 'Bearer test-token',
          Accept: 'application/vnd.github+json',
        },
      });
      expect(result).toEqual([
        {
          author: 'testuser',
          content: 'Comment body',
          createdAt: new Date('2024-01-01T00:00:00Z'),
        },
      ]);
    });

    it('fetches two pages when first response contains rel="next" Link header', async () => {
      const page1Payloads = [
        {
          user: { login: 'user1' },
          body: 'Page 1 comment',
          created_at: '2024-01-01T00:00:00Z',
        },
      ];
      const page2Payloads = [
        {
          user: { login: 'user2' },
          body: 'Page 2 comment',
          created_at: '2024-01-02T00:00:00Z',
        },
      ];

      const fetchSpy = jest
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce(
          new Response(JSON.stringify(page1Payloads), {
            status: 200,
            headers: {
              Link: '<https://api.github.com/repos/HiromiShikata/test-repo/issues/123/comments?per_page=100&page=2>; rel="next"',
            },
          }),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify(page2Payloads), { status: 200 }),
        );

      const result = await repository.getCommentsFromIssue(
        buildIssue(TEST_URL),
      );

      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(fetchSpy).toHaveBeenNthCalledWith(
        1,
        'https://api.github.com/repos/HiromiShikata/test-repo/issues/123/comments?per_page=100&page=1',
        expect.anything(),
      );
      expect(fetchSpy).toHaveBeenNthCalledWith(
        2,
        'https://api.github.com/repos/HiromiShikata/test-repo/issues/123/comments?per_page=100&page=2',
        expect.anything(),
      );
      expect(result).toEqual([
        {
          author: 'user1',
          content: 'Page 1 comment',
          createdAt: new Date('2024-01-01T00:00:00Z'),
        },
        {
          author: 'user2',
          content: 'Page 2 comment',
          createdAt: new Date('2024-01-02T00:00:00Z'),
        },
      ]);
    });

    it('maps author to empty string when user field is null (ghost user)', async () => {
      const commentPayloads = [
        {
          user: null,
          body: 'Ghost comment',
          created_at: '2024-01-01T00:00:00Z',
        },
      ];
      jest
        .spyOn(global, 'fetch')
        .mockResolvedValue(
          new Response(JSON.stringify(commentPayloads), { status: 200 }),
        );

      const result = await repository.getCommentsFromIssue(
        buildIssue(TEST_URL),
      );

      expect(result[0].author).toBe('');
    });

    it('throws an error including status and statusText when response is non-2xx', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue(
        new Response('Not Found', {
          status: 404,
          statusText: 'Not Found',
        }),
      );

      await expect(
        repository.getCommentsFromIssue(buildIssue(TEST_URL)),
      ).rejects.toThrow('404');
      await expect(
        repository.getCommentsFromIssue(buildIssue(TEST_URL)),
      ).rejects.toThrow('Not Found');
    });

    it('caches comments with ETag on first call, sends If-None-Match on second call and returns cached comments on 304', async () => {
      const commentPayloads = [
        {
          user: { login: 'testuser' },
          body: 'Cached comment',
          created_at: '2024-01-01T00:00:00Z',
        },
      ];
      const cache = buildCommentCacheRepository();
      cache.getSingle.mockResolvedValue(null);
      cache.setSingle.mockResolvedValue(undefined);
      const repositoryWithCache = new GitHubIssueCommentRepository(
        'test-token',
        cache,
      );

      jest.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify(commentPayloads), {
          status: 200,
          headers: { ETag: '"etag-abc"' },
        }),
      );

      const firstResult = await repositoryWithCache.getCommentsFromIssue(
        buildIssue(TEST_URL),
      );

      expect(cache.setSingle).toHaveBeenCalledWith(
        'comments/HiromiShikata/test-repo/123',
        {
          etag: '"etag-abc"',
          comments: [
            {
              author: 'testuser',
              content: 'Cached comment',
              createdAt: '2024-01-01T00:00:00.000Z',
            },
          ],
        },
      );
      expect(firstResult).toEqual([
        {
          author: 'testuser',
          content: 'Cached comment',
          createdAt: new Date('2024-01-01T00:00:00Z'),
        },
      ]);

      cache.getSingle.mockResolvedValue({
        etag: '"etag-abc"',
        comments: [
          {
            author: 'testuser',
            content: 'Cached comment',
            createdAt: '2024-01-01T00:00:00.000Z',
          },
        ],
      });
      const fetchSpy = jest
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce(new Response(null, { status: 304 }));

      const secondResult = await repositoryWithCache.getCommentsFromIssue(
        buildIssue(TEST_URL),
      );

      expect(fetchSpy).toHaveBeenCalledWith(EXPECTED_REST_URL, {
        headers: {
          Authorization: 'Bearer test-token',
          Accept: 'application/vnd.github+json',
          'If-None-Match': '"etag-abc"',
        },
      });
      expect(secondResult).toEqual([
        {
          author: 'testuser',
          content: 'Cached comment',
          createdAt: new Date('2024-01-01T00:00:00Z'),
        },
      ]);
    });

    it('updates cache when server returns 200 with a changed ETag', async () => {
      const newCommentPayloads = [
        {
          user: { login: 'user-new' },
          body: 'New comment',
          created_at: '2024-02-01T00:00:00Z',
        },
      ];
      const cache = buildCommentCacheRepository();
      cache.getSingle.mockResolvedValue({
        etag: '"etag-old"',
        comments: [
          {
            author: 'user-old',
            content: 'Old comment',
            createdAt: '2024-01-01T00:00:00.000Z',
          },
        ],
      });
      cache.setSingle.mockResolvedValue(undefined);
      const repositoryWithCache = new GitHubIssueCommentRepository(
        'test-token',
        cache,
      );

      jest.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify(newCommentPayloads), {
          status: 200,
          headers: { ETag: '"etag-new"' },
        }),
      );

      const result = await repositoryWithCache.getCommentsFromIssue(
        buildIssue(TEST_URL),
      );

      expect(result).toEqual([
        {
          author: 'user-new',
          content: 'New comment',
          createdAt: new Date('2024-02-01T00:00:00Z'),
        },
      ]);
      expect(cache.setSingle).toHaveBeenCalledWith(
        'comments/HiromiShikata/test-repo/123',
        expect.objectContaining({ etag: '"etag-new"' }),
      );
      expect(cache.setSingle).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ etag: '"etag-old"' }),
      );
    });

    it('leaves behaviour unchanged when commentCacheRepository is null', async () => {
      const commentPayloads = [
        {
          user: { login: 'testuser' },
          body: 'Comment body',
          created_at: '2024-01-01T00:00:00Z',
        },
      ];
      const fetchSpy = jest
        .spyOn(global, 'fetch')
        .mockResolvedValue(
          new Response(JSON.stringify(commentPayloads), { status: 200 }),
        );

      const result = await repository.getCommentsFromIssue(
        buildIssue(TEST_URL),
      );

      expect(fetchSpy).toHaveBeenCalledWith(EXPECTED_REST_URL, {
        headers: {
          Authorization: 'Bearer test-token',
          Accept: 'application/vnd.github+json',
        },
      });
      expect(result).toEqual([
        {
          author: 'testuser',
          content: 'Comment body',
          createdAt: new Date('2024-01-01T00:00:00Z'),
        },
      ]);
    });

    it('writes cache only after all pages are fetched for multi-page responses', async () => {
      const page1Payloads = [
        {
          user: { login: 'user1' },
          body: 'Page 1 comment',
          created_at: '2024-01-01T00:00:00Z',
        },
      ];
      const page2Payloads = [
        {
          user: { login: 'user2' },
          body: 'Page 2 comment',
          created_at: '2024-01-02T00:00:00Z',
        },
      ];
      const cache = buildCommentCacheRepository();
      cache.getSingle.mockResolvedValue(null);
      cache.setSingle.mockResolvedValue(undefined);
      const repositoryWithCache = new GitHubIssueCommentRepository(
        'test-token',
        cache,
      );

      jest
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce(
          new Response(JSON.stringify(page1Payloads), {
            status: 200,
            headers: {
              ETag: '"etag-page1"',
              Link: '<https://api.github.com/repos/HiromiShikata/test-repo/issues/123/comments?per_page=100&page=2>; rel="next"',
            },
          }),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify(page2Payloads), { status: 200 }),
        );

      const result = await repositoryWithCache.getCommentsFromIssue(
        buildIssue(TEST_URL),
      );

      expect(result).toEqual([
        {
          author: 'user1',
          content: 'Page 1 comment',
          createdAt: new Date('2024-01-01T00:00:00Z'),
        },
        {
          author: 'user2',
          content: 'Page 2 comment',
          createdAt: new Date('2024-01-02T00:00:00Z'),
        },
      ]);
      expect(cache.setSingle).toHaveBeenCalledTimes(1);
      expect(cache.setSingle).toHaveBeenCalledWith(
        'comments/HiromiShikata/test-repo/123',
        {
          etag: '"etag-page1"',
          comments: [
            {
              author: 'user1',
              content: 'Page 1 comment',
              createdAt: '2024-01-01T00:00:00.000Z',
            },
            {
              author: 'user2',
              content: 'Page 2 comment',
              createdAt: '2024-01-02T00:00:00.000Z',
            },
          ],
        },
      );
    });
  });

  describe('createComment', () => {
    it('fetches existing comments then posts to the correct REST endpoint with correct headers and body for an issue', async () => {
      const fetchSpy = jest
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce(
          new Response(JSON.stringify([]), { status: 200 }),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ id: 1 }), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
          }),
        );

      const issue = buildIssue(
        'https://github.com/HiromiShikata/test-repository/issues/42',
      );
      await repository.createComment(issue, 'hello world');

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.github.com/repos/HiromiShikata/test-repository/issues/42/comments',
        {
          method: 'POST',
          headers: {
            Authorization: 'Bearer test-token',
            Accept: 'application/vnd.github+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ body: 'hello world' }),
        },
      );
    });

    it('posts to the correct REST endpoint for a pull request', async () => {
      const fetchSpy = jest
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce(
          new Response(JSON.stringify([]), { status: 200 }),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ id: 2 }), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
          }),
        );

      const issue = buildIssue(
        'https://github.com/HiromiShikata/test-repository/pull/10',
      );
      await repository.createComment(issue, 'pr comment');

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.github.com/repos/HiromiShikata/test-repository/issues/10/comments',
        expect.objectContaining({
          method: 'POST',
        }),
      );
    });

    it('throws an error when the POST response is not 2xx', async () => {
      jest
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce(
          new Response(JSON.stringify([]), { status: 200 }),
        )
        .mockResolvedValueOnce(
          new Response('Not Found', {
            status: 404,
            statusText: 'Not Found',
          }),
        );

      const issue = buildIssue(
        'https://github.com/HiromiShikata/test-repository/issues/42',
      );

      await expect(
        repository.createComment(issue, 'hello world'),
      ).rejects.toThrow('404');
    });

    it('issues a GET for duplicate check followed by a POST, exactly two HTTP requests per call', async () => {
      const fetchSpy = jest
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce(
          new Response(JSON.stringify([]), { status: 200 }),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ id: 3 }), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
          }),
        );

      const issue = buildIssue(
        'https://github.com/HiromiShikata/test-repository/issues/5',
      );
      await repository.createComment(issue, 'single request');

      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('does not call the GraphQL endpoint', async () => {
      const fetchSpy = jest
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce(
          new Response(JSON.stringify([]), { status: 200 }),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ id: 4 }), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
          }),
        );

      const issue = buildIssue(
        'https://github.com/HiromiShikata/test-repository/issues/7',
      );
      await repository.createComment(issue, 'no graphql');

      expect(fetchSpy).not.toHaveBeenCalledWith(
        'https://api.github.com/graphql',
        expect.anything(),
      );
    });

    it('skips posting when an identical comment was posted within the last 2 hours', async () => {
      const recentComment = {
        user: { login: 'bot' },
        body: 'Auto Status Check: REJECTED',
        created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      };
      const fetchSpy = jest
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce(
          new Response(JSON.stringify([recentComment]), { status: 200 }),
        );

      const issue = buildIssue(
        'https://github.com/HiromiShikata/test-repository/issues/99',
      );
      await repository.createComment(issue, 'Auto Status Check: REJECTED');

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('/comments'),
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('still posts when an identical comment was posted more than 2 hours ago', async () => {
      const oldComment = {
        user: { login: 'bot' },
        body: 'Auto Status Check: REJECTED',
        created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      };
      const fetchSpy = jest
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce(
          new Response(JSON.stringify([oldComment]), { status: 200 }),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ id: 10 }), { status: 201 }),
        );

      const issue = buildIssue(
        'https://github.com/HiromiShikata/test-repository/issues/99',
      );
      await repository.createComment(issue, 'Auto Status Check: REJECTED');

      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/comments'),
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('still posts when the recent comment body differs', async () => {
      const recentComment = {
        user: { login: 'bot' },
        body: 'Auto Status Check: AWAITING_OWNER_APPROVAL',
        created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      };
      const fetchSpy = jest
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce(
          new Response(JSON.stringify([recentComment]), { status: 200 }),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ id: 11 }), { status: 201 }),
        );

      const issue = buildIssue(
        'https://github.com/HiromiShikata/test-repository/issues/99',
      );
      await repository.createComment(issue, 'Auto Status Check: REJECTED');

      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/comments'),
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('treats bodies with different timestamps as duplicates after normalisation', async () => {
      const recentComment = {
        user: { login: 'bot' },
        body: 'CLI error recurrence at 2026-09-05T10:00:00Z: some error',
        created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      };
      const fetchSpy = jest
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce(
          new Response(JSON.stringify([recentComment]), { status: 200 }),
        );

      const issue = buildIssue(
        'https://github.com/HiromiShikata/test-repository/issues/99',
      );
      await repository.createComment(
        issue,
        'CLI error recurrence at 2026-09-05T11:30:00Z: some error',
      );

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('/comments'),
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });
});
