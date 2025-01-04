import { GraphqlProjectItemRepository } from './GraphqlProjectItemRepository';
import { LocalStorageRepository } from '../LocalStorageRepository';
import { RestIssueRepository } from './RestIssueRepository';

describe('GraphqlProjectItemRepository', () => {
  jest.setTimeout(30 * 1000);
  const localStorageRepository = new LocalStorageRepository();
  let repository: GraphqlProjectItemRepository;

  beforeEach(() => {
    repository = new GraphqlProjectItemRepository(
      localStorageRepository,
      '',
      process.env.GH_TOKEN || 'dummy',
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

      expect(result).toHaveLength(6);
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            fieldName: expect.any(String),
            fieldValue: expect.any(String),
          }),
        ]),
      );
    });
  });

  describe('removeProjectItem', () => {
    it('should remove a project item with real GitHub integration', async () => {
      // Create a real issue in test-repository
      const restIssueRepository = new RestIssueRepository(
        localStorageRepository,
        '',
        process.env.GH_TOKEN || 'dummy',
      );
      const owner = 'HiromiShikata';
      const repositoryName = 'test-repository';
      const issueTitle = `test-issue-${Date.now()}`;
      const issueBody = 'Test issue for removeProjectItem integration test';
      const assignees = ['HiromiShikata'];
      const labels = ['test'];

      // Create issue and get its number
      const issueNumber = await restIssueRepository.createNewIssue(
        owner,
        repositoryName,
        issueTitle,
        issueBody,
        assignees,
        labels,
      );

      // Get project ID (known from GraphqlProjectRepository.test.ts)
      const projectId = 'PVT_kwHOAGJHa84AFhgF'; // Project #49

      // Get issue node ID
      const issueNodeId = await repository.fetchItemId(
        projectId,
        owner,
        repositoryName,
        issueNumber,
      );
      expect(issueNodeId).toBeDefined();

      // Add issue to project
      const projectItemId = await repository.addProjectItem(
        projectId,
        issueNodeId!,
      );
      expect(projectItemId).toBeDefined();

      // Verify item was added
      const projectItems = await repository.fetchProjectItems(projectId);
      const addedItem = projectItems.find(
        (item) =>
          item.nameWithOwner === `${owner}/${repositoryName}` &&
          item.number === issueNumber,
      );
      expect(addedItem).toBeDefined();

      // Remove item from project
      await repository.removeProjectItem(projectId, projectItemId);

      // Verify removal
      const updatedProjectItems = await repository.fetchProjectItems(projectId);
      const removedItem = updatedProjectItems.find(
        (item) =>
          item.nameWithOwner === `${owner}/${repositoryName}` &&
          item.number === issueNumber,
      );
      expect(removedItem).toBeUndefined();
    });
  });
});
