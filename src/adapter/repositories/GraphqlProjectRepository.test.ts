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
      await expect(
        repository.removeItemFromProject(projectId, testItemId),
      ).resolves.not.toThrow();
    });

    it('should throw error when project or item not found', async () => {
      const invalidItemId = 'invalid_item_id';
      await expect(
        repository.removeItemFromProject(projectId, invalidItemId),
      ).rejects.toThrow('Project or item not found');
    });
  });

  describe('removeItemFromProjectByIssueUrl', () => {
    const testIssueUrl =
      'https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/19';

    it('should remove item by issue URL successfully', async () => {
      await expect(
        repository.removeItemFromProjectByIssueUrl(projectUrl, testIssueUrl),
      ).resolves.not.toThrow();
    });

    it('should throw error when project not found', async () => {
      const invalidProjectUrl = 'https://github.com/users/HiromiShikata/projects/999';
      await expect(
        repository.removeItemFromProjectByIssueUrl(invalidProjectUrl, testIssueUrl),
      ).rejects.toThrow('Project not found');
    });

    it('should throw error when issue not found in project', async () => {
      const nonExistentIssueUrl =
        'https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/999999';
      await expect(
        repository.removeItemFromProjectByIssueUrl(projectUrl, nonExistentIssueUrl),
      ).rejects.toThrow('Item not found in project');
    });
  });
});
