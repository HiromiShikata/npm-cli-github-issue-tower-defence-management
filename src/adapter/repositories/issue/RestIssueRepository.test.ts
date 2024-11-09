import { RestIssueRepository } from './RestIssueRepository';

describe('RestIssueRepository', () => {
  const restIssueRepository: RestIssueRepository = new RestIssueRepository(
    '',
    process.env.TEST_BOT_GH_TOKEN || 'dummy',
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
