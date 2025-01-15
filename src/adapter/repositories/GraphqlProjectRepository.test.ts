import { GraphqlProjectRepository } from './GraphqlProjectRepository';
import { LocalStorageRepository } from './LocalStorageRepository';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = jest.mocked(axios, { shallow: false });

describe('GraphqlProjectRepository', () => {
  const localStorageRepository = new LocalStorageRepository();
  let repository: GraphqlProjectRepository;
  const token = process.env.GH_TOKEN;
  const login = 'HiromiShikata';
  const projectUrl = `https://github.com/users/HiromiShikata/projects/49`;
  const projectNumber = 49;
  const projectId = 'PVT_kwHOAGJHa84AFhgF';
  const testItemId = 'PVTI_lAHOAGJHa84AFhgFzgM5rXY';

  beforeEach(() => {
    repository = new GraphqlProjectRepository(localStorageRepository, token);
    jest.clearAllMocks();
  });

  describe('fetchProjectId', () => {
    it('should fetch project ID using GraphQL API', async () => {
      const mockResponse = {
        data: {
          data: {
            organization: {
              projectV2: {
                id: projectId,
              },
            },
            user: null,
          },
        },
      };
      mockedAxios.post.mockResolvedValueOnce({ data: mockResponse });

      const response = await repository.fetchProjectId(login, projectNumber);
      expect(response).toEqual(projectId);
    });
  });

  describe('findProjectIdByUrl', () => {
    it('should extract project ID from URL and fetch it', async () => {
      const mockResponse = {
        data: {
          data: {
            organization: {
              projectV2: {
                id: projectId,
              },
            },
            user: null,
          },
        },
      };
      mockedAxios.post.mockResolvedValueOnce({ data: mockResponse });

      const response = await repository.findProjectIdByUrl(projectUrl);
      expect(response).toEqual(projectId);
    });
  });

  describe('getProject', () => {
    it('should retrieve project details', async () => {
      const mockResponse = {
        data: {
          data: {
            node: {
              id: 'PVT_kwHOAGJHa84AFhgF',
              title: 'V2 project on owner for testing',
              shortDescription: '',
              public: true,
              closed: false,
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-01T00:00:00Z',
              number: 49,
              url: projectUrl,
              fields: {
                nodes: [
                  {
                    id: 'PVTF_lAHOAGJHa84AFhgFzgVlnK4',
                    name: 'NextActionDate',
                    dataType: 'DATE',
                  },
                  {
                    id: 'PVTSSF_lAHOAGJHa84AFhgFzgDLt0c',
                    name: 'Status',
                    dataType: 'SINGLE_SELECT',
                    options: [
                      {
                        id: 'f75ad846',
                        name: 'Todo',
                        description: '',
                        color: 'GRAY',
                      },
                      {
                        id: '47fc9ee4',
                        name: 'In Progress',
                        description: '',
                        color: 'GRAY',
                      },
                      {
                        id: '98236657',
                        name: 'Done',
                        description: '',
                        color: 'GRAY',
                      },
                    ],
                  },
                ],
              },
            },
          },
        },
      };
      mockedAxios.post.mockResolvedValueOnce({ data: mockResponse });

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
    const testItemId = 'PVTI_lAHOAGJHa84AFhgFzgM5rXY';

    it('should remove item from project successfully', async () => {
      const mockResponse = {
        data: {
          data: {
            deleteProjectV2Item: {
              deletedItemId: testItemId,
            },
          },
        },
      };
      mockedAxios.post.mockResolvedValueOnce({ data: mockResponse });

      await expect(
        repository.removeItemFromProject(projectId, testItemId),
      ).resolves.not.toThrow();
    });

    it('should throw error when project or item not found', async () => {
      const invalidItemId = 'invalid_item_id';
      const mockResponse = {
        data: {
          data: {
            deleteProjectV2Item: null,
          },
        },
      };
      mockedAxios.post.mockResolvedValueOnce({ data: mockResponse });

      await expect(
        repository.removeItemFromProject(projectId, invalidItemId),
      ).rejects.toThrow('Project or item not found');
    });
  });

  describe('removeItemFromProjectByIssueUrl', () => {
    const testIssueUrl =
      'https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/19';

    it('should remove item by issue URL successfully', async () => {
      const mockFindResponse = {
        data: {
          data: {
            node: {
              items: {
                nodes: [
                  {
                    id: testItemId,
                    content: {
                      number: 19,
                      repository: {
                        name: 'npm-cli-github-issue-tower-defence-management',
                        owner: {
                          login: 'HiromiShikata',
                        },
                      },
                    },
                  },
                ],
              },
            },
          },
        },
      };
      const mockDeleteResponse = {
        data: {
          data: {
            deleteProjectV2Item: {
              deletedItemId: testItemId,
            },
          },
        },
      };

      mockedAxios.post
        .mockResolvedValueOnce({ data: mockFindResponse })
        .mockResolvedValueOnce({ data: mockDeleteResponse });

      await expect(
        repository.removeItemFromProjectByIssueUrl(projectUrl, testIssueUrl),
      ).resolves.not.toThrow();
    });

    it('should throw error when project not found', async () => {
      const invalidProjectUrl =
        'https://github.com/users/HiromiShikata/projects/999';
      const mockResponse = {
        data: {
          data: {
            organization: null,
            user: null,
          },
        },
      };
      mockedAxios.post.mockResolvedValueOnce(mockResponse);

      await expect(
        repository.removeItemFromProjectByIssueUrl(
          invalidProjectUrl,
          testIssueUrl,
        ),
      ).rejects.toThrow('Project not found');
    });

    it('should throw error when issue not found in project', async () => {
      const nonExistentIssueUrl =
        'https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/999999';
      const mockFindProjectResponse = {
        data: {
          data: {
            organization: {
              projectV2: {
                id: projectId,
              },
            },
          },
        },
      };
      const mockFindItemResponse = {
        data: {
          data: {
            node: {
              items: {
                nodes: [],
              },
            },
          },
        },
      };

      mockedAxios.post
        .mockResolvedValueOnce({ data: mockFindProjectResponse })
        .mockResolvedValueOnce({ data: mockFindItemResponse });

      await expect(
        repository.removeItemFromProjectByIssueUrl(
          projectUrl,
          nonExistentIssueUrl,
        ),
      ).rejects.toThrow('Item not found in project');
    });
  });
});
