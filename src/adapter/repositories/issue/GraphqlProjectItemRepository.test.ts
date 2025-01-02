import { GraphqlProjectItemRepository } from './GraphqlProjectItemRepository';
import { LocalStorageRepository } from '../LocalStorageRepository';

describe('GraphqlProjectItemRepository', () => {
  const localStorageRepository = new LocalStorageRepository();
  let repository: GraphqlProjectItemRepository;

  beforeEach(() => {
    repository = new GraphqlProjectItemRepository(
      localStorageRepository,
      '',
      process.env.GH_TOKEN,
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
});
