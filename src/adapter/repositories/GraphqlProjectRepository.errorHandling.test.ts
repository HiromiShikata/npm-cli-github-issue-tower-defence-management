const mockGet = jest.fn();
const mockPost = jest.fn();

jest.mock('ky', () => ({
  default: {
    post: mockPost,
    get: mockGet,
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
import { Project } from '../../domain/entities/Project';

const mockJsonResponse = <T>(data: T) => ({
  json: jest.fn().mockResolvedValue(data),
});

const minimalProject: Project = {
  id: 'test-project-id',
  url: 'https://github.com/orgs/X-Mile/projects/7',
  databaseId: 7,
  name: 'X-Mile',
  status: { name: 'Status', fieldId: 'PVTSSF_status', statuses: [] },
  nextActionDate: null,
  nextActionHour: null,
  story: null,
  remainingEstimationMinutes: null,
  dependedIssueUrlSeparatedByComma: null,
  completionDate50PercentConfidence: null,
  agent: null,
};

describe('GraphqlProjectRepository error handling', () => {
  let repository: GraphqlProjectRepository;

  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    repository = new GraphqlProjectRepository(
      new LocalStorageRepository(),
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

  describe('listFieldNames', () => {
    const fieldsRestResponse = [
      { id: 1, node_id: 'PVTF_1', name: 'Status' },
      { id: 2, node_id: 'PVTF_2', name: 'Story' },
    ];
    let consoleWarnSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleWarnSpy.mockRestore();
      jest.useRealTimers();
    });

    it('should retry once after a delay when the REST fields endpoint returns 403 and return field names on the retry', async () => {
      jest.useFakeTimers();
      const forbiddenError = Object.assign(new Error('Forbidden'), {
        response: { status: 403 },
      });
      mockGet
        .mockImplementationOnce(() => {
          throw forbiddenError;
        })
        .mockReturnValueOnce({
          json: jest.fn().mockResolvedValue(fieldsRestResponse),
        });

      const promise = repository.listFieldNames(minimalProject);
      await jest.advanceTimersByTimeAsync(3000);
      const names = await promise;

      expect(mockGet).toHaveBeenCalledTimes(2);
      expect(names).toEqual(['Status', 'Story']);
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('403'),
      );
    });

    it('should rethrow when both the initial call and the retry receive a 403', async () => {
      jest.useFakeTimers();
      const forbiddenError = Object.assign(new Error('Forbidden'), {
        response: { status: 403 },
      });
      mockGet.mockImplementation(() => {
        throw forbiddenError;
      });

      const promise = repository.listFieldNames(minimalProject);
      await Promise.allSettled([
        jest.advanceTimersByTimeAsync(3000),
        promise,
      ]);

      await expect(promise).rejects.toThrow('Forbidden');
      expect(mockGet).toHaveBeenCalledTimes(2);
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('403'),
      );
    });
  });
});
