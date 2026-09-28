import { Issue } from '../entities/Issue';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { Project } from '../entities/Project';
import {
  buildStoryObjectMap,
  StoryObjectMap,
} from '../entities/StoryObjectMap';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { Member } from '../entities/Member';
import { DateRepository } from './adapter-interfaces/DateRepository';
import { SpreadsheetRepository } from './adapter-interfaces/SpreadsheetRepository';
import { ActionAnnouncementUseCase } from './ActionAnnouncementUseCase';
import { SetWorkflowManagementIssueToStoryUseCase } from './SetWorkflowManagementIssueToStoryUseCase';
import { ClearPastNextActionDateHourUseCase } from './ClearPastNextActionDateHourUseCase';
import { ClearDependedIssueURLUseCase } from './ClearDependedIssueURLUseCase';
import { SetDependedIssueUrlForOpenTaskPRsUseCase } from './SetDependedIssueUrlForOpenTaskPRsUseCase';
import { StaleTaskPullRequestCloseUseCase } from './StaleTaskPullRequestCloseUseCase';
import { CreateEstimationIssueUseCase } from './CreateEstimationIssueUseCase';
import { ChangeStatusByStoryColorUseCase } from './ChangeStatusByStoryColorUseCase';
import { SetNoStoryIssueToStoryUseCase } from './SetNoStoryIssueToStoryUseCase';
import { CreateNewStoryByLabelUseCase } from './CreateNewStoryByLabelUseCase';
import { AssignNoAssigneeIssueToManagerUseCase } from './AssignNoAssigneeIssueToManagerUseCase';
import { UpdateIssueStatusByLabelUseCase } from './UpdateIssueStatusByLabelUseCase';
import { IssueNoStatusUpdateUseCase } from './IssueNoStatusUpdateUseCase';
import {
  RotationOrderEntry,
  StartPreparationUseCase,
} from './StartPreparationUseCase';
import { AgentDesignationLabelAdoptUseCase } from './AgentDesignationLabelAdoptUseCase';
import { RevertOrphanedPreparationUseCase } from './RevertOrphanedPreparationUseCase';
import { NonPreparationWorkerScopeStopUseCase } from './NonPreparationWorkerScopeStopUseCase';
import { RevertNotReadyReviewQueueIssueUseCase } from './RevertNotReadyReviewQueueIssueUseCase';
import { isRecord } from './isRecord';
import { resolveLabelsAsLlmAgentName } from './resolveLabelsAsLlmAgentName';
import { resolveAllowedIssueAuthors } from './resolveAllowedIssueAuthors';
import { ProjectRequiredFieldCreateUseCase } from './ProjectRequiredFieldCreateUseCase';
import { SetupTowerDefenceProjectUseCase } from './SetupTowerDefenceProjectUseCase';
import { UpdateRateLimitCacheUseCase } from './UpdateRateLimitCacheUseCase';
import {
  DailySecurityScanConfig,
  DailySecurityScanUseCase,
} from './DailySecurityScanUseCase';
import { QualityCheckAdvanceUseCase } from './QualityCheckAdvanceUseCase';
import { ReopenedDoneIssueRevertUseCase } from './ReopenedDoneIssueRevertUseCase';
import { ClosedStoryIssueReopenUseCase } from './ClosedStoryIssueReopenUseCase';
import { ConflictedIssueRevertUseCase } from './ConflictedIssueRevertUseCase';
import { WorkflowIssueReporterSettings } from './reportSilentRedispatchWorkflowIssue';
import { isDuplicateWithinWindow } from '../services/commentDeduplication';
import { PREPARATION_STATUS_NAME } from '../entities/WorkflowStatus';
import { isTransientApiError } from './isTransientApiError';

export class ProjectNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectNotFoundError';
  }
}

const SLOW_SWEEP_INTERVAL_SECONDS = 600;
const WORKFLOW_INCIDENT_ISSUE_TITLE =
  'Error in HandleScheduledEvent / workflow incident';

