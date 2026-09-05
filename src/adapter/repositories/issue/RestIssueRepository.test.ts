const mockPost = jest.fn();
const mockGet = jest.fn();
const mockPut = jest.fn();
const mockPatch = jest.fn();
const mockDelete = jest.fn();

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
});
