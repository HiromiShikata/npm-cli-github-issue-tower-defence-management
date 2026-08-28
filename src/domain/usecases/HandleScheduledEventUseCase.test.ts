import { HandleScheduledEventUseCase } from './HandleScheduledEventUseCase';
import { mock } from 'jest-mock-extended';
import { ActionAnnouncementUseCase } from './ActionAnnouncementUseCase';
import { SetWorkflowManagementIssueToStoryUseCase } from './SetWorkflowManagementIssueToStoryUseCase';
import { ClearPastNextActionDateHourUseCase } from './ClearPastNextActionDateHourUseCase';
import { AnalyzeProblemByIssueUseCase } from './AnalyzeProblemByIssueUseCase';
import { AnalyzeStoriesUseCase } from './AnalyzeStoriesUseCase';
import { ClearDependedIssueURLUseCase } from './ClearDependedIssueURLUseCase';
import { SetDependedIssueUrlForOpenTaskPRsUseCase } from './SetDependedIssueUrlForOpenTaskPRsUseCase';
import { StaleTaskPullRequestCloseUseCase } from './StaleTaskPullRequestCloseUseCase';
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
import { IssueNoStatusUpdateUseCase } from './IssueNoStatusUpdateUseCase';
import { StartPreparationUseCase } from './StartPreparationUseCase';
import { RevertOrphanedPreparationUseCase } from './RevertOrphanedPreparationUseCase';
import { ConflictedIssueRevertUseCase } from './ConflictedIssueRevertUseCase';
import { RevertNotReadyReviewQueueIssueUseCase } from './RevertNotReadyReviewQueueIssueUseCase';
import { TriagerApprovalDispatchUseCase } from './TriagerApprovalDispatchUseCase';
import { AgentDesignationLabelAdoptUseCase } from './AgentDesignationLabelAdoptUseCase';
import { ProjectRequiredFieldCreateUseCase } from './ProjectRequiredFieldCreateUseCase';
import { SetupTowerDefenceProjectUseCase } from './SetupTowerDefenceProjectUseCase';
import { UpdateRateLimitCacheUseCase } from './UpdateRateLimitCacheUseCase';
import { DailySecurityScanUseCase } from './DailySecurityScanUseCase';
import { QualityCheckAdvanceUseCase } from './QualityCheckAdvanceUseCase';
import { ReopenedDoneIssueRevertUseCase } from './ReopenedDoneIssueRevertUseCase';

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
    const mockProjectRequiredFieldCreateUseCase =
      mock<ProjectRequiredFieldCreateUseCase>();
    const mockSetupTowerDefenceProjectUseCase =
      mock<SetupTowerDefenceProjectUseCase>();
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
    const mockSetDependedIssueUrlForOpenTaskPRsUseCase =
      mock<SetDependedIssueUrlForOpenTaskPRsUseCase>();
    const mockStaleTaskPullRequestCloseUseCase =
      mock<StaleTaskPullRequestCloseUseCase>();
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
    const mockIssueNoStatusUpdateUseCase = mock<IssueNoStatusUpdateUseCase>();
    const mockStartPreparationUseCase = mock<StartPreparationUseCase>();
    const mockRevertOrphanedPreparationUseCase =
      mock<RevertOrphanedPreparationUseCase>();
    const mockConflictedIssueRevertUseCase =
      mock<ConflictedIssueRevertUseCase>();
    const mockRevertNotReadyReviewQueueIssueUseCase =
      mock<RevertNotReadyReviewQueueIssueUseCase>();
    const mockTriagerApprovalDispatchUseCase =
      mock<TriagerApprovalDispatchUseCase>();
    const mockAgentDesignationLabelAdoptUseCase =
      mock<AgentDesignationLabelAdoptUseCase>();
    const mockUpdateRateLimitCacheUseCase = mock<UpdateRateLimitCacheUseCase>();
    const mockDailySecurityScanUseCase = mock<DailySecurityScanUseCase>();
    const mockAdvanceQualityCheckUseCase = mock<QualityCheckAdvanceUseCase>();
    const mockReopenedDoneIssueRevertUseCase =
      mock<ReopenedDoneIssueRevertUseCase>();
    const mockDateRepository = mock<DateRepository>();
    const mockSpreadsheetRepository = mock<SpreadsheetRepository>();
    const mockProjectRepository = mock<ProjectRepository>();
    const mockIssueRepository = mock<IssueRepository>();

    const useCase = new HandleScheduledEventUseCase(
      mockProjectRequiredFieldCreateUseCase,
      mockSetupTowerDefenceProjectUseCase,
      mockActionAnnouncementUseCase,
      mockSetWorkflowManagementIssueToStoryUseCase,
      mockClearPastNextActionDateHourUseCase,
      mockAnalyzeProblemByIssueUseCase,
      mockAnalyzeStoriesUseCase,
      mockClearDependedIssueURLUseCase,
      mockSetDependedIssueUrlForOpenTaskPRsUseCase,
      mockStaleTaskPullRequestCloseUseCase,
      mockCreateEstimationIssueUseCase,
      mockConvertCheckboxToIssueInStoryIssueUseCase,
      mockChangeStatusByStoryColorUseCase,
      mockSetNoStoryIssueToStoryUseCase,
      mockCreateNewStoryByLabelUseCase,
      mockAssignNoAssigneeIssueToManagerUseCase,
      mockUpdateIssueStatusByLabelUseCase,
      mockIssueNoStatusUpdateUseCase,
      mockStartPreparationUseCase,
      mockRevertOrphanedPreparationUseCase,
      mockConflictedIssueRevertUseCase,
      mockRevertNotReadyReviewQueueIssueUseCase,
      mockTriagerApprovalDispatchUseCase,
      mockAgentDesignationLabelAdoptUseCase,
      mockUpdateRateLimitCacheUseCase,
      mockDailySecurityScanUseCase,
      mockAdvanceQualityCheckUseCase,
      mockReopenedDoneIssueRevertUseCase,
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
        project: mock<Project>(),
        cacheUsed: false,
      });
      mockSpreadsheetRepository.getSheet.mockResolvedValue([
        ['LastExecutionDateTime'],
        ['2024-01-01T00:00:00Z'],
      ]);
      mockStartPreparationUseCase.run.mockResolvedValue({
        rotationOrder: null,
      });
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
        disabled: false,
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
        disabled: false,
      };

      const mockProject = mock<Project>();
      mockIssueRepository.getAllIssues.mockResolvedValue({
        issues: [],
        project: mockProject,
        cacheUsed: false,
      });
      await useCase.run(input);
      expect(mockUpdateIssueStatusByLabelUseCase.run).toHaveBeenCalledWith({
        project: mockProject,
        issues: [],
      });
    });

    it('should call IssueNoStatusUpdateUseCase with project and issues when startPreparation is configured', async () => {
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
        disabled: false,
        startPreparation: {
          defaultAgentName: 'agent1',
          configFilePath: '/path/to/config.yml',
          maximumPreparingIssuesCount: null,
        },
      };

      const mockProject = mock<Project>();
      const mockIssues = [mock<Issue>()];
      mockIssueRepository.getAllIssues.mockResolvedValue({
        issues: mockIssues,
        project: mockProject,
        cacheUsed: false,
      });
      await useCase.run(input);

      expect(mockIssueNoStatusUpdateUseCase.run).toHaveBeenCalledWith({
        project: mockProject,
        issues: mockIssues,
      });
    });

    it('should call TriagerApprovalDispatchUseCase with project URL', async () => {
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
        disabled: false,
      };

      await useCase.run(input);
      expect(mockTriagerApprovalDispatchUseCase.run).toHaveBeenCalledWith(
        expect.objectContaining({
          projectUrl: 'https://github.com/test-org/test-project',
        }),
      );
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
        disabled: true,
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
        disabled: false,
      };

      const mockProject = mock<Project>();
      mockProjectRepository.getProject.mockResolvedValue(mockProject);
      const result = await useCase.run(input);
      expect(result).not.toBeNull();
      expect(mockProjectRepository.findProjectIdByUrl).toHaveBeenCalled();
    });

    it('should pass createTaskFromStoryBodyCheckboxEnabled false to ConvertCheckboxToIssueInStoryIssueUseCase when the field is absent', async () => {
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
        disabled: false,
      };

      await useCase.run(input);
      expect(
        mockConvertCheckboxToIssueInStoryIssueUseCase.run,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          createTaskFromStoryBodyCheckboxEnabled: false,
        }),
      );
    });

    it('should pass createTaskFromStoryBodyCheckboxEnabled true to ConvertCheckboxToIssueInStoryIssueUseCase when the field is true', async () => {
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
        disabled: false,
        createTaskFromStoryBodyCheckboxEnabled: true,
      };

      await useCase.run(input);
      expect(
        mockConvertCheckboxToIssueInStoryIssueUseCase.run,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          createTaskFromStoryBodyCheckboxEnabled: true,
        }),
      );
    });

    it('should pass storyProgressCommentEnabled true to AnalyzeProblemByIssueUseCase when the field is absent', async () => {
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
        disabled: false,
      };

      await useCase.run(input);
      expect(mockAnalyzeProblemByIssueUseCase.run).toHaveBeenCalledWith(
        expect.objectContaining({
          storyProgressCommentEnabled: true,
        }),
      );
    });

    it('should pass storyProgressCommentEnabled false to AnalyzeProblemByIssueUseCase when the field is false', async () => {
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
        disabled: false,
        storyProgressCommentEnabled: false,
      };

      await useCase.run(input);
      expect(mockAnalyzeProblemByIssueUseCase.run).toHaveBeenCalledWith(
        expect.objectContaining({
          storyProgressCommentEnabled: false,
        }),
      );
    });

    it('should call getAllIssues with the resolved project id', async () => {
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
        disabled: false,
      };

      await useCase.run(input);
      expect(mockIssueRepository.getAllIssues).toHaveBeenCalledWith(
        'project-1',
      );
    });

    it('should pass awaitingQualityCheckStatus to revertOrphanedPreparationUseCase when startPreparation is configured', async () => {
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
        startPreparation: {
          awaitingWorkspaceStatus: 'Awaiting Workspace',
          preparationStatus: 'Preparation',
          awaitingQualityCheckStatus: 'Awaiting Quality Check',
          defaultAgentName: 'aw',
          configFilePath: '/path/to/config.yml',
          maximumPreparingIssuesCount: null,
          preparationProcessCheckCommand: 'pgrep -f "{URL}"',
        },
      };

      mockProjectRepository.getProject.mockResolvedValue(mock<Project>());
      await useCase.run(input);

      expect(mockRevertOrphanedPreparationUseCase.run).toHaveBeenCalledWith(
        expect.objectContaining({
          awaitingQualityCheckStatus: 'Awaiting Quality Check',
        }),
      );
    });

    it('should invoke conflictedIssueRevertUseCase on every scheduled run', async () => {
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
        disabled: false,
      };

      mockProjectRepository.getProject.mockResolvedValue(mock<Project>());
      await useCase.run(input);

      expect(mockConflictedIssueRevertUseCase.run).toHaveBeenCalledWith(
        expect.objectContaining({
          projectUrl: 'https://github.com/test-org/test-project',
        }),
      );
    });

    it('should invoke revertNotReadyReviewQueueIssueUseCase on every scheduled run', async () => {
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
        disabled: false,
      };

      mockProjectRepository.getProject.mockResolvedValue(mock<Project>());
      await useCase.run(input);

      expect(
        mockRevertNotReadyReviewQueueIssueUseCase.run,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          projectUrl: 'https://github.com/test-org/test-project',
        }),
      );
    });

    it('should invoke revertNotReadyReviewQueueIssueUseCase even when startPreparation is absent', async () => {
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
        disabled: false,
      };

      mockProjectRepository.getProject.mockResolvedValue(mock<Project>());
      await useCase.run(input);

      expect(
        mockRevertNotReadyReviewQueueIssueUseCase.run,
      ).toHaveBeenCalledTimes(1);
    });

    it('should pass a top-level allowedIssueAuthors to revertNotReadyReviewQueueIssueUseCase', async () => {
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
        disabled: false,
        allowedIssueAuthors: ['top-level-author'],
      };

      mockProjectRepository.getProject.mockResolvedValue(mock<Project>());
      await useCase.run(input);

      expect(
        mockRevertNotReadyReviewQueueIssueUseCase.run,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          allowedIssueAuthors: ['top-level-author'],
        }),
      );
    });

    it('should prefer a top-level allowedIssueAuthors over the startPreparation one', async () => {
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
        disabled: false,
        allowedIssueAuthors: ['top-level-author'],
        startPreparation: {
          defaultAgentName: 'agent1',
          configFilePath: '/path/to/config.yml',
          maximumPreparingIssuesCount: null,
          allowedIssueAuthors: ['nested-author'],
        },
      };

      mockProjectRepository.getProject.mockResolvedValue(mock<Project>());
      mockStartPreparationUseCase.run.mockResolvedValue({
        rotationOrder: null,
      });
      await useCase.run(input);

      expect(
        mockRevertNotReadyReviewQueueIssueUseCase.run,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          allowedIssueAuthors: ['top-level-author'],
        }),
      );
      expect(mockStartPreparationUseCase.run).toHaveBeenCalledWith(
        expect.objectContaining({
          allowedIssueAuthors: ['top-level-author'],
        }),
      );
    });

    it('should fall back to startPreparation allowedIssueAuthors when no top-level value is set', async () => {
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
        disabled: false,
        startPreparation: {
          defaultAgentName: 'agent1',
          configFilePath: '/path/to/config.yml',
          maximumPreparingIssuesCount: null,
          allowedIssueAuthors: ['nested-author'],
        },
      };

      mockProjectRepository.getProject.mockResolvedValue(mock<Project>());
      mockStartPreparationUseCase.run.mockResolvedValue({
        rotationOrder: null,
      });
      await useCase.run(input);

      expect(
        mockRevertNotReadyReviewQueueIssueUseCase.run,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          allowedIssueAuthors: ['nested-author'],
        }),
      );
    });

    it('should invoke UpdateRateLimitCacheUseCase before StartPreparationUseCase when startPreparation is configured', async () => {
      const callOrder: string[] = [];
      mockUpdateRateLimitCacheUseCase.run.mockImplementation(async () => {
        callOrder.push('updateRateLimitCache');
      });
      mockStartPreparationUseCase.run.mockImplementation(async () => {
        callOrder.push('startPreparation');
        return { rotationOrder: null };
      });

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
        disabled: false,
        startPreparation: {
          defaultAgentName: 'aw',
          configFilePath: '/path/to/config.yml',
          maximumPreparingIssuesCount: null,
        },
      };

      mockProjectRepository.getProject.mockResolvedValue(mock<Project>());
      await useCase.run(input);

      expect(mockUpdateRateLimitCacheUseCase.run).toHaveBeenCalledTimes(1);
      expect(callOrder.indexOf('updateRateLimitCache')).toBeLessThan(
        callOrder.indexOf('startPreparation'),
      );
    });

    it('should not invoke UpdateRateLimitCacheUseCase when startPreparation is absent', async () => {
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
        disabled: false,
      };

      mockProjectRepository.getProject.mockResolvedValue(mock<Project>());
      await useCase.run(input);

      expect(mockUpdateRateLimitCacheUseCase.run).not.toHaveBeenCalled();
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
        disabled: false,
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
        agent: null,
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
          project: storyProject,
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

    describe('slow sweep cadence', () => {
      const baseInput = {
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
        disabled: false,
        startPreparation: {
          defaultAgentName: 'test-agent',
          configFilePath: '/path/to/config.yml',
          maximumPreparingIssuesCount: null,
          defaultLlmModelName: null,
          defaultLlmAgentName: null,
        },
      };

      it('should run slow sweep use cases when no LastSlowSweepDateTime is recorded', async () => {
        mockSpreadsheetRepository.getSheet.mockResolvedValue([
          ['LastExecutionDateTime'],
          ['2024-01-01T00:00:00Z'],
        ]);
        mockDateRepository.now.mockResolvedValue(
          new Date('2024-01-01T00:10:00Z'),
        );

        await useCase.run(baseInput);

        expect(mockAnalyzeStoriesUseCase.run).toHaveBeenCalled();
        expect(mockUpdateIssueStatusByLabelUseCase.run).toHaveBeenCalled();
        expect(mockChangeStatusByStoryColorUseCase.run).toHaveBeenCalled();
        expect(mockCreateNewStoryByLabelUseCase.run).toHaveBeenCalled();
      });

      it('should skip slow sweep use cases when LastSlowSweepDateTime is within 600 seconds', async () => {
        const now = new Date('2024-01-01T00:10:00Z');
        const recentSlowSweep = new Date(
          now.getTime() - 300 * 1000,
        ).toISOString();
        mockSpreadsheetRepository.getSheet.mockResolvedValue([
          ['LastExecutionDateTime'],
          [
            '2024-01-01T00:00:00Z',
            '',
            '',
            'LastSlowSweepDateTime',
            recentSlowSweep,
          ],
        ]);
        mockDateRepository.now.mockResolvedValue(now);

        await useCase.run(baseInput);

        expect(mockAnalyzeStoriesUseCase.run).not.toHaveBeenCalled();
        expect(mockUpdateIssueStatusByLabelUseCase.run).not.toHaveBeenCalled();
        expect(mockChangeStatusByStoryColorUseCase.run).not.toHaveBeenCalled();
      });

      it('should run the new story label use case on a loop where slow sweep is skipped', async () => {
        const now = new Date('2024-01-01T00:10:00Z');
        const recentSlowSweep = new Date(
          now.getTime() - 300 * 1000,
        ).toISOString();
        mockSpreadsheetRepository.getSheet.mockResolvedValue([
          ['LastExecutionDateTime'],
          [
            '2024-01-01T00:00:00Z',
            '',
            '',
            'LastSlowSweepDateTime',
            recentSlowSweep,
          ],
        ]);
        mockDateRepository.now.mockResolvedValue(now);

        await useCase.run(baseInput);

        expect(mockCreateNewStoryByLabelUseCase.run).toHaveBeenCalledTimes(1);
        expect(mockAnalyzeStoriesUseCase.run).not.toHaveBeenCalled();
      });

      it('should still run preparation use cases even when slow sweep is skipped', async () => {
        const now = new Date('2024-01-01T00:10:00Z');
        const recentSlowSweep = new Date(
          now.getTime() - 300 * 1000,
        ).toISOString();
        mockSpreadsheetRepository.getSheet.mockResolvedValue([
          ['LastExecutionDateTime'],
          [
            '2024-01-01T00:00:00Z',
            '',
            '',
            'LastSlowSweepDateTime',
            recentSlowSweep,
          ],
        ]);
        mockDateRepository.now.mockResolvedValue(now);

        await useCase.run(baseInput);

        expect(mockStartPreparationUseCase.run).toHaveBeenCalled();
      });

      it('should run slow sweep use cases when LastSlowSweepDateTime is exactly 600 seconds ago', async () => {
        const now = new Date('2024-01-01T00:10:00Z');
        const exactThresholdSlowSweep = new Date(
          now.getTime() - 600 * 1000,
        ).toISOString();
        mockSpreadsheetRepository.getSheet.mockResolvedValue([
          ['LastExecutionDateTime'],
          [
            '2024-01-01T00:00:00Z',
            '',
            '',
            'LastSlowSweepDateTime',
            exactThresholdSlowSweep,
          ],
        ]);
        mockDateRepository.now.mockResolvedValue(now);

        await useCase.run(baseInput);

        expect(mockAnalyzeStoriesUseCase.run).toHaveBeenCalled();
        expect(mockUpdateIssueStatusByLabelUseCase.run).toHaveBeenCalled();
      });

      it('should update LastSlowSweepDateTime in spreadsheet when slow sweep runs', async () => {
        mockSpreadsheetRepository.getSheet.mockResolvedValue([
          ['LastExecutionDateTime'],
          ['2024-01-01T00:00:00Z'],
        ]);
        const now = new Date('2024-01-01T00:10:00Z');
        mockDateRepository.now.mockResolvedValue(now);

        await useCase.run(baseInput);

        const updateCellCalls = mockSpreadsheetRepository.updateCell.mock.calls;
        const slowSweepHeaderCall = updateCellCalls.find(
          (call) => call[2] === 1 && call[3] === 3,
        );
        const slowSweepValueCall = updateCellCalls.find(
          (call) => call[2] === 1 && call[3] === 4,
        );
        expect(slowSweepHeaderCall).toBeDefined();
        expect(slowSweepHeaderCall?.[4]).toBe('LastSlowSweepDateTime');
        expect(slowSweepValueCall).toBeDefined();
        expect(slowSweepValueCall?.[4]).toBe(now.toISOString());
      });

      it('should not update LastSlowSweepDateTime when slow sweep is skipped', async () => {
        const now = new Date('2024-01-01T00:10:00Z');
        const recentSlowSweep = new Date(
          now.getTime() - 300 * 1000,
        ).toISOString();
        mockSpreadsheetRepository.getSheet.mockResolvedValue([
          ['LastExecutionDateTime'],
          [
            '2024-01-01T00:00:00Z',
            '',
            '',
            'LastSlowSweepDateTime',
            recentSlowSweep,
          ],
        ]);
        mockDateRepository.now.mockResolvedValue(now);

        await useCase.run(baseInput);

        const updateCellCalls = mockSpreadsheetRepository.updateCell.mock.calls;
        const slowSweepValueCall = updateCellCalls.find(
          (call) => call[2] === 1 && call[3] === 4,
        );
        expect(slowSweepValueCall).toBeUndefined();
      });
    });

    describe('workflow incident issue deduplication in catch block', () => {
      const errorInput = {
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
        disabled: false,
      };

      beforeEach(() => {
        mockIssueRepository.searchIssue.mockResolvedValue([]);
      });

      it('should create a new incident issue when none exists for a non-transient error', async () => {
        const nonTransientError = new Error(
          'something went wrong unexpectedly',
        );
        mockRevertNotReadyReviewQueueIssueUseCase.run.mockRejectedValueOnce(
          nonTransientError,
        );

        await expect(useCase.run(errorInput)).rejects.toThrow(
          'something went wrong unexpectedly',
        );

        expect(mockIssueRepository.searchIssue).toHaveBeenCalledWith(
          expect.objectContaining({
            owner: 'test-org',
            repositoryName: 'test-repo',
            type: 'issue',
            state: 'open',
            title: 'Error in HandleScheduledEvent / workflow incident',
          }),
        );
        expect(mockIssueRepository.createNewIssue).toHaveBeenCalledWith(
          'test-org',
          'test-repo',
          'Error in HandleScheduledEvent / workflow incident',
          expect.stringContaining('something went wrong unexpectedly'),
          ['test-manager'],
          ['error'],
        );
        expect(mockIssueRepository.createCommentByUrl).not.toHaveBeenCalled();
      });

      it('should add a comment to the existing incident issue when one already exists', async () => {
        const nonTransientError = new Error(
          'something went wrong unexpectedly',
        );
        mockRevertNotReadyReviewQueueIssueUseCase.run.mockRejectedValueOnce(
          nonTransientError,
        );
        const existingIssueUrl =
          'https://github.com/test-org/test-repo/issues/42';
        mockIssueRepository.searchIssue.mockResolvedValue([
          {
            url: existingIssueUrl,
            title: 'Error in HandleScheduledEvent / workflow incident',
            number: '42',
          },
        ]);

        await expect(useCase.run(errorInput)).rejects.toThrow(
          'something went wrong unexpectedly',
        );

        expect(mockIssueRepository.createCommentByUrl).toHaveBeenCalledWith(
          existingIssueUrl,
          expect.stringContaining('something went wrong unexpectedly'),
        );
        expect(mockIssueRepository.createNewIssue).not.toHaveBeenCalledWith(
          expect.anything(),
          expect.anything(),
          'Error in HandleScheduledEvent / workflow incident',
          expect.anything(),
          expect.anything(),
          expect.anything(),
        );
      });

      it('should not create or comment an incident issue for a transient 401 error', async () => {
        const transientError = new Error('HttpError: 401 Unauthorized');
        mockRevertNotReadyReviewQueueIssueUseCase.run.mockRejectedValueOnce(
          transientError,
        );

        await expect(useCase.run(errorInput)).rejects.toThrow('401');

        expect(mockIssueRepository.searchIssue).not.toHaveBeenCalled();
        expect(mockIssueRepository.createNewIssue).not.toHaveBeenCalled();
        expect(mockIssueRepository.createCommentByUrl).not.toHaveBeenCalled();
      });

      it('should not create or comment an incident issue for a transient 429 rate limit error', async () => {
        const transientError = new Error('API rate limit exceeded 429');
        mockRevertNotReadyReviewQueueIssueUseCase.run.mockRejectedValueOnce(
          transientError,
        );

        await expect(useCase.run(errorInput)).rejects.toThrow('429');

        expect(mockIssueRepository.searchIssue).not.toHaveBeenCalled();
        expect(mockIssueRepository.createNewIssue).not.toHaveBeenCalled();
        expect(mockIssueRepository.createCommentByUrl).not.toHaveBeenCalled();
      });

      it('should not create or comment an incident issue for a transient 502 error', async () => {
        const transientError = new Error('502 Bad Gateway');
        mockRevertNotReadyReviewQueueIssueUseCase.run.mockRejectedValueOnce(
          transientError,
        );

        await expect(useCase.run(errorInput)).rejects.toThrow('502');

        expect(mockIssueRepository.searchIssue).not.toHaveBeenCalled();
        expect(mockIssueRepository.createNewIssue).not.toHaveBeenCalled();
        expect(mockIssueRepository.createCommentByUrl).not.toHaveBeenCalled();
      });

      it('should not create or comment an incident issue for a transient 503 error', async () => {
        const transientError = new Error('503 Service Unavailable');
        mockRevertNotReadyReviewQueueIssueUseCase.run.mockRejectedValueOnce(
          transientError,
        );

        await expect(useCase.run(errorInput)).rejects.toThrow('503');

        expect(mockIssueRepository.searchIssue).not.toHaveBeenCalled();
        expect(mockIssueRepository.createNewIssue).not.toHaveBeenCalled();
        expect(mockIssueRepository.createCommentByUrl).not.toHaveBeenCalled();
      });

      it('should not create or comment an incident issue for a GraphQL RATE_LIMIT error', async () => {
        const transientError = new Error('GraphQL error: RATE_LIMIT exceeded');
        mockRevertNotReadyReviewQueueIssueUseCase.run.mockRejectedValueOnce(
          transientError,
        );

        await expect(useCase.run(errorInput)).rejects.toThrow('RATE_LIMIT');

        expect(mockIssueRepository.searchIssue).not.toHaveBeenCalled();
        expect(mockIssueRepository.createNewIssue).not.toHaveBeenCalled();
        expect(mockIssueRepository.createCommentByUrl).not.toHaveBeenCalled();
      });

      it('should not create or comment an incident issue for a bad credentials error', async () => {
        const transientError = new Error('Bad credentials');
        mockRevertNotReadyReviewQueueIssueUseCase.run.mockRejectedValueOnce(
          transientError,
        );

        await expect(useCase.run(errorInput)).rejects.toThrow(
          'Bad credentials',
        );

        expect(mockIssueRepository.searchIssue).not.toHaveBeenCalled();
        expect(mockIssueRepository.createNewIssue).not.toHaveBeenCalled();
        expect(mockIssueRepository.createCommentByUrl).not.toHaveBeenCalled();
      });

      it('should not create or comment an incident issue for a fetch AbortSignal timeout DOMException', async () => {
        const timeoutError = new DOMException(
          'The operation was aborted due to timeout',
          'TimeoutError',
        );
        mockRevertNotReadyReviewQueueIssueUseCase.run.mockRejectedValueOnce(
          timeoutError,
        );

        await expect(useCase.run(errorInput)).rejects.toThrow(
          'The operation was aborted due to timeout',
        );

        expect(mockIssueRepository.searchIssue).not.toHaveBeenCalled();
        expect(mockIssueRepository.createNewIssue).not.toHaveBeenCalled();
        expect(mockIssueRepository.createCommentByUrl).not.toHaveBeenCalled();
      });

      it('should not create or comment an incident issue for a ky TimeoutError (matched by error name)', async () => {
        const timeoutError = new Error(
          'Request timed out: POST https://api.github.com/graphql',
        );
        timeoutError.name = 'TimeoutError';
        mockRevertNotReadyReviewQueueIssueUseCase.run.mockRejectedValueOnce(
          timeoutError,
        );

        await expect(useCase.run(errorInput)).rejects.toThrow(
          'Request timed out',
        );

        expect(mockIssueRepository.searchIssue).not.toHaveBeenCalled();
        expect(mockIssueRepository.createNewIssue).not.toHaveBeenCalled();
        expect(mockIssueRepository.createCommentByUrl).not.toHaveBeenCalled();
      });

      it('should not create or comment an incident issue for a request timed out error (matched by message)', async () => {
        const timeoutError = new Error(
          'Request timed out: POST https://api.github.com/graphql',
        );
        mockRevertNotReadyReviewQueueIssueUseCase.run.mockRejectedValueOnce(
          timeoutError,
        );

        await expect(useCase.run(errorInput)).rejects.toThrow(
          'Request timed out',
        );

        expect(mockIssueRepository.searchIssue).not.toHaveBeenCalled();
        expect(mockIssueRepository.createNewIssue).not.toHaveBeenCalled();
        expect(mockIssueRepository.createCommentByUrl).not.toHaveBeenCalled();
      });
    });

    describe('spreadsheet access failure error issue creation', () => {
      const failureInput = {
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
        disabled: false,
      };

      it('should create an error issue and rethrow when spreadsheet read fails in findTargetDateAndUpdateLastExecutionDateTime', async () => {
        const readError = new Error('boom on getSheet');
        mockSpreadsheetRepository.getSheet.mockRejectedValueOnce(readError);

        await expect(useCase.run(failureInput)).rejects.toThrow(
          'boom on getSheet',
        );

        expect(mockIssueRepository.createNewIssue).toHaveBeenCalledWith(
          failureInput.org,
          failureInput.workingReport.repo,
          'Error in HandleScheduledEvent / spreadsheet read failure',
          expect.stringContaining(failureInput.workingReport.spreadsheetUrl),
          [failureInput.manager],
          ['error'],
        );
        const body = mockIssueRepository.createNewIssue.mock.calls[0][3];
        expect(body).toContain('Operation: read');
        expect(body).toContain('boom on getSheet');
        expect(body).toContain(readError.stack ?? '');
      });

      it('should create an error issue and rethrow when spreadsheet write fails in findTargetDateAndUpdateLastExecutionDateTime', async () => {
        const writeError = new Error('boom on updateCell');
        mockSpreadsheetRepository.getSheet.mockResolvedValueOnce([
          ['LastExecutionDateTime'],
          ['2024-01-01T00:00:00Z'],
        ]);
        mockSpreadsheetRepository.updateCell.mockRejectedValueOnce(writeError);

        await expect(useCase.run(failureInput)).rejects.toThrow(
          'boom on updateCell',
        );

        expect(mockIssueRepository.createNewIssue).toHaveBeenCalledWith(
          failureInput.org,
          failureInput.workingReport.repo,
          'Error in HandleScheduledEvent / spreadsheet write failure',
          expect.stringContaining(failureInput.workingReport.spreadsheetUrl),
          [failureInput.manager],
          ['error'],
        );
        const body = mockIssueRepository.createNewIssue.mock.calls[0][3];
        expect(body).toContain('Operation: write');
        expect(body).toContain('boom on updateCell');
        expect(body).toContain(writeError.stack ?? '');
      });
    });

    describe('transient spreadsheet API error containment', () => {
      const transientInput = {
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
        disabled: false,
      };

      const createGaxiosLikeError = (
        message: string,
        status?: number,
        code?: string,
      ): Error => {
        const error: Error & {
          status?: number;
          code?: string;
          response?: { status?: number };
        } = new Error(message);
        error.name = 'GaxiosError';
        if (status !== undefined) {
          error.status = status;
          error.response = { status };
        }
        if (code !== undefined) {
          error.code = code;
        }
        return error;
      };

      let warnSpy: jest.SpyInstance;
      beforeEach(() => {
        warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      });
      afterEach(() => {
        warnSpy.mockRestore();
      });

      it('should skip the spreadsheet read and continue the cycle when getSheet fails with a gaxios HTTP 500 error', async () => {
        mockSpreadsheetRepository.getSheet.mockRejectedValue(
          createGaxiosLikeError('Internal error encountered.', 500),
        );

        const result = await useCase.run(transientInput);

        expect(result).not.toBeNull();
        expect(result?.targetDateTimes).toEqual([]);
        expect(mockIssueRepository.createNewIssue).not.toHaveBeenCalled();
        expect(warnSpy).toHaveBeenCalled();
        expect(
          mockRevertNotReadyReviewQueueIssueUseCase.run,
        ).toHaveBeenCalled();
      });

      it('should skip the spreadsheet write and continue the cycle when updateCell fails with a gaxios HTTP 503 error', async () => {
        mockSpreadsheetRepository.updateCell.mockRejectedValue(
          createGaxiosLikeError('The service is currently unavailable.', 503),
        );

        const result = await useCase.run(transientInput);

        expect(result).not.toBeNull();
        expect(result?.targetDateTimes).toEqual([]);
        expect(mockIssueRepository.createNewIssue).not.toHaveBeenCalled();
        expect(warnSpy).toHaveBeenCalled();
        expect(
          mockRevertNotReadyReviewQueueIssueUseCase.run,
        ).toHaveBeenCalled();
      });

      it('should skip the spreadsheet operation and continue the cycle when getSheet fails with a gaxios HTTP 429 rate limit error', async () => {
        mockSpreadsheetRepository.getSheet.mockRejectedValue(
          createGaxiosLikeError('Quota exceeded', 429),
        );

        const result = await useCase.run(transientInput);

        expect(result).not.toBeNull();
        expect(result?.targetDateTimes).toEqual([]);
        expect(mockIssueRepository.createNewIssue).not.toHaveBeenCalled();
        expect(warnSpy).toHaveBeenCalled();
        expect(
          mockRevertNotReadyReviewQueueIssueUseCase.run,
        ).toHaveBeenCalled();
      });

      it('should skip the spreadsheet operation and continue the cycle when getSheet fails with a gaxios network error without an HTTP status', async () => {
        mockSpreadsheetRepository.getSheet.mockRejectedValue(
          createGaxiosLikeError('socket hang up', undefined, 'ECONNRESET'),
        );

        const result = await useCase.run(transientInput);

        expect(result).not.toBeNull();
        expect(result?.targetDateTimes).toEqual([]);
        expect(mockIssueRepository.createNewIssue).not.toHaveBeenCalled();
        expect(warnSpy).toHaveBeenCalled();
        expect(
          mockRevertNotReadyReviewQueueIssueUseCase.run,
        ).toHaveBeenCalled();
      });

      it('should skip the spreadsheet operation and continue the cycle when getSheet fails with a gaxios internal error carrying no status field (matched by message)', async () => {
        mockSpreadsheetRepository.getSheet.mockRejectedValue(
          createGaxiosLikeError('Internal error encountered.'),
        );

        const result = await useCase.run(transientInput);

        expect(result).not.toBeNull();
        expect(result?.targetDateTimes).toEqual([]);
        expect(mockIssueRepository.createNewIssue).not.toHaveBeenCalled();
        expect(warnSpy).toHaveBeenCalled();
        expect(
          mockRevertNotReadyReviewQueueIssueUseCase.run,
        ).toHaveBeenCalled();
      });

      it('should create an error issue and rethrow when getSheet fails with a gaxios HTTP 401 authentication error', async () => {
        mockSpreadsheetRepository.getSheet.mockRejectedValue(
          createGaxiosLikeError('Invalid Credentials', 401),
        );

        await expect(useCase.run(transientInput)).rejects.toThrow(
          'Invalid Credentials',
        );

        expect(mockIssueRepository.createNewIssue).toHaveBeenCalledWith(
          transientInput.org,
          transientInput.workingReport.repo,
          'Error in HandleScheduledEvent / spreadsheet read failure',
          expect.stringContaining(transientInput.workingReport.spreadsheetUrl),
          [transientInput.manager],
          ['error'],
        );
      });

      it('should create an error issue and rethrow when getSheet fails with a gaxios HTTP 403 permission error', async () => {
        mockSpreadsheetRepository.getSheet.mockRejectedValue(
          createGaxiosLikeError('The caller does not have permission', 403),
        );

        await expect(useCase.run(transientInput)).rejects.toThrow(
          'The caller does not have permission',
        );

        expect(mockIssueRepository.createNewIssue).toHaveBeenCalledWith(
          transientInput.org,
          transientInput.workingReport.repo,
          'Error in HandleScheduledEvent / spreadsheet read failure',
          expect.stringContaining(transientInput.workingReport.spreadsheetUrl),
          [transientInput.manager],
          ['error'],
        );
      });
    });

    describe('empty targetDateTimes handling', () => {
      const emptyTargetInput = {
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
        disabled: false,
      };

      it('should not crash and should skip the LastExecutionDateTime write when lastExecutionDateTime is within 60 seconds of now', async () => {
        const lastExecution = '2024-01-01T00:00:00Z';
        const now = new Date('2024-01-01T00:00:30Z');
        mockSpreadsheetRepository.getSheet.mockResolvedValue([
          ['LastExecutionDateTime'],
          ['', '', lastExecution],
        ]);
        mockDateRepository.now.mockResolvedValue(now);

        const result = await useCase.run(emptyTargetInput);

        expect(result).not.toBeNull();
        expect(result?.targetDateTimes).toEqual([]);
        const updateCellCalls = mockSpreadsheetRepository.updateCell.mock.calls;
        const lastExecutionWrite = updateCellCalls.find(
          (call) => call[2] === 1 && call[3] === 2,
        );
        expect(lastExecutionWrite).toBeUndefined();
      });

      it('should not crash and should skip the LastExecutionDateTime write when lastExecutionDateTime equals now', async () => {
        const sameTime = '2024-01-01T00:00:00Z';
        mockSpreadsheetRepository.getSheet.mockResolvedValue([
          ['LastExecutionDateTime'],
          ['', '', sameTime],
        ]);
        mockDateRepository.now.mockResolvedValue(new Date(sameTime));

        const result = await useCase.run(emptyTargetInput);

        expect(result).not.toBeNull();
        expect(result?.targetDateTimes).toEqual([]);
        const updateCellCalls = mockSpreadsheetRepository.updateCell.mock.calls;
        const lastExecutionWrite = updateCellCalls.find(
          (call) => call[2] === 1 && call[3] === 2,
        );
        expect(lastExecutionWrite).toBeUndefined();
      });
    });

    describe('autoAdvanceQualityCheckEnabled', () => {
      const baseInput = {
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
        disabled: false,
      };

      it('does not call advanceQualityCheckUseCase when autoAdvanceQualityCheckEnabled is absent', async () => {
        await useCase.run(baseInput);

        expect(mockAdvanceQualityCheckUseCase.run).not.toHaveBeenCalled();
      });

      it('does not call advanceQualityCheckUseCase when autoAdvanceQualityCheckEnabled is false', async () => {
        await useCase.run({
          ...baseInput,
          startPreparation: {
            defaultAgentName: 'agent1',
            configFilePath: '/path/to/config.yml',
            maximumPreparingIssuesCount: null,
            autoAdvanceQualityCheckEnabled: false,
          },
        });

        expect(mockAdvanceQualityCheckUseCase.run).not.toHaveBeenCalled();
      });

      it('calls advanceQualityCheckUseCase when autoAdvanceQualityCheckEnabled is true', async () => {
        const mockProject = mock<Project>();
        const mockIssues: Issue[] = [];
        const fixedNow = new Date('2024-06-15T12:00:00Z');
        mockDateRepository.now.mockResolvedValue(fixedNow);
        mockIssueRepository.getAllIssues.mockResolvedValue({
          issues: mockIssues,
          project: mockProject,
          cacheUsed: false,
        });

        await useCase.run({
          ...baseInput,
          startPreparation: {
            defaultAgentName: 'agent1',
            configFilePath: '/path/to/config.yml',
            maximumPreparingIssuesCount: null,
            autoAdvanceQualityCheckEnabled: true,
          },
        });

        expect(mockAdvanceQualityCheckUseCase.run).toHaveBeenCalledWith(
          expect.objectContaining({
            project: mockProject,
            issues: mockIssues,
            evaluatedAt: fixedNow,
          }),
        );
      });

      it('passes awaitingQualityCheckStatus to advanceQualityCheckUseCase when configured', async () => {
        const mockProject = mock<Project>();
        mockIssueRepository.getAllIssues.mockResolvedValue({
          issues: [],
          project: mockProject,
          cacheUsed: false,
        });

        await useCase.run({
          ...baseInput,
          startPreparation: {
            defaultAgentName: 'agent1',
            configFilePath: '/path/to/config.yml',
            maximumPreparingIssuesCount: null,
            autoAdvanceQualityCheckEnabled: true,
            awaitingQualityCheckStatus: 'Custom Review Status',
          },
        });

        expect(mockAdvanceQualityCheckUseCase.run).toHaveBeenCalledWith(
          expect.objectContaining({
            awaitingQualityCheckStatusName: 'Custom Review Status',
          }),
        );
      });

      it('continues to startPreparationUseCase when qualityCheckAdvanceUseCase.run rejects', async () => {
        mockAdvanceQualityCheckUseCase.run.mockRejectedValue(
          new AggregateError(
            [new Error('GitHub API rate limit')],
            'Failed to advance 1 issue(s) from Awaiting Quality Check to Done',
          ),
        );

        await useCase.run({
          ...baseInput,
          startPreparation: {
            defaultAgentName: 'agent1',
            configFilePath: '/path/to/config.yml',
            maximumPreparingIssuesCount: null,
            autoAdvanceQualityCheckEnabled: true,
          },
        });

        expect(mockStartPreparationUseCase.run).toHaveBeenCalled();
      });
    });

    describe('reopenedDoneIssueRevertUseCase', () => {
      const baseInput = {
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
        disabled: false,
      };

      it('does not call reopenedDoneIssueRevertUseCase when startPreparation is absent', async () => {
        await useCase.run(baseInput);

        expect(mockReopenedDoneIssueRevertUseCase.run).not.toHaveBeenCalled();
      });

      it('does not call reopenedDoneIssueRevertUseCase when autoRevertReopenedDoneEnabled is absent', async () => {
        await useCase.run({
          ...baseInput,
          startPreparation: {
            defaultAgentName: 'agent1',
            configFilePath: '/path/to/config.yml',
            maximumPreparingIssuesCount: null,
            autoAdvanceQualityCheckEnabled: false,
          },
        });

        expect(mockReopenedDoneIssueRevertUseCase.run).not.toHaveBeenCalled();
      });

      it('does not call reopenedDoneIssueRevertUseCase when autoRevertReopenedDoneEnabled is false', async () => {
        await useCase.run({
          ...baseInput,
          startPreparation: {
            defaultAgentName: 'agent1',
            configFilePath: '/path/to/config.yml',
            maximumPreparingIssuesCount: null,
            autoAdvanceQualityCheckEnabled: false,
            autoRevertReopenedDoneEnabled: false,
          },
        });

        expect(mockReopenedDoneIssueRevertUseCase.run).not.toHaveBeenCalled();
      });

      it('calls reopenedDoneIssueRevertUseCase with project and issues when autoRevertReopenedDoneEnabled is true', async () => {
        const mockProject = mock<Project>();
        const mockIssues: Issue[] = [];
        mockIssueRepository.getAllIssues.mockResolvedValue({
          issues: mockIssues,
          project: mockProject,
          cacheUsed: false,
        });

        await useCase.run({
          ...baseInput,
          startPreparation: {
            defaultAgentName: 'agent1',
            configFilePath: '/path/to/config.yml',
            maximumPreparingIssuesCount: null,
            autoAdvanceQualityCheckEnabled: false,
            autoRevertReopenedDoneEnabled: true,
          },
        });

        expect(mockReopenedDoneIssueRevertUseCase.run).toHaveBeenCalledWith({
          project: mockProject,
          issues: mockIssues,
        });
      });

      it('continues to startPreparationUseCase when reopenedDoneIssueRevertUseCase.run rejects', async () => {
        mockReopenedDoneIssueRevertUseCase.run.mockRejectedValue(
          new AggregateError(
            [new Error('GitHub API error')],
            'Failed to revert 1 reopened Done issue(s)',
          ),
        );

        await useCase.run({
          ...baseInput,
          startPreparation: {
            defaultAgentName: 'agent1',
            configFilePath: '/path/to/config.yml',
            maximumPreparingIssuesCount: null,
            autoAdvanceQualityCheckEnabled: false,
            autoRevertReopenedDoneEnabled: true,
          },
        });

        expect(mockStartPreparationUseCase.run).toHaveBeenCalled();
      });
    });
  });

  describe('storyIssues', () => {
    const useCase = new HandleScheduledEventUseCase(
      mock<ProjectRequiredFieldCreateUseCase>(),
      mock<SetupTowerDefenceProjectUseCase>(),
      mock<ActionAnnouncementUseCase>(),
      mock<SetWorkflowManagementIssueToStoryUseCase>(),
      mock<ClearPastNextActionDateHourUseCase>(),
      mock<AnalyzeProblemByIssueUseCase>(),
      mock<AnalyzeStoriesUseCase>(),
      mock<ClearDependedIssueURLUseCase>(),
      mock<SetDependedIssueUrlForOpenTaskPRsUseCase>(),
      mock<StaleTaskPullRequestCloseUseCase>(),
      mock<CreateEstimationIssueUseCase>(),
      mock<ConvertCheckboxToIssueInStoryIssueUseCase>(),
      mock<ChangeStatusByStoryColorUseCase>(),
      mock<SetNoStoryIssueToStoryUseCase>(),
      mock<CreateNewStoryByLabelUseCase>(),
      mock<AssignNoAssigneeIssueToManagerUseCase>(),
      mock<UpdateIssueStatusByLabelUseCase>(),
      mock<IssueNoStatusUpdateUseCase>(),
      mock<StartPreparationUseCase>(),
      mock<RevertOrphanedPreparationUseCase>(),
      mock<ConflictedIssueRevertUseCase>(),
      mock<RevertNotReadyReviewQueueIssueUseCase>(),
      mock<TriagerApprovalDispatchUseCase>(),
      mock<AgentDesignationLabelAdoptUseCase>(),
      null,
      null,
      mock<QualityCheckAdvanceUseCase>(),
      mock<ReopenedDoneIssueRevertUseCase>(),
      mock<DateRepository>(),
      mock<SpreadsheetRepository>(),
      mock<ProjectRepository>(),
      mock<IssueRepository>(),
    );

    const storyName = 'my story / feature';
    const baseProject: Project = {
      id: 'project-1',
      url: 'https://github.com/orgs/user/projects/1',
      databaseId: 1,
      name: 'Test Project',
      status: { name: 'Status', fieldId: 'status-field-id', statuses: [] },
      nextActionDate: null,
      nextActionHour: null,
      story: {
        name: 'Story',
        fieldId: 'story-field-id',
        databaseId: 1,
        stories: [
          { id: 'story-1', name: storyName, color: 'BLUE', description: '' },
        ],
        workflowManagementStory: { id: 'wms-1', name: 'workflow management' },
      },
      remainingEstimationMinutes: null,
      dependedIssueUrlSeparatedByComma: null,
      completionDate50PercentConfidence: null,
      agent: null,
    };

    const baseIssue: Issue = {
      nameWithOwner: 'user/repo',
      number: 1,
      title: storyName,
      state: 'OPEN',
      status: null,
      story: null,
      nextActionDate: null,
      nextActionHour: null,
      estimationMinutes: null,
      dependedIssueUrls: [],
      completionDate50PercentConfidence: null,
      url: 'https://github.com/user/repo/issues/1',
      assignees: [],
      labels: [],
      org: 'user',
      repo: 'repo',
      body: '',
      itemId: 'item-1',
      isPr: false,
      isInProgress: false,
      isClosed: false,
      createdAt: new Date('2024-01-01T00:00:00Z'),
      author: '',
      closingIssueReferenceUrls: [],
      agent: null,
      stateReason: null,
    };

    it('should return storyIssue as null when the only matching issue is closed', async () => {
      const closedIssue: Issue = {
        ...baseIssue,
        state: 'CLOSED',
        isClosed: true,
      };
      const result = await useCase.storyIssues({
        project: baseProject,
        issues: [closedIssue],
      });
      expect(result.get(storyName)?.storyIssue).toBeNull();
    });

    it('should return the open matching issue as storyIssue', async () => {
      const result = await useCase.storyIssues({
        project: baseProject,
        issues: [baseIssue],
      });
      expect(result.get(storyName)?.storyIssue).toBe(baseIssue);
    });
  });
});
