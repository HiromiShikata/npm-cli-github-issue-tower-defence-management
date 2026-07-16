import { Issue } from '../entities/Issue';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { Project } from '../entities/Project';
import { StoryObjectMap } from '../entities/StoryObjectMap';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { Member } from '../entities/Member';
import { DateRepository } from './adapter-interfaces/DateRepository';
import { SpreadsheetRepository } from './adapter-interfaces/SpreadsheetRepository';
import { ActionAnnouncementUseCase } from './ActionAnnouncementUseCase';
import { SetWorkflowManagementIssueToStoryUseCase } from './SetWorkflowManagementIssueToStoryUseCase';
import { ClearPastNextActionDateHourUseCase } from './ClearPastNextActionDateHourUseCase';
import { AnalyzeProblemByIssueUseCase } from './AnalyzeProblemByIssueUseCase';
import { AnalyzeStoriesUseCase } from './AnalyzeStoriesUseCase';
import { ClearDependedIssueURLUseCase } from './ClearDependedIssueURLUseCase';
import { SetDependedIssueUrlForOpenTaskPRsUseCase } from './SetDependedIssueUrlForOpenTaskPRsUseCase';
import { CreateEstimationIssueUseCase } from './CreateEstimationIssueUseCase';
import { ConvertCheckboxToIssueInStoryIssueUseCase } from './ConvertCheckboxToIssueInStoryIssueUseCase';
import { ChangeStatusByStoryColorUseCase } from './ChangeStatusByStoryColorUseCase';
import { SetNoStoryIssueToStoryUseCase } from './SetNoStoryIssueToStoryUseCase';
import { CreateNewStoryByLabelUseCase } from './CreateNewStoryByLabelUseCase';
import { AssignNoAssigneeIssueToManagerUseCase } from './AssignNoAssigneeIssueToManagerUseCase';
import { UpdateIssueStatusByLabelUseCase } from './UpdateIssueStatusByLabelUseCase';
import {
  RotationOrderEntry,
  StartPreparationUseCase,
} from './StartPreparationUseCase';
import { RevertOrphanedPreparationUseCase } from './RevertOrphanedPreparationUseCase';
import { RevertNotReadyReviewQueueIssueUseCase } from './RevertNotReadyReviewQueueIssueUseCase';
import { resolveLabelsAsLlmAgentName } from './resolveLabelsAsLlmAgentName';
import { resolveAllowedIssueAuthors } from './resolveAllowedIssueAuthors';
import { SetupTowerDefenceProjectUseCase } from './SetupTowerDefenceProjectUseCase';
import { UpdateRateLimitCacheUseCase } from './UpdateRateLimitCacheUseCase';
import {
  DailySecurityScanConfig,
  DailySecurityScanUseCase,
} from './DailySecurityScanUseCase';

export class ProjectNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectNotFoundError';
  }
}

const SLOW_SWEEP_INTERVAL_SECONDS = 600;
const WORKFLOW_INCIDENT_ISSUE_TITLE =
  'Error in HandleScheduledEvent / workflow incident';

const isTransientApiError = (error: Error): boolean => {
  const msg = error.message;
  return (
    /\b(401|403|429|500|502|503|504)\b/.test(msg) ||
    /rate.?limit|RATE_LIMIT/i.test(msg) ||
    /bad credentials/i.test(msg)
  );
};

