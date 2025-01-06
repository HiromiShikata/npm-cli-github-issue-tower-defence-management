import { mock } from 'jest-mock-extended';
import { HandleScheduledEventUseCase } from './HandleScheduledEventUseCase';
import { GenerateWorkingTimeReportUseCase } from './GenerateWorkingTimeReportUseCase';
import { ActionAnnouncementUseCase } from './ActionAnnouncementUseCase';
import { SetWorkflowManagementIssueToStoryUseCase } from './SetWorkflowManagementIssueToStoryUseCase';
import { ClearNextActionHourUseCase } from './ClearNextActionHourUseCase';
import { AnalyzeProblemByIssueUseCase } from './AnalyzeProblemByIssueUseCase';
import { AnalyzeStoriesUseCase } from './AnalyzeStoriesUseCase';
import { ClearDependedIssueURLUseCase } from './ClearDependedIssueURLUseCase';
import { CreateEstimationIssueUseCase } from './CreateEstimationIssueUseCase';
import { ConvertCheckboxToIssueInStoryIssueUseCase } from './ConvertCheckboxToIssueInStoryIssueUseCase';
import { ChangeStatusLongInReviewIssueUseCase } from './ChangeStatusLongInReviewIssueUseCase';
import { DateRepository } from './adapter-interfaces/DateRepository';
import { SpreadsheetRepository } from './adapter-interfaces/SpreadsheetRepository';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { Project, FieldOption } from '../entities/Project';
import { Issue } from '../entities/Issue';

describe('HandleScheduledEventUseCase', () => {
  describe('run', () => {
    it('should call changeStatusLongInReviewIssueUseCase.run with correct parameters', async () => {
      // Mock all dependencies
      const mockGenerateWorkingTimeReportUseCase = mock<GenerateWorkingTimeReportUseCase>();
      const mockActionAnnouncementUseCase = mock<ActionAnnouncementUseCase>();
      const mockSetWorkflowManagementIssueToStoryUseCase = mock<SetWorkflowManagementIssueToStoryUseCase>();
      const mockClearNextActionHourUseCase = mock<ClearNextActionHourUseCase>();
      const mockAnalyzeProblemByIssueUseCase = mock<AnalyzeProblemByIssueUseCase>();
      const mockAnalyzeStoriesUseCase = mock<AnalyzeStoriesUseCase>();
      const mockClearDependedIssueURLUseCase = mock<ClearDependedIssueURLUseCase>();
      const mockCreateEstimationIssueUseCase = mock<CreateEstimationIssueUseCase>();
      const mockConvertCheckboxToIssueInStoryIssueUseCase = mock<ConvertCheckboxToIssueInStoryIssueUseCase>();
      const mockChangeStatusLongInReviewIssueUseCase = mock<ChangeStatusLongInReviewIssueUseCase>();
      const mockDateRepository = mock<DateRepository>();
      const mockSpreadsheetRepository = mock<SpreadsheetRepository>();
      const mockProjectRepository = mock<ProjectRepository>();
      const mockIssueRepository = mock<IssueRepository>();

      // Set up test data
      const testProject: Project = {
        id: 'test-project-id',
        name: 'Test Project',
        status: {
          name: 'Status',
          fieldId: 'status-field-id',
          statuses: Array<FieldOption>(),
        },
        nextActionDate: null,
        nextActionHour: null,
        story: null,
        remainingEstimationMinutes: {
          name: 'Remaining Estimation Minutes',
          fieldId: 'remaining-estimation-minutes',
        },
        dependedIssueUrlSeparatedByComma: null,
        completionDate50PercentConfidence: null,
      };
      const testIssues: Issue[] = [];

      // Set up repository responses
      mockProjectRepository.findProjectIdByUrl.mockResolvedValue('test-project-id');
      mockProjectRepository.getProject.mockResolvedValue(testProject);
      mockIssueRepository.getAllIssues.mockResolvedValue({ issues: testIssues, cacheUsed: false });
      mockDateRepository.now.mockResolvedValue(new Date());
      mockSpreadsheetRepository.getSheet.mockResolvedValue(null);

      // Create use case instance
      const useCase = new HandleScheduledEventUseCase(
        mockGenerateWorkingTimeReportUseCase,
        mockActionAnnouncementUseCase,
        mockSetWorkflowManagementIssueToStoryUseCase,
        mockClearNextActionHourUseCase,
        mockAnalyzeProblemByIssueUseCase,
        mockAnalyzeStoriesUseCase,
        mockClearDependedIssueURLUseCase,
        mockCreateEstimationIssueUseCase,
        mockConvertCheckboxToIssueInStoryIssueUseCase,
        mockDateRepository,
        mockSpreadsheetRepository,
        mockProjectRepository,
        mockIssueRepository,
        mockChangeStatusLongInReviewIssueUseCase,
      );

      // Execute
      await useCase.run({
        projectName: 'Test Project',
        org: 'test-org',
        projectUrl: 'https://example.com/project',
        manager: 'test-manager',
        workingReport: {
          repo: 'test-repo',
          members: [],
          spreadsheetUrl: 'https://example.com/sheet',
          reportIssueLabels: [],
        },
        urlOfStoryView: 'https://example.com/story',
        disabledStatus: 'disabled',
      });

      // Verify
      expect(mockChangeStatusLongInReviewIssueUseCase.run).toHaveBeenCalledWith({
        project: testProject,
        issues: testIssues,
        cacheUsed: false,
        org: 'test-org',
        repo: 'test-repo',
      });
    });
  });


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
        expected: Array(30)
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
});
