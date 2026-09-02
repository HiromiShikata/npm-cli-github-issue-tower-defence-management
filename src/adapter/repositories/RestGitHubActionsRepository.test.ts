const mockGet = jest.fn();

jest.mock('ky', () => ({
  default: {
    get: mockGet,
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
    extend: jest.fn(),
    create: jest.fn(),
    stop: jest.fn(),
  },
  __esModule: true,
}));

import { RestGitHubActionsRepository } from './RestGitHubActionsRepository';

const mockJsonResponse = <T>(data: T) => ({
  json: jest.fn().mockResolvedValue(data),
});

const since = new Date('2026-01-01T00:00:00Z');
const until = new Date('2026-01-08T00:00:00Z');

describe('RestGitHubActionsRepository', () => {
  const repository = new RestGitHubActionsRepository('default-token', {
    'other-owner': 'override-token',
  });

  afterEach(() => {
    mockGet.mockReset();
  });

  describe('getWorkflowRuns', () => {
    it('returns only runs whose created_at falls within the since–until window', async () => {
      mockGet.mockReturnValueOnce(
        mockJsonResponse({
          workflow_runs: [
            {
              conclusion: 'success',
              created_at: '2026-01-03T12:00:00Z',
              updated_at: '2026-01-03T13:00:00Z',
            },
            {
              conclusion: 'failure',
              created_at: '2025-12-31T23:59:59Z',
              updated_at: '2026-01-01T00:30:00Z',
            },
            {
              conclusion: 'success',
              created_at: '2026-01-09T00:00:01Z',
              updated_at: '2026-01-09T01:00:00Z',
            },
          ],
        }),
      );

      const result = await repository.getWorkflowRuns(
        'owner',
        'repo',
        'deploy.yml',
        'main',
        since,
        until,
      );

      expect(result).toHaveLength(1);
      expect(result[0]?.conclusion).toBe('success');
      expect(result[0]?.createdAt).toEqual(new Date('2026-01-03T12:00:00Z'));
    });

    it('maps non-success non-failure conclusions to null', async () => {
      mockGet.mockReturnValueOnce(
        mockJsonResponse({
          workflow_runs: [
            {
              conclusion: 'skipped',
              created_at: '2026-01-04T00:00:00Z',
              updated_at: '2026-01-04T01:00:00Z',
            },
            {
              conclusion: null,
              created_at: '2026-01-04T00:00:00Z',
              updated_at: '2026-01-04T01:00:00Z',
            },
          ],
        }),
      );

      const result = await repository.getWorkflowRuns(
        'owner',
        'repo',
        'deploy.yml',
        null,
        since,
        until,
      );

      expect(result).toHaveLength(2);
      expect(result[0]?.conclusion).toBeNull();
      expect(result[1]?.conclusion).toBeNull();
    });

    it('passes branch to search params when provided', async () => {
      mockGet.mockReturnValueOnce(mockJsonResponse({ workflow_runs: [] }));

      await repository.getWorkflowRuns(
        'owner',
        'repo',
        'deploy.yml',
        'production',
        since,
        until,
      );

      expect(mockGet).toHaveBeenCalledWith(
        'https://api.github.com/repos/owner/repo/actions/workflows/deploy.yml/runs',
        expect.objectContaining({
          searchParams: { per_page: '100', page: '1', branch: 'production' },
        }),
      );
    });

    it('omits branch from search params when null', async () => {
      mockGet.mockReturnValueOnce(mockJsonResponse({ workflow_runs: [] }));

      await repository.getWorkflowRuns(
        'owner',
        'repo',
        'deploy.yml',
        null,
        since,
        until,
      );

      expect(mockGet).toHaveBeenCalledWith(
        'https://api.github.com/repos/owner/repo/actions/workflows/deploy.yml/runs',
        expect.objectContaining({
          searchParams: { per_page: '100', page: '1' },
        }),
      );
    });

    it('uses owner-specific token override', async () => {
      mockGet.mockReturnValueOnce(mockJsonResponse({ workflow_runs: [] }));

      await repository.getWorkflowRuns(
        'other-owner',
        'repo',
        'deploy.yml',
        null,
        since,
        until,
      );

      expect(mockGet).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: { Authorization: 'token override-token' },
        }),
      );
    });
  });

  describe('getMergedPullRequests', () => {
    it('returns only PRs merged within the since–until window', async () => {
      mockGet.mockReturnValueOnce(
        mockJsonResponse([
          {
            merged_at: '2026-01-05T00:00:00Z',
            created_at: '2026-01-04T00:00:00Z',
          },
          {
            merged_at: '2025-12-30T00:00:00Z',
            created_at: '2025-12-28T00:00:00Z',
          },
          {
            merged_at: '2026-01-10T00:00:00Z',
            created_at: '2026-01-09T00:00:00Z',
          },
          { merged_at: null, created_at: '2026-01-03T00:00:00Z' },
        ]),
      );

      const result = await repository.getMergedPullRequests(
        'owner',
        'repo',
        'main',
        since,
        until,
      );

      expect(result).toHaveLength(1);
      expect(result[0]?.mergedAt).toEqual(new Date('2026-01-05T00:00:00Z'));
      expect(result[0]?.createdAt).toEqual(new Date('2026-01-04T00:00:00Z'));
    });

    it('excludes PRs with null merged_at', async () => {
      mockGet.mockReturnValueOnce(
        mockJsonResponse([
          { merged_at: null, created_at: '2026-01-03T00:00:00Z' },
        ]),
      );

      const result = await repository.getMergedPullRequests(
        'owner',
        'repo',
        null,
        since,
        until,
      );

      expect(result).toHaveLength(0);
    });

    it('passes base branch to search params when provided', async () => {
      mockGet.mockReturnValueOnce(mockJsonResponse([]));

      await repository.getMergedPullRequests(
        'owner',
        'repo',
        'production',
        since,
        until,
      );

      expect(mockGet).toHaveBeenCalledWith(
        'https://api.github.com/repos/owner/repo/pulls',
        {
          searchParams: {
            state: 'closed',
            per_page: '100',
            page: '1',
            base: 'production',
          },
          headers: { Authorization: 'token default-token' },
        },
      );
    });
  });

  describe('pagination', () => {
    it('fetches multiple pages when first page returns exactly 100 items', async () => {
      const page1Runs = Array.from({ length: 100 }, () => ({
        conclusion: 'success',
        created_at: '2026-01-03T12:00:00Z',
        updated_at: '2026-01-03T13:00:00Z',
      }));
      const page2Runs = [
        {
          conclusion: 'failure',
          created_at: '2026-01-04T00:00:00Z',
          updated_at: '2026-01-04T01:00:00Z',
        },
      ];

      mockGet
        .mockReturnValueOnce(mockJsonResponse({ workflow_runs: page1Runs }))
        .mockReturnValueOnce(mockJsonResponse({ workflow_runs: page2Runs }));

      const result = await repository.getWorkflowRuns(
        'owner',
        'repo',
        'deploy.yml',
        null,
        since,
        until,
      );

      expect(mockGet).toHaveBeenCalledTimes(2);
      expect(result.filter((r) => r.conclusion === 'failure')).toHaveLength(1);
      expect(result[0]?.updatedAt).toEqual(new Date('2026-01-03T13:00:00Z'));
    });
  });

  describe('getClosedItemsByLabels', () => {
    it('returns only items closed within the since–until window', async () => {
      mockGet.mockReturnValueOnce(
        mockJsonResponse([
          {
            created_at: '2026-01-02T00:00:00Z',
            closed_at: '2026-01-04T00:00:00Z',
          },
          {
            created_at: '2025-12-25T00:00:00Z',
            closed_at: '2025-12-31T00:00:00Z',
          },
          {
            created_at: '2026-01-08T00:00:00Z',
            closed_at: '2026-01-10T00:00:00Z',
          },
          { created_at: '2026-01-06T00:00:00Z', closed_at: null },
        ]),
      );

      const result = await repository.getClosedItemsByLabels(
        'owner',
        'repo',
        ['hotfix', 'incident'],
        since,
        until,
      );

      expect(result).toHaveLength(1);
      expect(result[0]?.closedAt).toEqual(new Date('2026-01-04T00:00:00Z'));
    });

    it('returns empty array when labels list is empty without calling the API', async () => {
      const result = await repository.getClosedItemsByLabels(
        'owner',
        'repo',
        [],
        since,
        until,
      );

      expect(result).toHaveLength(0);
      expect(mockGet).not.toHaveBeenCalled();
    });

    it('excludes items with null closed_at', async () => {
      mockGet.mockReturnValueOnce(
        mockJsonResponse([
          { created_at: '2026-01-02T00:00:00Z', closed_at: null },
        ]),
      );

      const result = await repository.getClosedItemsByLabels(
        'owner',
        'repo',
        ['hotfix'],
        since,
        until,
      );

      expect(result).toHaveLength(0);
    });
  });
});
