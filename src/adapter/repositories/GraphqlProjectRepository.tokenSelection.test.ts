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

const fetchProjectIdResponse = {
  data: {
    organization: null,
    user: { projectV2: { id: 'PVT_test', databaseId: 1 } },
  },
};

const updateStoryListResponse = {
  data: {
    updateProjectV2Field: {
      projectV2Field: {
        options: [
          { id: 'opt1', name: 'story1', color: 'GRAY', description: '' },
        ],
      },
    },
  },
};

const projectWithStory: Project = {
  id: 'PVT_test',
  url: 'https://github.com/users/test/projects/1',
  databaseId: 1,
  name: 'Test Project',
  status: { name: 'Status', fieldId: 'field_status', statuses: [] },
  nextActionDate: null,
  nextActionHour: null,
  story: {
    name: 'Story',
    fieldId: 'field_story',
    databaseId: 1,
    stories: [],
    workflowManagementStory: { id: 'opt_wm', name: 'workflow management' },
  },
  remainingEstimationMinutes: null,
  dependedIssueUrlSeparatedByComma: null,
  completionDate50PercentConfidence: null,
  agent: null,
};

describe('GraphqlProjectRepository token selection', () => {
  const localStorageRepository = new LocalStorageRepository();

  beforeEach(() => {
    mockPost.mockReset();
    mockGet.mockReset();
  });

  describe('query operations use selectReadToken', () => {
    it('uses manager token for query when readGhTokens is empty', async () => {
      const repository = new GraphqlProjectRepository(
        localStorageRepository,
        'manager-token',
        undefined,
        [],
      );
      mockPost.mockReturnValueOnce(mockJsonResponse(fetchProjectIdResponse));

      await repository.fetchProjectId('owner', 1);

      expect(mockPost).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: { Authorization: 'Bearer manager-token' },
        }),
      );
    });

    it('uses read token for query when readGhTokens has one entry', async () => {
      const repository = new GraphqlProjectRepository(
        localStorageRepository,
        'manager-token',
        undefined,
        ['read-token-1'],
      );
      mockPost.mockReturnValueOnce(mockJsonResponse(fetchProjectIdResponse));

      await repository.fetchProjectId('owner', 1);

      expect(mockPost).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: { Authorization: 'Bearer read-token-1' },
        }),
      );
    });
  });

  describe('mutation operations always use manager token', () => {
    it('uses manager token for mutation even when readGhTokens is set', async () => {
      const repository = new GraphqlProjectRepository(
        localStorageRepository,
        'manager-token',
        undefined,
        ['read-token-1'],
      );
      mockPost.mockReturnValueOnce(mockJsonResponse(updateStoryListResponse));

      await repository.updateStoryList(projectWithStory, []);

      expect(mockPost).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: { Authorization: 'Bearer manager-token' },
        }),
      );
    });
  });

  describe('fetchProjectByGraphql falls back to write token when read token returns null node', () => {
    beforeEach(() => {
      const error403 = Object.assign(new Error('403'), {
        response: { status: 403 },
      });
      mockGet.mockReturnValue({
        json: jest.fn().mockRejectedValue(error403),
      });
    });

    const projectNodeResponse = {
      data: {
        node: {
          id: 'PVT_test',
          databaseId: 1,
          title: 'Test Project',
          shortDescription: '',
          public: false,
          closed: false,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          number: 1,
          url: 'https://github.com/users/test/projects/1',
          fields: {
            nodes: [
              {
                id: 'field_status',
                databaseId: 10,
                name: 'Status',
                dataType: 'SINGLE_SELECT',
                configuration: { iterations: [] },
                options: [],
              },
            ],
          },
        },
      },
    };

    it('returns project using write token when read token cannot access Projects V2', async () => {
      const repository = new GraphqlProjectRepository(
        localStorageRepository,
        'manager-token',
        undefined,
        ['read-token-1'],
      );

      // First call: fetchProjectId with read token (returns project ID)
      mockPost.mockReturnValueOnce(
        mockJsonResponse({
          data: {
            organization: null,
            user: { projectV2: { id: 'PVT_test', databaseId: 1 } },
          },
        }),
      );
      // Second call: fetchProjectByGraphql with read token → null node (no Projects V2 access)
      mockPost.mockReturnValueOnce(mockJsonResponse({ data: { node: null } }));
      // Third call: fetchProjectByGraphql with write token (fallback) → returns project
      mockPost.mockReturnValueOnce(mockJsonResponse(projectNodeResponse));

      const project = await repository.getByUrl(
        'https://github.com/users/test/projects/1',
      );

      expect(project).not.toBeNull();
      expect(project.id).toBe('PVT_test');
      expect(project.name).toBe('Test Project');

      // Verify the third call used the write token
      expect(mockPost).toHaveBeenNthCalledWith(
        3,
        expect.any(String),
        expect.objectContaining({
          headers: { Authorization: 'Bearer manager-token' },
        }),
      );
    });

    it('returns null when both read token and write token cannot access the project', async () => {
      const repository = new GraphqlProjectRepository(
        localStorageRepository,
        'manager-token',
        undefined,
        ['read-token-1'],
      );

      // fetchProjectId with read token
      mockPost.mockReturnValueOnce(
        mockJsonResponse({
          data: {
            organization: null,
            user: { projectV2: { id: 'PVT_test', databaseId: 1 } },
          },
        }),
      );
      // fetchProjectByGraphql with read token → null
      mockPost.mockReturnValueOnce(mockJsonResponse({ data: { node: null } }));
      // fetchProjectByGraphql with write token → also null
      mockPost.mockReturnValueOnce(mockJsonResponse({ data: { node: null } }));

      await expect(
        repository.getByUrl('https://github.com/users/test/projects/1'),
      ).rejects.toThrow('Project not found for ID: PVT_test');
    });

    it('logs a warning when write-token fallback response has errors', async () => {
      const consoleSpy = jest
        .spyOn(console, 'warn')
        .mockImplementation(() => {});
      const repository = new GraphqlProjectRepository(
        localStorageRepository,
        'manager-token',
        undefined,
        ['read-token-1'],
      );

      // fetchProjectId
      mockPost.mockReturnValueOnce(
        mockJsonResponse({
          data: {
            organization: null,
            user: { projectV2: { id: 'PVT_test', databaseId: 1 } },
          },
        }),
      );
      // fetchProjectByGraphql with read token → null node
      mockPost.mockReturnValueOnce(mockJsonResponse({ data: { node: null } }));
      // fetchProjectByGraphql with write token → errors, no data
      mockPost.mockReturnValueOnce(
        mockJsonResponse({ errors: [{ message: 'insufficient scope' }] }),
      );

      await expect(
        repository.getByUrl('https://github.com/users/test/projects/1'),
      ).rejects.toThrow('Project not found for ID: PVT_test');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'write-token fallback for GetProjectV2 also failed',
        ),
      );

      consoleSpy.mockRestore();
    });

    it('does not retry when read token equals write token (no readGhTokens)', async () => {
      const repository = new GraphqlProjectRepository(
        localStorageRepository,
        'manager-token',
        undefined,
        [], // no read tokens
      );

      // fetchProjectId
      mockPost.mockReturnValueOnce(
        mockJsonResponse({
          data: {
            organization: null,
            user: { projectV2: { id: 'PVT_test', databaseId: 1 } },
          },
        }),
      );
      // fetchProjectByGraphql with write token (only token available) → null
      mockPost.mockReturnValueOnce(mockJsonResponse({ data: { node: null } }));

      await expect(
        repository.getByUrl('https://github.com/users/test/projects/1'),
      ).rejects.toThrow('Project not found for ID: PVT_test');

      // Only 2 calls: fetchProjectId + fetchProjectByGraphql (no retry)
      expect(mockPost).toHaveBeenCalledTimes(2);
    });
  });
});
