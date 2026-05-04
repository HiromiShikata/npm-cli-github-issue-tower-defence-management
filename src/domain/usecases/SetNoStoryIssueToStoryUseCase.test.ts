import { mock } from 'jest-mock-extended';
import { SetNoStoryIssueToStoryUseCase } from './SetNoStoryIssueToStoryUseCase';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { Issue } from '../entities/Issue';
import { Project } from '../entities/Project';

describe('SetNoStoryIssueToStoryUseCase', () => {
  const mockIssueRepository = mock<IssueRepository>();

  const basicStory = {
    name: 'Story Field',
    fieldId: 'storyFieldId',
    databaseId: 123,
    stories: [
      {
        id: 'noStoryId',
        name: 'regular / NO STORY',
        color: 'GRAY' as const,
        description: '',
      },
      {
        id: 'highPriorityId',
        name: 'regular / high priority',
        color: 'RED' as const,
        description: '',
      },
    ],
    workflowManagementStory: {
      id: 'workflowManagementStoryId',
      name: 'workflow management',
    },
  };

  const basicProject: Project = {
    ...mock<Project>(),
    story: basicStory,
  };

  const targetDate = new Date('2000-01-01T01:00:00Z');

  let useCase: SetNoStoryIssueToStoryUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    useCase = new SetNoStoryIssueToStoryUseCase(mockIssueRepository);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('run', () => {
    it('should do nothing when project has no story field', async () => {
      const projectWithoutStory: Project = { ...basicProject, story: null };

      await useCase.run({
        targetDates: [targetDate],
        project: projectWithoutStory,
        issues: [
          {
            ...mock<Issue>(),
            labels: [],
            story: null,
            state: 'OPEN',
            nextActionDate: null,
            nextActionHour: null,
          },
        ],
        cacheUsed: false,
      });

      expect(mockIssueRepository.updateStory).not.toHaveBeenCalled();
    });

    it('should do nothing when cacheUsed is true', async () => {
      await useCase.run({
        targetDates: [targetDate],
        project: basicProject,
        issues: [
          {
            ...mock<Issue>(),
            labels: [],
            story: null,
            state: 'OPEN',
            nextActionDate: null,
            nextActionHour: null,
          },
        ],
        cacheUsed: true,
      });

      expect(mockIssueRepository.updateStory).not.toHaveBeenCalled();
    });

    it('should do nothing when no target date has minutes === 0', async () => {
      const nonHourDate = new Date('2000-01-01T01:30:00Z');

      await useCase.run({
        targetDates: [nonHourDate],
        project: basicProject,
        issues: [
          {
            ...mock<Issue>(),
            labels: [],
            story: null,
            state: 'OPEN',
            nextActionDate: null,
            nextActionHour: null,
          },
        ],
        cacheUsed: false,
      });

      expect(mockIssueRepository.updateStory).not.toHaveBeenCalled();
    });

    it('should do nothing when project story has no stories', async () => {
      const projectWithEmptyStories: Project = {
        ...basicProject,
        story: {
          ...basicStory,
          stories: [],
        },
      };

      await useCase.run({
        targetDates: [targetDate],
        project: projectWithEmptyStories,
        issues: [
          {
            ...mock<Issue>(),
            labels: [],
            story: null,
            state: 'OPEN',
            nextActionDate: null,
            nextActionHour: null,
          },
        ],
        cacheUsed: false,
      });

      expect(mockIssueRepository.updateStory).not.toHaveBeenCalled();
    });

    it('should assign first story to eligible issue with no story and no story: labels', async () => {
      const issue: Issue = {
        ...mock<Issue>(),
        labels: [],
        story: null,
        state: 'OPEN',
        nextActionDate: null,
        nextActionHour: null,
      };

      const promise = useCase.run({
        targetDates: [targetDate],
        project: basicProject,
        issues: [issue],
        cacheUsed: false,
      });
      await jest.runAllTimersAsync();
      await promise;

      expect(mockIssueRepository.updateStory.mock.calls).toEqual([
        [{ ...basicProject, story: basicProject.story }, issue, 'noStoryId'],
      ]);
    });

    it('should skip issue that has a story: label', async () => {
      const issue: Issue = {
        ...mock<Issue>(),
        labels: ['story:high-priority'],
        story: null,
        state: 'OPEN',
        nextActionDate: null,
        nextActionHour: null,
      };

      await useCase.run({
        targetDates: [targetDate],
        project: basicProject,
        issues: [issue],
        cacheUsed: false,
      });

      expect(mockIssueRepository.updateStory).not.toHaveBeenCalled();
    });

    it('should skip issue that has a story:workflow-management label', async () => {
      const issue: Issue = {
        ...mock<Issue>(),
        labels: ['story:workflow-management'],
        story: null,
        state: 'OPEN',
        nextActionDate: null,
        nextActionHour: null,
      };

      await useCase.run({
        targetDates: [targetDate],
        project: basicProject,
        issues: [issue],
        cacheUsed: false,
      });

      expect(mockIssueRepository.updateStory).not.toHaveBeenCalled();
    });

    it('should skip issue that has a story: label with uppercase prefix', async () => {
      const issue: Issue = {
        ...mock<Issue>(),
        labels: ['STORY:high-priority'],
        story: null,
        state: 'OPEN',
        nextActionDate: null,
        nextActionHour: null,
      };

      await useCase.run({
        targetDates: [targetDate],
        project: basicProject,
        issues: [issue],
        cacheUsed: false,
      });

      expect(mockIssueRepository.updateStory).not.toHaveBeenCalled();
    });

    it('should skip issue that already has a story assigned', async () => {
      const issue: Issue = {
        ...mock<Issue>(),
        labels: [],
        story: 'regular / NO STORY',
        state: 'OPEN',
        nextActionDate: null,
        nextActionHour: null,
      };

      await useCase.run({
        targetDates: [targetDate],
        project: basicProject,
        issues: [issue],
        cacheUsed: false,
      });

      expect(mockIssueRepository.updateStory).not.toHaveBeenCalled();
    });

    it('should skip CLOSED issue', async () => {
      const issue: Issue = {
        ...mock<Issue>(),
        labels: [],
        story: null,
        state: 'CLOSED',
        nextActionDate: null,
        nextActionHour: null,
      };

      await useCase.run({
        targetDates: [targetDate],
        project: basicProject,
        issues: [issue],
        cacheUsed: false,
      });

      expect(mockIssueRepository.updateStory).not.toHaveBeenCalled();
    });

    it('should skip issue with nextActionDate in the future', async () => {
      const futureDate = new Date('2000-01-02T00:00:00Z');
      const issue: Issue = {
        ...mock<Issue>(),
        labels: [],
        story: null,
        state: 'OPEN',
        nextActionDate: futureDate,
        nextActionHour: null,
      };

      await useCase.run({
        targetDates: [targetDate],
        project: basicProject,
        issues: [issue],
        cacheUsed: false,
      });

      expect(mockIssueRepository.updateStory).not.toHaveBeenCalled();
    });

    it('should skip issue with nextActionHour set', async () => {
      const issue: Issue = {
        ...mock<Issue>(),
        labels: [],
        story: null,
        state: 'OPEN',
        nextActionDate: null,
        nextActionHour: 9,
      };

      await useCase.run({
        targetDates: [targetDate],
        project: basicProject,
        issues: [issue],
        cacheUsed: false,
      });

      expect(mockIssueRepository.updateStory).not.toHaveBeenCalled();
    });

    it('should process issue with nextActionDate equal to or before target date', async () => {
      const pastDate = new Date('2000-01-01T00:00:00Z');
      const issue: Issue = {
        ...mock<Issue>(),
        labels: [],
        story: null,
        state: 'OPEN',
        nextActionDate: pastDate,
        nextActionHour: null,
      };

      const promise = useCase.run({
        targetDates: [targetDate],
        project: basicProject,
        issues: [issue],
        cacheUsed: false,
      });
      await jest.runAllTimersAsync();
      await promise;

      expect(mockIssueRepository.updateStory.mock.calls).toEqual([
        [{ ...basicProject, story: basicProject.story }, issue, 'noStoryId'],
      ]);
    });

    it('should process multiple eligible issues and skip those with story: labels', async () => {
      const eligibleIssue: Issue = {
        ...mock<Issue>(),
        labels: [],
        story: null,
        state: 'OPEN',
        nextActionDate: null,
        nextActionHour: null,
      };
      const issueWithStoryLabel: Issue = {
        ...mock<Issue>(),
        labels: ['story:high-priority'],
        story: null,
        state: 'OPEN',
        nextActionDate: null,
        nextActionHour: null,
      };

      const promise = useCase.run({
        targetDates: [targetDate],
        project: basicProject,
        issues: [eligibleIssue, issueWithStoryLabel],
        cacheUsed: false,
      });
      await jest.runAllTimersAsync();
      await promise;

      expect(mockIssueRepository.updateStory.mock.calls).toEqual([
        [
          { ...basicProject, story: basicProject.story },
          eligibleIssue,
          'noStoryId',
        ],
      ]);
    });
  });
});
