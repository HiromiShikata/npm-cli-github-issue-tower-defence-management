import { mock } from 'jest-mock-extended';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { SubscriptionDisabledIssueUseCase } from './SubscriptionDisabledIssueUseCase';

const ORG = 'test-org';
const REPO = 'test-repo';

const buildEntry = (name: string, subscriptionDisabled: boolean) => ({
  name,
  subscriptionDisabled,
});

describe('SubscriptionDisabledIssueUseCase', () => {
  describe('when no tokens are disabled', () => {
    it('does not create any issue or comment', async () => {
      const mockIssueRepository = mock<IssueRepository>();

      const useCase = new SubscriptionDisabledIssueUseCase(mockIssueRepository);

      await useCase.run({
        tokenEntries: [buildEntry('dev1', false), buildEntry('dev2', false)],
        org: ORG,
        repo: REPO,
      });

      expect(mockIssueRepository.searchIssue.mock.calls).toHaveLength(0);
      expect(mockIssueRepository.createNewIssue.mock.calls).toHaveLength(0);
      expect(mockIssueRepository.createCommentByUrl.mock.calls).toHaveLength(0);
    });
  });

  describe('when a token is disabled and no open issue exists', () => {
    it('creates a new issue naming the token by display name only', async () => {
      const mockIssueRepository = mock<IssueRepository>();
      mockIssueRepository.searchIssue.mockResolvedValue([]);
      mockIssueRepository.createNewIssue.mockResolvedValue(42);

      const useCase = new SubscriptionDisabledIssueUseCase(mockIssueRepository);

      await useCase.run({
        tokenEntries: [buildEntry('dev3', true)],
        org: ORG,
        repo: REPO,
      });

      expect(mockIssueRepository.searchIssue.mock.calls).toHaveLength(1);
      expect(mockIssueRepository.searchIssue.mock.calls[0][0]).toEqual({
        owner: ORG,
        repositoryName: REPO,
        type: 'issue',
        state: 'open',
        title: 'Restore Claude subscription access for dev3',
      });
      expect(mockIssueRepository.createNewIssue.mock.calls).toHaveLength(1);
      expect(mockIssueRepository.createNewIssue.mock.calls[0][0]).toBe(ORG);
      expect(mockIssueRepository.createNewIssue.mock.calls[0][1]).toBe(REPO);
      expect(mockIssueRepository.createNewIssue.mock.calls[0][2]).toBe(
        'Restore Claude subscription access for dev3',
      );
      expect(mockIssueRepository.createNewIssue.mock.calls[0][3]).toContain(
        'dev3',
      );
      expect(mockIssueRepository.createNewIssue.mock.calls[0][3]).not.toContain(
        'From: :robot:',
      );
      expect(mockIssueRepository.createCommentByUrl.mock.calls).toHaveLength(0);
    });

    it('does not include the token value in the issue body', async () => {
      const mockIssueRepository = mock<IssueRepository>();
      mockIssueRepository.searchIssue.mockResolvedValue([]);
      mockIssueRepository.createNewIssue.mockResolvedValue(1);

      const useCase = new SubscriptionDisabledIssueUseCase(mockIssueRepository);

      const SECRET_TOKEN = 'sk-ant-secret-abc123';
      await useCase.run({
        tokenEntries: [{ name: 'dev3', subscriptionDisabled: true }],
        org: ORG,
        repo: REPO,
      });

      expect(mockIssueRepository.createNewIssue.mock.calls[0][3]).not.toContain(
        SECRET_TOKEN,
      );
    });
  });

  describe('when a token is disabled and an open issue already exists', () => {
    it('comments on the existing issue instead of creating a new one', async () => {
      const mockIssueRepository = mock<IssueRepository>();
      const existingIssueUrl =
        'https://github.com/test-org/test-repo/issues/99';
      mockIssueRepository.searchIssue.mockResolvedValue([
        {
          url: existingIssueUrl,
          title: 'Restore Claude subscription access for dev3',
          number: '99',
        },
      ]);

      const useCase = new SubscriptionDisabledIssueUseCase(mockIssueRepository);

      await useCase.run({
        tokenEntries: [buildEntry('dev3', true)],
        org: ORG,
        repo: REPO,
      });

      expect(mockIssueRepository.createNewIssue.mock.calls).toHaveLength(0);
      expect(mockIssueRepository.createCommentByUrl.mock.calls).toHaveLength(1);
      expect(mockIssueRepository.createCommentByUrl.mock.calls[0][0]).toBe(
        existingIssueUrl,
      );
      expect(mockIssueRepository.createCommentByUrl.mock.calls[0][1]).toContain(
        'dev3',
      );
    });
  });

  describe('when multiple tokens have different states', () => {
    it('only handles disabled tokens', async () => {
      const mockIssueRepository = mock<IssueRepository>();
      mockIssueRepository.searchIssue.mockResolvedValue([]);
      mockIssueRepository.createNewIssue.mockResolvedValue(1);

      const useCase = new SubscriptionDisabledIssueUseCase(mockIssueRepository);

      await useCase.run({
        tokenEntries: [
          buildEntry('dev1', false),
          buildEntry('dev2', true),
          buildEntry('dev3', false),
          buildEntry('dev4', true),
        ],
        org: ORG,
        repo: REPO,
      });

      expect(mockIssueRepository.searchIssue.mock.calls).toHaveLength(2);
      expect(mockIssueRepository.createNewIssue.mock.calls).toHaveLength(2);
      expect(mockIssueRepository.searchIssue.mock.calls[0][0]).toEqual(
        expect.objectContaining({
          title: 'Restore Claude subscription access for dev2',
        }),
      );
      expect(mockIssueRepository.searchIssue.mock.calls[1][0]).toEqual(
        expect.objectContaining({
          title: 'Restore Claude subscription access for dev4',
        }),
      );
    });
  });

  describe('when the token list is empty', () => {
    it('does nothing', async () => {
      const mockIssueRepository = mock<IssueRepository>();

      const useCase = new SubscriptionDisabledIssueUseCase(mockIssueRepository);

      await useCase.run({
        tokenEntries: [],
        org: ORG,
        repo: REPO,
      });

      expect(mockIssueRepository.searchIssue.mock.calls).toHaveLength(0);
      expect(mockIssueRepository.createNewIssue.mock.calls).toHaveLength(0);
      expect(mockIssueRepository.createCommentByUrl.mock.calls).toHaveLength(0);
    });
  });

  describe('when searchIssue returns issues but none with exact title match', () => {
    it('creates a new issue when title does not exactly match', async () => {
      const mockIssueRepository = mock<IssueRepository>();
      mockIssueRepository.searchIssue.mockResolvedValue([
        {
          url: 'https://github.com/test-org/test-repo/issues/5',
          title: 'Restore Claude subscription access for dev3-old',
          number: '5',
        },
      ]);
      mockIssueRepository.createNewIssue.mockResolvedValue(6);

      const useCase = new SubscriptionDisabledIssueUseCase(mockIssueRepository);

      await useCase.run({
        tokenEntries: [buildEntry('dev3', true)],
        org: ORG,
        repo: REPO,
      });

      expect(mockIssueRepository.createNewIssue.mock.calls).toHaveLength(1);
      expect(mockIssueRepository.createNewIssue.mock.calls[0][2]).toBe(
        'Restore Claude subscription access for dev3',
      );
      expect(mockIssueRepository.createCommentByUrl.mock.calls).toHaveLength(0);
    });
  });
});
