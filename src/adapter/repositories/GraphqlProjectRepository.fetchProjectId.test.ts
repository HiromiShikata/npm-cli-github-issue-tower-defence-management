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

import { GraphqlProjectRepository } from './GraphqlProjectRepository';
import { LocalStorageRepository } from './LocalStorageRepository';

const mockJsonResponse = <T>(data: T) => ({
  json: jest.fn().mockResolvedValue(data),
});

describe('GraphqlProjectRepository.fetchProjectId', () => {
  const localStorageRepository = new LocalStorageRepository();
  let repository: GraphqlProjectRepository;

  beforeEach(() => {
    jest.useFakeTimers();
    mockPost.mockReset();
    repository = new GraphqlProjectRepository(
      localStorageRepository,
      'dummy-token',
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('user-owned project', () => {
    it('should resolve project ID from user owner when organization returns null', async () => {
      mockPost.mockReturnValueOnce(
        mockJsonResponse({
          data: {
            organization: null,
            user: {
              projectV2: {
                id: 'PVT_user123',
                databaseId: 999,
              },
            },
          },
        }),
      );

      const result = await repository.fetchProjectId('some-user', 1);

      expect(result).toBe('PVT_user123');
    });

    it('should resolve project ID from organization owner when user returns null', async () => {
      mockPost.mockReturnValueOnce(
        mockJsonResponse({
          data: {
            organization: {
              projectV2: {
                id: 'PVT_org456',
                databaseId: 111,
              },
            },
            user: null,
          },
        }),
      );

      const result = await repository.fetchProjectId('some-org', 2);

      expect(result).toBe('PVT_org456');
    });
  });

  describe('memoization', () => {
    it('should return cached project ID on subsequent calls without re-fetching', async () => {
      mockPost.mockReturnValueOnce(
        mockJsonResponse({
          data: {
            organization: null,
            user: {
              projectV2: {
                id: 'PVT_cached',
                databaseId: 777,
              },
            },
          },
        }),
      );

      const first = await repository.fetchProjectId('owner', 10);
      const second = await repository.fetchProjectId('owner', 10);

      expect(first).toBe('PVT_cached');
      expect(second).toBe('PVT_cached');
      expect(mockPost).toHaveBeenCalledTimes(1);
    });

    it('should use separate cache entries for different owner+projectNumber combinations', async () => {
      mockPost
        .mockReturnValueOnce(
          mockJsonResponse({
            data: {
              organization: null,
              user: { projectV2: { id: 'PVT_A', databaseId: 1 } },
            },
          }),
        )
        .mockReturnValueOnce(
          mockJsonResponse({
            data: {
              organization: null,
              user: { projectV2: { id: 'PVT_B', databaseId: 2 } },
            },
          }),
        );

      const resultA = await repository.fetchProjectId('ownerA', 1);
      const resultB = await repository.fetchProjectId('ownerB', 1);

      expect(resultA).toBe('PVT_A');
      expect(resultB).toBe('PVT_B');
      expect(mockPost).toHaveBeenCalledTimes(2);
    });
  });

  describe('errors-only response hardening', () => {
    it('should throw a clear error when response has no data field', async () => {
      mockPost.mockReturnValueOnce(
        mockJsonResponse({
          errors: [{ message: 'Could not resolve to a User' }],
        }),
      );

      await expect(repository.fetchProjectId('bad-owner', 1)).rejects.toThrow(
        'Could not resolve to a User',
      );
    });

    it('should throw a clear error when data is null', async () => {
      mockPost.mockReturnValueOnce(
        mockJsonResponse({
          data: null,
          errors: [{ message: 'secondary rate limit' }],
        }),
      );

      await expect(
        repository.fetchProjectId('rate-limited', 1),
      ).rejects.toThrow('secondary rate limit');
    });

    it('should throw a clear error when data has no project in either org or user', async () => {
      mockPost.mockReturnValueOnce(
        mockJsonResponse({
          data: {
            organization: null,
            user: null,
          },
        }),
      );

      await expect(
        repository.fetchProjectId('no-project-owner', 99),
      ).rejects.toThrow('project not found');
    });

    it('should throw a clear error when network call fails', async () => {
      mockPost.mockReturnValueOnce({
        json: jest.fn().mockRejectedValue(new Error('network failure')),
      });

      await expect(repository.fetchProjectId('owner', 1)).rejects.toThrow(
        'network failure',
      );
    });
  });

  describe('backoff after failure', () => {
    it('should not re-call GraphQL within 1 hour after a failure', async () => {
      mockPost.mockReturnValueOnce(
        mockJsonResponse({
          errors: [{ message: 'auth failure' }],
        }),
      );

      await expect(repository.fetchProjectId('owner', 5)).rejects.toThrow();

      await expect(repository.fetchProjectId('owner', 5)).rejects.toThrow(
        'backoff',
      );

      expect(mockPost).toHaveBeenCalledTimes(1);
    });

    it('should retry after 1 hour backoff has elapsed', async () => {
      mockPost
        .mockReturnValueOnce(
          mockJsonResponse({
            errors: [{ message: 'temporary error' }],
          }),
        )
        .mockReturnValueOnce(
          mockJsonResponse({
            data: {
              organization: null,
              user: { projectV2: { id: 'PVT_recovered', databaseId: 42 } },
            },
          }),
        );

      await expect(repository.fetchProjectId('owner', 7)).rejects.toThrow();

      jest.advanceTimersByTime(60 * 60 * 1000 + 1);

      const result = await repository.fetchProjectId('owner', 7);

      expect(result).toBe('PVT_recovered');
      expect(mockPost).toHaveBeenCalledTimes(2);
    });

    it('should apply backoff independently per owner+projectNumber', async () => {
      mockPost
        .mockReturnValueOnce(
          mockJsonResponse({
            errors: [{ message: 'error for owner A' }],
          }),
        )
        .mockReturnValueOnce(
          mockJsonResponse({
            data: {
              organization: null,
              user: { projectV2: { id: 'PVT_B', databaseId: 2 } },
            },
          }),
        );

      await expect(repository.fetchProjectId('ownerA', 1)).rejects.toThrow();

      const resultB = await repository.fetchProjectId('ownerB', 1);

      expect(resultB).toBe('PVT_B');
      expect(mockPost).toHaveBeenCalledTimes(2);
    });
  });
});