export class HandleScheduledEventUseCase {
  constructor(
    readonly setupTowerDefenceProjectUseCase: SetupTowerDefenceProjectUseCase,
    readonly actionAnnouncementUseCase: ActionAnnouncementUseCase,
    readonly setWorkflowManagementIssueToStoryUseCase: SetWorkflowManagementIssueToStoryUseCase,
    readonly clearPastNextActionUseCase: ClearPastNextActionDateHourUseCase,
    readonly analyzeProblemByIssueUseCase: AnalyzeProblemByIssueUseCase,
    readonly analyzeStoriesUseCase: AnalyzeStoriesUseCase,
    readonly clearDependedIssueURLUseCase: ClearDependedIssueURLUseCase,
    readonly setDependedIssueUrlForOpenTaskPRsUseCase: SetDependedIssueUrlForOpenTaskPRsUseCase,
    readonly createEstimationIssueUseCase: CreateEstimationIssueUseCase,
    readonly convertCheckboxToIssueInStoryIssueUseCase: ConvertCheckboxToIssueInStoryIssueUseCase,
    readonly changeStatusByStoryColorUseCase: ChangeStatusByStoryColorUseCase,
    readonly setNoStoryIssueToStoryUseCase: SetNoStoryIssueToStoryUseCase,
    readonly createNewStoryByLabelUseCase: CreateNewStoryByLabelUseCase,
    readonly assignNoAssigneeIssueToManagerUseCase: AssignNoAssigneeIssueToManagerUseCase,
    readonly updateIssueStatusByLabelUseCase: UpdateIssueStatusByLabelUseCase,
    readonly startPreparationUseCase: StartPreparationUseCase,
    readonly revertOrphanedPreparationUseCase: RevertOrphanedPreparationUseCase,
    readonly revertNotReadyReviewQueueIssueUseCase: RevertNotReadyReviewQueueIssueUseCase,
    readonly updateRateLimitCacheUseCase: UpdateRateLimitCacheUseCase | null,
    readonly dailySecurityScanUseCase: DailySecurityScanUseCase | null,
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
      spreadsheetUrl: string;
    };
    urlOfStoryView: string;
    disabled: boolean;
    labelsAsLlmAgentName?: string[] | null;
    changeTargetPathAliases?: Record<string, string> | null;
    allowedIssueAuthors?: string[] | null;
    startPreparation?: {
      defaultAgentName: string;
      defaultLlmModelName?: string | null;
      fallbackLlmModelName?: string | null;
      defaultLlmAgentName?: string | null;
      configFilePath: string;
      maximumPreparingIssuesCount: number | null;
      utilizationPercentageThreshold?: number;
      allowedIssueAuthors?: string[] | null;
      preparationProcessCheckCommand?: string;
      codexHomeCandidates?: string[] | null;
      awLogDirectoryPath?: string;
      awLogStaleThresholdMinutes?: number;
      awaitingQualityCheckStatus?: string | null;
      labelsAsLlmAgentName?: string[] | null;
    } | null;
    thresholdForAutoReject?: number;
    createTaskFromStoryBodyCheckboxEnabled?: boolean;
    dailySecurityScan?: DailySecurityScanConfig | null;
  }): Promise<{
    project: Project;
    issues: Issue[];
    cacheUsed: boolean;
    targetDateTimes: Date[];
    storyIssues: StoryObjectMap;
    rotationOrder: RotationOrderEntry[] | null;
  } | null> => {
    if (input.disabled) {
      return null;
    }
    await this.setupTowerDefenceProjectUseCase.run({
      projectUrl: input.projectUrl,
    });
    const projectId = await this.projectRepository.findProjectIdByUrl(
      input.projectUrl,
    );
    if (!projectId) {
      throw new ProjectNotFoundError(
        `Project not found. projectUrl: ${input.projectUrl}`,
      );
    }
    const now: Date = await this.dateRepository.now();
    const {
      issues,
      project,
      cacheUsed,
    }: { issues: Issue[]; project: Project; cacheUsed: boolean } =
      await this.issueRepository.getAllIssues(projectId);
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
      const storyStartTime = Date.now();
      console.log(
        `[HandleScheduledEvent] Creating story issue: story="${storyObject.story.name}"`,
      );
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
        console.log(
          `[HandleScheduledEvent] Polling for issue (attempt ${i + 1}/3): url=${issueUrl}`,
        );
        await new Promise((resolve) => setTimeout(resolve, 30 * 1000));
        issue = await this.issueRepository.getIssueByUrl(issueUrl);
        if (!issue || !issue.itemId) {
          continue;
        }
        console.log(
          `[HandleScheduledEvent] Issue found: url=${issueUrl} itemId=${issue.itemId}`,
        );
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
      console.log(
        `[HandleScheduledEvent] Waiting for story update: url=${issueUrl}`,
      );
      await new Promise((resolve) => setTimeout(resolve, 10 * 1000));
      const newIssue = await this.issueRepository.getIssueByUrl(issueUrl);
      if (!newIssue) {
        throw new Error(`Issue not found. URL: ${issueUrl}`);
      }
      storyObject.storyIssue = newIssue;
      issues.push(newIssue);
      storyObject.issues.push(newIssue);
      console.log(
        `[HandleScheduledEvent] Story issue created: story="${storyObject.story.name}" elapsed=${Date.now() - storyStartTime}ms`,
      );
    }

    const targetDateTimes: Date[] =
      await this.findTargetDateAndUpdateLastExecutionDateTime(
        input.workingReport.spreadsheetUrl,
        now,
        input.org,
        input.workingReport.repo,
        input.manager,
      );

    const runSlowSweep = await this.shouldRunSlowSweep(
      input.workingReport.spreadsheetUrl,
      now,
      input.org,
      input.workingReport.repo,
      input.manager,
    );

    let rotationOrder: RotationOrderEntry[] | null;
    try {
      const useCaseResult = await this.runEachUseCases(
        input,
        project,
        issues,
        cacheUsed,
        targetDateTimes,
        storyIssues,
        runSlowSweep,
      );
      rotationOrder = useCaseResult.rotationOrder;
    } catch (e) {
      if (!(e instanceof Error)) {
        throw e;
      }
      if (!isTransientApiError(e)) {
        const errorBody = `${e.message}
\`\`\`
${e.stack}
\`\`\`
\`\`\`
${JSON.stringify(e)}
\`\`\`

`;
        const existingIncidentIssues = await this.issueRepository.searchIssue({
          owner: input.org,
          repositoryName: input.workingReport.repo,
          type: 'issue',
          state: 'open',
          title: WORKFLOW_INCIDENT_ISSUE_TITLE,
        });
        if (existingIncidentIssues.length > 0) {
          await this.issueRepository.createCommentByUrl(
            existingIncidentIssues[0].url,
            errorBody,
          );
        } else {
          await this.issueRepository.createNewIssue(
            input.org,
            input.workingReport.repo,
            WORKFLOW_INCIDENT_ISSUE_TITLE,
            errorBody,
            [input.manager],
            ['error'],
          );
        }
      }
      throw e;
    }

    return {
      project,
      issues,
      cacheUsed,
      targetDateTimes,
      storyIssues,
      rotationOrder,
    };
  };
  runEachUseCases = async (
    input: Parameters<HandleScheduledEventUseCase['run']>[0],
    project: Project,
    issues: Issue[],
    cacheUsed: boolean,
    targetDateTimes: Date[],
    storyObjectMap: StoryObjectMap,
    runSlowSweep: boolean,
  ): Promise<{ rotationOrder: RotationOrderEntry[] | null }> => {
    if (runSlowSweep) {
      await this.runSlowSweepUseCases(
        input,
        project,
        issues,
        cacheUsed,
        targetDateTimes,
        storyObjectMap,
      );
    }
    const labelsAsLlmAgentName = resolveLabelsAsLlmAgentName({
      topLevel: input.labelsAsLlmAgentName,
      startPreparation: input.startPreparation?.labelsAsLlmAgentName,
    });
    const allowedIssueAuthors = resolveAllowedIssueAuthors({
      topLevel: input.allowedIssueAuthors,
      startPreparation: input.startPreparation?.allowedIssueAuthors,
    });
    await this.revertNotReadyReviewQueueIssueUseCase.run({
      projectUrl: input.projectUrl,
      labelsAsLlmAgentName,
      changeTargetPathAliases: input.changeTargetPathAliases,
      allowedIssueAuthors,
    });
    if (this.dailySecurityScanUseCase !== null && input.dailySecurityScan) {
      await this.dailySecurityScanUseCase.run({
        targetDates: targetDateTimes,
        org: input.org,
        manager: input.manager,
        dailySecurityScan: input.dailySecurityScan,
      });
    }
    if (input.startPreparation) {
      if (this.updateRateLimitCacheUseCase !== null) {
        await this.updateRateLimitCacheUseCase.run({
          nowEpochSeconds: Date.now() / 1000,
        });
      }
      if (input.startPreparation.preparationProcessCheckCommand) {
        await this.revertOrphanedPreparationUseCase.run({
          projectUrl: input.projectUrl,
          preparationProcessCheckCommand:
            input.startPreparation.preparationProcessCheckCommand,
          thresholdForAutoReject: input.thresholdForAutoReject ?? 3,
          awLogDirectoryPath: input.startPreparation.awLogDirectoryPath,
          awLogStaleThresholdMinutes:
            input.startPreparation.awLogStaleThresholdMinutes,
          awaitingQualityCheckStatus:
            input.startPreparation.awaitingQualityCheckStatus ?? undefined,
          labelsAsLlmAgentName,
        });
      }
      const preparationResult = await this.startPreparationUseCase.run({
        projectUrl: input.projectUrl,
        defaultAgentName: input.startPreparation.defaultAgentName,
        defaultLlmModelName: input.startPreparation.defaultLlmModelName ?? null,
        fallbackLlmModelName:
          input.startPreparation.fallbackLlmModelName ?? null,
        defaultLlmAgentName: input.startPreparation.defaultLlmAgentName ?? null,
        configFilePath: input.startPreparation.configFilePath,
        maximumPreparingIssuesCount:
          input.startPreparation.maximumPreparingIssuesCount,
        utilizationPercentageThreshold:
          input.startPreparation.utilizationPercentageThreshold ?? 90,
        allowedIssueAuthors,
        codexHomeCandidates: input.startPreparation.codexHomeCandidates ?? null,
        labelsAsLlmAgentName,
      });
      return { rotationOrder: preparationResult.rotationOrder };
    }
    return { rotationOrder: null };
  };
  runSlowSweepUseCases = async (
    input: Parameters<HandleScheduledEventUseCase['run']>[0],
    project: Project,
    issues: Issue[],
    cacheUsed: boolean,
    targetDateTimes: Date[],
    storyObjectMap: StoryObjectMap,
  ): Promise<void> => {
    await this.setWorkflowManagementIssueToStoryUseCase.run({
      targetDates: targetDateTimes,
      project,
      issues,
      cacheUsed,
    });
    await this.setNoStoryIssueToStoryUseCase.run({
      targetDates: targetDateTimes,
      project,
      issues,
      cacheUsed,
    });
    await this.analyzeProblemByIssueUseCase.run({
      targetDates: targetDateTimes,
      project,
      storyObjectMap: storyObjectMap,
    });
    await this.actionAnnouncementUseCase.run({
      targetDates: targetDateTimes,
      project,
      issues,
      cacheUsed,
      members: input.workingReport.members,
      manager: input.manager,
    });
    await this.clearPastNextActionUseCase.run({
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
    await this.setDependedIssueUrlForOpenTaskPRsUseCase.run({
      project,
      issues,
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
      storyObjectMap: storyObjectMap,
    });
    await this.convertCheckboxToIssueInStoryIssueUseCase.run({
      project,
      issues,
      cacheUsed,
      urlOfStoryView: input.urlOfStoryView,
      storyObjectMap: storyObjectMap,
      manager: input.manager,
      createTaskFromStoryBodyCheckboxEnabled:
        input.createTaskFromStoryBodyCheckboxEnabled ?? false,
    });
    await this.changeStatusByStoryColorUseCase.run({
      project,
      cacheUsed,
      org: input.org,
      repo: input.workingReport.repo,
      storyObjectMap: storyObjectMap,
    });
    await this.createNewStoryByLabelUseCase.run({
      project,
      cacheUsed,
      org: input.org,
      repo: input.workingReport.repo,
      storyObjectMap: storyObjectMap,
      issues: issues,
    });
    await this.assignNoAssigneeIssueToManagerUseCase.run({
      issues,
      manager: input.manager,
      cacheUsed,
    });
    await this.updateIssueStatusByLabelUseCase.run({
      project,
      issues,
    });
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
  runSpreadsheetOperation = async <T>(
    operation: 'read' | 'write',
    spreadsheetUrl: string,
    org: string,
    repo: string,
    manager: Member['name'],
    action: () => Promise<T>,
  ): Promise<T> => {
    try {
      return await action();
    } catch (e) {
      if (!(e instanceof Error)) {
        throw e;
      }
      await this.issueRepository.createNewIssue(
        org,
        repo,
        `Error in HandleScheduledEvent / spreadsheet ${operation} failure`,
        `Spreadsheet URL: ${spreadsheetUrl}
Operation: ${operation}

${e.message}
\`\`\`
${e.stack}
\`\`\`
\`\`\`
${JSON.stringify(e)}
\`\`\`

`,
        [manager],
        ['error'],
      );
      throw e;
    }
  };
  findTargetDateAndUpdateLastExecutionDateTime = async (
    spreadsheetUrl: string,
    now: Date,
    org: string,
    repo: string,
    manager: Member['name'],
  ): Promise<Date[]> => {
    const sheetValues = await this.runSpreadsheetOperation(
      'read',
      spreadsheetUrl,
      org,
      repo,
      manager,
      () =>
        this.spreadsheetRepository.getSheet(
          spreadsheetUrl,
          'HandleScheduledEvent',
        ),
    );
    if (!sheetValues) {
      await this.runSpreadsheetOperation(
        'write',
        spreadsheetUrl,
        org,
        repo,
        manager,
        () =>
          this.spreadsheetRepository.updateCell(
            spreadsheetUrl,
            'HandleScheduledEvent',
            1,
            1,
            'LastExecutionDateTime',
          ),
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

    if (targetDateTimes.length === 0) {
      return targetDateTimes;
    }

    await this.runSpreadsheetOperation(
      'write',
      spreadsheetUrl,
      org,
      repo,
      manager,
      () =>
        this.spreadsheetRepository.updateCell(
          spreadsheetUrl,
          'HandleScheduledEvent',
          1,
          2,
          targetDateTimes[targetDateTimes.length - 1].toISOString(),
        ),
    );
    return targetDateTimes;
  };
  shouldRunSlowSweep = async (
    spreadsheetUrl: string,
    now: Date,
    org: string,
    repo: string,
    manager: Member['name'],
  ): Promise<boolean> => {
    const sheetValues = await this.runSpreadsheetOperation(
      'read',
      spreadsheetUrl,
      org,
      repo,
      manager,
      () =>
        this.spreadsheetRepository.getSheet(
          spreadsheetUrl,
          'HandleScheduledEvent',
        ),
    );
    const lastSlowSweepDateTime =
      sheetValues && sheetValues[1] && sheetValues[1][4]
        ? new Date(sheetValues[1][4])
        : null;
    const elapsedSeconds = lastSlowSweepDateTime
      ? (now.getTime() - lastSlowSweepDateTime.getTime()) / 1000
      : Infinity;
    if (elapsedSeconds < SLOW_SWEEP_INTERVAL_SECONDS) {
      return false;
    }
    await this.runSpreadsheetOperation(
      'write',
      spreadsheetUrl,
      org,
      repo,
      manager,
      () =>
        this.spreadsheetRepository.updateCell(
          spreadsheetUrl,
          'HandleScheduledEvent',
          1,
          3,
          'LastSlowSweepDateTime',
        ),
    );
    await this.runSpreadsheetOperation(
      'write',
      spreadsheetUrl,
      org,
      repo,
      manager,
      () =>
        this.spreadsheetRepository.updateCell(
          spreadsheetUrl,
          'HandleScheduledEvent',
          1,
          4,
          now.toISOString(),
        ),
    );
    return true;
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
        summaryStoryIssue.get(story.name)?.issues.push(issue);
      }
    }
    return summaryStoryIssue;
  };
}
