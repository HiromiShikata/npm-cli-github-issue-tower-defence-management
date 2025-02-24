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
import { AnalyzeStoriesUseCase } from './AnalyzeStoriesUseCase';
import { ClearDependedIssueURLUseCase } from './ClearDependedIssueURLUseCase';
import { CreateEstimationIssueUseCase } from './CreateEstimationIssueUseCase';
import { ConvertCheckboxToIssueInStoryIssueUseCase } from './ConvertCheckboxToIssueInStoryIssueUseCase';
import { ChangeStatusLongInReviewIssueUseCase } from './ChangeStatusLongInReviewIssueUseCase';
import { ChangeStatusByStoryColorUseCase } from './ChangeStatusByStoryColorUseCase';
import { SetNoStoryIssueToStoryUseCase } from './SetNoStoryIssueToStoryUseCase';

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
export type StoryObjectMap = Map<
  NonNullable<Project['story']>['stories'][0]['name'],
  StoryObject
>;

export class HandleScheduledEventUseCase {
  constructor(
    readonly generateWorkingTimeReportUseCase: GenerateWorkingTimeReportUseCase,
    readonly actionAnnouncementUseCase: ActionAnnouncementUseCase,
    readonly setWorkflowManagementIssueToStoryUseCase: SetWorkflowManagementIssueToStoryUseCase,
    readonly clearNextActionHourUseCase: ClearNextActionHourUseCase,
    readonly analyzeProblemByIssueUseCase: AnalyzeProblemByIssueUseCase,
    readonly analyzeStoriesUseCase: AnalyzeStoriesUseCase,
    readonly clearDependedIssueURLUseCase: ClearDependedIssueURLUseCase,
    readonly createEstimationIssueUseCase: CreateEstimationIssueUseCase,
    readonly convertCheckboxToIssueInStoryIssueUseCase: ConvertCheckboxToIssueInStoryIssueUseCase,
    readonly changeStatusLongInReviewIssueUseCase: ChangeStatusLongInReviewIssueUseCase,
    readonly changeStatusByStoryColorUseCase: ChangeStatusByStoryColorUseCase,
    readonly setNoStoryIssueToStoryUseCase: SetNoStoryIssueToStoryUseCase,
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
      let issue: Issue | null = null;
      for (let i = 0; i < 3; i++) {
        await new Promise((resolve) => setTimeout(resolve, 30 * 1000));
        issue = await this.issueRepository.getIssueByUrl(issueUrl);
        if (!issue) {
          continue;
        } else if (!issue.itemId) {
          continue;
        }
        break;
      }
      if (!issue) {
        throw new Error(`Issue not found. URL: ${issueUrl}`);
      } else if (!issue.itemId) {
        throw new Error(`Issue itemId not found. URL: ${issueUrl}`);
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

    try {
      await this.runEachUseCases(
        input,
        project,
        issues,
        cacheUsed,
        targetDateTimes,
        storyIssues,
      );
    } catch (e) {
      if (!(e instanceof Error)) {
        throw e;
      }
      await this.issueRepository.createNewIssue(
        input.org,
        input.workingReport.repo,
        `Error in HandleScheduledEvent / workflow incident`,
        `${e.message}
\`\`\`
${e.stack}
\`\`\`
\`\`\`
${JSON.stringify(e)}
\`\`\`

`,
        [input.manager],
        ['error'],
      );
      throw e;
    }

    return { project, issues, cacheUsed, targetDateTimes, storyIssues };
  };
  runEachUseCases = async (
    input: Parameters<HandleScheduledEventUseCase['run']>[0],
    project: Project,
    issues: Issue[],
    cacheUsed: boolean,
    targetDateTimes: Date[],
    storyObjectMap: StoryObjectMap,
  ): Promise<void> => {
    const projectId = project.id;

    for (const targetDateTime of targetDateTimes) {
      await this.runForGenerateWorkingTimeReportUseCase({
        org: input.org,
        manager: input.manager,
        workingReport: input.workingReport,
        projectId,
        issues,
        targetDateTime,
      });
    }
    await this.setNoStoryIssueToStoryUseCase.run({
      targetDates: targetDateTimes,
      project,
      issues,
      cacheUsed,
    });
    await this.analyzeProblemByIssueUseCase.run({
      targetDates: targetDateTimes,
      project,
      issues,
      cacheUsed,
      manager: input.manager,
      members: input.workingReport.members,
      org: input.org,
      repo: input.workingReport.repo,
      storyObjectMap: storyObjectMap,
      disabledStatus: input.disabledStatus,
    });
    await this.changeStatusLongInReviewIssueUseCase.run({
      project,
      issues,
      cacheUsed,
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
    await this.analyzeStoriesUseCase.run({
      targetDates: targetDateTimes,
      project,
      issues,
      cacheUsed,
      ...input,
      manager: input.manager,
      org: input.org,
      repo: input.workingReport.repo,
      storyObjectMap: storyObjectMap,
      members: input.workingReport.members,
    });
    await this.clearDependedIssueURLUseCase.run({
      project,
      issues,
      cacheUsed,
    });
    await this.createEstimationIssueUseCase.run({
      targetDates: targetDateTimes,
      project,
      issues,
      cacheUsed,
      manager: input.manager,
      org: input.org,
      repo: input.workingReport.repo,
      urlOfStoryView: input.urlOfStoryView,
      disabledStatus: input.disabledStatus,
      storyObjectMap: storyObjectMap,
    });
    await this.convertCheckboxToIssueInStoryIssueUseCase.run({
      project,
      issues,
      cacheUsed,
      org: input.org,
      repo: input.workingReport.repo,
      urlOfStoryView: input.urlOfStoryView,
      disabledStatus: input.disabledStatus,
      storyObjectMap: storyObjectMap,
    });
    await this.changeStatusByStoryColorUseCase.run({
      project,
      cacheUsed,
      org: input.org,
      repo: input.workingReport.repo,
      disabledStatus: input.disabledStatus,
      storyObjectMap: storyObjectMap,
    });
 };
  runForGenerateWorkingTimeReportUseCase = async (input: {
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
      targetDateTimes.length < 300
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
