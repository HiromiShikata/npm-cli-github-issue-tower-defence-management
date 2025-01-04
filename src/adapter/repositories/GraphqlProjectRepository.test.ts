import { GraphqlProjectRepository } from './GraphqlProjectRepository';
import { LocalStorageRepository } from './LocalStorageRepository';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('GraphqlProjectRepository', () => {
  const localStorageRepository = new LocalStorageRepository();
  let repository: GraphqlProjectRepository;
  const token = process.env.GH_TOKEN;
  const login = 'HiromiShikata';
  const projectUrl = `https://github.com/users/HiromiShikata/projects/49`;
  const projectNumber = 49;
  const projectId = 'PVT_kwHOAGJHa84AFhgF';

  beforeEach(() => {
    repository = new GraphqlProjectRepository(localStorageRepository, token);
  });

  describe('fetchProjectId', () => {
    it('should fetch project ID using GraphQL API', async () => {
      const response = await repository.fetchProjectId(login, projectNumber);

      expect(response).toEqual(projectId);
    });
  });

  describe('findProjectIdByUrl', () => {
    it('should extract project ID from URL and fetch it', async () => {
      const response = await repository.findProjectIdByUrl(projectUrl);
      expect(response).toEqual(projectId);
    });
  });

  describe('getProject', () => {
    it('should retrieve project details', async () => {
      const project = await repository.getProject(projectId);
      expect(project).toEqual({
        id: 'PVT_kwHOAGJHa84AFhgF',
        name: 'V2 project on owner for testing',
        nextActionDate: {
          fieldId: 'PVTF_lAHOAGJHa84AFhgFzgVlnK4',
          name: 'NextActionDate',
        },
        nextActionHour: null,
        remainingEstimationMinutes: null,
        story: null,
        completionDate50PercentConfidence: null,
        dependedIssueUrlSeparatedByComma: null,
      });
    });
  });

  describe('removeItemFromProject', () => {
    it('should remove an item from the project', async () => {
      const mockResponse = { data: { deleteProjectV2Item: { deletedItemId: 'test-item-id' } } };
      mockedAxios.post.mockResolvedValueOnce(mockResponse);

      await repository.removeItemFromProject(projectId, 'test-item-id');

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://api.github.com/graphql',
        {
          query: expect.stringContaining('mutation DeleteProjectItem'),
          variables: {
            input: {
              projectId,
              itemId: 'test-item-id',
            },
          },
        },
        expect.any(Object)
      );
    });

    it('should handle errors when removing an item', async () => {
      const errorMessage = 'Failed to remove item';
      mockedAxios.post.mockRejectedValueOnce(new Error(errorMessage));

      await expect(repository.removeItemFromProject(projectId, 'test-item-id'))
        .rejects
        .toThrow(errorMessage);
    });
  });
});
