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
    it('should create a new issue and return issue number', async () => {
      const issueNumber = await restIssueRepository.createNewIssue(
        'HiromiShikata',
        'test-repository',
        'Test Issue for Project Item Removal',
        'This is a test issue created for testing project item removal.',
        ['HiromiShikata'],
        ['test'],
      );

      expect(typeof issueNumber).toBe('number');
      expect(issueNumber).toBeGreaterThan(0);

      // Verify the issue exists by creating a comment
      await expect(
        restIssueRepository.createComment(
          `https://github.com/HiromiShikata/test-repository/issues/${issueNumber}`,
          'Test comment to verify issue exists',
        ),
      ).resolves.not.toThrow();
    });

    it('should handle errors when creating an issue', async () => {
      await expect(
        restIssueRepository.createNewIssue(
          'invalid-owner',
          'invalid-repo',
          'test issue',
          'test body',
          ['invalid-user'],
          ['test'],
        ),
      ).rejects.toThrow();
    });
  });
});
