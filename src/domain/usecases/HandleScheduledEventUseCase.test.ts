import { HandleScheduledEventUseCase } from './HandleScheduledEventUseCase';
import { mock } from 'jest-mock-extended';
import { ActionAnnouncementUseCase } from './ActionAnnouncementUseCase';
import { SetWorkflowManagementIssueToStoryUseCase } from './SetWorkflowManagementIssueToStoryUseCase';
import { ClearNextActionHourUseCase } from './ClearNextActionHourUseCase';
import { AnalyzeProblemByIssueUseCase } from './AnalyzeProblemByIssueUseCase';
import { AnalyzeStoriesUseCase } from './AnalyzeStoriesUseCase';
import { ClearDependedIssueURLUseCase } from './ClearDependedIssueURLUseCase';
import { CreateEstimationIssueUseCase } from './CreateEstimationIssueUseCase';
import { ConvertCheckboxToIssueInStoryIssueUseCase } from './ConvertCheckboxToIssueInStoryIssueUseCase';
import { DateRepository } from './adapter-interfaces/DateRepository';
import { SpreadsheetRepository } from './adapter-interfaces/SpreadsheetRepository';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { Project } from '../entities/Project';
import { ChangeStatusByStoryColorUseCase } from './ChangeStatusByStoryColorUseCase';
import { SetNoStoryIssueToStoryUseCase } from './SetNoStoryIssueToStoryUseCase';
import { CreateNewStoryByLabelUseCase } from './CreateNewStoryByLabelUseCase';
import { AssignNoAssigneeIssueToManagerUseCase } from './AssignNoAssigneeIssueToManagerUseCase';
import { UpdateIssueStatusByLabelUseCase } from './UpdateIssueStatusByLabelUseCase';

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
    const mockClearNextActionHourUseCase = mock<ClearNextActionHourUseCase>();
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
    const mockDateRepository = mock<DateRepository>();
    const mockSpreadsheetRepository = mock<SpreadsheetRepository>();
    const mockProjectRepository = mock<ProjectRepository>();
    const mockIssueRepository = mock<IssueRepository>();

    const useCase = new HandleScheduledEventUseCase(
      mockActionAnnouncementUseCase,
      mockSetWorkflowManagementIssueToStoryUseCase,
      mockClearNextActionHourUseCase,
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
  });
});
