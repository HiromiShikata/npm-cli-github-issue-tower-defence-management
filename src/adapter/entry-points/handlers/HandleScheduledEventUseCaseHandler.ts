import YAML from 'yaml';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { writeSituationFile } from './situationFileWriter';
import {
  formatConsoleGeneratedAt,
  writeConsoleLists,
} from './consoleListsWriter';
import { writeDashboardRow } from './dashboardRowWriter';
import { writeMachineStatus } from './machineStatusWriter';
import { writeTokenStatus } from './tokenStatusWriter';
import { handleSubscriptionDisabledTokens } from './subscriptionDisabledTokenHandler';
import { writeInTmuxByHumanData } from './inTmuxByHumanDataWriter';
import { cleanClosedIssueOwnerCallFiles } from './ownerCallFileCleaner';
import { reconcileInTmuxByHumanSessions } from './inTmuxByHumanSessionReconciler';
import { handleTokenExhaustionHandover } from './tokenExhaustionHandover';
import { cleanStaleTmuxSessions } from './staleTmuxSessionCleaner';
import {
  notifySilentTmuxSessions,
  DEFAULT_NOTIFY_SILENT_TMUX_SESSIONS_PARAMS,
} from './notifySilentTmuxSessions';
import { ownerReplyMarkerDirectoryResolve } from './ownerReplyMarkerDirectoryResolve';
import { TranscriptOwnerCallStatusProvider } from '../../repositories/TranscriptOwnerCallStatusProvider';
import { NoUnansweredOwnerCallStatusProvider } from '../../repositories/NoUnansweredOwnerCallStatusProvider';
import { OwnerCallStatusProvider } from '../../../domain/usecases/adapter-interfaces/OwnerCallStatusProvider';
import {
  resetDegeneratedTmuxSessions,
  DEFAULT_RESET_DEGENERATED_TMUX_SESSIONS_PARAMS,
} from './resetDegeneratedTmuxSessions';
import { writeRotationOrderFile } from './rotationOrderFileWriter';
import {
  fetchProjectReadme,
  parseProjectReadmeConfig,
} from '../cli/projectConfig';
import {
  loadStartPreparationFleetSettings,
  resolveFleetConfigFilePath,
} from '../cli/fleetConfig';
import { SystemDateRepository } from '../../repositories/SystemDateRepository';
import { LocalStorageRepository } from '../../repositories/LocalStorageRepository';
import { GoogleSpreadsheetRepository } from '../../repositories/GoogleSpreadsheetRepository';
import { GraphqlProjectRepository } from '../../repositories/GraphqlProjectRepository';
import { ApiV3IssueRepository } from '../../repositories/issue/ApiV3IssueRepository';
import { RestIssueRepository } from '../../repositories/issue/RestIssueRepository';
import { GraphqlProjectItemRepository } from '../../repositories/issue/GraphqlProjectItemRepository';
import { ApiV3CheerioRestIssueRepository } from '../../repositories/issue/ApiV3CheerioRestIssueRepository';
import { HandleScheduledEventUseCase } from '../../../domain/usecases/HandleScheduledEventUseCase';
import { LocalStorageCacheRepository } from '../../repositories/LocalStorageCacheRepository';
import { projectCacheDirectory } from '../../repositories/localStorageCacheDirectory';
import { ActionAnnouncementUseCase } from '../../../domain/usecases/ActionAnnouncementUseCase';
import { SetWorkflowManagementIssueToStoryUseCase } from '../../../domain/usecases/SetWorkflowManagementIssueToStoryUseCase';
import { ClearPastNextActionDateHourUseCase } from '../../../domain/usecases/ClearPastNextActionDateHourUseCase';
import { AnalyzeProblemByIssueUseCase } from '../../../domain/usecases/AnalyzeProblemByIssueUseCase';
import { Issue } from '../../../domain/entities/Issue';
import { Project } from '../../../domain/entities/Project';
import { BaseGitHubRepository } from '../../repositories/BaseGitHubRepository';
import { AnalyzeStoriesUseCase } from '../../../domain/usecases/AnalyzeStoriesUseCase';
import { ClearDependedIssueURLUseCase } from '../../../domain/usecases/ClearDependedIssueURLUseCase';
import { SetDependedIssueUrlForOpenTaskPRsUseCase } from '../../../domain/usecases/SetDependedIssueUrlForOpenTaskPRsUseCase';
import { StaleTaskPullRequestCloseUseCase } from '../../../domain/usecases/StaleTaskPullRequestCloseUseCase';
import { CreateEstimationIssueUseCase } from '../../../domain/usecases/CreateEstimationIssueUseCase';
import { ConvertCheckboxToIssueInStoryIssueUseCase } from '../../../domain/usecases/ConvertCheckboxToIssueInStoryIssueUseCase';
import { ChangeStatusByStoryColorUseCase } from '../../../domain/usecases/ChangeStatusByStoryColorUseCase';
import { SetNoStoryIssueToStoryUseCase } from '../../../domain/usecases/SetNoStoryIssueToStoryUseCase';
import { CreateNewStoryByLabelUseCase } from '../../../domain/usecases/CreateNewStoryByLabelUseCase';
import { AssignNoAssigneeIssueToManagerUseCase } from '../../../domain/usecases/AssignNoAssigneeIssueToManagerUseCase';
import { UpdateIssueStatusByLabelUseCase } from '../../../domain/usecases/UpdateIssueStatusByLabelUseCase';
import { IssueNoStatusUpdateUseCase } from '../../../domain/usecases/IssueNoStatusUpdateUseCase';
import { StartPreparationUseCase } from '../../../domain/usecases/StartPreparationUseCase';
import { NodeLocalCommandRunner } from '../../repositories/NodeLocalCommandRunner';
import { ProcTakeOwnershipSpawnRepository } from '../../repositories/ProcTakeOwnershipSpawnRepository';
import { ProxyClaudeTokenUsageRepository } from '../../repositories/ProxyClaudeTokenUsageRepository';
import { ProxyRateLimitCacheRepository } from '../../repositories/ProxyRateLimitCacheRepository';
import { UpdateRateLimitCacheUseCase } from '../../../domain/usecases/UpdateRateLimitCacheUseCase';
import { RevertOrphanedPreparationUseCase } from '../../../domain/usecases/RevertOrphanedPreparationUseCase';
import { RevertNotReadyReviewQueueIssueUseCase } from '../../../domain/usecases/RevertNotReadyReviewQueueIssueUseCase';
import { TriagerApprovalDispatchUseCase } from '../../../domain/usecases/TriagerApprovalDispatchUseCase';
import { AgentDesignationLabelAdoptUseCase } from '../../../domain/usecases/AgentDesignationLabelAdoptUseCase';
import { GitHubIssueCommentRepository } from '../../repositories/GitHubIssueCommentRepository';
import { ProjectRequiredFieldCreateUseCase } from '../../../domain/usecases/ProjectRequiredFieldCreateUseCase';
import { SetupTowerDefenceProjectUseCase } from '../../../domain/usecases/SetupTowerDefenceProjectUseCase';
import { DailySecurityScanUseCase } from '../../../domain/usecases/DailySecurityScanUseCase';
import { QualityCheckAdvanceUseCase } from '../../../domain/usecases/QualityCheckAdvanceUseCase';
import { ReopenedDoneIssueRevertUseCase } from '../../../domain/usecases/ReopenedDoneIssueRevertUseCase';
import { ConflictedIssueRevertUseCase } from '../../../domain/usecases/ConflictedIssueRevertUseCase';
import { KyHttpRepository } from '../../repositories/KyHttpRepository';
import { FileSystemKevReportWatermarkRepository } from '../../repositories/FileSystemKevReportWatermarkRepository';
import {
  AWAITING_QUALITY_CHECK_STATUS_NAME,
  AWAITING_WORKSPACE_STATUS_NAME,
  FAILED_PREPARATION_STATUS_NAME,
  PREPARATION_STATUS_NAME,
} from '../../../domain/entities/WorkflowStatus';

