import { SubscriptionDisabledIssueUseCase } from './SubscriptionDisabledIssueUseCase';
import { IssueRepository } from './adapter-interfaces/IssueRepository';

type MockedIssueRepository = {
  searchIssue: jest.Mock;
  createNewIssue: jest.Mock;
  createCommentByUrl: jest.Mock;
};

const mockIssueRepository = (): MockedIssueRepository => ({
  searchIssue: jest.fn(),
  createNewIssue: jest.fn(),
  createCommentByUrl: jest.fn(),
});

const buildEntry = (name: string, subscriptionDisabled: boolean) => ({
  name,
  subscriptionDisabled,
});

const ORG = 'test-org';
const REPO = 'test-repo';

describe('SubscriptionDisabledIssueUseCase', () => {
  describe('when no tokens are disabled', () => {
    it('does not create any issue or comment', async () => {
      const repository = mockIssueRepository();
      const useCase = new SubscriptionDisabledIssueUseCase(
        repository as unknown as Pick<
          IssueRepository,
          'searchIssue' | 'createNewIssue' | 'createCommentByUrl'
        >,
      );

      await useCase.run({
        tokenEntries: [buildEntry('dev1', false), buildEntry('dev2', false)],
        org: ORG,
        repo: REPO,
      });

      expect(repository.searchIssue).not.toHaveBeenCalled();
      expect(repository.createNewIssue).not.toHaveBeenCalled();
      expect(repository.createCommentByUrl).not.toHaveBeenCalled();
    });
  });

  describe('when a token is disabled and no open issue exists', () => {
    it('creates a new issue naming the token by display name only', async () => {
      const repository = mockIssueRepository();
      repository.searchIssue.mockResolvedValue([]);
      repository.createNewIssue.mockResolvedValue(42);

      const useCase = new SubscriptionDisabledIssueUseCase(
        repository as unknown as Pick<
          IssueRepository,
          'searchIssue' | 'createNewIssue' | 'createCommentByUrl'
        >,
      );

      await useCase.run({
        tokenEntries: [buildEntry('dev3', true)],
        org: ORG,
        repo: REPO,
      });

      expect(repository.searchIssue).toHaveBeenCalledWith({
        owner: ORG,
        repositoryName: REPO,
        type: 'issue',
        state: 'open',
        title: 'Restore Claude subscription access for dev3',
      });
      expect(repository.createNewIssue).toHaveBeenCalledWith(
        ORG,
        REPO,
        'Restore Claude subscription access for dev3',
        expect.stringContaining('dev3'),
        [],
        [],
      );
      expect(repository.createCommentByUrl).not.toHaveBeenCalled();
    });

    it('does not include the token value in the issue body', async () => {
      const repository = mockIssueRepository();
      repository.searchIssue.mockResolvedValue([]);
      repository.createNewIssue.mockResolvedValue(1);

      const useCase = new SubscriptionDisabledIssueUseCase(
        repository as unknown as Pick<
          IssueRepository,
          'searchIssue' | 'createNewIssue' | 'createCommentByUrl'
        >,
      );

      const SECRET_TOKEN = 'sk-ant-secret-abc123';
      await useCase.run({
        tokenEntries: [{ name: 'dev3', subscriptionDisabled: true }],
        org: ORG,
        repo: REPO,
      });

      const callArgs = repository.createNewIssue.mock.calls[0];
      const body: string = callArgs[3];
      expect(body).not.toContain(SECRET_TOKEN);
    });
  });

  describe('when a token is disabled and an open issue already exists', () => {
    it('comments on the existing issue instead of creating a new one', async () => {
      const repository = mockIssueRepository();
      const existingIssueUrl =
        'https://github.com/test-org/test-repo/issues/99';
      repository.searchIssue.mockResolvedValue([
        {
          url: existingIssueUrl,
          title: 'Restore Claude subscription access for dev3',
          number: '99',
        },
      ]);
      repository.createCommentByUrl.mockResolvedValue(undefined);

      const useCase = new SubscriptionDisabledIssueUseCase(
        repository as unknown as Pick<
          IssueRepository,
          'searchIssue' | 'createNewIssue' | 'createCommentByUrl'
        >,
      );

      await useCase.run({
        tokenEntries: [buildEntry('dev3', true)],
        org: ORG,
        repo: REPO,
      });

      expect(repository.createNewIssue).not.toHaveBeenCalled();
      expect(repository.createCommentByUrl).toHaveBeenCalledWith(
        existingIssueUrl,
        expect.stringContaining('dev3'),
      );
    });
  });

  describe('when multiple tokens have different states', () => {
    it('only handles disabled tokens', async () => {
      const repository = mockIssueRepository();
      repository.searchIssue.mockResolvedValue([]);
      repository.createNewIssue.mockResolvedValue(1);

      const useCase = new SubscriptionDisabledIssueUseCase(
        repository as unknown as Pick<
          IssueRepository,
          'searchIssue' | 'createNewIssue' | 'createCommentByUrl'
        >,
      );

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

      expect(repository.searchIssue).toHaveBeenCalledTimes(2);
      expect(repository.createNewIssue).toHaveBeenCalledTimes(2);
      expect(repository.searchIssue).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Restore Claude subscription access for dev2',
        }),
      );
      expect(repository.searchIssue).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Restore Claude subscription access for dev4',
        }),
      );
    });
  });

  describe('when the token list is empty', () => {
    it('does nothing', async () => {
      const repository = mockIssueRepository();
      const useCase = new SubscriptionDisabledIssueUseCase(
        repository as unknown as Pick<
          IssueRepository,
          'searchIssue' | 'createNewIssue' | 'createCommentByUrl'
        >,
      );

      await useCase.run({
        tokenEntries: [],
        org: ORG,
        repo: REPO,
      });

      expect(repository.searchIssue).not.toHaveBeenCalled();
      expect(repository.createNewIssue).not.toHaveBeenCalled();
      expect(repository.createCommentByUrl).not.toHaveBeenCalled();
    });
  });

  describe('when searchIssue returns issues but none with exact title match', () => {
    it('creates a new issue when title does not exactly match', async () => {
      const repository = mockIssueRepository();
      repository.searchIssue.mockResolvedValue([
        {
          url: 'https://github.com/test-org/test-repo/issues/5',
          title: 'Restore Claude subscription access for dev3-old',
          number: '5',
        },
      ]);
      repository.createNewIssue.mockResolvedValue(6);

      const useCase = new SubscriptionDisabledIssueUseCase(
        repository as unknown as Pick<
          IssueRepository,
          'searchIssue' | 'createNewIssue' | 'createCommentByUrl'
        >,
      );

      await useCase.run({
        tokenEntries: [buildEntry('dev3', true)],
        org: ORG,
        repo: REPO,
      });

      expect(repository.createNewIssue).toHaveBeenCalledWith(
        ORG,
        REPO,
        'Restore Claude subscription access for dev3',
        expect.any(String),
        [],
        [],
      );
      expect(repository.createCommentByUrl).not.toHaveBeenCalled();
    });
  });
});
