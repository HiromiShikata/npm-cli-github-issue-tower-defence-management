import { mock } from 'jest-mock-extended';
import { SetWorkflowManagementIssueToStoryUseCase } from './SetWorkflowManagementIssueToStoryUseCase';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { Issue } from '../entities/Issue';
import { Project } from '../entities/Project';

describe('SetWorkflowManagementIssueToStoryUseCase', () => {
  const mockIssueRepository = mock<IssueRepository>();

  const basicProject: Project = {
    ...mock<Project>(),
    story: {
      name: 'Story Field',
      fieldId: 'storyFieldId',
      databaseId: 123,
      stories: [
        {
          id: 'noStoryId',
          name: 'regular / NO STORY',
          color: 'GRAY',
          description: '',
        },
        {
          id: 'highPriorityId',
          name: 'regular / high priority',
          color: 'RED',
          description: '',
        },
        {
          id: 'middleBugId',
          name: 'regular / middle bug',
          color: 'ORANGE',
          description: '',
        },
        {
          id: 'workflowBoardId',
          name: 'workflow board',
          color: 'BLUE',
          description: '',
        },
      ],
      workflowManagementStory: {
        id: 'workflowManagementStoryId',
        name: 'workflow management',
      },
    },
  };

  const targetDate = new Date('2000-01-01T01:00:00Z');

  let useCase: SetWorkflowManagementIssueToStoryUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    useCase = new SetWorkflowManagementIssueToStoryUseCase(mockIssueRepository);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('normalizeCandidate', () => {
    const testCases: { name: string; input: string; expected: string }[] = [
      {
        name: 'should lowercase and remove spaces',
        input: 'high priority',
        expected: 'highpriority',
      },
      {
        name: 'should remove hyphens',
        input: 'high-priority',
        expected: 'highpriority',
      },
      {
        name: 'should remove underscores',
        input: 'high_priority',
        expected: 'highpriority',
      },
      {
        name: 'should remove slashes',
        input: 'high/priority',
        expected: 'highpriority',
      },
      {
        name: 'should handle mixed separators',
        input: 'High-Priority_Now',
        expected: 'highprioritynow',
      },
    ];

    testCases.forEach(({ name, input, expected }) => {
      it(name, () => {
        expect(
          SetWorkflowManagementIssueToStoryUseCase.normalizeCandidate(input),
        ).toEqual(expected);
      });
    });
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
            labels: ['story:high-priority'],
            story: null,
            state: 'OPEN',
            nextActionDate: null,
            nextActionHour: null,
            isPr: false,
          },
        ],
        cacheUsed: false,
      });

      expect(mockIssueRepository.updateStory).not.toHaveBeenCalled();
      expect(mockIssueRepository.removeLabel).not.toHaveBeenCalled();
    });

    it('should do nothing when cacheUsed is true', async () => {
      await useCase.run({
        targetDates: [targetDate],
        project: basicProject,
        issues: [
          {
            ...mock<Issue>(),
            labels: ['story:high-priority'],
            story: null,
            state: 'OPEN',
            nextActionDate: null,
            nextActionHour: null,
            isPr: false,
          },
        ],
        cacheUsed: true,
      });

      expect(mockIssueRepository.updateStory).not.toHaveBeenCalled();
      expect(mockIssueRepository.removeLabel).not.toHaveBeenCalled();
    });

    it('should do nothing when no target date has minutes === 0', async () => {
      const nonHourDate = new Date('2000-01-01T01:30:00Z');

      await useCase.run({
        targetDates: [nonHourDate],
        project: basicProject,
        issues: [
          {
            ...mock<Issue>(),
            labels: ['story:high-priority'],
            story: null,
            state: 'OPEN',
            nextActionDate: null,
            nextActionHour: null,
            isPr: false,
          },
        ],
        cacheUsed: false,
      });

      expect(mockIssueRepository.updateStory).not.toHaveBeenCalled();
      expect(mockIssueRepository.removeLabel).not.toHaveBeenCalled();
    });

    it('should map story:workflow-management label to workflow management story and remove label', async () => {
      const issue: Issue = {
        ...mock<Issue>(),
        labels: ['story:workflow-management', 'other'],
        story: null,
        state: 'OPEN',
        nextActionDate: null,
        nextActionHour: null,
        isPr: false,
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
        [
          { ...basicProject, story: basicProject.story },
          issue,
          'workflowManagementStoryId',
        ],
      ]);
      expect(mockIssueRepository.removeLabel.mock.calls).toEqual([
        [issue, 'story:workflow-management'],
      ]);
    });

    it('should map daily-routine label to workflow management story without removing label', async () => {
      const issue: Issue = {
        ...mock<Issue>(),
        labels: ['daily-routine', 'other'],
        story: null,
        state: 'OPEN',
        nextActionDate: null,
        nextActionHour: null,
        isPr: false,
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
        [
          { ...basicProject, story: basicProject.story },
          issue,
          'workflowManagementStoryId',
        ],
      ]);
      expect(mockIssueRepository.removeLabel).not.toHaveBeenCalled();
    });

    it('should map isPr issue to workflow management story without removing label', async () => {
      const issue: Issue = {
        ...mock<Issue>(),
        labels: ['other'],
        story: null,
        state: 'OPEN',
        nextActionDate: null,
        nextActionHour: null,
        isPr: true,
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
        [
          { ...basicProject, story: basicProject.story },
          issue,
          'workflowManagementStoryId',
        ],
      ]);
      expect(mockIssueRepository.removeLabel).not.toHaveBeenCalled();
    });

    it('should map story:high-priority label to regular / high priority story and remove label', async () => {
      const issue: Issue = {
        ...mock<Issue>(),
        labels: ['story:high-priority'],
        story: null,
        state: 'OPEN',
        nextActionDate: null,
        nextActionHour: null,
        isPr: false,
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
        [
          { ...basicProject, story: basicProject.story },
          issue,
          'highPriorityId',
        ],
      ]);
      expect(mockIssueRepository.removeLabel.mock.calls).toEqual([
        [issue, 'story:high-priority'],
      ]);
    });

    it('should normalize label by removing underscores to match story option', async () => {
      const issue: Issue = {
        ...mock<Issue>(),
        labels: ['story:high_priority'],
        story: null,
        state: 'OPEN',
        nextActionDate: null,
        nextActionHour: null,
        isPr: false,
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
        [
          { ...basicProject, story: basicProject.story },
          issue,
          'highPriorityId',
        ],
      ]);
      expect(mockIssueRepository.removeLabel.mock.calls).toEqual([
        [issue, 'story:high_priority'],
      ]);
    });

    it('should normalize label by removing hyphens to match story option with spaces', async () => {
      const issue: Issue = {
        ...mock<Issue>(),
        labels: ['story:middle-bug'],
        story: null,
        state: 'OPEN',
        nextActionDate: null,
        nextActionHour: null,
        isPr: false,
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
        [{ ...basicProject, story: basicProject.story }, issue, 'middleBugId'],
      ]);
      expect(mockIssueRepository.removeLabel.mock.calls).toEqual([
        [issue, 'story:middle-bug'],
      ]);
    });

    it('should throw error when story:* label has no matching regular / ... option', async () => {
      const issue: Issue = {
        ...mock<Issue>(),
        labels: ['story:routine-management'],
        story: null,
        state: 'OPEN',
        nextActionDate: null,
        nextActionHour: null,
        isPr: false,
      };

      await expect(
        useCase.run({
          targetDates: [targetDate],
          project: basicProject,
          issues: [issue],
          cacheUsed: false,
        }),
      ).rejects.toThrow(
        'No matching story found for label: story:routine-management',
      );

      expect(mockIssueRepository.updateStory).not.toHaveBeenCalled();
      expect(mockIssueRepository.removeLabel).not.toHaveBeenCalled();
    });

    it('should not match story option that does not start with regular / ', async () => {
      const issue: Issue = {
        ...mock<Issue>(),
        labels: ['story:workflow-board'],
        story: null,
        state: 'OPEN',
        nextActionDate: null,
        nextActionHour: null,
        isPr: false,
      };

      await expect(
        useCase.run({
          targetDates: [targetDate],
          project: basicProject,
          issues: [issue],
          cacheUsed: false,
        }),
      ).rejects.toThrow(
        'No matching story found for label: story:workflow-board',
      );
    });

    it('should skip issue that already has a story assigned', async () => {
      const issue: Issue = {
        ...mock<Issue>(),
        labels: ['story:high-priority'],
        story: 'regular / NO STORY',
        state: 'OPEN',
        nextActionDate: null,
        nextActionHour: null,
        isPr: false,
      };

      await useCase.run({
        targetDates: [targetDate],
        project: basicProject,
        issues: [issue],
        cacheUsed: false,
      });

      expect(mockIssueRepository.updateStory).not.toHaveBeenCalled();
      expect(mockIssueRepository.removeLabel).not.toHaveBeenCalled();
    });

    it('should skip CLOSED issue', async () => {
      const issue: Issue = {
        ...mock<Issue>(),
        labels: ['story:high-priority'],
        story: null,
        state: 'CLOSED',
        nextActionDate: null,
        nextActionHour: null,
        isPr: false,
      };

      await useCase.run({
        targetDates: [targetDate],
        project: basicProject,
        issues: [issue],
        cacheUsed: false,
      });

      expect(mockIssueRepository.updateStory).not.toHaveBeenCalled();
      expect(mockIssueRepository.removeLabel).not.toHaveBeenCalled();
    });

    it('should skip issue with nextActionDate in the future', async () => {
      const futureDate = new Date('2000-01-02T00:00:00Z');
      const issue: Issue = {
        ...mock<Issue>(),
        labels: ['story:high-priority'],
        story: null,
        state: 'OPEN',
        nextActionDate: futureDate,
        nextActionHour: null,
        isPr: false,
      };

      await useCase.run({
        targetDates: [targetDate],
        project: basicProject,
        issues: [issue],
        cacheUsed: false,
      });

      expect(mockIssueRepository.updateStory).not.toHaveBeenCalled();
      expect(mockIssueRepository.removeLabel).not.toHaveBeenCalled();
    });

    it('should skip issue with nextActionHour set', async () => {
      const issue: Issue = {
        ...mock<Issue>(),
        labels: ['story:high-priority'],
        story: null,
        state: 'OPEN',
        nextActionDate: null,
        nextActionHour: 9,
        isPr: false,
      };

      await useCase.run({
        targetDates: [targetDate],
        project: basicProject,
        issues: [issue],
        cacheUsed: false,
      });

      expect(mockIssueRepository.updateStory).not.toHaveBeenCalled();
      expect(mockIssueRepository.removeLabel).not.toHaveBeenCalled();
    });

    it('should process multiple eligible issues', async () => {
      const issue1: Issue = {
        ...mock<Issue>(),
        labels: ['story:high-priority'],
        story: null,
        state: 'OPEN',
        nextActionDate: null,
        nextActionHour: null,
        isPr: false,
      };
      const issue2: Issue = {
        ...mock<Issue>(),
        labels: ['story:middle-bug'],
        story: null,
        state: 'OPEN',
        nextActionDate: null,
        nextActionHour: null,
        isPr: false,
      };

      const promise = useCase.run({
        targetDates: [targetDate],
        project: basicProject,
        issues: [issue1, issue2],
        cacheUsed: false,
      });
      await jest.runAllTimersAsync();
      await promise;

      expect(mockIssueRepository.updateStory.mock.calls).toEqual([
        [
          { ...basicProject, story: basicProject.story },
          issue1,
          'highPriorityId',
        ],
        [{ ...basicProject, story: basicProject.story }, issue2, 'middleBugId'],
      ]);
      expect(mockIssueRepository.removeLabel.mock.calls).toEqual([
        [issue1, 'story:high-priority'],
        [issue2, 'story:middle-bug'],
      ]);
    });
  });
});