const TRANSIENT_NETWORK_ERROR_CODE_PATTERN =
  /\b(ECONNRESET|ECONNREFUSED|ECONNABORTED|ETIMEDOUT|EPIPE|ENOTFOUND|EAI_AGAIN|ERR_NETWORK|ERR_SOCKET_CONNECTION_TIMEOUT)\b/;

const extractHttpStatusFromError = (error: Error): number | null => {
  if (!isRecord(error)) {
    return null;
  }
  const response: unknown = error.response;
  const values: unknown[] = [
    error.status,
    isRecord(response) ? response.status : null,
    error.code,
  ];
  for (const value of values) {
    if (typeof value === 'number' && Number.isInteger(value)) {
      return value;
    }
    if (typeof value === 'string' && /^\d{3}$/.test(value)) {
      return Number(value);
    }
  }
  return null;
};

const isTransientSpreadsheetApiError = (error: Error): boolean => {
  const status = extractHttpStatusFromError(error);
  if (status !== null) {
    return status === 429 || (status >= 500 && status <= 599);
  }
  if (
    error.name === 'TimeoutError' ||
    /request timed out/i.test(error.message)
  ) {
    return true;
  }
  const code: unknown = isRecord(error) ? error.code : null;
  if (
    typeof code === 'string' &&
    TRANSIENT_NETWORK_ERROR_CODE_PATTERN.test(code)
  ) {
    return true;
  }
  return (
    /\b(429|500|502|503|504)\b/.test(error.message) ||
    /rate.?limit/i.test(error.message) ||
    /internal error encountered/i.test(error.message) ||
    /socket hang up/i.test(error.message) ||
    TRANSIENT_NETWORK_ERROR_CODE_PATTERN.test(error.message)
  );
};

