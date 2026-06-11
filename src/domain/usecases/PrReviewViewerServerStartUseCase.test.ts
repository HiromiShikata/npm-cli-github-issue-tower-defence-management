import { PrReviewViewerServerStartUseCase } from './PrReviewViewerServerStartUseCase';
import {
  PrReviewViewerListRepository,
  PrReviewViewerDetailRepository,
  PrReviewRepository,
  PrReviewDoneRepository,
  IssueTitleCacheRepository,
} from './adapter-interfaces/PrReviewViewerRepository';
import { PrReviewViewerItem } from '../entities/PrReviewViewerItem';

const makeItem = (
  overrides: Partial<PrReviewViewerItem> = {},
): PrReviewViewerItem => ({
  issue: {
    number: 1,
    title: 'Issue title',
    author: 'author',
    url: 'https://github.com/owner/repo/issues/1',
    story: null,
    projectItemId: 'PVTI_item1',
  },
  pr: {
    number: 42,
    repo: 'owner/repo',
    title: 'PR title',
    additions: 10,
    deletions: 5,
    changedFiles: 3,
    url: 'https://github.com/owner/repo/pull/42',
  },
  ...overrides,
});

const makeListRepo = (
  items: PrReviewViewerItem[] = [makeItem()],
): jest.Mocked<PrReviewViewerListRepository> => ({
  getList: jest.fn().mockResolvedValue(items),
});

const makeDetailRepo = (): jest.Mocked<PrReviewViewerDetailRepository> => ({
  getDetail: jest.fn().mockResolvedValue({ body: 'pr body' }),
});

const makeReviewRepo = (): jest.Mocked<PrReviewRepository> => ({
  approve: jest.fn().mockResolvedValue(undefined),
  requestChanges: jest.fn().mockResolvedValue(undefined),
  comment: jest.fn().mockResolvedValue(undefined),
  createComment: jest.fn().mockResolvedValue(undefined),
  closePullRequest: jest.fn().mockResolvedValue(undefined),
  addLabel: jest.fn().mockResolvedValue(undefined),
  updateProjectItemStatus: jest.fn().mockResolvedValue(undefined),
  getFileContent: jest
    .fn()
    .mockResolvedValue({ content: Buffer.from('data'), contentType: 'image/png' }),
  getIssueOrPrTitle: jest.fn().mockResolvedValue({
    title: 'Some title',
    state: 'open',
    isPR: false,
    url: 'https://github.com/owner/repo/issues/1',
  }),
});

const makeDoneRepo = (): jest.Mocked<PrReviewDoneRepository> => ({
  markDone: jest.fn().mockResolvedValue(undefined),
  isDone: jest.fn().mockResolvedValue(false),
  getAllDone: jest.fn().mockResolvedValue([]),
});

const makeTitleCacheRepo = (): jest.Mocked<IssueTitleCacheRepository> => ({
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
});

const makeUseCase = (
  overrides: {
    listRepo?: jest.Mocked<PrReviewViewerListRepository>;
    detailRepo?: jest.Mocked<PrReviewViewerDetailRepository>;
    reviewRepo?: jest.Mocked<PrReviewRepository>;
    doneRepo?: jest.Mocked<PrReviewDoneRepository>;
    titleCacheRepo?: jest.Mocked<IssueTitleCacheRepository>;
  } = {},
) => {
  const listRepo = overrides.listRepo ?? makeListRepo();
  const detailRepo = overrides.detailRepo ?? makeDetailRepo();
  const reviewRepo = overrides.reviewRepo ?? makeReviewRepo();
  const doneRepo = overrides.doneRepo ?? makeDoneRepo();
  const titleCacheRepo = overrides.titleCacheRepo ?? makeTitleCacheRepo();
  const useCase = new PrReviewViewerServerStartUseCase(
    listRepo,
    detailRepo,
    reviewRepo,
    doneRepo,
    titleCacheRepo,
  );
  return { useCase, listRepo, detailRepo, reviewRepo, doneRepo, titleCacheRepo };
};

