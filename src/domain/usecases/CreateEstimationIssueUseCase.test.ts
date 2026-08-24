import { mock } from 'jest-mock-extended';
import { CreateEstimationIssueUseCase } from './CreateEstimationIssueUseCase';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { DateRepository } from './adapter-interfaces/DateRepository';
import { Project } from '../entities/Project';
import { StoryObject } from '../entities/StoryObjectMap';

describe('CreateEstimationIssueUseCase', () => {
  const mockIssueRepository = mock<IssueRepository>();
  const mockDateRepository = mock<DateRepository>();

  let useCase: CreateEstimationIssueUseCase;

  const projectWithStory: Project = {
    ...mock<Project>(),
    story: {
      name: 'Story',
      fieldId: 'story-field',
      databaseId: 1,
      stories: [],
      workflowManagementStory: { id: 'wms-id', name: 'workflow management' },
    },
    remainingEstimationMinutes: null,
    completionDate50PercentConfidence: null,
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
  };

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new CreateEstimationIssueUseCase(
      mockIssueRepository,
      mockDateRepository,
    );
  });

  describe('run — UTC 07:00 guard', () => {
    it('returns early when no targetDate is at UTC 07:00', async () => {
      const nonMatchingDate = new Date(Date.UTC(2026, 0, 15, 6, 0, 0));

      await useCase.run({ ...commonInput, targetDates: [nonMatchingDate] });

      expect(mockIssueRepository.createNewIssue).not.toHaveBeenCalled();
    });

    it('returns early when targetDates is empty', async () => {
      await useCase.run({ ...commonInput, targetDates: [] });

      expect(mockIssueRepository.createNewIssue).not.toHaveBeenCalled();
    });

    it('returns early when project has no story field', async () => {
      const projectWithoutStory: Project = { ...projectWithStory, story: null };

      await useCase.run({
        ...commonInput,
        project: projectWithoutStory,
        targetDates: [new Date(Date.UTC(2026, 0, 15, 7, 0, 0))],
      });

      expect(mockIssueRepository.createNewIssue).not.toHaveBeenCalled();
    });
  });

  describe('run — weekend skip', () => {
    const projectWithNonRegularStory: Project = {
      ...projectWithStory,
      story: {
        name: 'Story',
        fieldId: 'story-field',
        databaseId: 1,
        stories: [
          {
            id: 'story-1',
            name: 'Feature Story',
            color: 'BLUE',
            description: '',
          },
        ],
        workflowManagementStory: { id: 'wms-id', name: 'workflow management' },
      },
    };

    it('returns early when the last targetDate falls on Saturday UTC', async () => {
      const saturdayAt07h = new Date(Date.UTC(2026, 0, 17, 7, 0, 0));
      expect(saturdayAt07h.getUTCDay()).toBe(6);

      await useCase.run({
        ...commonInput,
        project: projectWithNonRegularStory,
        targetDates: [saturdayAt07h],
      });

      expect(mockIssueRepository.createNewIssue).not.toHaveBeenCalled();
    });

    it('returns early when the last targetDate falls on Sunday UTC', async () => {
      const sundayAt07h = new Date(Date.UTC(2026, 0, 18, 7, 0, 0));
      expect(sundayAt07h.getUTCDay()).toBe(0);

      await useCase.run({
        ...commonInput,
        project: projectWithNonRegularStory,
        targetDates: [sundayAt07h],
      });

      expect(mockIssueRepository.createNewIssue).not.toHaveBeenCalled();
    });

    it('proceeds past the weekend guard on a weekday UTC 07:00', async () => {
      const thursdayAt07h = new Date(Date.UTC(2026, 0, 15, 7, 0, 0));
      expect(thursdayAt07h.getUTCDay()).toBe(4);

      await expect(
        useCase.run({
          ...commonInput,
          project: projectWithNonRegularStory,
          targetDates: [thursdayAt07h],
        }),
      ).rejects.toThrow('Story issue not found: Feature Story');
    });
  });
});
