import { Issue, Label } from '../entities/Issue';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { Project } from '../entities/Project';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { GenerateWorkingTimeReportUseCase } from './GenerateWorkingTimeReportUseCase';
import { Member } from '../entities/Member';
import { DateRepository } from './adapter-interfaces/DateRepository';
import { SpreadsheetRepository } from './adapter-interfaces/SpreadsheetRepository';
import { ActionAnnouncementUseCase } from './ActionAnnouncementUseCase';
import { SetWorkflowManagementIssueToStoryUseCase } from './SetWorkflowManagementIssueToStoryUseCase';
import { ClearNextActionHourUseCase } from './ClearNextActionHourUseCase';
import { AnalyzeProblemByIssueUseCase } from './AnalyzeProblemByIssueUseCase';

export class ProjectNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectNotFoundError';
  }
}

export class HandleScheduledEventUseCase {
  constructor(
    readonly generateWorkingTimeReportUseCase: GenerateWorkingTimeReportUseCase,
    readonly actionAnnouncementUseCase: ActionAnnouncementUseCase,
    readonly setWorkflowManagementIssueToStoryUseCase: SetWorkflowManagementIssueToStoryUseCase,
    readonly clearNextActionHourUseCase: ClearNextActionHourUseCase,
    readonly analyzeProblemByIssueUseCase: AnalyzeProblemByIssueUseCase,
    readonly dateRepository: DateRepository,
    readonly spreadsheetRepository: SpreadsheetRepository,
    readonly projectRepository: ProjectRepository,
    readonly issueRepository: IssueRepository,
  ) {}

  run = async (input: {
    projectName: string;
    org: string;
    projectUrl: string;
    manager: Member['name'];
    workingReport: {
      repo: string;
      members: Member['name'][];
      warningThresholdHour?: number;
      spreadsheetUrl: string;
      reportIssueTemplate?: string;
      reportIssueLabels: Label[];
    };
  }): Promise<{
    project: Project;
    issues: Issue[];
    cacheUsed: boolean;
    targetDateTimes: Date[];
  }> => {
    const projectId = await this.projectRepository.findProjectIdByUrl(
      input.projectUrl,
    );
    if (!projectId) {
      throw new ProjectNotFoundError(
        `Project not found. projectUrl: ${input.projectUrl}`,
      );
    }
    const project = await this.projectRepository.getProject(projectId);
    if (!project) {
      throw new ProjectNotFoundError(
        `Project not found. projectId: ${
          projectId
        } projectUrl: ${input.projectUrl}`,
      );
    }
    const now: Date = await this.dateRepository.now();
    const allowIssueCacheMinutes = 60;
    const { issues, cacheUsed }: { issues: Issue[]; cacheUsed: boolean } =
      await this.issueRepository.getAllIssues(
        projectId,
        allowIssueCacheMinutes,
      );

    const targetDateTimes: Date[] =
      await this.findTargetDateAndUpdateLastExecutionDateTime(
        input.workingReport.spreadsheetUrl,
        now,
      );

    for (const targetDateTime of targetDateTimes) {
      await this.runForTargetDateTime({
        org: input.org,
        manager: input.manager,
        workingReport: input.workingReport,
        projectId,
        issues,
        targetDateTime,
      });
    }
    await this.analyzeProblemByIssueUseCase.run({
      targetDates: targetDateTimes,
      project,
      issues,
      cacheUsed,
      manager: input.manager,
      org: input.org,
      repo: input.workingReport.repo,
    });
    await this.actionAnnouncementUseCase.run({
      targetDates: targetDateTimes,
      project,
      issues,
      cacheUsed,
      members: input.workingReport.members,
      manager: input.manager,
    });
    await this.setWorkflowManagementIssueToStoryUseCase.run({
      targetDates: targetDateTimes,
      project,
      issues,
      cacheUsed,
    });
    await this.clearNextActionHourUseCase.run({
      targetDates: targetDateTimes,
      project,
      issues,
      cacheUsed,
    });
    return { project, issues, cacheUsed, targetDateTimes };
  };
  runForTargetDateTime = async (input: {
    org: string;
    manager: Member['name'];
    workingReport: {
      repo: string;
      members: Member['name'][];
      warningThresholdHour?: number;
      spreadsheetUrl: string;
      reportIssueTemplate?: string;
      reportIssueLabels: Label[];
    };
    projectId: Project['id'];
    issues: Issue[];
    targetDateTime: Date;
  }): Promise<void> => {
    const targetHour = input.targetDateTime.getHours();
    const targetMinute = input.targetDateTime.getMinutes();
    if (targetHour === 0 && targetMinute === 0) {
      const yesterday = new Date(
        input.targetDateTime.getTime() - 24 * 60 * 60 * 1000,
      );

      await this.generateWorkingTimeReportUseCase.run({
        ...input,
        ...input.workingReport,
        targetDate: yesterday,
      });
    }
  };
  static createTargetDateTimes = (from: Date, to: Date): Date[] => {
    const targetDateTimes: Date[] = [];
    if (from.getTime() > to.getTime()) {
      const targetDate = new Date(to);
      targetDate.setSeconds(0);
      targetDate.setMilliseconds(0);
      return [targetDate];
    }
    const targetDate = new Date(from);
    targetDate.setTime(targetDate.getTime() + 60 * 1000);
    targetDate.setSeconds(0);
    targetDate.setMilliseconds(0);
    while (
      targetDate.getTime() <= to.getTime() &&
      targetDateTimes.length < 30
    ) {
      targetDateTimes.push(new Date(targetDate));
      targetDate.setMinutes(targetDate.getMinutes() + 1);
    }
    return targetDateTimes;
  };
  findTargetDateAndUpdateLastExecutionDateTime = async (
    spreadsheetUrl: string,
    now: Date,
  ): Promise<Date[]> => {
    const sheetValues = await this.spreadsheetRepository.getSheet(
      spreadsheetUrl,
      'HandleScheduledEvent',
    );
    if (!sheetValues) {
      await this.spreadsheetRepository.updateCell(
        spreadsheetUrl,
        'HandleScheduledEvent',
        1,
        1,
        'LastExecutionDateTime',
      );
    }
    const lastExecutionDateTime =
      sheetValues && sheetValues[1][2] ? new Date(sheetValues[1][2]) : null;

    const targetDateTimes: Date[] = lastExecutionDateTime
      ? HandleScheduledEventUseCase.createTargetDateTimes(
          lastExecutionDateTime,
          now,
        )
      : [now];

    await this.spreadsheetRepository.updateCell(
      spreadsheetUrl,
      'HandleScheduledEvent',
      1,
      2,
      targetDateTimes[targetDateTimes.length - 1].toISOString(),
    );
    return targetDateTimes;
  };
}
