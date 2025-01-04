import { GraphqlProjectItemRepository } from './GraphqlProjectItemRepository';
import { LocalStorageRepository } from '../LocalStorageRepository';
import type { AxiosResponse } from 'axios';

jest.mock('axios');
const mockPost = jest.fn<Promise<AxiosResponse>, [string, unknown, unknown]>();

describe('GraphqlProjectItemRepository', () => {
  const localStorageRepository = new LocalStorageRepository();
  let repository: GraphqlProjectItemRepository;

  beforeEach(() => {
    repository = new GraphqlProjectItemRepository(
      localStorageRepository,
      '',
      process.env.GH_TOKEN,
    );
    mockPost.mockReset();
  });
  describe('getProjectItemFields', () => {
    it('should return project item fields', async () => {
      const owner = 'HiromiShikata';
      const repositoryName = 'test-repository';
      const issueNumber = 38;

      const mockResponse = {
        status: 200,
        data: {
          data: {
            repository: {
              issue: {
                projectItems: {
                  nodes: [
                    {
                      fieldValues: {
                        nodes: [
                          {
                            field: { name: 'Assignees' },
                            value: '',
                          },
                          {
                            field: { name: 'Repository' },
                            value: 'test-repository',
                          },
                          {
                            field: { name: '' },
                            value: '',
                          },
                          {
                            field: { name: '' },
                            value: 'In progress test title',
                          },
                          {
                            field: { name: 'Status' },
                            value: 'Todo',
                          },
                          {
                            field: { name: 'NextActionDate' },
                            value: '2024-04-25',
                          },
                        ],
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      };

      mockPost.mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
        data: mockResponse,
      } as AxiosResponse);

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

      mockPost.mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
        data: mockResponse,
      } as AxiosResponse);

      await repository.removeProjectItem(projectId, itemId);

      const expectedPayload: {
        query: string;
        variables: {
          input: {
            projectId: string;
            itemId: string;
          };
        };
      } = {
        query: 'mutation DeleteProjectItem',
        variables: {
          input: {
            projectId,
            itemId,
          },
        },
      };
      
      expect(mockPost).toHaveBeenCalledWith(
        'https://api.github.com/graphql',
        expect.objectContaining(expectedPayload),
        expect.any(Object),
      );
    });

    it('should throw error when removal fails', async () => {
      const projectId = 'test-project-id';
      const itemId = 'test-item-id';
      const errorMessage = 'Failed to remove item';

      mockPost.mockResolvedValueOnce({
        status: 400,
        statusText: 'Bad Request',
        headers: {},
        config: {},
        data: { errors: [{ message: errorMessage }] },
      } as AxiosResponse);

      await expect(
        repository.removeProjectItem(projectId, itemId),
      ).rejects.toThrow('Failed to remove project item');
    });

    it('should throw error when GraphQL returns errors', async () => {
      const projectId = 'test-project-id';
      const itemId = 'test-item-id';
      const errorMessage = 'GraphQL Error';

      mockPost.mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
        data: { errors: [{ message: errorMessage }] },
      } as AxiosResponse);

      await expect(
        repository.removeProjectItem(projectId, itemId),
      ).rejects.toThrow(errorMessage);
    });
  });
});
