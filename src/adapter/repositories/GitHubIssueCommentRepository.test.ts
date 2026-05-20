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
});

const TEST_URL = 'https://github.com/HiromiShikata/test-repo/issues/123';
const EXPECTED_REST_URL =
  'https://api.github.com/repos/HiromiShikata/test-repo/issues/123/comments?per_page=100&page=1';

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
      expect(fetchSpy).toHaveBeenCalledWith(
        EXPECTED_REST_URL,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
            Accept: 'application/vnd.github+json',
          }),
        }),
      );
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
  });
});