describe('PrReviewViewerServerStartUseCase', () => {
  describe('getList', () => {
    it('returns all items when none are done', async () => {
      const { useCase, doneRepo } = makeUseCase();
      doneRepo.getAllDone.mockResolvedValue([]);
      const result = await useCase.getList('myproject');
      expect(result).toHaveLength(1);
    });

    it('excludes done PRs from the list', async () => {
      const { useCase, doneRepo } = makeUseCase();
      doneRepo.getAllDone.mockResolvedValue([
        { owner: 'owner', repo: 'repo', prNumber: 42 },
      ]);
      const result = await useCase.getList('myproject');
      expect(result).toHaveLength(0);
    });

    it('includes PRs that are not in the done set', async () => {
      const items = [makeItem(), makeItem({ pr: { ...makeItem().pr, number: 99 } })];
      const { useCase, doneRepo } = makeUseCase({ listRepo: makeListRepo(items) });
      doneRepo.getAllDone.mockResolvedValue([
        { owner: 'owner', repo: 'repo', prNumber: 42 },
      ]);
      const result = await useCase.getList('myproject');
      expect(result).toHaveLength(1);
      expect(result[0].pr.number).toBe(99);
    });
  });

  describe('getDetail', () => {
    it('returns detail from repository', async () => {
      const { useCase, detailRepo } = makeUseCase();
      detailRepo.getDetail.mockResolvedValue({ body: 'pr body', files: [] });
      const result = await useCase.getDetail('proj', 'owner__repo', 42);
      expect(result).toEqual({ body: 'pr body', files: [] });
      expect(detailRepo.getDetail).toHaveBeenCalledWith('proj', 'owner__repo', 42);
    });

    it('returns null when detail not found', async () => {
      const { useCase, detailRepo } = makeUseCase();
      detailRepo.getDetail.mockResolvedValue(null);
      const result = await useCase.getDetail('proj', 'owner__repo', 99);
      expect(result).toBeNull();
    });
  });

  describe('executeReview - APPROVE', () => {
    it('calls approve, updates project status, and marks done', async () => {
      const { useCase, reviewRepo, doneRepo } = makeUseCase();
      const result = await useCase.executeReview('proj', {
        action: 'APPROVE',
        repo: 'owner/repo',
        prNumber: 42,
        projectItemId: 'PVTI_item1',
        projectId: 'PVT_proj1',
        statusFieldId: 'PVTF_field1',
        awaitingWorkspaceStatusOptionId: 'opt_aw',
      });
      expect(result).toEqual({ ok: true });
      expect(reviewRepo.approve).toHaveBeenCalledWith(
        'owner',
        'repo',
        42,
        undefined,
        undefined,
      );
      expect(reviewRepo.updateProjectItemStatus).toHaveBeenCalledWith(
        'PVT_proj1',
        'PVTF_field1',
        'PVTI_item1',
        'opt_aw',
      );
      expect(doneRepo.markDone).toHaveBeenCalledWith('owner', 'repo', 42);
    });

    it('returns error when approve throws', async () => {
      const { useCase, reviewRepo } = makeUseCase();
      reviewRepo.approve.mockRejectedValue(
        new Error('Can not approve your own pull request'),
      );
      const result = await useCase.executeReview('proj', {
        action: 'APPROVE',
        repo: 'owner/repo',
        prNumber: 42,
        projectItemId: 'PVTI_item1',
        projectId: 'PVT_proj1',
        statusFieldId: 'PVTF_field1',
        awaitingWorkspaceStatusOptionId: 'opt_aw',
      });
      expect(result).toEqual({
        ok: false,
        error: 'Can not approve your own pull request',
      });
    });
  });

  describe('executeReview - REQUEST_CHANGES', () => {
    it('calls requestChanges, updates project status, and marks done', async () => {
      const { useCase, reviewRepo, doneRepo } = makeUseCase();
      const result = await useCase.executeReview('proj', {
        action: 'REQUEST_CHANGES',
        repo: 'owner/repo',
        prNumber: 42,
        projectItemId: 'PVTI_item1',
        projectId: 'PVT_proj1',
        statusFieldId: 'PVTF_field1',
        awaitingWorkspaceStatusOptionId: 'opt_aw',
        body: 'Needs work',
      });
      expect(result).toEqual({ ok: true });
      expect(reviewRepo.requestChanges).toHaveBeenCalledWith(
        'owner',
        'repo',
        42,
        'Needs work',
        undefined,
      );
      expect(reviewRepo.updateProjectItemStatus).toHaveBeenCalled();
      expect(doneRepo.markDone).toHaveBeenCalledWith('owner', 'repo', 42);
    });
  });

  describe('executeReview - COMMENT', () => {
    it('calls comment but does not update project status or mark done', async () => {
      const { useCase, reviewRepo, doneRepo } = makeUseCase();
      const result = await useCase.executeReview('proj', {
        action: 'COMMENT',
        repo: 'owner/repo',
        prNumber: 42,
        projectItemId: 'PVTI_item1',
        projectId: 'PVT_proj1',
        statusFieldId: 'PVTF_field1',
        awaitingWorkspaceStatusOptionId: 'opt_aw',
        body: 'LGTM',
      });
      expect(result).toEqual({ ok: true });
      expect(reviewRepo.comment).toHaveBeenCalledWith(
        'owner',
        'repo',
        42,
        'LGTM',
        undefined,
      );
      expect(reviewRepo.updateProjectItemStatus).not.toHaveBeenCalled();
      expect(doneRepo.markDone).not.toHaveBeenCalled();
    });
  });

  describe('executeReview - CLOSE_WRONG', () => {
    it('posts "totally wrong" comment and closes PR', async () => {
      const { useCase, reviewRepo, doneRepo } = makeUseCase();
      const result = await useCase.executeReview('proj', {
        action: 'CLOSE_WRONG',
        repo: 'owner/repo',
        prNumber: 42,
        projectItemId: 'PVTI_item1',
        projectId: 'PVT_proj1',
        statusFieldId: 'PVTF_field1',
        awaitingWorkspaceStatusOptionId: 'opt_aw',
      });
      expect(result).toEqual({ ok: true });
      expect(reviewRepo.createComment).toHaveBeenCalledWith(
        'owner',
        'repo',
        42,
        'totally wrong',
      );
      expect(reviewRepo.closePullRequest).toHaveBeenCalledWith('owner', 'repo', 42);
      expect(reviewRepo.updateProjectItemStatus).not.toHaveBeenCalled();
      expect(doneRepo.markDone).toHaveBeenCalledWith('owner', 'repo', 42);
    });
  });

  describe('executeReview - CLOSE_UNNEEDED', () => {
    it('posts comment, adds chore label to linked issue, closes PR', async () => {
      const item = makeItem({
        issue: {
          number: 1,
          title: 'Issue',
          author: 'author',
          url: 'https://github.com/issueowner/issuerepo/issues/1',
          story: null,
          projectItemId: 'PVTI_item1',
        },
        pr: {
          number: 42,
          repo: 'owner/repo',
          title: 'PR',
          additions: 1,
          deletions: 0,
          changedFiles: 1,
          url: 'https://github.com/owner/repo/pull/42',
        },
      });
      const listRepo = makeListRepo([item]);
      const { useCase, reviewRepo, doneRepo } = makeUseCase({ listRepo });
      const result = await useCase.executeReview('proj', {
        action: 'CLOSE_UNNEEDED',
        repo: 'owner/repo',
        prNumber: 42,
        projectItemId: 'PVTI_item1',
        projectId: 'PVT_proj1',
        statusFieldId: 'PVTF_field1',
        awaitingWorkspaceStatusOptionId: 'opt_aw',
      });
      expect(result).toEqual({ ok: true });
      expect(reviewRepo.createComment).toHaveBeenCalledWith(
        'owner',
        'repo',
        42,
        'This pull request is unnecessary.',
      );
      expect(reviewRepo.addLabel).toHaveBeenCalledWith(
        'issueowner',
        'issuerepo',
        1,
        'chore',
      );
      expect(reviewRepo.closePullRequest).toHaveBeenCalledWith('owner', 'repo', 42);
      expect(doneRepo.markDone).toHaveBeenCalledWith('owner', 'repo', 42);
    });
  });

  describe('executeReview - invalid inputs', () => {
    it('returns error for invalid repo format', async () => {
      const { useCase } = makeUseCase();
      const result = await useCase.executeReview('proj', {
        action: 'APPROVE',
        repo: 'invalidrepo',
        prNumber: 42,
        projectItemId: '',
        projectId: '',
        statusFieldId: '',
        awaitingWorkspaceStatusOptionId: '',
      });
      expect(result.ok).toBe(false);
      if (result.ok === false) {
        expect(result.error).toContain('Invalid repo format');
      }
    });
  });

  describe('executeReview - markDone failure is non-fatal', () => {
    it('returns ok:true even when markDone throws', async () => {
      const { useCase, doneRepo } = makeUseCase();
      doneRepo.markDone.mockRejectedValue(new Error('disk full'));
      const result = await useCase.executeReview('proj', {
        action: 'APPROVE',
        repo: 'owner/repo',
        prNumber: 42,
        projectItemId: 'PVTI_item1',
        projectId: 'PVT_proj1',
        statusFieldId: 'PVTF_field1',
        awaitingWorkspaceStatusOptionId: 'opt_aw',
      });
      expect(result).toEqual({ ok: true });
    });
  });

  describe('getFileContent', () => {
    it('delegates to prReviewRepository', async () => {
      const { useCase, reviewRepo } = makeUseCase();
      const result = await useCase.getFileContent(
        'owner',
        'repo',
        'path/to/file.png',
        'main',
        'abc123',
      );
      expect(result).toEqual({
        content: Buffer.from('data'),
        contentType: 'image/png',
      });
      expect(reviewRepo.getFileContent).toHaveBeenCalledWith(
        'owner',
        'repo',
        'path/to/file.png',
        'main',
        'abc123',
      );
    });
  });

  describe('getIssueTitleInfo', () => {
    it('returns cached value when available', async () => {
      const cached = {
        title: 'Cached title',
        state: 'open',
        isPR: false,
        url: 'https://github.com/owner/repo/issues/1',
      };
      const titleCacheRepo = makeTitleCacheRepo();
      titleCacheRepo.get.mockResolvedValue(cached);
      const { useCase, reviewRepo } = makeUseCase({ titleCacheRepo });
      const result = await useCase.getIssueTitleInfo('owner', 'repo', 1);
      expect(result).toEqual(cached);
      expect(reviewRepo.getIssueOrPrTitle).not.toHaveBeenCalled();
    });

    it('fetches from GitHub when not cached and stores result', async () => {
      const fetched = {
        title: 'GitHub title',
        state: 'closed',
        isPR: true,
        url: 'https://github.com/owner/repo/pull/2',
      };
      const titleCacheRepo = makeTitleCacheRepo();
      titleCacheRepo.get.mockResolvedValue(null);
      const reviewRepo = makeReviewRepo();
      reviewRepo.getIssueOrPrTitle.mockResolvedValue(fetched);
      const { useCase } = makeUseCase({ titleCacheRepo, reviewRepo });
      const result = await useCase.getIssueTitleInfo('owner', 'repo', 2);
      expect(result).toEqual(fetched);
      expect(titleCacheRepo.set).toHaveBeenCalledWith('owner', 'repo', 2, fetched);
    });
  });
});
