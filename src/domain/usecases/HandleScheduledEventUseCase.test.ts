import { HandleScheduledEventUseCase } from './HandleScheduledEventUseCase';
import { mock } from 'jest-mock-extended';
import { ActionAnnouncementUseCase } from './ActionAnnouncementUseCase';
import { SetWorkflowManagementIssueToStoryUseCase } from './SetWorkflowManagementIssueToStoryUseCase';
import { ClearPastNextActionDateHourUseCase } from './ClearPastNextActionDateHourUseCase';
import { AnalyzeProblemByIssueUseCase } from './AnalyzeProblemByIssueUseCase';
import { AnalyzeStoriesUseCase } from './AnalyzeStoriesUseCase';
import { ClearDependedIssueURLUseCase } from './ClearDependedIssueURLUseCase';
import { CreateEstimationIssueUseCase } from './CreateEstimationIssueUseCase';
import { ConvertCheckboxToIssueInStoryIssueUseCase } from './ConvertCheckboxToIssueInStoryIssueUseCase';
import { DateRepository } from './adapter-interfaces/DateRepository';
import { SpreadsheetRepository } from './adapter-interfaces/SpreadsheetRepository';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { Issue } from '../entities/Issue';
import { Project } from '../entities/Project';
import { ChangeStatusByStoryColorUseCase } from './ChangeStatusByStoryColorUseCase';
import { SetNoStoryIssueToStoryUseCase } from './SetNoStoryIssueToStoryUseCase';
import { CreateNewStoryByLabelUseCase } from './CreateNewStoryByLabelUseCase';
import { AssignNoAssigneeIssueToManagerUseCase } from './AssignNoAssigneeIssueToManagerUseCase';
import { UpdateIssueStatusByLabelUseCase } from './UpdateIssueStatusByLabelUseCase';
import { StartPreparationUseCase } from './StartPreparationUseCase';
import { NotifyFinishedIssuePreparationUseCase } from './NotifyFinishedIssuePreparationUseCase';
import { RevertOrphanedPreparationUseCase } from './RevertOrphanedPreparationUseCase';

