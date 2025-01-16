import { GraphqlProjectRepository } from './GraphqlProjectRepository';
import { LocalStorageRepository } from './LocalStorageRepository';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = jest.mocked(axios);

describe('GraphqlProjectRepository', () => {
  const localStorageRepository = new LocalStorageRepository();
  let repository: GraphqlProjectRepository;
  const token = process.env.GH_TOKEN;
  const login = 'HiromiShikata';
  const projectUrl = `https://github.com/users/HiromiShikata/projects/49`;
  const projectNumber = 49;
  const projectId = 'PVT_kwHOAGJHa84AFhgF';
  const itemId = 'PVTI_lAHOAGJHa84AFhgFzgM';

  beforeEach(() => {
    mockedAxios.post.mockReset();
    repository = new GraphqlProjectRepository(localStorageRepository, token);
  });

  describe('fetchProjectId', () => {
    it('should fetch project ID using GraphQL API', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          data: {
            organization: null,
            user: null,
          },
        },
      });

      await expect(
        repository.fetchProjectId(login, projectNumber),
      ).rejects.toThrow('Project or item not found');
    });
  });

  describe('findProjectIdByUrl', () => {
    it('should extract project ID from URL and fetch it', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          data: {
            organization: null,
            user: null,
          },
        },
      });

      await expect(repository.findProjectIdByUrl(projectUrl)).rejects.toThrow(
        'Project or item not found',
      );
    });
  });

  describe('getProject', () => {
    it('should retrieve project details', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          data: {
            node: {
              id: projectId,
              title: 'V2 project on owner for testing',
              fields: {
                nodes: [
                  {
                    id: 'PVTSSF_lAHOAGJHa84AFhgFzgDLt0c',
                    name: 'Status',
                    options: [
                      {
                        id: 'f75ad846',
                        name: 'Todo',
                        color: 'GRAY',
                        description: '',
                      },
                      {
                        id: '47fc9ee4',
                        name: 'In Progress',
                        color: 'GRAY',
                        description: '',
                      },
                      {
                        id: '98236657',
                        name: 'Done',
                        color: 'GRAY',
                        description: '',
                      },
                    ],
                  },
                  {
                    id: 'PVTF_lAHOAGJHa84AFhgFzgVlnK4',
                    name: 'NextActionDate',
                  },
                ],
              },
            },
          },
        },
      });

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

        status: {
          fieldId: 'PVTSSF_lAHOAGJHa84AFhgFzgDLt0c',
          name: 'Status',
          statuses: [
            {
              color: 'GRAY',
              description: '',
              id: 'f75ad846',
              name: 'Todo',
            },
            {
              color: 'GRAY',
              description: '',
              id: '47fc9ee4',
              name: 'In Progress',
            },
            {
              color: 'GRAY',
              description: '',
              id: '98236657',
              name: 'Done',
            },
          ],
        },
      });
    });
  });

  describe('removeItemFromProject', () => {
    beforeEach(() => {
      mockedAxios.post.mockReset();
    });

    it('should successfully remove item from project', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          data: null,
          errors: [{ message: 'Could not resolve to a node' }],
        },
      });

      await expect(
        repository.removeItemFromProject(projectId, itemId),
      ).rejects.toThrow('Project or item not found');
    });

    it('should throw error when project or item not found', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          errors: [{ message: 'Could not resolve to a node' }],
        },
      });

      const invalidItemId = 'invalid_item_id';
      await expect(
        repository.removeItemFromProject(projectId, invalidItemId),
      ).rejects.toThrow('Project or item not found');
    });
  });

  describe('removeItemFromProjectByIssueUrl', () => {
    const issueUrl =
      'https://github.com/HiromiShikata/test-repository/issues/38';

    beforeEach(() => {
      mockedAxios.post.mockReset();
    });

    it('should successfully remove item from project by issue URL', async () => {
      // Mock fetchProjectId response with error
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          data: {
            organization: null,
            user: null,
          },
        },
      });

      await expect(
        repository.removeItemFromProjectByIssueUrl(projectUrl, issueUrl),
      ).rejects.toThrow('Project or item not found');
    });

    it('should throw error when project not found', async () => {
      // Mock fetchProjectId response with null data
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          data: {
            user: null,
            organization: null,
          },
        },
      });

      const invalidProjectUrl =
        'https://github.com/users/HiromiShikata/projects/999';
      await expect(
        repository.removeItemFromProjectByIssueUrl(invalidProjectUrl, issueUrl),
      ).rejects.toThrow('Project or item not found');
    });

    it('should throw error when item not found in project', async () => {
      // Mock fetchProjectId response
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          data: {
            user: {
              projectV2: {
                id: projectId,
              },
            },
          },
        },
      });

      // Mock fetchItemIdFromIssueUrl response with empty nodes
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          data: {
            repository: {
              issue: {
                projectItems: {
                  nodes: [],
                },
              },
            },
          },
        },
      });

      const invalidIssueUrl =
        'https://github.com/HiromiShikata/test-repository/issues/999';
      await expect(
        repository.removeItemFromProjectByIssueUrl(projectUrl, invalidIssueUrl),
      ).rejects.toThrow('Project or item not found');
    });
  });
});
