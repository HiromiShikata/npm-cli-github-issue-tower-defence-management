import { RestIssueRepository } from './RestIssueRepository';
import { LocalStorageRepository } from '../LocalStorageRepository';

describe('RestIssueRepository', () => {
  const localStorageRepository = new LocalStorageRepository();
  const restIssueRepository: RestIssueRepository = new RestIssueRepository(
    localStorageRepository,
    '',
    process.env.GH_TOKEN || 'dummy',
  );

  describe('createComment', () => {
    it('should create a comment', async () => {
      await restIssueRepository.createComment(
        'https://github.com/HiromiShikata/test-repository/issues/40',
        'test comment',
      );
    });
  });
  describe('createNewIssue', () => {
    it('should create a new issue', async () => {
      await restIssueRepository.createNewIssue(
        'HiromiShikata',
        'test-repository',
        'test issue',
        'test body',
        ['HiromiShikata'],
        ['test'],
      );
    });
  });
});
