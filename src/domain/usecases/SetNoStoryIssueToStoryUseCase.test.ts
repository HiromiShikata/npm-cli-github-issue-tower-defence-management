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
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    useCase = new SetNoStoryIssueToStoryUseCase(mockIssueRepository);
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
    warnSpy.mockRestore();
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

    it('should not throw when the target date list is empty', async () => {
      await expect(
        useCase.run({
          targetDates: [],
          project: basicProject,
          issues: [
            {
              ...mock<Issue>(),
              labels: [],
              story: null,
              state: 'OPEN',
              nextActionDate: new Date('2000-01-01T00:00:00Z'),
              nextActionHour: null,
            },
          ],
          cacheUsed: false,
        }),
      ).resolves.toBeUndefined();
      expect(mockIssueRepository.updateStory).not.toHaveBeenCalled();
    });

    it('should assign story to eligible issue even when cacheUsed is true', async () => {
      const issue: Issue = {
        ...mock<Issue>(),
        labels: [],
        story: null,
        state: 'OPEN',
        nextActionDate: null,
        nextActionHour: null,
      };
      mockIssueRepository.get.mockResolvedValue({ ...issue, story: null });

      const promise = useCase.run({
        targetDates: [targetDate],
        project: basicProject,
        issues: [issue],
        cacheUsed: true,
      });
      await jest.runAllTimersAsync();
      await promise;

      expect(mockIssueRepository.updateStory.mock.calls).toEqual([
        [{ ...basicProject, story: basicProject.story }, issue, 'noStoryId'],
      ]);
    });

    it('should assign first story to eligible issue on non-minute-0 target date', async () => {
      const nonHourDate = new Date('2000-01-01T01:30:00Z');
      const issue: Issue = {
        ...mock<Issue>(),
        labels: [],
        story: null,
        state: 'OPEN',
        nextActionDate: null,
        nextActionHour: null,
      };
      mockIssueRepository.get.mockResolvedValue({ ...issue, story: null });

      const promise = useCase.run({
        targetDates: [nonHourDate],
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
      mockIssueRepository.get.mockResolvedValue({ ...issue, story: null });

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
      mockIssueRepository.get.mockResolvedValue({ ...issue, story: null });

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
      mockIssueRepository.get.mockImplementation(async (issueUrl: string) => {
        if (issueUrl === eligibleIssue.url) {
          return { ...eligibleIssue, story: null };
        }
        return null;
      });

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

    it('should use NO STORY option by name even when it is not at index 0', async () => {
      const reorderedStory = {
        ...basicStory,
        stories: [
          {
            id: 'highPriorityId',
            name: 'regular / high priority',
            color: 'RED' as const,
            description: '',
          },
          {
            id: 'noStoryId',
            name: 'regular / NO STORY',
            color: 'RED' as const,
            description: '',
          },
        ],
      };
      const project = { ...basicProject, story: reorderedStory };
      const issue: Issue = {
        ...mock<Issue>(),
        labels: [],
        story: null,
        state: 'OPEN',
        nextActionDate: null,
        nextActionHour: null,
      };
      mockIssueRepository.get.mockResolvedValue({ ...issue, story: null });

      const promise = useCase.run({
        targetDates: [targetDate],
        project,
        issues: [issue],
        cacheUsed: false,
      });
      await jest.runAllTimersAsync();
      await promise;

      expect(mockIssueRepository.updateStory.mock.calls).toEqual([
        [{ ...project, story: reorderedStory }, issue, 'noStoryId'],
      ]);
    });

    it('should do nothing when NO STORY option does not exist in the stories list', async () => {
      const storyWithoutNoStory = {
        ...basicStory,
        stories: [
          {
            id: 'highPriorityId',
            name: 'regular / high priority',
            color: 'RED' as const,
            description: '',
          },
        ],
      };
      const project = { ...basicProject, story: storyWithoutNoStory };
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
        project,
        issues: [issue],
        cacheUsed: false,
      });
      await jest.runAllTimersAsync();
      await promise;

      expect(mockIssueRepository.updateStory).not.toHaveBeenCalled();
    });

    it('should not overwrite Story when the live re-read shows a Story was already set since the snapshot was taken', async () => {
      const issue: Issue = {
        ...mock<Issue>(),
        labels: [],
        story: null,
        state: 'OPEN',
        nextActionDate: null,
        nextActionHour: null,
      };
      mockIssueRepository.get.mockResolvedValue({
        ...issue,
        story: 'regular / high priority',
      });

      const promise = useCase.run({
        targetDates: [targetDate],
        project: basicProject,
        issues: [issue],
        cacheUsed: false,
      });
      await jest.runAllTimersAsync();
      await promise;

      expect(mockIssueRepository.get.mock.calls).toEqual([
        [issue.url, basicProject],
      ]);
      expect(mockIssueRepository.updateStory).not.toHaveBeenCalled();
    });

    it('should log a console.warn naming the changed field when the live re-read shows a Story was already set since the snapshot was taken', async () => {
      const issue: Issue = {
        ...mock<Issue>(),
        labels: [],
        story: null,
        state: 'OPEN',
        nextActionDate: null,
        nextActionHour: null,
      };
      mockIssueRepository.get.mockResolvedValue({
        ...issue,
        story: 'regular / high priority',
      });

      const promise = useCase.run({
        targetDates: [targetDate],
        project: basicProject,
        issues: [issue],
        cacheUsed: false,
      });
      await jest.runAllTimersAsync();
      await promise;

      expect(warnSpy.mock.calls.length).toBeGreaterThanOrEqual(1);
      expect(
        warnSpy.mock.calls.some((call: unknown[]) => {
          const message = call[0];
          return (
            typeof message === 'string' &&
            message.includes('story changed from')
          );
        }),
      ).toBe(true);
      expect(
        warnSpy.mock.calls.every((call: unknown[]) => {
          const message = call[0];
          return typeof message === 'string' && message.includes(issue.url);
        }),
      ).toBe(true);
    });

    it('should not write when the live re-read returns null (issue not found)', async () => {
      const issue: Issue = {
        ...mock<Issue>(),
        labels: [],
        story: null,
        state: 'OPEN',
        nextActionDate: null,
        nextActionHour: null,
      };
      mockIssueRepository.get.mockResolvedValue(null);

      const promise = useCase.run({
        targetDates: [targetDate],
        project: basicProject,
        issues: [issue],
        cacheUsed: false,
      });
      await jest.runAllTimersAsync();
      await promise;

      expect(mockIssueRepository.get.mock.calls).toEqual([
        [issue.url, basicProject],
      ]);
      expect(mockIssueRepository.updateStory).not.toHaveBeenCalled();
    });

    it('should log a console.warn naming the project removal when the live re-read returns null (issue not found)', async () => {
      const issue: Issue = {
        ...mock<Issue>(),
        labels: [],
        story: null,
        state: 'OPEN',
        nextActionDate: null,
        nextActionHour: null,
      };
      mockIssueRepository.get.mockResolvedValue(null);

      const promise = useCase.run({
        targetDates: [targetDate],
        project: basicProject,
        issues: [issue],
        cacheUsed: false,
      });
      await jest.runAllTimersAsync();
      await promise;

      expect(warnSpy.mock.calls.length).toBeGreaterThanOrEqual(1);
      expect(
        warnSpy.mock.calls.some((call: unknown[]) => {
          const message = call[0];
          return (
            typeof message === 'string' &&
            message.includes('is no longer on project')
          );
        }),
      ).toBe(true);
      expect(
        warnSpy.mock.calls.every((call: unknown[]) => {
          const message = call[0];
          return typeof message === 'string' && message.includes(issue.url);
        }),
      ).toBe(true);
    });

    it('should not write and should re-throw as AggregateError when the live re-read rejects', async () => {
      const issue: Issue = {
        ...mock<Issue>(),
        labels: [],
        story: null,
        state: 'OPEN',
        nextActionDate: null,
        nextActionHour: null,
      };
      mockIssueRepository.get.mockRejectedValue(new Error('network error'));

      const promise = useCase.run({
        targetDates: [targetDate],
        project: basicProject,
        issues: [issue],
        cacheUsed: false,
      });
      await jest.runAllTimersAsync();
      await expect(promise).rejects.toBeInstanceOf(AggregateError);

      expect(mockIssueRepository.get.mock.calls).toEqual([
        [issue.url, basicProject],
      ]);
      expect(mockIssueRepository.updateStory).not.toHaveBeenCalled();
    });

    it('should process the remaining issue and collect the rejection into the thrown AggregateError when the live re-read rejects for one issue among several', async () => {
      const failingIssue: Issue = {
        ...mock<Issue>(),
        labels: [],
        story: null,
        state: 'OPEN',
        nextActionDate: null,
        nextActionHour: null,
        url: 'https://github.com/user/repo/issues/1',
      };
      const succeedingIssue: Issue = {
        ...mock<Issue>(),
        labels: [],
        story: null,
        state: 'OPEN',
        nextActionDate: null,
        nextActionHour: null,
        url: 'https://github.com/user/repo/issues/2',
      };
      const rejectionError = new Error('network error');
      mockIssueRepository.get.mockImplementation(async (issueUrl: string) => {
        if (issueUrl === failingIssue.url) {
          throw rejectionError;
        }
        if (issueUrl === succeedingIssue.url) {
          return { ...succeedingIssue, story: null };
        }
        return null;
      });

      const promise = useCase.run({
        targetDates: [targetDate],
        project: basicProject,
        issues: [failingIssue, succeedingIssue],
        cacheUsed: false,
      });
      await jest.runAllTimersAsync();

      let caughtError: unknown;
      try {
        await promise;
      } catch (error) {
        caughtError = error;
      }

      expect(caughtError).toBeInstanceOf(AggregateError);
      if (caughtError instanceof AggregateError) {
        expect(caughtError.errors).toEqual([rejectionError]);
      } else {
        throw caughtError;
      }
      expect(mockIssueRepository.updateStory.mock.calls).toEqual([
        [
          { ...basicProject, story: basicProject.story },
          succeedingIssue,
          'noStoryId',
        ],
      ]);
    });
  });
});
