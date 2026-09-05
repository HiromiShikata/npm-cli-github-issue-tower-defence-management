import { BaseGitHubRepository } from './BaseGitHubRepository';
import { LocalStorageRepository } from './LocalStorageRepository';

const localStorageRepository = new LocalStorageRepository();

class TestGitHubRepository extends BaseGitHubRepository {
  constructor(
    ghToken?: string,
    readGhTokens: string[] = [],
  ) {
    super(localStorageRepository, ghToken ?? process.env.GH_TOKEN, readGhTokens);
  }
  extractIssueFromUrlPublic = this.extractIssueFromUrl;
  selectReadTokenPublic(): string {
    return this.selectReadToken();
  }
}

describe('BaseGitHubRepository', () => {
  describe('extractIssueFromUrl', () => {
    it('should return issue number', () => {
      const repo = new TestGitHubRepository();
      const extracted = repo.extractIssueFromUrlPublic(
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

  describe('selectReadToken', () => {
    it('returns the manager token when readGhTokens is empty', () => {
      const repo = new TestGitHubRepository('manager-token', []);
      expect(repo.selectReadTokenPublic()).toBe('manager-token');
    });

    it('returns the single read token when readGhTokens has one entry', () => {
      const repo = new TestGitHubRepository('manager-token', ['read-token-1']);
      expect(repo.selectReadTokenPublic()).toBe('read-token-1');
    });

    it('does not return the manager token when readGhTokens is set', () => {
      const repo = new TestGitHubRepository('manager-token', ['read-token-1']);
      expect(repo.selectReadTokenPublic()).not.toBe('manager-token');
    });

    it('cycles through multiple read tokens in round-robin order', () => {
      const repo = new TestGitHubRepository('manager-token', [
        'read-token-a',
        'read-token-b',
        'read-token-c',
      ]);
      expect(repo.selectReadTokenPublic()).toBe('read-token-a');
      expect(repo.selectReadTokenPublic()).toBe('read-token-b');
      expect(repo.selectReadTokenPublic()).toBe('read-token-c');
      expect(repo.selectReadTokenPublic()).toBe('read-token-a');
    });

    it('wraps around after exhausting all read tokens', () => {
      const repo = new TestGitHubRepository('manager-token', [
        'token-x',
        'token-y',
      ]);
      repo.selectReadTokenPublic();
      repo.selectReadTokenPublic();
      expect(repo.selectReadTokenPublic()).toBe('token-x');
    });
  });
});
