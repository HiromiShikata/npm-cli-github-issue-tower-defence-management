import { BaseGitHubRepository } from './BaseGitHubRepository';
import { LocalStorageRepository } from './LocalStorageRepository';
describe('BaseGitHubRepository', () => {
  const localStorageRepository = new LocalStorageRepository();
  class TestGitHubRepository extends BaseGitHubRepository {
    constructor() {
      super(localStorageRepository, process.env.GH_TOKEN);
    }
    extractIssueFromUrlPublic = this.extractIssueFromUrl;
  }
  const baseGitHubRepository: TestGitHubRepository = new TestGitHubRepository();

  describe('extractIssueFromUrl', () => {
    it('should return issue number', () => {
      const extracted = baseGitHubRepository.extractIssueFromUrlPublic(
        'https://github.com/HiromiShikata/test-repository/issues/38',
      );
      expect(extracted).toEqual({
        owner: 'HiromiShikata',
        repo: 'test-repository',
        issueNumber: 38,
        isIssue: true,
      });
    });
  });
});
