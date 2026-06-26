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
    it('should create a comment', async () => {
      mockPost.mockResolvedValue(undefined);

      await restIssueRepository.createComment(
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
});
