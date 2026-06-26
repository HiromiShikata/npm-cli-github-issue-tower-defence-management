const mockPost = jest.fn();

jest.mock('ky', () => ({
  default: {
    post: mockPost,
    get: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
    extend: jest.fn(),
    create: jest.fn(),
    stop: jest.fn(),
  },
  __esModule: true,
}));

import {
  GraphqlProjectRepository,
  resolveProjectCacheTtlMs,
} from './GraphqlProjectRepository';
import { LocalStorageCacheRepository } from './LocalStorageCacheRepository';
import { LocalStorageRepository } from './LocalStorageRepository';
import { Project } from '../../domain/entities/Project';

const mockJsonResponse = <T>(data: T) => ({
  json: jest.fn().mockResolvedValue(data),
});

const projectId = 'PVT_project123';

const getProjectResponse = {
  data: {
    node: {
      id: projectId,
      databaseId: 1,
      title: 'A project',
      shortDescription: '',
      public: true,
      closed: false,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
      number: 49,
      url: 'https://github.com/users/owner/projects/49',
      fields: {
        nodes: [
          {
            id: 'PVTSSF_status',
            databaseId: 10,
            name: 'Status',
            dataType: 'SINGLE_SELECT',
            options: [
              { id: 'st1', name: 'Todo', description: '', color: 'GRAY' },
            ],
          },
        ],
      },
    },
  },
};

const expectedProject: Project = {
  id: projectId,
  url: 'https://github.com/users/owner/projects/49',
  databaseId: 1,
  name: 'A project',
  status: {
    name: 'Status',
    fieldId: 'PVTSSF_status',
    statuses: [{ id: 'st1', name: 'Todo', color: 'GRAY', description: '' }],
  },
  nextActionDate: null,
  nextActionHour: null,
  story: null,
  remainingEstimationMinutes: null,
  dependedIssueUrlSeparatedByComma: null,
  completionDate50PercentConfidence: null,
};

const fetchProjectIdResponse = {
  data: {
    organization: null,
    user: { projectV2: { id: projectId, databaseId: 1 } },
  },
};

type CacheEntry = { value: object; timestamp: Date } | null;

const buildCacheStub = (overrides?: {
  getLatest?: jest.Mock;
  set?: jest.Mock;
}): Pick<LocalStorageCacheRepository, 'getLatest' | 'set'> & {
  getLatest: jest.Mock;
  set: jest.Mock;
} => ({
  getLatest: overrides?.getLatest ?? jest.fn().mockResolvedValue(null),
  set: overrides?.set ?? jest.fn().mockResolvedValue(undefined),
});