export class HandleScheduledEventUseCase {
  constructor(
    readonly projectRequiredFieldCreateUseCase: ProjectRequiredFieldCreateUseCase,
    readonly setupTowerDefenceProjectUseCase: SetupTowerDefenceProjectUseCase,
    readonly actionAnnouncementUseCase: ActionAnnouncementUseCase,
    readonly setWorkflowManagementIssueToStoryUseCase: SetWorkflowManagementIssueToStoryUseCase,
    readonly clearPastNextActionUseCase: ClearPastNextActionDateHourUseCase,
    readonly clearDependedIssueURLUseCase: ClearDependedIssueURLUseCase,
    readonly setDependedIssueUrlForOpenTaskPRsUseCase: SetDependedIssueUrlForOpenTaskPRsUseCase,
    readonly staleTaskPullRequestCloseUseCase: StaleTaskPullRequestCloseUseCase,
    readonly createEstimationIssueUseCase: CreateEstimationIssueUseCase,
    readonly changeStatusByStoryColorUseCase: ChangeStatusByStoryColorUseCase,
    readonly setNoStoryIssueToStoryUseCase: SetNoStoryIssueToStoryUseCase,
    readonly createNewStoryByLabelUseCase: CreateNewStoryByLabelUseCase,
    readonly assignNoAssigneeIssueToManagerUseCase: AssignNoAssigneeIssueToManagerUseCase,
    readonly updateIssueStatusByLabelUseCase: UpdateIssueStatusByLabelUseCase,
    readonly issueNoStatusUpdateUseCase: IssueNoStatusUpdateUseCase,
    readonly startPreparationUseCase: StartPreparationUseCase,
    readonly revertOrphanedPreparationUseCase: RevertOrphanedPreparationUseCase,
    readonly nonPreparationWorkerScopeStopUseCase: NonPreparationWorkerScopeStopUseCase,
    readonly conflictedIssueRevertUseCase: ConflictedIssueRevertUseCase,
    readonly revertNotReadyReviewQueueIssueUseCase: RevertNotReadyReviewQueueIssueUseCase,
    readonly agentDesignationLabelAdoptUseCase: AgentDesignationLabelAdoptUseCase,
    readonly updateRateLimitCacheUseCase: UpdateRateLimitCacheUseCase | null,
    readonly dailySecurityScanUseCase: DailySecurityScanUseCase | null,
    readonly qualityCheckAdvanceUseCase: QualityCheckAdvanceUseCase,
    readonly reopenedDoneIssueRevertUseCase: ReopenedDoneIssueRevertUseCase,
    readonly closedStoryIssueReopenUseCase: ClosedStoryIssueReopenUseCase,
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
    labelsNotRequiringPullRequest?: string[] | null;
    changeTargetPathAliases?: Record<string, string> | null;
    allowedIssueAuthors?: string[] | null;
    autoAssignManagerAuthors?: string[] | null;
    agents?: string[] | null;
    agentDesignationLabelsToKeep?: string[] | null;
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
      awaitingOwnerStatus?: string | null;
      autoAdvanceQualityCheckEnabled?: boolean;
      autoRevertReopenedDoneEnabled?: boolean;
      labelsAsLlmAgentName?: string[] | null;
    } | null;
    thresholdForAutoReject?: number;
    thresholdForDispatchLoop?: number;
    queryToAddProjectEnabled?: boolean;
    queryToAddProject?: string | null;
    dailySecurityScan?: DailySecurityScanConfig | null;
    developerAgentNames?: string[] | null;
    workflowIssueReporterSettings?: WorkflowIssueReporterSettings | null;
    allowedDependencyRepoNameWithOwner?: string | null;
    afterIssuesFetched?:
      ((project: Project, issues: Issue[]) => void | Promise<void>) | null;
  }): Promise<{
    project: Project;
    issues: Issue[];
    cacheUsed: boolean;
    targetDateTimes: Date[];
    storyIssues: StoryObjectMap;
    rotationOrder: RotationOrderEntry[] | null;
    storyOptionWriteFailures: string[];
  } | null> => {
    if (input.disabled) {
      return null;
    }
    try {
      await this.projectRequiredFieldCreateUseCase.run({
        projectUrl: input.projectUrl,
        agents: input.agents ?? null,
        defaultAgentName: input.startPreparation?.defaultAgentName ?? null,
      });
    } catch (e) {
      if (!(e instanceof Error) || !isTransientApiError(e)) {
        throw e;
      }
      console.warn(
        `[HandleScheduledEvent] Transient API error in ProjectRequiredFieldCreateUseCase, skipping field setup for this cycle: ${e.name}: ${e.message}`,
      );
    }
    try {
      await this.setupTowerDefenceProjectUseCase.run({
        projectUrl: input.projectUrl,
      });
    } catch (e) {
      if (!(e instanceof Error) || !isTransientApiError(e)) {
        throw e;
      }
      console.warn(
        `[HandleScheduledEvent] Transient API error in SetupTowerDefenceProjectUseCase, skipping project setup for this cycle: ${e.name}: ${e.message}`,
      );
    }
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
    try {
      await this.closedStoryIssueReopenUseCase.run({
        issues,
        storyObjectMap: storyIssues,
        storyIssueOwnerRepo: `${input.org}/${input.workingReport.repo}`,
      });
    } catch (reopenError) {
      console.error(
        `[HandleScheduledEvent] Failed to reopen closed story issues for project ${project.url}: ${reopenError instanceof Error ? reopenError.message : String(reopenError)}`,
        reopenError,
      );
    }
    if (input.afterIssuesFetched) {
      await input.afterIssuesFetched(project, issues);
    }
    const storyOptionWriteFailures: string[] = [];
    for (const storyObject of storyIssues.values()) {
      const projectStory = project.story;
      if (!projectStory) {
        break;
      }
      if (
        storyObject.storyIssue ||
        storyObject.story.name.startsWith('regular / ') ||
        storyObject.story.color === 'GRAY'
      ) {
        continue;
      }
      const hasClosedStoryIssue = issues.some(
        (issue) =>
          storyObject.story.name.startsWith(issue.title) &&
          issue.isClosed &&
          issue.labels.includes('story'),
      );
      if (hasClosedStoryIssue) {
        continue;
      }
      const existingOpenStoryIssues = await this.issueRepository.searchIssue({
        owner: input.org,
        repositoryName: input.workingReport.repo,
        type: 'issue',
        state: 'open',
        title: storyObject.story.name,
      });
      const matchedOpenStoryIssue = existingOpenStoryIssues.find(
        (issue) => issue.title === storyObject.story.name,
      );
      if (matchedOpenStoryIssue) {
        const matchedIssueState = await this.issueRepository.getIssueByUrl(
          matchedOpenStoryIssue.url,
        );
        if (matchedIssueState && !matchedIssueState.storyOptionId) {
          await this.refetchAndWriteStoryOption({
            projectId,
            storyName: storyObject.story.name,
            issueUrl: matchedOpenStoryIssue.url,
            projectItemId: matchedIssueState.itemId,
            failures: storyOptionWriteFailures,
          });
        }
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
        projectId,
        storyObject.story.name,
      );
      const issueUrl = `https://github.com/${input.org}/${input.workingReport.repo}/issues/${issueNumber}`;
      const projectItemId = await this.issueRepository.addIssueToProject(
        project,
        issueUrl,
      );
      await this.refetchAndWriteStoryOption({
        projectId,
        storyName: storyObject.story.name,
        issueUrl,
        projectItemId,
        failures: storyOptionWriteFailures,
      });
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
      await this.issueRepository.appendIssueToProjectCache(projectId, newIssue);
      console.log(
        `[HandleScheduledEvent] Story issue created: story="${storyObject.story.name}" elapsed=${Date.now() - storyStartTime}ms`,
      );
    }

    let targetDateTimes: Date[] = [];
    try {
      targetDateTimes = await this.findTargetDateAndUpdateLastExecutionDateTime(
        input.workingReport.spreadsheetUrl,
        now,
        input.org,
        input.workingReport.repo,
        input.manager,
      );
    } catch (e) {
      if (!(e instanceof Error) || !isTransientSpreadsheetApiError(e)) {
        throw e;
      }
      console.warn(
        `[HandleScheduledEvent] Transient spreadsheet API error while updating last execution date time, skipping this spreadsheet operation and continuing the cycle: ${e.name}: ${e.message}`,
      );
    }

    let runSlowSweep = false;
    try {
      runSlowSweep = await this.shouldRunSlowSweep(
        input.workingReport.spreadsheetUrl,
        now,
        input.org,
        input.workingReport.repo,
        input.manager,
      );
    } catch (e) {
      if (!(e instanceof Error) || !isTransientSpreadsheetApiError(e)) {
        throw e;
      }
      console.warn(
        `[HandleScheduledEvent] Transient spreadsheet API error while checking slow sweep schedule, skipping slow sweep for this cycle: ${e.name}: ${e.message}`,
      );
    }

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
        now,
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
          const existingComments =
            await this.issueRepository.getIssueOrPullRequestComments(
              existingIncidentIssues[0].url,
            );
          if (
            !isDuplicateWithinWindow(
              errorBody,
              existingComments.map((c) => ({
                text: c.body,
                createdAt: c.createdAt,
              })),
              new Date(),
            )
          ) {
            await this.issueRepository.createCommentByUrl(
              existingIncidentIssues[0].url,
              errorBody,
            );
          }
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
      storyOptionWriteFailures,
    };
  };
  private refetchAndWriteStoryOption = async (input: {
    projectId: Project['id'];
    storyName: string;
    issueUrl: string;
    projectItemId: string;
    failures: string[];
  }): Promise<void> => {
    const { projectId, storyName, issueUrl, projectItemId, failures } = input;
    await this.runOperationIsolated(
      `write Story field for issue ${issueUrl} (story="${storyName}")`,
      async () => {
        const freshProject = await this.projectRepository.getProject(projectId);
        const freshStory = freshProject?.story ?? null;
        if (!freshProject || !freshStory) {
          console.warn(
            `[HandleScheduledEvent] Skipping Story field write because the project or its Story field could not be re-fetched: issue=${issueUrl} story="${storyName}"`,
          );
          return;
        }
        const matchingStoryOption = freshStory.stories.find(
          (option) => option.name === storyName,
        );
        if (!matchingStoryOption) {
          console.warn(
            `[HandleScheduledEvent] Skipping Story field write because no Story option currently matches the story name: issue=${issueUrl} story="${storyName}"`,
          );
          return;
        }
        await this.issueRepository.updateStoryByProjectItemId(
          { ...freshProject, story: freshStory },
          projectItemId,
          matchingStoryOption.id,
        );
      },
      failures,
    );
  };
  runEachUseCases = async (
    input: Parameters<HandleScheduledEventUseCase['run']>[0],
    project: Project,
    issues: Issue[],
    cacheUsed: boolean,
    targetDateTimes: Date[],
    storyObjectMap: StoryObjectMap,
    runSlowSweep: boolean,
    now: Date,
  ): Promise<{ rotationOrder: RotationOrderEntry[] | null }> => {
    if (runSlowSweep) {
      await this.runSlowSweepUseCases(
        input,
        project,
        issues,
        cacheUsed,
        targetDateTimes,
        storyObjectMap,
        now,
      );
    } else {
      try {
        await this.clearDependedIssueURLUseCase.removeResolvedDependedIssueUrlsFromIssuesWithClosedDependedIssue(
          { project, issues },
        );
      } catch (removalError) {
        console.error(
          `[HandleScheduledEvent] Failed to remove resolved depended issue URLs for project ${project.url}: ${removalError instanceof Error ? removalError.message : String(removalError)}`,
          removalError,
        );
      }
    }
    await this.createNewStoryByLabelUseCase.run({
      project,
      cacheUsed,
      org: input.org,
      repo: input.workingReport.repo,
      storyObjectMap,
      issues,
    });
    const labelsAsLlmAgentName = resolveLabelsAsLlmAgentName({
      topLevel: input.labelsAsLlmAgentName,
      startPreparation: input.startPreparation?.labelsAsLlmAgentName,
    });
    const allowedIssueAuthors = resolveAllowedIssueAuthors({
      topLevel: input.allowedIssueAuthors,
      startPreparation: input.startPreparation?.allowedIssueAuthors,
    });
    await this.agentDesignationLabelAdoptUseCase.run({
      project,
      issues,
      agents: input.agents ?? null,
      agentDesignationLabelsToKeep: input.agentDesignationLabelsToKeep ?? null,
      defaultAgentName: input.startPreparation?.defaultAgentName ?? null,
    });
    await this.conflictedIssueRevertUseCase.run({
      projectUrl: input.projectUrl,
      allowedIssueAuthors,
      thresholdForAutoReject: input.thresholdForAutoReject,
      thresholdForDispatchLoop: input.thresholdForDispatchLoop,
    });
    await this.revertNotReadyReviewQueueIssueUseCase.run({
      projectUrl: input.projectUrl,
      manager: input.manager,
      labelsAsLlmAgentName,
      labelsNotRequiringPullRequest: input.labelsNotRequiringPullRequest,
      changeTargetPathAliases: input.changeTargetPathAliases,
      allowedIssueAuthors,
      developerAgentNames: input.developerAgentNames,
      evaluatedAt: now,
      thresholdForAutoReject: input.thresholdForAutoReject,
      thresholdForDispatchLoop: input.thresholdForDispatchLoop,
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
          thresholdForDispatchLoop: input.thresholdForDispatchLoop,
          awLogDirectoryPath: input.startPreparation.awLogDirectoryPath,
          awLogStaleThresholdMinutes:
            input.startPreparation.awLogStaleThresholdMinutes,
          awaitingOwnerStatus:
            input.startPreparation.awaitingOwnerStatus ?? undefined,
          labelsAsLlmAgentName,
          labelsNotRequiringPullRequest: input.labelsNotRequiringPullRequest,
          allowedIssueAuthors,
          agents: input.agents ?? null,
          developerAgentNames: input.developerAgentNames ?? null,
          workflowIssueReporterSettings:
            input.workflowIssueReporterSettings ?? null,
        });
      }
      try {
        const { stoppedScopeUnitNames } =
          await this.nonPreparationWorkerScopeStopUseCase.run({
            issues,
            currentProjectOrg: input.org,
          });
        if (stoppedScopeUnitNames.length > 0) {
          console.log(
            `[HandleScheduledEvent] Stopped ${stoppedScopeUnitNames.length} worker scope(s) whose issue Status is not ${PREPARATION_STATUS_NAME} for project ${project.url}: ${stoppedScopeUnitNames.join(', ')}`,
          );
        }
      } catch (stopError) {
        console.error(
          `[HandleScheduledEvent] Failed to stop non-${PREPARATION_STATUS_NAME} worker scopes for project ${project.url}: ${stopError instanceof Error ? stopError.message : String(stopError)}`,
          stopError,
        );
      }
      if (input.startPreparation.autoRevertReopenedDoneEnabled) {
        try {
          await this.reopenedDoneIssueRevertUseCase.run({ project, issues });
        } catch (revertError) {
          console.error(
            `[HandleScheduledEvent] Failed to revert reopened Done issues for project ${project.url}: ${revertError instanceof Error ? revertError.message : String(revertError)}`,
            revertError,
          );
        }
      }
      if (input.startPreparation.autoAdvanceQualityCheckEnabled) {
        try {
          await this.qualityCheckAdvanceUseCase.run({
            project,
            issues,
            awaitingOwnerStatusName:
              input.startPreparation.awaitingOwnerStatus ?? undefined,
            evaluatedAt: now,
          });
        } catch (advanceError) {
          console.error(
            `[HandleScheduledEvent] Failed to advance quality check items for project ${project.url}: ${advanceError instanceof Error ? advanceError.message : String(advanceError)}`,
            advanceError,
          );
        }
      }
      await this.issueNoStatusUpdateUseCase.run({ project, issues });
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
        manager: input.manager,
        codexHomeCandidates: input.startPreparation.codexHomeCandidates ?? null,
        labelsAsLlmAgentName,
        agents: input.agents ?? null,
      });
      return { rotationOrder: preparationResult.rotationOrder };
    }
    return { rotationOrder: null };
  };
  private runOperationIsolated = async (
    operationName: string,
    operation: () => Promise<void>,
    failures: string[],
  ): Promise<void> => {
    try {
      await operation();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(
        `[HandleScheduledEvent] Failed to ${operationName}: ${message}`,
        error,
      );
      failures.push(`${operationName}: ${message}`);
    }
  };

  runSlowSweepUseCases = async (
    input: Parameters<HandleScheduledEventUseCase['run']>[0],
    project: Project,
    issues: Issue[],
    cacheUsed: boolean,
    targetDateTimes: Date[],
    storyObjectMap: StoryObjectMap,
    now: Date,
  ): Promise<void> => {
    const failures: string[] = [];
    await this.runOperationIsolated(
      `set workflow-management issues to Story for project ${project.url}`,
      () =>
        this.setWorkflowManagementIssueToStoryUseCase.run({
          targetDates: targetDateTimes,
          project,
          issues,
          cacheUsed,
        }),
      failures,
    );
    await this.runOperationIsolated(
      `set NO STORY issues to Story for project ${project.url}`,
      () =>
        this.setNoStoryIssueToStoryUseCase.run({
          targetDates: targetDateTimes,
          project,
          issues,
          cacheUsed,
        }),
      failures,
    );
    await this.runOperationIsolated(
      `run action announcements for project ${project.url}`,
      () =>
        this.actionAnnouncementUseCase.run({
          targetDates: targetDateTimes,
          project,
          issues,
          cacheUsed,
          members: input.workingReport.members,
          manager: input.manager,
        }),
      failures,
    );
    await this.runOperationIsolated(
      `clear past next action date/hour for project ${project.url}`,
      () =>
        this.clearPastNextActionUseCase.run({
          targetDates: targetDateTimes,
          project,
          issues,
          cacheUsed,
        }),
      failures,
    );
    await this.runOperationIsolated(
      `clear depended issue URL for project ${project.url}`,
      () =>
        this.clearDependedIssueURLUseCase.run({
          project,
          issues,
          cacheUsed,
          allowedExternalRepoNameWithOwner:
            input.allowedDependencyRepoNameWithOwner ?? null,
        }),
      failures,
    );
    await this.runOperationIsolated(
      `set depended issue URL for open task PRs for project ${project.url}`,
      () =>
        this.setDependedIssueUrlForOpenTaskPRsUseCase.run({
          project,
          issues,
        }),
      failures,
    );
    await this.runOperationIsolated(
      `close stale task pull requests for project ${project.url}`,
      () =>
        this.staleTaskPullRequestCloseUseCase.run({
          issues,
          evaluatedAt: now,
        }),
      failures,
    );
    await this.runOperationIsolated(
      `create estimation issue for project ${project.url}`,
      () =>
        this.createEstimationIssueUseCase.run({
          targetDates: targetDateTimes,
          project,
          issues,
          cacheUsed,
          manager: input.manager,
          org: input.org,
          repo: input.workingReport.repo,
          urlOfStoryView: input.urlOfStoryView,
          storyObjectMap: storyObjectMap,
        }),
      failures,
    );
    await this.runOperationIsolated(
      `change status by story color for project ${project.url}`,
      () =>
        this.changeStatusByStoryColorUseCase.run({
          project,
          cacheUsed,
          org: input.org,
          repo: input.workingReport.repo,
          storyObjectMap: storyObjectMap,
          manager: input.manager,
        }),
      failures,
    );
    await this.runOperationIsolated(
      `assign no-assignee issue to manager for project ${project.url}`,
      () =>
        this.assignNoAssigneeIssueToManagerUseCase.run({
          issues,
          manager: input.manager,
          cacheUsed,
          autoAssignManagerAuthors: input.autoAssignManagerAuthors ?? null,
          projectToAddSearchedIssues: project,
          queryToAddProjectEnabled: input.queryToAddProjectEnabled ?? false,
          queryToAddProject: input.queryToAddProject ?? null,
        }),
      failures,
    );
    await this.runOperationIsolated(
      `update issue status by label for project ${project.url}`,
      () =>
        this.updateIssueStatusByLabelUseCase.run({
          project,
          issues,
        }),
      failures,
    );
    if (failures.length > 0) {
      throw new Error(
        `Failed ${failures.length} operation(s) in runSlowSweepUseCases for project ${project.url}: ${failures.join('; ')}`,
      );
    }
  };
  static createTargetDateTimes = (from: Date, to: Date): Date[] => {
    const targetDateTimes: Date[] = [];
    if (from.getTime() > to.getTime()) {
      const targetDate = new Date(to);
      targetDate.setUTCSeconds(0);
      targetDate.setUTCMilliseconds(0);
      return [targetDate];
    }
    const targetDate = new Date(from);
    targetDate.setTime(targetDate.getTime() + 60 * 1000);
    targetDate.setUTCSeconds(0);
    targetDate.setUTCMilliseconds(0);
    while (
      targetDate.getTime() <= to.getTime() &&
      targetDateTimes.length < 300
    ) {
      targetDateTimes.push(new Date(targetDate));
      targetDate.setUTCMinutes(targetDate.getUTCMinutes() + 1);
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
      if (isTransientSpreadsheetApiError(e)) {
        console.warn(
          `[HandleScheduledEvent] Transient spreadsheet API error on ${operation} (${spreadsheetUrl}): ${e.name}: ${e.message}`,
        );
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
    return buildStoryObjectMap(input);
  };
}
