import { Issue, Label } from '../entities/Issue';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { Project } from '../entities/Project';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { GenerateWorkingTimeReportUseCase } from './GenerateWorkingTimeReportUseCase';
import { Member } from '../entities/Member';
import { DateRepository } from './adapter-interfaces/DateRepository';
import { SpreadsheetRepository } from './adapter-interfaces/SpreadsheetRepository';

export class ProjectNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectNotFoundError';
  }
}

export class HandleScheduledEventUseCase {
  constructor(
    readonly generateWorkingTimeReportUseCase: GenerateWorkingTimeReportUseCase,
    readonly dateRepository: DateRepository,
    readonly spreadsheetRepository: SpreadsheetRepository,
    readonly projectRepository: ProjectRepository,
    readonly issueRepository: IssueRepository,
  ) {}

  run = async (input: {
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
  }): Promise<void> => {
    const projectId = await this.projectRepository.findProjectIdByUrl(
      input.projectUrl,
    );
    if (!projectId) {
      throw new ProjectNotFoundError(
        `Project not found. projectUrl: ${input.projectUrl}`,
      );
    }
    const now: Date = await this.dateRepository.now();
    const lastExecutionDateTime: Date =
      await this.findAndUpdateLastExecutionDateTime(
        input.workingReport.spreadsheetUrl,
        now,
      );
    const issues: Issue[] = await this.issueRepository.getAllIssues(projectId);
    const targetDateTimes: Date[] = this.createTargetDateTimes(
      lastExecutionDateTime,
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
  createTargetDateTimes = (from: Date, to: Date): Date[] => {
    const targetDateTimes: Date[] = [];
    const targetDate = new Date(from);
    targetDate.setSeconds(0);
    targetDate.setMilliseconds(0);
    while (
      targetDate.getTime() <= to.getTime() ||
      targetDateTimes.length < 30
    ) {
      targetDate.setMinutes(targetDate.getMinutes() + 1);
      targetDateTimes.push(new Date(targetDate));
    }
    return targetDateTimes;
  };
  findAndUpdateLastExecutionDateTime = async (
    spreadsheetUrl: string,
    now: Date,
  ): Promise<Date> => {
    const sheetValues = await this.spreadsheetRepository.getSheet(
      spreadsheetUrl,
      'HandleScheduledEvent',
    );

    await this.spreadsheetRepository.updateCell(
      spreadsheetUrl,
      'HandleScheduledEvent',
      1,
      2,
      now.toISOString(),
    );
    if (!sheetValues) {
      await this.spreadsheetRepository.updateCell(
        spreadsheetUrl,
        'HandleScheduledEvent',
        1,
        1,
        'LastExecutionDateTime',
      );
      return now;
    }
    return new Date(sheetValues[1][2]);
  };
}
