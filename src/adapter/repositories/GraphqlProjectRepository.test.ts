import {
  GraphqlProjectRepository,
  convertToFieldOptionColor,
} from './GraphqlProjectRepository';
import { LocalStorageRepository } from './LocalStorageRepository';
import { FieldOption, Project } from '../../domain/entities/Project';

describe('convertToFieldOptionColor', () => {
  it('should preserve PINK so the Todo by human status button renders pink', () => {
    expect(convertToFieldOptionColor('PINK')).toEqual('PINK');
  });

  it('should preserve ORANGE so the Unread status button renders orange', () => {
    expect(convertToFieldOptionColor('ORANGE')).toEqual('ORANGE');
  });

  it('should preserve the remaining GitHub project option colors', () => {
    expect(convertToFieldOptionColor('RED')).toEqual('RED');
    expect(convertToFieldOptionColor('YELLOW')).toEqual('YELLOW');
    expect(convertToFieldOptionColor('GREEN')).toEqual('GREEN');
    expect(convertToFieldOptionColor('BLUE')).toEqual('BLUE');
    expect(convertToFieldOptionColor('PURPLE')).toEqual('PURPLE');
    expect(convertToFieldOptionColor('GRAY')).toEqual('GRAY');
  });

  it('should fall back to GRAY for an unknown color value', () => {
    expect(convertToFieldOptionColor('UNKNOWN')).toEqual('GRAY');
  });
});

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

      await repository.updateStoryList(testProject, existingStories);
    });
  });

  describe('getProject', () => {
    it('should retrieve project details', async () => {
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
