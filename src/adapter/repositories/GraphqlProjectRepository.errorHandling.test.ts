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

describe('GraphqlProjectRepository error handling', () => {
  let repository: GraphqlProjectRepository;

  beforeEach(() => {
    mockPost.mockClear();
    repository = new GraphqlProjectRepository(
      new LocalStorageRepository(),
      '',
      'dummy-token',
    );
  });

  describe('fetchProjectId', () => {
    it('should throw a descriptive error when response has no data field', async () => {
      mockPost.mockReturnValueOnce(mockJsonResponse({}));

      await expect(repository.fetchProjectId('someOrg', 1)).rejects.toThrow(
        'GitHub GraphQL API returned no data for fetchProjectId: no data field in response',
      );
    });

    it('should throw with error messages when response contains only errors', async () => {
      mockPost.mockReturnValueOnce(
        mockJsonResponse({
          errors: [
            { message: 'was submitted too quickly' },
            { message: 'secondary rate limit' },
          ],
        }),
      );

      await expect(repository.fetchProjectId('someOrg', 1)).rejects.toThrow(
        'GitHub GraphQL API returned no data for fetchProjectId: was submitted too quickly; secondary rate limit',
      );
    });

    it('should return project ID when data is present for organization', async () => {
      mockPost.mockReturnValueOnce(
        mockJsonResponse({
          data: {
            organization: {
              projectV2: { id: 'org-project-id', databaseId: 1 },
            },
            user: { projectV2: null },
          },
        }),
      );

      const result = await repository.fetchProjectId('someOrg', 1);
      expect(result).toBe('org-project-id');
    });

    it('should return project ID when data is present for user', async () => {
      mockPost.mockReturnValueOnce(
        mockJsonResponse({
          data: {
            organization: { projectV2: null },
            user: { projectV2: { id: 'user-project-id', databaseId: 2 } },
          },
        }),
      );

      const result = await repository.fetchProjectId('someUser', 2);
      expect(result).toBe('user-project-id');
    });
  });

  describe('getProject', () => {
    it('should throw a descriptive error when response has no data field', async () => {
      mockPost.mockReturnValueOnce(mockJsonResponse({}));

      await expect(repository.getProject('project-id')).rejects.toThrow(
        'GitHub GraphQL API returned no data for getProject: no data field in response',
      );
    });

    it('should throw with error messages when response contains only errors', async () => {
      mockPost.mockReturnValueOnce(
        mockJsonResponse({
          errors: [{ message: 'abuse detection triggered' }],
        }),
      );

      await expect(repository.getProject('project-id')).rejects.toThrow(
        'GitHub GraphQL API returned no data for getProject: abuse detection triggered',
      );
    });
  });
});