describe('HandleScheduledEventUseCase', () => {
  describe('createTargetDateTimes', () => {
    const testCases: {
      lastExecutionDateTime: Date;
      now: Date;
      expected: Date[];
    }[] = [
      {
        lastExecutionDateTime: new Date('2021-01-01T00:00:00Z'),
        now: new Date('2021-01-01T00:00:00Z'),
        expected: [],
      },
      {
        lastExecutionDateTime: new Date('2021-01-01T00:00:00Z'),
        now: new Date('2021-01-01T00:00:01Z'),
        expected: [],
      },
      {
        lastExecutionDateTime: new Date('2021-01-01T00:00:00Z'),
        now: new Date('2020-01-01T00:00:02Z'),
        expected: [new Date('2020-01-01T00:00:00Z')],
      },
      {
        lastExecutionDateTime: new Date('2021-01-01T00:00:00Z'),
        now: new Date('2021-01-01T00:05:00Z'),
        expected: [
          new Date('2021-01-01T00:01:00Z'),
          new Date('2021-01-01T00:02:00Z'),
          new Date('2021-01-01T00:03:00Z'),
          new Date('2021-01-01T00:04:00Z'),
          new Date('2021-01-01T00:05:00Z'),
        ],
      },
      {
        lastExecutionDateTime: new Date('2021-01-01T00:00:00Z'),
        now: new Date('2022-01-01T00:00:00Z'),
        expected: Array(300)
          .fill(0)
          .map((_, i) => {
            const d = new Date('2021-01-01T00:00:00Z');
            d.setTime(d.getTime() + (i + 1) * 60 * 1000);
            return d;
          }),
      },
    ];
    testCases.forEach((testCase) => {
      it(`should return ${testCase.expected.map((d) => d.toISOString()).join(',')} when lastExecutionDateTime is ${testCase.lastExecutionDateTime.toISOString()} and now is ${testCase.now.toISOString()}`, () => {
        const result = HandleScheduledEventUseCase.createTargetDateTimes(
          testCase.lastExecutionDateTime,
          testCase.now,
        );
        expect(result).toEqual(testCase.expected);
      });
    });
  });

  describe('run', () => {
    const mockActionAnnouncementUseCase = mock<ActionAnnouncementUseCase>();
    const mockSetWorkflowManagementIssueToStoryUseCase =
      mock<SetWorkflowManagementIssueToStoryUseCase>();
    const mockClearPastNextActionDateHourUseCase =
      mock<ClearPastNextActionDateHourUseCase>();
    const mockAnalyzeProblemByIssueUseCase =
      mock<AnalyzeProblemByIssueUseCase>();
    const mockAnalyzeStoriesUseCase = mock<AnalyzeStoriesUseCase>();
    const mockClearDependedIssueURLUseCase =
      mock<ClearDependedIssueURLUseCase>();
    const mockCreateEstimationIssueUseCase =
      mock<CreateEstimationIssueUseCase>();
    const mockConvertCheckboxToIssueInStoryIssueUseCase =
      mock<ConvertCheckboxToIssueInStoryIssueUseCase>();
    const mockChangeStatusByStoryColorUseCase =
      mock<ChangeStatusByStoryColorUseCase>();
    const mockSetNoStoryIssueToStoryUseCase =
      mock<SetNoStoryIssueToStoryUseCase>();
    const mockCreateNewStoryByLabelUseCase =
      mock<CreateNewStoryByLabelUseCase>();
    const mockAssignNoAssigneeIssueToManagerUseCase =
      mock<AssignNoAssigneeIssueToManagerUseCase>();
    const mockUpdateIssueStatusByLabelUseCase =
      mock<UpdateIssueStatusByLabelUseCase>();
    const mockStartPreparationUseCase = mock<StartPreparationUseCase>();
    const mockNotifyFinishedIssuePreparationUseCase =
      mock<NotifyFinishedIssuePreparationUseCase>();
    const mockRevertOrphanedPreparationUseCase =
      mock<RevertOrphanedPreparationUseCase>();
    const mockDateRepository = mock<DateRepository>();
    const mockSpreadsheetRepository = mock<SpreadsheetRepository>();
    const mockProjectRepository = mock<ProjectRepository>();
    const mockIssueRepository = mock<IssueRepository>();

    const useCase = new HandleScheduledEventUseCase(
      mockActionAnnouncementUseCase,
      mockSetWorkflowManagementIssueToStoryUseCase,
      mockClearPastNextActionDateHourUseCase,
      mockAnalyzeProblemByIssueUseCase,
      mockAnalyzeStoriesUseCase,
      mockClearDependedIssueURLUseCase,
      mockCreateEstimationIssueUseCase,
      mockConvertCheckboxToIssueInStoryIssueUseCase,
      mockChangeStatusByStoryColorUseCase,
      mockSetNoStoryIssueToStoryUseCase,
      mockCreateNewStoryByLabelUseCase,
      mockAssignNoAssigneeIssueToManagerUseCase,
      mockUpdateIssueStatusByLabelUseCase,
      mockStartPreparationUseCase,
      mockNotifyFinishedIssuePreparationUseCase,
      mockRevertOrphanedPreparationUseCase,
      mockDateRepository,
      mockSpreadsheetRepository,
      mockProjectRepository,
      mockIssueRepository,
    );

    beforeEach(() => {
      jest.clearAllMocks();
      mockProjectRepository.findProjectIdByUrl.mockResolvedValue('project-1');
      mockProjectRepository.getProject.mockResolvedValue(mock<Project>());
      mockDateRepository.now.mockResolvedValue(
        new Date('2024-01-01T00:00:00Z'),
      );
      mockIssueRepository.getAllIssues.mockResolvedValue({
        issues: [],
        cacheUsed: false,
      });
      mockSpreadsheetRepository.getSheet.mockResolvedValue([
        ['LastExecutionDateTime'],
        ['2024-01-01T00:00:00Z'],
      ]);
    });

    it('should call AnalyzeProblemByIssueUseCase with correct parameters', async () => {
      const input = {
        projectName: 'test-project',
        org: 'test-org',
        projectUrl: 'https://github.com/test-org/test-project',
        manager: 'test-manager',
        workingReport: {
          repo: 'test-repo',
          members: ['member1'],
          spreadsheetUrl: 'https://docs.google.com/spreadsheets/test',
        },
        urlOfStoryView: 'https://github.com/test-org/test-project/issues',
        disabledStatus: 'disabled',
        defaultStatus: null,
        disabled: false,
        allowIssueCacheMinutes: 60,
      };

      const mockProject = mock<Project>();
      mockProjectRepository.getProject.mockResolvedValue(mockProject);
      await useCase.run(input);
      expect(mockAnalyzeProblemByIssueUseCase.run).toHaveBeenCalled();
    });

    it('should call UpdateIssueStatusByLabelUseCase with correct parameters', async () => {
      const input = {
        projectName: 'test-project',
        org: 'test-org',
        projectUrl: 'https://github.com/test-org/test-project',
        manager: 'test-manager',
        workingReport: {
          repo: 'test-repo',
          members: ['member1'],
          spreadsheetUrl: 'https://docs.google.com/spreadsheets/test',
        },
        urlOfStoryView: 'https://github.com/test-org/test-project/issues',
        disabledStatus: 'disabled',
        defaultStatus: 'ToDo',
        disabled: false,
        allowIssueCacheMinutes: 60,
      };

      const mockProject = mock<Project>();
      mockProjectRepository.getProject.mockResolvedValue(mockProject);
      await useCase.run(input);
      expect(mockUpdateIssueStatusByLabelUseCase.run).toHaveBeenCalledWith({
        project: mockProject,
        issues: [],
        defaultStatus: 'ToDo',
      });
    });

    it('should accept null for defaultStatus parameter', async () => {
      const input = {
        projectName: 'test-project',
        org: 'test-org',
        projectUrl: 'https://github.com/test-org/test-project',
        manager: 'test-manager',
        workingReport: {
          repo: 'test-repo',
          members: ['member1'],
          spreadsheetUrl: 'https://docs.google.com/spreadsheets/test',
        },
        urlOfStoryView: 'https://github.com/test-org/test-project/issues',
        disabledStatus: 'disabled',
        defaultStatus: null,
        disabled: false,
        allowIssueCacheMinutes: 60,
      };

      const mockProject = mock<Project>();
      mockProjectRepository.getProject.mockResolvedValue(mockProject);
      await useCase.run(input);
      expect(mockUpdateIssueStatusByLabelUseCase.run).toHaveBeenCalledWith({
        project: mockProject,
        issues: [],
        defaultStatus: null,
      });
    });

    it('should return null and skip all processing when disabled is true', async () => {
      const input = {
        projectName: 'test-project',
        org: 'test-org',
        projectUrl: 'https://github.com/test-org/test-project',
        manager: 'test-manager',
        workingReport: {
          repo: 'test-repo',
          members: ['member1'],
          spreadsheetUrl: 'https://docs.google.com/spreadsheets/test',
        },
        urlOfStoryView: 'https://github.com/test-org/test-project/issues',
        disabledStatus: 'disabled',
        defaultStatus: null,
        disabled: true,
        allowIssueCacheMinutes: 60,
      };

      const result = await useCase.run(input);
      expect(result).toBeNull();
      expect(mockProjectRepository.findProjectIdByUrl).not.toHaveBeenCalled();
      expect(mockAnalyzeProblemByIssueUseCase.run).not.toHaveBeenCalled();
      expect(mockUpdateIssueStatusByLabelUseCase.run).not.toHaveBeenCalled();
    });

    it('should process normally when disabled is false', async () => {
      const input = {
        projectName: 'test-project',
        org: 'test-org',
        projectUrl: 'https://github.com/test-org/test-project',
        manager: 'test-manager',
        workingReport: {
          repo: 'test-repo',
          members: ['member1'],
          spreadsheetUrl: 'https://docs.google.com/spreadsheets/test',
        },
        urlOfStoryView: 'https://github.com/test-org/test-project/issues',
        disabledStatus: 'disabled',
        defaultStatus: null,
        disabled: false,
        allowIssueCacheMinutes: 60,
      };

      const mockProject = mock<Project>();
      mockProjectRepository.getProject.mockResolvedValue(mockProject);
      const result = await useCase.run(input);
      expect(result).not.toBeNull();
      expect(mockProjectRepository.findProjectIdByUrl).toHaveBeenCalled();
    });

    it('should pass allowIssueCacheMinutes to getAllIssues', async () => {
      const input = {
        projectName: 'test-project',
        org: 'test-org',
        projectUrl: 'https://github.com/test-org/test-project',
        manager: 'test-manager',
        workingReport: {
          repo: 'test-repo',
          members: ['member1'],
          spreadsheetUrl: 'https://docs.google.com/spreadsheets/test',
        },
        urlOfStoryView: 'https://github.com/test-org/test-project/issues',
        disabledStatus: 'disabled',
        defaultStatus: null,
        disabled: false,
        allowIssueCacheMinutes: 120,
      };

      const mockProject = mock<Project>();
      mockProjectRepository.getProject.mockResolvedValue(mockProject);
      await useCase.run(input);
      expect(mockIssueRepository.getAllIssues).toHaveBeenCalledWith(
        'project-1',
        120,
      );
    });

    describe('story issue creation progress logs', () => {
      const storyInput = {
        projectName: 'test-project',
        org: 'test-org',
        projectUrl: 'https://github.com/test-org/test-project',
        manager: 'test-manager',
        workingReport: {
          repo: 'test-repo',
          members: ['member1'],
          spreadsheetUrl: 'https://docs.google.com/spreadsheets/test',
        },
        urlOfStoryView: 'https://github.com/test-org/test-project/issues',
        disabledStatus: 'disabled',
        defaultStatus: null,
        disabled: false,
        allowIssueCacheMinutes: 60,
      };

      const storyProject: Project = {
        id: 'proj-1',
        url: 'https://github.com/orgs/test-org/projects/1',
        databaseId: 1,
        name: 'test-project',
        status: { name: 'Status', fieldId: 'f1', statuses: [] },
        nextActionDate: null,
        nextActionHour: null,
        story: {
          name: 'Story',
          fieldId: 'f2',
          databaseId: 2,
          stories: [
            {
              id: 'story-1',
              name: 'feature / StoryOne',
              color: 'BLUE',
              description: 'story desc',
            },
          ],
          workflowManagementStory: { id: 'wm-1', name: 'workflow' },
        },
        remainingEstimationMinutes: null,
        dependedIssueUrlSeparatedByComma: null,
        completionDate50PercentConfidence: null,
      };

      const capturedLogs: string[] = [];
      let consoleSpy: jest.SpyInstance;

      beforeEach(() => {
        capturedLogs.length = 0;
        consoleSpy = jest
          .spyOn(console, 'log')
          .mockImplementation((...data: unknown[]) => {
            const firstData = data[0];
            if (
              typeof firstData === 'string' &&
              firstData.startsWith('[HandleScheduledEvent]')
            ) {
              capturedLogs.push(firstData);
            }
          });
        jest.useFakeTimers();
        mockProjectRepository.getProject.mockResolvedValue(storyProject);
        mockIssueRepository.getAllIssues.mockResolvedValue({
          issues: [],
          cacheUsed: false,
        });
        mockIssueRepository.createNewIssue.mockResolvedValue(99);
        const createdIssue = mock<Issue>();
        createdIssue.itemId = 'item-99';
        mockIssueRepository.getIssueByUrl.mockResolvedValue(createdIssue);
      });

      afterEach(() => {
        consoleSpy.mockRestore();
        jest.useRealTimers();
      });

      it('should emit Creating story issue log before createNewIssue', async () => {
        const runPromise = useCase.run(storyInput);
        await jest.runAllTimersAsync();
        await runPromise;

        expect(capturedLogs[0]).toContain('Creating story issue');
        expect(capturedLogs[0]).toContain('feature / StoryOne');
      });

      it('should emit Polling for issue log before each 30s sleep', async () => {
        const runPromise = useCase.run(storyInput);
        await jest.runAllTimersAsync();
        await runPromise;

        expect(capturedLogs[1]).toContain('Polling for issue (attempt 1/3)');
        expect(capturedLogs[1]).toContain(
          'https://github.com/test-org/test-repo/issues/99',
        );
      });

      it('should emit Issue found log on successful issue lookup', async () => {
        const runPromise = useCase.run(storyInput);
        await jest.runAllTimersAsync();
        await runPromise;

        expect(capturedLogs[2]).toContain('Issue found');
        expect(capturedLogs[2]).toContain(
          'https://github.com/test-org/test-repo/issues/99',
        );
        expect(capturedLogs[2]).toContain('itemId=item-99');
      });

      it('should emit Waiting for story update log before 10s sleep', async () => {
        const runPromise = useCase.run(storyInput);
        await jest.runAllTimersAsync();
        await runPromise;

        expect(capturedLogs[3]).toContain('Waiting for story update');
        expect(capturedLogs[3]).toContain(
          'https://github.com/test-org/test-repo/issues/99',
        );
      });

      it('should emit Story issue created log with elapsed time after iteration completes', async () => {
        const runPromise = useCase.run(storyInput);
        await jest.runAllTimersAsync();
        await runPromise;

        expect(capturedLogs[4]).toContain('Story issue created');
        expect(capturedLogs[4]).toContain('feature / StoryOne');
        expect(capturedLogs[4]).toMatch(/elapsed=\d+ms/);
      });

      it('should emit logs in expected order', async () => {
        const runPromise = useCase.run(storyInput);
        await jest.runAllTimersAsync();
        await runPromise;

        expect(capturedLogs).toHaveLength(5);
        expect(capturedLogs[0]).toContain('Creating story issue');
        expect(capturedLogs[1]).toContain('Polling for issue (attempt 1/3)');
        expect(capturedLogs[2]).toContain('Issue found');
        expect(capturedLogs[3]).toContain('Waiting for story update');
        expect(capturedLogs[4]).toContain('Story issue created');
      });
    });
  });
});
