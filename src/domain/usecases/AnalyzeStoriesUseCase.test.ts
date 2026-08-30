import { mock } from 'jest-mock-extended';
import { AnalyzeStoriesUseCase } from './AnalyzeStoriesUseCase';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { DateRepository } from './adapter-interfaces/DateRepository';
import { Project } from '../entities/Project';
import { StoryObject } from '../entities/StoryObjectMap';

describe('AnalyzeStoriesUseCase', () => {
  const mockIssueRepository = mock<IssueRepository>();
  const mockDateRepository = mock<DateRepository>();

  let useCase: AnalyzeStoriesUseCase;

  const projectWithStory: Project = {
    ...mock<Project>(),
    story: {
      name: 'Story',
      fieldId: 'story-field',
      databaseId: 1,
      stories: [],
      workflowManagementStory: { id: 'wms-id', name: 'workflow management' },
    },
  };

  const commonInput = {
    project: projectWithStory,
    issues: [],
    cacheUsed: false,
    manager: 'manager-user',
    org: 'org',
    repo: 'repo',
    urlOfStoryView: 'https://github.com/org/repo',
    storyObjectMap: new Map<string, StoryObject>(),
    members: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new AnalyzeStoriesUseCase(
      mockIssueRepository,
      mockDateRepository,
    );
  });

  describe('run — UTC 05:00 guard', () => {
    it('returns early when no targetDate is at UTC 05:00', async () => {
      const nonMatchingDate = new Date(Date.UTC(2026, 0, 15, 4, 0, 0));

      await useCase.run({ ...commonInput, targetDates: [nonMatchingDate] });

      expect(mockIssueRepository.createNewIssue).not.toHaveBeenCalled();
    });

    it('proceeds when a targetDate is exactly UTC 05:00', async () => {
      const matchingDate = new Date(Date.UTC(2026, 0, 15, 5, 0, 0));

      await useCase.run({ ...commonInput, targetDates: [matchingDate] });

      expect(mockIssueRepository.createNewIssue).toHaveBeenCalledTimes(1);
      const body = mockIssueRepository.createNewIssue.mock.calls[0][3];
      expect(body).not.toContain('From: :robot:');
    });

    it('returns early when project has no story field', async () => {
      const projectWithoutStory: Project = { ...projectWithStory, story: null };

      await useCase.run({
        ...commonInput,
        project: projectWithoutStory,
        targetDates: [new Date(Date.UTC(2026, 0, 15, 5, 0, 0))],
      });

      expect(mockIssueRepository.createNewIssue).not.toHaveBeenCalled();
    });

    it('returns early when targetDates is empty', async () => {
      await useCase.run({ ...commonInput, targetDates: [] });

      expect(mockIssueRepository.createNewIssue).not.toHaveBeenCalled();
    });
  });
});
