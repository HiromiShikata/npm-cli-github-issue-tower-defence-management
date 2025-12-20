import { GraphqlProjectRepository } from './GraphqlProjectRepository';
import { LocalStorageRepository } from './LocalStorageRepository';

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
      expect(project.id).toBe('PVT_kwHOAGJHa84AFhgF');
      expect(project.databaseId).toBe(1447941);
      expect(project.name).toBe('V2 project on owner for testing');
      expect(project.nextActionDate).toEqual({
        fieldId: 'PVTF_lAHOAGJHa84AFhgFzgVlnK4',
        name: 'NextActionDate',
      });
      expect(project.nextActionHour).toBeNull();
      expect(project.remainingEstimationMinutes).toBeNull();
      expect(project.story).toEqual({
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
      });
      expect(project.completionDate50PercentConfidence).toBeNull();
      expect(project.dependedIssueUrlSeparatedByComma).toBeNull();
      expect(project.status.fieldId).toBe('PVTSSF_lAHOAGJHa84AFhgFzgDLt0c');
      expect(project.status.name).toBe('Status');
      expect(project.status.statuses.length).toBeGreaterThanOrEqual(3);
      expect(
        project.status.statuses.find((s) => s.name === 'Todo'),
      ).toBeDefined();
      expect(
        project.status.statuses.find((s) => s.name === 'In Progress'),
      ).toBeDefined();
      expect(
        project.status.statuses.find((s) => s.name === 'Done'),
      ).toBeDefined();
    });
  });
});
