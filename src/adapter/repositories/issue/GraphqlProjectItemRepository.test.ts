import { GraphqlProjectItemRepository } from './GraphqlProjectItemRepository';
import { LocalStorageRepository } from '../LocalStorageRepository';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = jest.mocked(axios);

describe('GraphqlProjectItemRepository', () => {
  const localStorageRepository = new LocalStorageRepository();
  let repository: GraphqlProjectItemRepository;

  beforeEach(() => {
    repository = new GraphqlProjectItemRepository(
      localStorageRepository,
      '',
      process.env.GH_TOKEN,
    );
  });
  describe('getProjectItemFields', () => {
    it('should return project item fields', async () => {
      const owner = 'HiromiShikata';
      const repositoryName = 'test-repository';
      const issueNumber = 38;

      const result = await repository.getProjectItemFields(
        owner,
        repositoryName,
        issueNumber,
      );

      expect(result).toEqual([
        {
          fieldName: 'Assignees',
          fieldValue: '',
        },
        {
          fieldName: 'Repository',
          fieldValue: 'test-repository',
        },
        {
          fieldName: '',
          fieldValue: '',
        },
        {
          fieldName: '',
          fieldValue: 'In progress test title',
        },
        {
          fieldName: 'Status',
          fieldValue: 'Todo',
        },
        {
          fieldName: 'NextActionDate',
          fieldValue: '2024-04-25',
        },
      ]);
    });
  });

  describe('removeProjectItem', () => {
    it('should remove a project item successfully', async () => {
      const projectId = 'test-project-id';
      const itemId = 'test-item-id';
      const mockResponse = {
        data: {
          deleteProjectV2Item: {
            deletedItemId: itemId,
          },
        },
      };

      mockedAxios.post.mockResolvedValueOnce({
        status: 200,
        data: mockResponse,
      });

      await repository.removeProjectItem(projectId, itemId);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://api.github.com/graphql',
        {
          query: expect.stringContaining('mutation DeleteProjectItem'),
          variables: {
            input: {
              projectId,
              itemId,
            },
          },
        },
        expect.any(Object),
      );
    });

    it('should throw error when removal fails', async () => {
      const projectId = 'test-project-id';
      const itemId = 'test-item-id';
      const errorMessage = 'Failed to remove item';

      mockedAxios.post.mockResolvedValueOnce({
        status: 400,
        data: { errors: [{ message: errorMessage }] },
      });

      await expect(
        repository.removeProjectItem(projectId, itemId),
      ).rejects.toThrow('Failed to remove project item');
    });

    it('should throw error when GraphQL returns errors', async () => {
      const projectId = 'test-project-id';
      const itemId = 'test-item-id';
      const errorMessage = 'GraphQL Error';

      mockedAxios.post.mockResolvedValueOnce({
        status: 200,
        data: { errors: [{ message: errorMessage }] },
      });

      await expect(
        repository.removeProjectItem(projectId, itemId),
      ).rejects.toThrow(errorMessage);
    });
  });
});
