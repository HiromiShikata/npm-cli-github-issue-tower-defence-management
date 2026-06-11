import { TriageViewerServerStartUseCase } from './TriageViewerServerStartUseCase';
import { TriageRepository } from './adapter-interfaces/TriageRepository';
import { TriageData } from '../entities/TriageIssue';

const makeTriageData = (): TriageData => ({
  issues: [
    {
      number: 1,
      title: 'Untriaged issue',
      body: 'Body text',
      url: 'https://github.com/owner/repo/issues/1',
      owner: 'owner',
      repo: 'repo',
      itemId: 'item-1',
    },
  ],
  storyOptions: [
    { id: 'story-1', name: 'Story A', color: 'BLUE' },
    { id: 'story-2', name: 'Story B', color: 'GREEN' },
  ],
  storyFieldId: 'field-1',
  projectId: 'project-1',
});

const makeRepository = (): jest.Mocked<TriageRepository> => ({
  getTriageData: jest.fn().mockResolvedValue(makeTriageData()),
  setStory: jest.fn().mockResolvedValue(undefined),
  closeIssue: jest.fn().mockResolvedValue(undefined),
  fetchImageProxy: jest.fn().mockResolvedValue({
    content: Buffer.from('image data'),
    contentType: 'image/png',
  }),
});

describe('TriageViewerServerStartUseCase', () => {
  describe('getTriageData', () => {
    it('returns triage data from repository', async () => {
      const repository = makeRepository();
      const useCase = new TriageViewerServerStartUseCase(repository);

      const result = await useCase.getTriageData(
        'https://github.com/orgs/owner/projects/1',
      );

      expect(result).toEqual(makeTriageData());
      expect(repository.getTriageData).toHaveBeenCalledWith(
        'https://github.com/orgs/owner/projects/1',
      );
    });
  });

  describe('setStory', () => {
    it('returns ok true on success', async () => {
      const repository = makeRepository();
      const useCase = new TriageViewerServerStartUseCase(repository);

      const result = await useCase.setStory({
        projectId: 'project-1',
        storyFieldId: 'field-1',
        itemId: 'item-1',
        storyOptionId: 'story-1',
      });

      expect(result).toEqual({ ok: true });
      expect(repository.setStory).toHaveBeenCalledWith(
        'project-1',
        'field-1',
        'item-1',
        'story-1',
      );
    });

    it('returns ok false with error message on repository failure', async () => {
      const repository = makeRepository();
      repository.setStory.mockRejectedValue(new Error('GraphQL error'));
      const useCase = new TriageViewerServerStartUseCase(repository);

      const result = await useCase.setStory({
        projectId: 'project-1',
        storyFieldId: 'field-1',
        itemId: 'item-1',
        storyOptionId: 'story-1',
      });

      expect(result).toEqual({ ok: false, error: 'GraphQL error' });
    });
  });

  describe('closeIssue', () => {
    it('returns ok true on success', async () => {
      const repository = makeRepository();
      const useCase = new TriageViewerServerStartUseCase(repository);

      const result = await useCase.closeIssue({
        owner: 'owner',
        repo: 'repo',
        issueNumber: 1,
        reason: 'completed',
      });

      expect(result).toEqual({ ok: true });
      expect(repository.closeIssue).toHaveBeenCalledWith(
        'owner',
        'repo',
        1,
        'completed',
      );
    });

    it('returns ok false with error message on repository failure', async () => {
      const repository = makeRepository();
      repository.closeIssue.mockRejectedValue(new Error('REST error'));
      const useCase = new TriageViewerServerStartUseCase(repository);

      const result = await useCase.closeIssue({
        owner: 'owner',
        repo: 'repo',
        issueNumber: 1,
        reason: 'not_planned',
      });

      expect(result).toEqual({ ok: false, error: 'REST error' });
    });

    it('handles duplicate close reason', async () => {
      const repository = makeRepository();
      const useCase = new TriageViewerServerStartUseCase(repository);

      const result = await useCase.closeIssue({
        owner: 'owner',
        repo: 'repo',
        issueNumber: 1,
        reason: 'duplicate',
      });

      expect(result).toEqual({ ok: true });
      expect(repository.closeIssue).toHaveBeenCalledWith(
        'owner',
        'repo',
        1,
        'duplicate',
      );
    });
  });

  describe('fetchImageProxy', () => {
    it('delegates to repository', async () => {
      const repository = makeRepository();
      const useCase = new TriageViewerServerStartUseCase(repository);

      const result = await useCase.fetchImageProxy(
        'https://github.com/user-images/test.png',
      );

      expect(result).toEqual({
        content: Buffer.from('image data'),
        contentType: 'image/png',
      });
      expect(repository.fetchImageProxy).toHaveBeenCalledWith(
        'https://github.com/user-images/test.png',
      );
    });
  });
});