const DEFAULT_DASHBOARD_DATA_DIR: string | null = null;

const readSilentSeconds = (
  configValue: number | undefined,
  envValue: string | undefined,
  defaultValue: number,
): number => {
  if (configValue !== undefined) {
    return configValue;
  }
  if (envValue !== undefined) {
    const parsed = Number(envValue);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return defaultValue;
};

export class HandleScheduledEventUseCaseHandler {
  handle = async (
    configFilePath: string,
    _verbose: boolean,
    inTmuxProjectOrderOverride: string[] | null = null,
  ): Promise<{
    project: Project;
    issues: Issue[];
    cacheUsed: boolean;
    targetDateTimes: Date[];
  } | null> => {
    const configFileContent = fs.readFileSync(configFilePath, 'utf8');
    const input: unknown = YAML.parse(configFileContent);
    type inputType = Omit<
      Parameters<HandleScheduledEventUseCase['run']>[0],
      'allowedIssueAuthors' | 'autoAssignManagerAuthors'
    > & {
      allowedIssueAuthors?: string | string[] | null;
      autoAssignManagerAuthors?: string | string[] | null;
      claudeCodeOauthTokenListJsonPath?: string;
      consoleDataOutputDir?: string;
      dashboardDataDir?: string;
      disks?: { title: string; mountpoint: string }[];
      workflowBlockerStoryName?: string;
      inTmuxDataOutputDir?: string;
      newIssueRepo?: string;
      inTmuxConsoleBaseUrl?: string;
      inTmuxConsoleToken?: string;
      inTmuxProjectOrder?: string[];
      inTmuxLauncherCommand?: string;
      tokenExhaustionHandoverEnabled?: boolean;
      tokenExhaustionHandoverMessage?: string;
      tokenExhaustionHandoverBareNameLeaderMessage?: string;
      tokenRateLimitSnapshotBaseDir?: string;
      tokenExhaustionGracePeriodSeconds?: number;
      tokenExhaustionHandoverStateFilePath?: string;
      silentNotificationEnabled?: boolean;
      ownerCallMarker?: string;
      ownerReplyMarkerDirectory?: string;
      subAgentOutputRootDirectory?: string;
      subAgentProcessMatchPattern?: string;
      subAgentTranscriptRootDirectory?: string;
      subAgentRuntimeRootDirectory?: string;
      mainSilentThresholdSeconds?: number;
      unansweredOwnerCallGraceSeconds?: number;
      subAgentSilentThresholdSeconds?: number;
      subAgentRunningThresholdSeconds?: number;
      silentNotificationStaggerSeconds?: number;
      candidateDebounceRecencyWindowSeconds?: number;
      candidateDebounceStateFilePath?: string;
      activeHubTaskStatus?: string;
      hubTaskStatusCacheStateFilePath?: string;
      hubTaskStatusCacheTtlSeconds?: number;
      silentMainStalledMessage?: string;
      silentMainStalledStaleOwnerCallMessage?: string;
      silentSubAgentIdleMessageHeader?: string;
      silentSubAgentIdleMessageFooter?: string;
      silentSubAgentLongRunningMessageHeader?: string;
      silentSubAgentLongRunningMessageFooter?: string;
      outputDegenerationResetEnabled?: boolean;
      outputDegenerationWarningMessage?: string;
      outputDegenerationGraceSeconds?: number;
      outputDegenerationCooldownSeconds?: number;
      outputDegenerationCooldownStateFilePath?: string;
      credentials: {
        manager: {
          github: {
            token: string;
          };
          slack: {
            userToken: string;
          };
          googleServiceAccount: {
            serviceAccountKey: string;
          };
        };
        bot: {
          github: {
            token: string;
          };
        };
      };
    };

    const isInputType = (v: unknown): v is inputType => {
      if (typeof v !== 'object' || v === null) return false;
      if (
        !('credentials' in v) ||
        typeof v.credentials !== 'object' ||
        v.credentials === null
      )
        return false;
      const credentials = v.credentials;
      if (
        !('manager' in credentials) ||
        typeof credentials.manager !== 'object' ||
        credentials.manager === null
      )
        return false;
      const manager = credentials.manager;
      if (
        !('github' in manager) ||
        typeof manager.github !== 'object' ||
        manager.github === null
      )
        return false;
      if (
        !('token' in manager.github) ||
        typeof manager.github.token !== 'string'
      )
        return false;
      if (
        !('slack' in manager) ||
        typeof manager.slack !== 'object' ||
        manager.slack === null
      )
        return false;
      if (
        !('userToken' in manager.slack) ||
        typeof manager.slack.userToken !== 'string'
      )
        return false;
      if (
        !('googleServiceAccount' in manager) ||
        typeof manager.googleServiceAccount !== 'object' ||
        manager.googleServiceAccount === null
      )
        return false;
      if (
        !('serviceAccountKey' in manager.googleServiceAccount) ||
        typeof manager.googleServiceAccount.serviceAccountKey !== 'string'
      )
        return false;
      if (
        !('bot' in credentials) ||
        typeof credentials.bot !== 'object' ||
        credentials.bot === null
      )
        return false;
      const bot = credentials.bot;
      if (
        !('github' in bot) ||
        typeof bot.github !== 'object' ||
        bot.github === null
      )
        return false;
      if (!('token' in bot.github) || typeof bot.github.token !== 'string')
        return false;
      return true;
    };
    if (!isInputType(input)) {
      throw new Error(
        `Invalid input: required credential fields are missing. Got: ${JSON.stringify(input)}`,
      );
    }
    if (input.disabled) {
      return null;
    }

    const managerToken = input.credentials.manager.github.token;
    const readme = await fetchProjectReadme(input.projectUrl, managerToken);
    const readmeConfig = readme
      ? parseProjectReadmeConfig(readme, input.projectUrl)
      : {};

    const startPreparationFleetSettings = loadStartPreparationFleetSettings(
      resolveFleetConfigFilePath(null),
    );

    const normalizeAllowedIssueAuthors = (
      value: string | string[] | null | undefined,
    ): string[] | null => {
      if (value === null || value === undefined) {
        return null;
      }
      if (Array.isArray(value)) {
        return value;
      }
      return value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    };

    const mergedInput = {
      ...input,
      allowedIssueAuthors: normalizeAllowedIssueAuthors(
        input.allowedIssueAuthors,
      ),
      autoAssignManagerAuthors: normalizeAllowedIssueAuthors(
        readmeConfig.autoAssignManagerAuthors ??
          input.autoAssignManagerAuthors ??
          input.allowedIssueAuthors,
      ),
      claudeCodeOauthTokenListJsonPath:
        readmeConfig.claudeCodeOauthTokenListJsonPath ??
        input.claudeCodeOauthTokenListJsonPath,
      thresholdForAutoReject:
        readmeConfig.thresholdForAutoReject ?? input.thresholdForAutoReject,
      thresholdForDispatchLoop:
        readmeConfig.thresholdForDispatchLoop ?? input.thresholdForDispatchLoop,
      developerAgentName:
        readmeConfig.developerAgentName ?? input.developerAgentName ?? null,
      startPreparation: input.startPreparation
        ? {
            ...input.startPreparation,
            defaultAgentName:
              readmeConfig.defaultAgentName ??
              input.startPreparation.defaultAgentName,
            defaultLlmModelName:
              readmeConfig.defaultLlmModelName ??
              input.startPreparation.defaultLlmModelName,
            fallbackLlmModelName:
              readmeConfig.fallbackLlmModelName ??
              input.startPreparation.fallbackLlmModelName,
            defaultLlmAgentName:
              readmeConfig.defaultLlmAgentName ??
              input.startPreparation.defaultLlmAgentName,
            maximumPreparingIssuesCount:
              readmeConfig.maximumPreparingIssuesCount ??
              input.startPreparation.maximumPreparingIssuesCount ??
              startPreparationFleetSettings.maximumPreparingIssuesCount,
            utilizationPercentageThreshold:
              readmeConfig.utilizationPercentageThreshold ??
              input.startPreparation.utilizationPercentageThreshold,
            allowedIssueAuthors: readmeConfig.allowedIssueAuthors
              ? readmeConfig.allowedIssueAuthors
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean)
              : input.startPreparation.allowedIssueAuthors,
            preparationProcessCheckCommand:
              readmeConfig.preparationProcessCheckCommand ??
              input.startPreparation.preparationProcessCheckCommand,
            codexHomeCandidates:
              readmeConfig.codexHomeCandidates ??
              input.startPreparation.codexHomeCandidates,
          }
        : input.startPreparation,
    };

    type EffectiveConfigValue = string | number | null | undefined;

    const resolveConfigSource = (
      readmeValue: EffectiveConfigValue,
      configFileValue: EffectiveConfigValue,
    ): 'readmeOverride' | 'configFile' | 'unset (default)' => {
      if (readmeValue !== undefined && readmeValue !== null) {
        return 'readmeOverride';
      }
      if (configFileValue !== undefined && configFileValue !== null) {
        return 'configFile';
      }
      return 'unset (default)';
    };

    const formatEffectiveConfig = (
      value: EffectiveConfigValue,
      readmeValue: EffectiveConfigValue,
      configFileValue: EffectiveConfigValue,
    ): string =>
      `${value ?? 'null'} (source: ${resolveConfigSource(readmeValue, configFileValue)})`;

    console.log(
      `Effective maximumPreparingIssuesCount: ${formatEffectiveConfig(
        mergedInput.startPreparation?.maximumPreparingIssuesCount,
        readmeConfig.maximumPreparingIssuesCount,
        input.startPreparation?.maximumPreparingIssuesCount,
      )}`,
    );
    console.log(
      `Effective defaultLlmModelName: ${formatEffectiveConfig(
        mergedInput.startPreparation?.defaultLlmModelName,
        readmeConfig.defaultLlmModelName,
        input.startPreparation?.defaultLlmModelName,
      )}`,
    );
    console.log(
      `Effective defaultAgentName: ${formatEffectiveConfig(
        mergedInput.startPreparation?.defaultAgentName,
        readmeConfig.defaultAgentName,
        input.startPreparation?.defaultAgentName,
      )}`,
    );

    const systemDateRepository = new SystemDateRepository();
    const localStorageRepository = new LocalStorageRepository();
    const googleSpreadsheetRepository = new GoogleSpreadsheetRepository(
      localStorageRepository,
      input.credentials.manager.googleServiceAccount.serviceAccountKey,
    );
    const cachePath = projectCacheDirectory(input.projectName);
    const localStorageCacheRepository = new LocalStorageCacheRepository(
      localStorageRepository,
      cachePath,
    );
    const githubRepositoryParams: ConstructorParameters<
      typeof BaseGitHubRepository
    > = [localStorageRepository, input.credentials.bot.github.token];
    const projectRepository = new GraphqlProjectRepository(
      ...githubRepositoryParams,
      localStorageCacheRepository,
    );
    const apiV3IssueRepository = new ApiV3IssueRepository(
      ...githubRepositoryParams,
    );
    const restIssueRepository = new RestIssueRepository(
      ...githubRepositoryParams,
    );
    const graphqlProjectItemRepository = new GraphqlProjectItemRepository(
      ...githubRepositoryParams,
    );
    const issueRepository = new ApiV3CheerioRestIssueRepository(
      apiV3IssueRepository,
      restIssueRepository,
      graphqlProjectItemRepository,
      localStorageCacheRepository,
      projectRepository,
      systemDateRepository,
      ...githubRepositoryParams,
    );
    const projectRequiredFieldCreateUseCase =
      new ProjectRequiredFieldCreateUseCase(projectRepository);
    const setupTowerDefenceProjectUseCase = new SetupTowerDefenceProjectUseCase(
      projectRepository,
      issueRepository,
    );
    const actionAnnouncement = new ActionAnnouncementUseCase(issueRepository);
    const setWorkflowManagementIssueToStoryUseCase =
      new SetWorkflowManagementIssueToStoryUseCase(issueRepository);
    const clearPastNextActionUseCase = new ClearPastNextActionDateHourUseCase(
      issueRepository,
    );
    const analyzeProblemByIssueUseCase = new AnalyzeProblemByIssueUseCase(
      issueRepository,
      systemDateRepository,
    );
    const analyzeStoriesUseCase = new AnalyzeStoriesUseCase(
      issueRepository,
      systemDateRepository,
    );
    const clearDependedIssueURLUseCase = new ClearDependedIssueURLUseCase(
      issueRepository,
    );
    const setDependedIssueUrlForOpenTaskPRsUseCase =
      new SetDependedIssueUrlForOpenTaskPRsUseCase(issueRepository);
    const staleTaskPullRequestCloseUseCase =
      new StaleTaskPullRequestCloseUseCase(issueRepository);
    const createEstimationIssueUseCase = new CreateEstimationIssueUseCase(
      issueRepository,
      systemDateRepository,
    );
    const convertCheckboxToIssueInStoryIssueUseCase =
      new ConvertCheckboxToIssueInStoryIssueUseCase(issueRepository);
    const changeStatusByStoryColorUseCase = new ChangeStatusByStoryColorUseCase(
      systemDateRepository,
      issueRepository,
    );

    const setNoStoryIssueToStoryUseCase = new SetNoStoryIssueToStoryUseCase(
      issueRepository,
    );
    const createNewStoryByLabel = new CreateNewStoryByLabelUseCase(
      projectRepository,
      issueRepository,
    );
    const assignNoAssigneeIssueToManagerUseCase =
      new AssignNoAssigneeIssueToManagerUseCase(issueRepository);
    const updateIssueStatusByLabelUseCase = new UpdateIssueStatusByLabelUseCase(
      issueRepository,
    );
    const issueNoStatusUpdateUseCase = new IssueNoStatusUpdateUseCase(
      issueRepository,
    );
    const nodeLocalCommandRunner = new NodeLocalCommandRunner();
    const claudeTokenUsageRepository = new ProxyClaudeTokenUsageRepository(
      mergedInput.claudeCodeOauthTokenListJsonPath ?? null,
    );
    const startPreparationUseCase = new StartPreparationUseCase(
      projectRepository,
      issueRepository,
      nodeLocalCommandRunner,
      claudeTokenUsageRepository,
      new ProcTakeOwnershipSpawnRepository(),
    );
    const proxyRateLimitCacheRepository = new ProxyRateLimitCacheRepository(
      mergedInput.claudeCodeOauthTokenListJsonPath ?? null,
    );
    const updateRateLimitCacheUseCase = mergedInput.startPreparation
      ? new UpdateRateLimitCacheUseCase(proxyRateLimitCacheRepository)
      : null;
    const issueCommentRepository = new GitHubIssueCommentRepository(
      input.credentials.bot.github.token,
    );
    const revertOrphanedPreparationUseCase =
      new RevertOrphanedPreparationUseCase(
        projectRepository,
        issueRepository,
        issueCommentRepository,
        nodeLocalCommandRunner,
      );
    const conflictedIssueRevertUseCase = new ConflictedIssueRevertUseCase(
      projectRepository,
      issueRepository,
      issueCommentRepository,
    );
    const revertNotReadyReviewQueueIssueUseCase =
      new RevertNotReadyReviewQueueIssueUseCase(
        projectRepository,
        issueRepository,
        issueCommentRepository,
      );
    const triagerApprovalDispatchUseCase = new TriagerApprovalDispatchUseCase(
      projectRepository,
      issueRepository,
      issueCommentRepository,
    );
    const agentDesignationLabelAdoptUseCase =
      new AgentDesignationLabelAdoptUseCase(projectRepository, issueRepository);

    const dailySecurityScanUseCase = mergedInput.dailySecurityScan
      ? new DailySecurityScanUseCase(
          nodeLocalCommandRunner,
          issueRepository,
          new KyHttpRepository(),
          new FileSystemKevReportWatermarkRepository(),
        )
      : null;

    const qualityCheckAdvanceUseCase = new QualityCheckAdvanceUseCase(
      issueRepository,
    );

    const reopenedDoneIssueRevertUseCase = new ReopenedDoneIssueRevertUseCase(
      issueRepository,
    );

    const handleScheduledEventUseCase = new HandleScheduledEventUseCase(
      projectRequiredFieldCreateUseCase,
      setupTowerDefenceProjectUseCase,
      actionAnnouncement,
      setWorkflowManagementIssueToStoryUseCase,
      clearPastNextActionUseCase,
      analyzeProblemByIssueUseCase,
      analyzeStoriesUseCase,
      clearDependedIssueURLUseCase,
      setDependedIssueUrlForOpenTaskPRsUseCase,
      staleTaskPullRequestCloseUseCase,
      createEstimationIssueUseCase,
      convertCheckboxToIssueInStoryIssueUseCase,
      changeStatusByStoryColorUseCase,
      setNoStoryIssueToStoryUseCase,
      createNewStoryByLabel,
      assignNoAssigneeIssueToManagerUseCase,
      updateIssueStatusByLabelUseCase,
      issueNoStatusUpdateUseCase,
      startPreparationUseCase,
      revertOrphanedPreparationUseCase,
      conflictedIssueRevertUseCase,
      revertNotReadyReviewQueueIssueUseCase,
      triagerApprovalDispatchUseCase,
      agentDesignationLabelAdoptUseCase,
      updateRateLimitCacheUseCase,
      dailySecurityScanUseCase,
      qualityCheckAdvanceUseCase,
      reopenedDoneIssueRevertUseCase,
      systemDateRepository,
      googleSpreadsheetRepository,
      projectRepository,
      issueRepository,
    );

    const dashboardDataDir =
      mergedInput.dashboardDataDir ?? DEFAULT_DASHBOARD_DATA_DIR;

    const afterIssuesFetched = async (
      project: Project,
      issues: Issue[],
    ): Promise<void> => {
      try {
        const issuesFetchedAt = issueRepository.getLastIssuesFetchedAt(
          project.id,
        );
        if (issuesFetchedAt === null) {
          throw new Error(
            `No GitHub read time recorded for the project the console lists describe. projectId: ${project.id}`,
          );
        }
        writeConsoleLists({
          consoleDataOutputDir: mergedInput.consoleDataOutputDir ?? null,
          pjcode: input.projectName,
          assigneeLogin: input.manager,
          project,
          issues,
          generatedAt: formatConsoleGeneratedAt(new Date(issuesFetchedAt)),
          workflowBlockerStoryName:
            mergedInput.workflowBlockerStoryName ?? null,
          urlOfStoryView: mergedInput.urlOfStoryView,
        });
      } catch (error) {
        console.error(
          `Failed to write console lists: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }

      try {
        writeDashboardRow({
          dashboardDataDir,
          pjcode: input.projectName,
          assigneeLogin: input.manager,
          issues,
        });
      } catch (error) {
        console.error(
          `Failed to write dashboard row: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    };

    const result = await handleScheduledEventUseCase.run({
      ...mergedInput,
      afterIssuesFetched,
    });
    if (result) {
      if (result.rotationOrder !== null) {
        writeRotationOrderFile(result.rotationOrder);
      }
      await writeSituationFile({
        cachePath,
        projectId: result.project.id,
        issues: result.issues,
        statusNames: {
          awaitingQualityCheckStatus: AWAITING_QUALITY_CHECK_STATUS_NAME,
          preparationStatus: PREPARATION_STATUS_NAME,
          awaitingWorkspaceStatus: AWAITING_WORKSPACE_STATUS_NAME,
          failedPreparationStatus: FAILED_PREPARATION_STATUS_NAME,
        },
        config: {
          maximumPreparingIssuesCount:
            mergedInput.startPreparation?.maximumPreparingIssuesCount ?? null,
          utilizationPercentageThreshold:
            mergedInput.startPreparation?.utilizationPercentageThreshold ?? 90,
          thresholdForAutoReject: 3,
        },
        preparationProcessCheckCommand:
          mergedInput.startPreparation?.preparationProcessCheckCommand ?? null,
        localCommandRunner: nodeLocalCommandRunner,
      });

      try {
        await writeMachineStatus({
          dashboardDataDir,
          allIssuesCacheDir: `${cachePath}/allIssues-${result.project.id}`,
          disks: mergedInput.disks ?? null,
        });
      } catch (error) {
        console.error(
          `Failed to write machine status: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }

      try {
        writeTokenStatus({
          dashboardDataDir,
          tokenListJsonPath:
            mergedInput.claudeCodeOauthTokenListJsonPath ?? null,
          issues: result.issues,
          pjcode: input.projectName,
        });
      } catch (error) {
        console.error(
          `Failed to write token status: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }

      try {
        await handleSubscriptionDisabledTokens({
          tokenListJsonPath:
            mergedInput.claudeCodeOauthTokenListJsonPath ?? null,
          org: input.org,
          repo: input.workingReport.repo,
          issueRepository,
        });
      } catch (error) {
        console.error(
          `Failed to handle subscription disabled tokens: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }

      const inTmuxNow = new Date();

      const inTmuxGetuid = process.getuid?.bind(process);
      const ownerCallMarker =
        mergedInput.ownerCallMarker ??
        process.env.TDPM_SILENT_OWNER_CALL_MARKER ??
        null;
      const ownerReplyMarkerDirectory = ownerReplyMarkerDirectoryResolve(
        mergedInput.ownerReplyMarkerDirectory ?? null,
        process.env,
        inTmuxGetuid === undefined ? null : inTmuxGetuid(),
      );
      const transcriptOwnerCallStatusProvider =
        ownerCallMarker !== null && ownerCallMarker.length > 0
          ? new TranscriptOwnerCallStatusProvider(
              ownerCallMarker,
              ownerReplyMarkerDirectory,
            )
          : null;
      const ownerCallStatusProvider: OwnerCallStatusProvider =
        transcriptOwnerCallStatusProvider ??
        new NoUnansweredOwnerCallStatusProvider();

      try {
        writeInTmuxByHumanData({
          inTmuxDataOutputDir: mergedInput.inTmuxDataOutputDir ?? null,
          inTmuxConsoleBaseUrl: mergedInput.inTmuxConsoleBaseUrl ?? null,
          inTmuxConsoleToken: mergedInput.inTmuxConsoleToken ?? null,
          inTmuxProjectOrder:
            inTmuxProjectOrderOverride ??
            mergedInput.inTmuxProjectOrder ??
            null,
          pjcode: input.projectName,
          assigneeLogin: input.manager,
          org: input.org,
          repo: input.workingReport.repo,
          newIssueRepo: mergedInput.newIssueRepo ?? undefined,
          project: result.project,
          issues: result.issues,
          now: inTmuxNow,
        });
      } catch (error) {
        console.error(
          `Failed to write in-tmux-by-human data: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }

      try {
        cleanClosedIssueOwnerCallFiles({
          inTmuxDataOutputDir: mergedInput.inTmuxDataOutputDir ?? null,
          pjcode: input.projectName,
          issues: result.issues,
        });
      } catch (error) {
        console.error(
          `Failed to clean owner call files of closed issues: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }

      try {
        await handleTokenExhaustionHandover({
          enabled: mergedInput.tokenExhaustionHandoverEnabled ?? false,
          tokenListJsonPath:
            mergedInput.claudeCodeOauthTokenListJsonPath ?? null,
          handoverMessage: mergedInput.tokenExhaustionHandoverMessage ?? null,
          bareNameLeaderHandoverMessage:
            mergedInput.tokenExhaustionHandoverBareNameLeaderMessage ?? null,
          tokenRateLimitSnapshotBaseDir:
            mergedInput.tokenRateLimitSnapshotBaseDir ?? null,
          gracePeriodSeconds:
            mergedInput.tokenExhaustionGracePeriodSeconds ?? null,
          stateFilePath:
            mergedInput.tokenExhaustionHandoverStateFilePath ?? null,
          localCommandRunner: nodeLocalCommandRunner,
          now: inTmuxNow,
        });
      } catch (error) {
        console.error(
          `Failed to handle token exhaustion handover: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }

      try {
        await reconcileInTmuxByHumanSessions({
          inTmuxLauncherCommand: mergedInput.inTmuxLauncherCommand ?? null,
          assigneeLogin: input.manager,
          issues: result.issues,
          localCommandRunner: nodeLocalCommandRunner,
          issueStateRepository: issueRepository,
          now: inTmuxNow,
        });
      } catch (error) {
        console.error(
          `Failed to reconcile in-tmux-by-human sessions: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }

      try {
        await cleanStaleTmuxSessions({
          project: result.project,
          issueRepository,
          localCommandRunner: nodeLocalCommandRunner,
          now: inTmuxNow,
        });
      } catch (error) {
        console.error(
          `Failed to clean stale tmux sessions: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }

      try {
        const silentNotificationEnabled =
          mergedInput.silentNotificationEnabled ??
          process.env.TDPM_SILENT_NOTIFICATION_ENABLED === 'true';
        const subAgentOutputRootDirectory =
          mergedInput.subAgentOutputRootDirectory ??
          process.env.TDPM_SUBAGENT_OUTPUT_ROOT_DIRECTORY ??
          null;
        const subAgentProcessMatchPattern =
          mergedInput.subAgentProcessMatchPattern ??
          process.env.TDPM_SUBAGENT_PROCESS_MATCH_PATTERN ??
          null;
        const subAgentTranscriptRootDirectory =
          mergedInput.subAgentTranscriptRootDirectory ??
          process.env.TDPM_SUBAGENT_TRANSCRIPT_ROOT_DIRECTORY ??
          null;
        const getuid = process.getuid?.bind(process);
        const subAgentRuntimeRootDirectory =
          mergedInput.subAgentRuntimeRootDirectory ??
          process.env.TDPM_SUBAGENT_RUNTIME_ROOT_DIRECTORY ??
          (getuid === undefined
            ? null
            : path.join(os.tmpdir(), `claude-${getuid()}`));
        await notifySilentTmuxSessions({
          enabled: silentNotificationEnabled,
          localCommandRunner: nodeLocalCommandRunner,
          ownerCallStatusProvider,
          subAgentOutputRootDirectory,
          subAgentProcessMatchPattern,
          subAgentTranscriptRootDirectory,
          subAgentRuntimeRootDirectory,
          mainSilentThresholdSeconds: readSilentSeconds(
            mergedInput.mainSilentThresholdSeconds,
            process.env.TDPM_MAIN_SILENT_THRESHOLD_SECONDS,
            DEFAULT_NOTIFY_SILENT_TMUX_SESSIONS_PARAMS.mainSilentThresholdSeconds,
          ),
          unansweredOwnerCallGraceSeconds: readSilentSeconds(
            mergedInput.unansweredOwnerCallGraceSeconds,
            process.env.TDPM_SILENT_UNANSWERED_OWNER_CALL_GRACE_SECONDS,
            DEFAULT_NOTIFY_SILENT_TMUX_SESSIONS_PARAMS.unansweredOwnerCallGraceSeconds,
          ),
          subAgentSilentThresholdSeconds: readSilentSeconds(
            mergedInput.subAgentSilentThresholdSeconds,
            process.env.TDPM_SUBAGENT_SILENT_THRESHOLD_SECONDS,
            DEFAULT_NOTIFY_SILENT_TMUX_SESSIONS_PARAMS.subAgentSilentThresholdSeconds,
          ),
          subAgentRunningThresholdSeconds: readSilentSeconds(
            mergedInput.subAgentRunningThresholdSeconds,
            process.env.TDPM_SUBAGENT_RUNNING_THRESHOLD_SECONDS,
            DEFAULT_NOTIFY_SILENT_TMUX_SESSIONS_PARAMS.subAgentRunningThresholdSeconds,
          ),
          staggerSeconds: readSilentSeconds(
            mergedInput.silentNotificationStaggerSeconds,
            process.env.TDPM_SILENT_NOTIFICATION_STAGGER_SECONDS,
            DEFAULT_NOTIFY_SILENT_TMUX_SESSIONS_PARAMS.staggerSeconds,
          ),
          candidateDebounceRecencyWindowSeconds: readSilentSeconds(
            mergedInput.candidateDebounceRecencyWindowSeconds,
            process.env.TDPM_SILENT_CANDIDATE_DEBOUNCE_RECENCY_WINDOW_SECONDS,
            DEFAULT_NOTIFY_SILENT_TMUX_SESSIONS_PARAMS.candidateDebounceRecencyWindowSeconds,
          ),
          candidateDebounceStateFilePath:
            mergedInput.candidateDebounceStateFilePath ??
            process.env.TDPM_SILENT_CANDIDATE_DEBOUNCE_STATE_FILE_PATH ??
            null,
          activeHubTaskStatus:
            mergedInput.activeHubTaskStatus ??
            process.env.TDPM_ACTIVE_HUB_TASK_STATUS ??
            null,
          hubTaskStatusResolver: issueRepository,
          hubTaskStatusCacheStateFilePath:
            mergedInput.hubTaskStatusCacheStateFilePath ??
            process.env.TDPM_SILENT_HUB_TASK_STATUS_CACHE_STATE_FILE_PATH ??
            null,
          hubTaskStatusCacheTtlSeconds: readSilentSeconds(
            mergedInput.hubTaskStatusCacheTtlSeconds,
            process.env.TDPM_SILENT_HUB_TASK_STATUS_CACHE_TTL_SECONDS,
            DEFAULT_NOTIFY_SILENT_TMUX_SESSIONS_PARAMS.hubTaskStatusCacheTtlSeconds,
          ),
          messageTemplates: {
            mainStalledMessage:
              mergedInput.silentMainStalledMessage ??
              process.env.TDPM_SILENT_MAIN_STALLED_MESSAGE ??
              null,
            mainStalledStaleOwnerCallMessage:
              mergedInput.silentMainStalledStaleOwnerCallMessage ??
              process.env.TDPM_SILENT_MAIN_STALLED_STALE_OWNER_CALL_MESSAGE ??
              null,
            subAgentIdleMessageHeader:
              mergedInput.silentSubAgentIdleMessageHeader ??
              process.env.TDPM_SILENT_SUBAGENT_IDLE_MESSAGE_HEADER ??
              null,
            subAgentIdleMessageFooter:
              mergedInput.silentSubAgentIdleMessageFooter ??
              process.env.TDPM_SILENT_SUBAGENT_IDLE_MESSAGE_FOOTER ??
              null,
            subAgentLongRunningMessageHeader:
              mergedInput.silentSubAgentLongRunningMessageHeader ??
              process.env.TDPM_SILENT_SUBAGENT_LONG_RUNNING_MESSAGE_HEADER ??
              null,
            subAgentLongRunningMessageFooter:
              mergedInput.silentSubAgentLongRunningMessageFooter ??
              process.env.TDPM_SILENT_SUBAGENT_LONG_RUNNING_MESSAGE_FOOTER ??
              null,
          },
          now: inTmuxNow,
        });
      } catch (error) {
        console.error(
          `Failed to notify silent tmux sessions: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }

      try {
        const outputDegenerationResetEnabled =
          mergedInput.outputDegenerationResetEnabled ??
          process.env.TDPM_OUTPUT_DEGENERATION_RESET_ENABLED === 'true';
        await resetDegeneratedTmuxSessions({
          enabled: outputDegenerationResetEnabled,
          localCommandRunner: nodeLocalCommandRunner,
          warningMessage:
            mergedInput.outputDegenerationWarningMessage ??
            process.env.TDPM_OUTPUT_DEGENERATION_WARNING_MESSAGE ??
            DEFAULT_RESET_DEGENERATED_TMUX_SESSIONS_PARAMS.warningMessage,
          graceSeconds: readSilentSeconds(
            mergedInput.outputDegenerationGraceSeconds,
            process.env.TDPM_OUTPUT_DEGENERATION_GRACE_SECONDS,
            DEFAULT_RESET_DEGENERATED_TMUX_SESSIONS_PARAMS.graceSeconds,
          ),
          cooldownSeconds: readSilentSeconds(
            mergedInput.outputDegenerationCooldownSeconds,
            process.env.TDPM_OUTPUT_DEGENERATION_COOLDOWN_SECONDS,
            DEFAULT_RESET_DEGENERATED_TMUX_SESSIONS_PARAMS.cooldownSeconds,
          ),
          cooldownStateFilePath:
            mergedInput.outputDegenerationCooldownStateFilePath ??
            process.env.TDPM_OUTPUT_DEGENERATION_COOLDOWN_STATE_FILE_PATH ??
            null,
          now: inTmuxNow,
        });
      } catch (error) {
        console.error(
          `Failed to reset degenerated tmux sessions: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
    return result;
  };
}
