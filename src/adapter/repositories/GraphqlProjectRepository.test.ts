interface GraphqlPostBody {
  json: { query: string; variables: Record<string, unknown> };
  headers: { Authorization: string };
}

const mockPost = jest.fn<unknown, [string, GraphqlPostBody]>();

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
import { FieldOption, Project } from '../../domain/entities/Project';

const mockJsonResponse = <T>(data: T) => ({
  json: jest.fn().mockResolvedValue(data),
});

describe('GraphqlProjectRepository', () => {
  const localStorageRepository = new LocalStorageRepository();
  let repository: GraphqlProjectRepository;
  const token = 'dummy-token';
  const login = 'HiromiShikata';
  const projectUrl = `https://github.com/users/HiromiShikata/projects/49`;
  const projectNumber = 49;
  const projectId = 'PVT_kwHOAGJHa84AFhgF';

  beforeEach(() => {
    mockPost.mockReset();
    repository = new GraphqlProjectRepository(localStorageRepository, token);
  });

  describe('fetchProjectId', () => {
    it('should fetch project ID using GraphQL API', async () => {
      mockPost.mockReturnValue(
        mockJsonResponse({
          data: {
            organization: null,
            user: { projectV2: { id: projectId, databaseId: 1447941 } },
          },
        }),
      );

      const response = await repository.fetchProjectId(login, projectNumber);

      expect(response).toEqual(projectId);
      expect(mockPost).toHaveBeenCalledTimes(1);
      const [url, body] = mockPost.mock.calls[0];
      expect(url).toEqual('https://api.github.com/graphql');
      expect(body.headers).toEqual({ Authorization: `Bearer ${token}` });
      expect(body.json.variables).toEqual({
        login: 'HiromiShikata',
        number: 49,
      });
    });
  });

  describe('findProjectIdByUrl', () => {
    it('should extract project ID from URL and fetch it', async () => {
      mockPost.mockReturnValue(
        mockJsonResponse({
          data: {
            organization: null,
            user: { projectV2: { id: projectId, databaseId: 1447941 } },
          },
        }),
      );

      const response = await repository.findProjectIdByUrl(projectUrl);
      expect(response).toEqual(projectId);
      const [, body] = mockPost.mock.calls[0];
      expect(body.json.variables).toEqual({
        login: 'HiromiShikata',
        number: 49,
      });
    });
  });

  describe('updateStoryList', () => {
    const storyFieldId = 'PVTSSF_lAHOAGJHa84AFhgFzg1oBms';
    const existingStories: FieldOption[] = [
      { id: 'af410dae', name: 'story1', color: 'GRAY', description: '' },
      {
        id: '696ccdef',
        name: 'Workflow Management',
        color: 'GRAY',
        description: '',
      },
      { id: '4fa21881', name: 'test', color: 'GRAY', description: '' },
    ];
    const testProject: Project = {
      id: projectId,
      url: projectUrl,
      databaseId: 1447941,
      name: 'V2 project on owner for testing',
      completionDate50PercentConfidence: null,
      dependedIssueUrlSeparatedByComma: null,
      nextActionDate: {
        fieldId: 'PVTF_lAHOAGJHa84AFhgFzgVlnK4',
        name: 'NextActionDate',
      },
      nextActionHour: null,
      remainingEstimationMinutes: null,
      status: {
        fieldId: 'PVTSSF_lAHOAGJHa84AFhgFzgDLt0c',
        name: 'Status',
        statuses: [],
      },
      story: {
        fieldId: storyFieldId,
        databaseId: 224921195,
        name: 'Story',
        stories: existingStories,
        workflowManagementStory: {
          id: '696ccdef',
          name: 'Workflow Management',
        },
      },
    };

    it('should add a new option while preserving all existing options', async () => {
      const uniqueSuffix = Date.now().toString(36);
      const newOption: Omit<FieldOption, 'id'> & { id: null } = {
        id: null,
        name: `test-story-graphql-${uniqueSuffix}`,
        color: 'BLUE',
        description: 'created by graphql unit test',
      };
      const inputList: Parameters<typeof repository.updateStoryList>['1'] = [
        ...existingStories,
        newOption,
      ];
      const addedStory: FieldOption = {
        id: 'generated-option-id',
        name: newOption.name,
        color: newOption.color,
        description: newOption.description,
      };

      mockPost
        .mockReturnValueOnce(
          mockJsonResponse({
            data: {
              updateProjectV2Field: {
                projectV2Field: {
                  options: [...existingStories, addedStory],
                },
              },
            },
          }),
        )
        .mockReturnValueOnce(
          mockJsonResponse({
            data: {
              updateProjectV2Field: {
                projectV2Field: { options: existingStories },
              },
            },
          }),
        );

      const result = await repository.updateStoryList(testProject, inputList);

      expect(result).toHaveLength(existingStories.length + 1);
      existingStories.forEach((existing) => {
        const found = result.find((r) => r.id === existing.id);
        expect(found).toEqual(existing);
      });
      const added = result.find((r) => r.name === newOption.name);
      expect(added).toBeDefined();
      expect(added?.color).toEqual(newOption.color);
      expect(added?.description).toEqual(newOption.description);
      expect(added?.id).toBeDefined();

      const [, body] = mockPost.mock.calls[0];
      expect(body.json.variables).toEqual({
        fieldId: storyFieldId,
        options: [
          { id: 'af410dae', name: 'story1', color: 'GRAY', description: '' },
          {
            id: '696ccdef',
            name: 'Workflow Management',
            color: 'GRAY',
            description: '',
          },
          { id: '4fa21881', name: 'test', color: 'GRAY', description: '' },
          {
            name: newOption.name,
            color: 'BLUE',
            description: 'created by graphql unit test',
          },
        ],
      });

      await repository.updateStoryList(testProject, existingStories);
      expect(mockPost).toHaveBeenCalledTimes(2);
    });
  });

  describe('getProject', () => {
    it('should retrieve project details', async () => {
      mockPost.mockReturnValue(
        mockJsonResponse({
          data: {
            node: {
              id: 'PVT_kwHOAGJHa84AFhgF',
              databaseId: 1447941,
              title: 'V2 project on owner for testing',
              shortDescription: '',
              public: false,
              closed: false,
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-01T00:00:00Z',
              number: 49,
              url: 'https://github.com/users/HiromiShikata/projects/49',
              fields: {
                nodes: [
                  {
                    id: 'PVTF_lAHOAGJHa84AFhgFzgVlnK4',
                    databaseId: 1,
                    name: 'NextActionDate',
                    dataType: 'DATE',
                    options: [],
                  },
                  {
                    id: 'PVTSSF_lAHOAGJHa84AFhgFzgDLt0c',
                    databaseId: 2,
                    name: 'Status',
                    dataType: 'SINGLE_SELECT',
                    options: [
                      {
                        id: '42fe08b2',
                        name: 'Todo',
                        description: '',
                        color: 'GRAY',
                      },
                      {
                        id: 'd8072cc4',
                        name: 'Awaiting workspace',
                        description: '',
                        color: 'GRAY',
                      },
                      {
                        id: 'fe181007',
                        name: 'Preparation',
                        description: '',
                        color: 'GRAY',
                      },
                      {
                        id: 'aa14ce66',
                        name: 'Awaiting quality check',
                        description: '',
                        color: 'GRAY',
                      },
                      {
                        id: 'bebc3184',
                        name: 'In Progress',
                        description: '',
                        color: 'GRAY',
                      },
                      {
                        id: '88c0a10e',
                        name: 'Done',
                        description: '',
                        color: 'GRAY',
                      },
                    ],
                  },
                  {
                    id: 'PVTSSF_lAHOAGJHa84AFhgFzg1oBms',
                    databaseId: 224921195,
                    name: 'Story',
                    dataType: 'SINGLE_SELECT',
                    options: [
                      {
                        id: 'af410dae',
                        name: 'story1',
                        description: '',
                        color: 'GRAY',
                      },
                      {
                        id: '696ccdef',
                        name: 'Workflow Management',
                        description: '',
                        color: 'GRAY',
                      },
                      {
                        id: '4fa21881',
                        name: 'test',
                        description: '',
                        color: 'GRAY',
                      },
                    ],
                  },
                ],
              },
            },
          },
        }),
      );

      const project = await repository.getProject(projectId);
      expect(project).toEqual({
        id: 'PVT_kwHOAGJHa84AFhgF',
        url: 'https://github.com/users/HiromiShikata/projects/49',
        databaseId: 1447941,
        name: 'V2 project on owner for testing',
        nextActionDate: {
          fieldId: 'PVTF_lAHOAGJHa84AFhgFzgVlnK4',
          name: 'NextActionDate',
        },
        nextActionHour: null,
        remainingEstimationMinutes: null,
        story: {
          fieldId: 'PVTSSF_lAHOAGJHa84AFhgFzg1oBms',
          databaseId: 224921195,
          name: 'Story',
          stories: [
            {
              color: 'GRAY',
              description: '',
              id: 'af410dae',
              name: 'story1',
            },
            {
              color: 'GRAY',
              description: '',
              id: '696ccdef',
              name: 'Workflow Management',
            },
            {
              color: 'GRAY',
              description: '',
              id: '4fa21881',
              name: 'test',
            },
          ],
          workflowManagementStory: {
            color: 'GRAY',
            description: '',
            id: '696ccdef',
            name: 'Workflow Management',
          },
        },
        completionDate50PercentConfidence: null,
        dependedIssueUrlSeparatedByComma: null,

        status: {
          fieldId: 'PVTSSF_lAHOAGJHa84AFhgFzgDLt0c',
          name: 'Status',
          statuses: [
            {
              color: 'GRAY',
              description: '',
              id: '42fe08b2',
              name: 'Todo',
            },
            {
              color: 'GRAY',
              description: '',
              id: 'd8072cc4',
              name: 'Awaiting workspace',
            },
            {
              color: 'GRAY',
              description: '',
              id: 'fe181007',
              name: 'Preparation',
            },
            {
              color: 'GRAY',
              description: '',
              id: 'aa14ce66',
              name: 'Awaiting quality check',
            },
            {
              color: 'GRAY',
              description: '',
              id: 'bebc3184',
              name: 'In Progress',
            },
            {
              color: 'GRAY',
              description: '',
              id: '88c0a10e',
              name: 'Done',
            },
          ],
        },
      });
    });
  });
});
