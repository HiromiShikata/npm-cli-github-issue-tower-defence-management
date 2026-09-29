import { GraphqlProjectRepository } from './GraphqlProjectRepository';
import { LocalStorageRepository } from './LocalStorageRepository';
import {
  FIELD_OPTION_COLORS,
  FieldOption,
  Project,
} from '../../domain/entities/Project';

const token = process.env.GH_TOKEN;
const describeWhenCredentials = token ? describe : describe.skip;

const expectEveryFieldOptionIsWellFormedRegardlessOfLiveContent = (
  options: FieldOption[],
): void => {
  expect(Array.isArray(options)).toBe(true);
  expect(options.length).toBeGreaterThan(0);
  options.forEach((option) => {
    expect(typeof option.id).toBe('string');
    expect(option.id.length).toBeGreaterThan(0);
    expect(typeof option.name).toBe('string');
    expect(option.name.length).toBeGreaterThan(0);
    expect(FIELD_OPTION_COLORS).toContain(option.color);
    expect(typeof option.description).toBe('string');
  });
};

const expectNextActionHourIsWellFormedOrNull = (
  nextActionHour: Project['nextActionHour'],
): void => {
  if (nextActionHour === null) {
    return;
  }
  expect(typeof nextActionHour.fieldId).toBe('string');
  expect(nextActionHour.fieldId.length).toBeGreaterThan(0);
  expect(typeof nextActionHour.name).toBe('string');
  expect(nextActionHour.name.length).toBeGreaterThan(0);
  expectEveryFieldOptionIsWellFormedRegardlessOfLiveContent(
    nextActionHour.options,
  );
};

const expectWorkflowManagementStoryIsWellFormed = (workflowManagementStory: {
  id: string;
  name: string;
}): void => {
  expect(typeof workflowManagementStory.id).toBe('string');
  expect(workflowManagementStory.id.length).toBeGreaterThan(0);
  expect(typeof workflowManagementStory.name).toBe('string');
  expect(workflowManagementStory.name.length).toBeGreaterThan(0);
  expect(workflowManagementStory.name).toMatch(/workflow management/i);
};

describeWhenCredentials('GraphqlProjectRepository', () => {
  const localStorageRepository = new LocalStorageRepository();
  let repository: GraphqlProjectRepository;
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
      agent: null,
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
      expect(project).toMatchObject({
        id: 'PVT_kwHOAGJHa84AFhgF',
        url: 'https://github.com/users/HiromiShikata/projects/49',
        databaseId: 1447941,
        name: 'V2 project on owner for testing',
        nextActionDate: {
          fieldId: 'PVTF_lAHOAGJHa84AFhgFzgVlnK4',
          name: 'NextActionDate',
        },
        remainingEstimationMinutes: null,
        story: {
          fieldId: 'PVTSSF_lAHOAGJHa84AFhgFzg1oBms',
          databaseId: 224921195,
          name: 'Story',
        },
        completionDate50PercentConfidence: null,
        agent: null,

        status: {
          fieldId: 'PVTSSF_lAHOAGJHa84AFhgFzgDLt0c',
          name: 'Status',
        },
      });

      if (project === null) {
        throw new Error('repository.getProject unexpectedly returned null');
      }
      expectEveryFieldOptionIsWellFormedRegardlessOfLiveContent(
        project.status.statuses,
      );
      expectNextActionHourIsWellFormedOrNull(project.nextActionHour);

      if (project.story === null) {
        throw new Error(
          'project.story unexpectedly returned null on a project with a Story field',
        );
      }
      expectEveryFieldOptionIsWellFormedRegardlessOfLiveContent(
        project.story.stories,
      );
      expectWorkflowManagementStoryIsWellFormed(
        project.story.workflowManagementStory,
      );
    });

    it('should return the same project from the REST read as from the GraphQL cold start read', async () => {
      const fromGraphql = await repository.getProject(projectId);
      const fromRest = await repository.getProject(projectId);

      expect(fromRest).toEqual(fromGraphql);
    }, 60000);
  });
});