describe('GraphqlProjectRepository disk cache', () => {
  const localStorageRepository = new LocalStorageRepository();
  const thirtyMinutesMs = 30 * 60 * 1000;

  beforeEach(() => {
    jest.useFakeTimers();
    mockPost.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('resolveProjectCacheTtlMs', () => {
    it('defaults to 30 minutes when unset', () => {
      expect(resolveProjectCacheTtlMs(undefined)).toBe(thirtyMinutesMs);
    });

    it('uses the configured millisecond value when valid', () => {
      expect(resolveProjectCacheTtlMs('60000')).toBe(60000);
    });

    it('falls back to the default for non-numeric or negative values', () => {
      expect(resolveProjectCacheTtlMs('abc')).toBe(thirtyMinutesMs);
      expect(resolveProjectCacheTtlMs('-1')).toBe(thirtyMinutesMs);
    });
  });

  describe('getProject', () => {
    it('fetches via GraphQL and writes the cache on a cache miss', async () => {
      const cache = buildCacheStub();
      mockPost.mockReturnValueOnce(mockJsonResponse(getProjectResponse));
      const repository = new GraphqlProjectRepository(
        localStorageRepository,
        'dummy',
        cache,
      );

      const project = await repository.getProject(projectId);

      expect(project).toEqual(expectedProject);
      expect(mockPost).toHaveBeenCalledTimes(1);
      expect(cache.set).toHaveBeenCalledWith(
        `project-${projectId}`,
        expectedProject,
      );
    });

    it('returns the cached project without any GraphQL call when the cache is fresh', async () => {
      const cache = buildCacheStub({
        getLatest: jest.fn().mockResolvedValue({
          value: expectedProject,
          timestamp: new Date(),
        } satisfies CacheEntry),
      });
      const repository = new GraphqlProjectRepository(
        localStorageRepository,
        'dummy',
        cache,
      );

      const project = await repository.getProject(projectId);

      expect(project).toEqual(expectedProject);
      expect(mockPost).not.toHaveBeenCalled();
      expect(cache.set).not.toHaveBeenCalled();
    });

    it('refetches via GraphQL when the cached entry is older than the TTL', async () => {
      const staleTimestamp = new Date(Date.now() - thirtyMinutesMs - 1);
      const cache = buildCacheStub({
        getLatest: jest.fn().mockResolvedValue({
          value: expectedProject,
          timestamp: staleTimestamp,
        } satisfies CacheEntry),
      });
      mockPost.mockReturnValueOnce(mockJsonResponse(getProjectResponse));
      const repository = new GraphqlProjectRepository(
        localStorageRepository,
        'dummy',
        cache,
      );

      const project = await repository.getProject(projectId);

      expect(project).toEqual(expectedProject);
      expect(mockPost).toHaveBeenCalledTimes(1);
      expect(cache.set).toHaveBeenCalledTimes(1);
    });

    it('falls back to a live GraphQL fetch when the cache read throws', async () => {
      const cache = buildCacheStub({
        getLatest: jest.fn().mockRejectedValue(new Error('corrupted file')),
      });
      mockPost.mockReturnValueOnce(mockJsonResponse(getProjectResponse));
      const repository = new GraphqlProjectRepository(
        localStorageRepository,
        'dummy',
        cache,
      );

      const project = await repository.getProject(projectId);

      expect(project).toEqual(expectedProject);
      expect(mockPost).toHaveBeenCalledTimes(1);
    });

    it('falls back to a live GraphQL fetch when the cached value is malformed', async () => {
      const cache = buildCacheStub({
        getLatest: jest.fn().mockResolvedValue({
          value: { unexpected: 'shape' },
          timestamp: new Date(),
        } satisfies CacheEntry),
      });
      mockPost.mockReturnValueOnce(mockJsonResponse(getProjectResponse));
      const repository = new GraphqlProjectRepository(
        localStorageRepository,
        'dummy',
        cache,
      );

      const project = await repository.getProject(projectId);

      expect(project).toEqual(expectedProject);
      expect(mockPost).toHaveBeenCalledTimes(1);
    });

    it('respects a custom TTL passed to the constructor', async () => {
      const cache = buildCacheStub({
        getLatest: jest.fn().mockResolvedValue({
          value: expectedProject,
          timestamp: new Date(Date.now() - 2000),
        } satisfies CacheEntry),
      });
      mockPost.mockReturnValueOnce(mockJsonResponse(getProjectResponse));
      const repository = new GraphqlProjectRepository(
        localStorageRepository,
        'dummy',
        cache,
        1000,
      );

      const project = await repository.getProject(projectId);

      expect(project).toEqual(expectedProject);
      expect(mockPost).toHaveBeenCalledTimes(1);
    });
  });

  describe('fetchProjectId', () => {
    it('fetches via GraphQL and writes the cache on a cache miss', async () => {
      const cache = buildCacheStub();
      mockPost.mockReturnValueOnce(mockJsonResponse(fetchProjectIdResponse));
      const repository = new GraphqlProjectRepository(
        localStorageRepository,
        'dummy',
        cache,
      );

      const result = await repository.fetchProjectId('owner', 49);

      expect(result).toBe(projectId);
      expect(mockPost).toHaveBeenCalledTimes(1);
      expect(cache.set).toHaveBeenCalledWith('projectId-owner:49', {
        projectId,
      });
    });

    it('returns the disk-cached project ID without any GraphQL call', async () => {
      const cache = buildCacheStub({
        getLatest: jest.fn().mockResolvedValue({
          value: { projectId },
          timestamp: new Date(),
        } satisfies CacheEntry),
      });
      const repository = new GraphqlProjectRepository(
        localStorageRepository,
        'dummy',
        cache,
      );

      const result = await repository.fetchProjectId('owner', 49);

      expect(result).toBe(projectId);
      expect(mockPost).not.toHaveBeenCalled();
      expect(cache.set).not.toHaveBeenCalled();
    });

    it('does not apply a TTL to the project ID cache because the mapping is static', async () => {
      const cache = buildCacheStub({
        getLatest: jest.fn().mockResolvedValue({
          value: { projectId },
          timestamp: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
        } satisfies CacheEntry),
      });
      const repository = new GraphqlProjectRepository(
        localStorageRepository,
        'dummy',
        cache,
      );

      const result = await repository.fetchProjectId('owner', 49);

      expect(result).toBe(projectId);
      expect(mockPost).not.toHaveBeenCalled();
    });

    it('falls back to a live GraphQL fetch when the project ID cache read throws', async () => {
      const cache = buildCacheStub({
        getLatest: jest.fn().mockRejectedValue(new Error('corrupted file')),
      });
      mockPost.mockReturnValueOnce(mockJsonResponse(fetchProjectIdResponse));
      const repository = new GraphqlProjectRepository(
        localStorageRepository,
        'dummy',
        cache,
      );

      const result = await repository.fetchProjectId('owner', 49);

      expect(result).toBe(projectId);
      expect(mockPost).toHaveBeenCalledTimes(1);
    });

    it('serves the second call from the in-memory L1 cache without a disk read', async () => {
      const cache = buildCacheStub();
      mockPost.mockReturnValueOnce(mockJsonResponse(fetchProjectIdResponse));
      const repository = new GraphqlProjectRepository(
        localStorageRepository,
        'dummy',
        cache,
      );

      await repository.fetchProjectId('owner', 49);
      await repository.fetchProjectId('owner', 49);

      expect(mockPost).toHaveBeenCalledTimes(1);
      expect(cache.getLatest).toHaveBeenCalledTimes(1);
    });
  });

  describe('without a cache repository', () => {
    it('still works using the in-memory cache only', async () => {
      mockPost.mockReturnValueOnce(mockJsonResponse(fetchProjectIdResponse));
      const repository = new GraphqlProjectRepository(
        localStorageRepository,
        'dummy',
      );

      const result = await repository.fetchProjectId('owner', 49);

      expect(result).toBe(projectId);
      expect(mockPost).toHaveBeenCalledTimes(1);
    });
  });
});
