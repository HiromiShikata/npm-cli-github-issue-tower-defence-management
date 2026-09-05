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
});
