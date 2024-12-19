import { GraphqlProjectRepository } from './GraphqlProjectRepository';

describe('GraphqlProjectRepository', () => {
  let repository: GraphqlProjectRepository;
  const token = process.env.GH_TOKEN;
  const login = 'HiromiShikata';
  const projectUrl = `https://github.com/users/HiromiShikata/projects/49`;
  const projectNumber = 49;
  const projectId = 'PVT_kwHOAGJHa84AFhgF';

  beforeEach(() => {
    repository = new GraphqlProjectRepository(token);
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
});
