import { Issue, Label } from '../entities/Issue';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { Project, StoryOption } from '../entities/Project';
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

export type StoryObject = {
  story: StoryOption;
  storyIssue: Issue | null;
  issues: (Issue & {
    totalWorkingTime: number;
    totalWorkingTimeByAssignee: Map<string, number>;
  })[];
};
export type StoryObjectMap = Map<string, StoryObject>;

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
    urlOfStoryView: string;
    disabledStatus: string;
  }): Promise<{
    project: Project;
    issues: Issue[];
    cacheUsed: boolean;
    targetDateTimes: Date[];
    storyIssues: StoryObjectMap;
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
    const storyIssues: StoryObjectMap = await this.storyIssues({
      project,
      issues,
    });
    for (const storyObject of storyIssues.values()) {
      const projectStory = project.story;
      if (!projectStory) {
        break;
      }
      if (
        storyObject.storyIssue ||
        storyObject.story.name.startsWith('regular / ')
      ) {
        continue;
      }
      const issueNumber = await this.issueRepository.createNewIssue(
        input.org,
        input.workingReport.repo,
        storyObject.story.name,
        storyObject.story.description,
        [input.manager],
        ['story'],
      );
      const issueUrl = `https://github.com/${input.org}/${input.workingReport.repo}/issues/${issueNumber}`;
      await new Promise((resolve) => setTimeout(resolve, 10 * 1000));
      const issue = await this.issueRepository.getIssueByUrl(issueUrl);
      if (!issue) {
        throw new Error(`Issue not found. URL: ${issueUrl}`);
      }
      await this.issueRepository.updateStory(
        { ...project, story: projectStory },
        issue,
        storyObject.story.id,
      );
      await new Promise((resolve) => setTimeout(resolve, 10 * 1000));
      const newIssue = await this.issueRepository.getIssueByUrl(issueUrl);
      if (!newIssue) {
        throw new Error(`Issue not found. URL: ${issueUrl}`);
      }
      storyObject.storyIssue = newIssue;
      issues.push(newIssue);
      storyObject.issues.push({
        ...newIssue,
        totalWorkingTime: 0,
        totalWorkingTimeByAssignee: new Map(),
      });
    }

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
      members: input.workingReport.members,
      org: input.org,
      repo: input.workingReport.repo,
      storyObjectMap: storyIssues,
      disabledStatus: input.disabledStatus,
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
    return { project, issues, cacheUsed, targetDateTimes, storyIssues };
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
  storyIssues = async (input: {
    project: Project;
    issues: Issue[];
  }): Promise<StoryObjectMap> => {
    const summaryStoryIssue: StoryObjectMap = new Map();
    const targetStory = input.project.story?.stories || [];
    for (const story of targetStory) {
      const storyIssue = input.issues.find((issue) =>
        story.name.startsWith(issue.title),
      );
      summaryStoryIssue.set(story.name, {
        story,
        storyIssue: storyIssue || null,
        issues: [],
      });
      for (const issue of input.issues) {
        if (issue.story !== story.name) {
          continue;
        }
        const totalWorkingTimeByAssignee =
          this.calculateTotalWorkingMinutesByAssignee(issue);
        const totalWorkingTime = Math.round(
          Array.from(totalWorkingTimeByAssignee.values()).reduce(
            (a, b) => a + b,
            0,
          ),
        );
        const issueSummary: {
          totalWorkingTime: number;
          totalWorkingTimeByAssignee: Map<string, number>;
        } = {
          totalWorkingTime,
          totalWorkingTimeByAssignee,
        };
        summaryStoryIssue
          .get(story.name)
          ?.issues.push({ ...issue, ...issueSummary });
      }
    }
    return summaryStoryIssue;
  };
  calculateTotalWorkingMinutesByAssignee = (
    issue: Issue,
  ): Map<string, number> => {
    const workingTimeLine = issue.workingTimeline;
    const mapWorkingTimeByAssignee: Map<string, number> = new Map();
    for (const workingTime of workingTimeLine) {
      const author = workingTime.author;
      const workingMinutes = workingTime.durationMinutes;
      if (!mapWorkingTimeByAssignee.has(author)) {
        mapWorkingTimeByAssignee.set(author, 0);
      }
      const currentWorkingMinutes = mapWorkingTimeByAssignee.get(author) || 0;
      mapWorkingTimeByAssignee.set(
        author,
        currentWorkingMinutes + workingMinutes,
      );
    }
    return mapWorkingTimeByAssignee;
  };
}
