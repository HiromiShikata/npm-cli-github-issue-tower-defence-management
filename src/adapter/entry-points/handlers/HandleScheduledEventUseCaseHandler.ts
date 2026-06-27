import YAML from 'yaml';
import TYPIA from 'typia';
import fs from 'fs';
import { writeSituationFile } from './situationFileWriter';
import { writeConsoleLists } from './consoleListsWriter';
import { writeDashboardRow } from './dashboardRowWriter';
import { writeMachineStatus } from './machineStatusWriter';
import { writeTokenStatus } from './tokenStatusWriter';
import { writeInTmuxByHumanData } from './inTmuxByHumanDataWriter';
import { reconcileInTmuxByHumanSessions } from './inTmuxByHumanSessionReconciler';
import { cleanStaleTmuxSessions } from './staleTmuxSessionCleaner';
import {
  notifySilentTmuxSessions,
  DEFAULT_NOTIFY_SILENT_TMUX_SESSIONS_PARAMS,
} from './notifySilentTmuxSessions';
import { writeRotationOrderFile } from './rotationOrderFileWriter';
import {
  fetchProjectReadme,
  parseProjectReadmeConfig,
} from '../cli/projectConfig';
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
import { CreateEstimationIssueUseCase } from '../../../domain/usecases/CreateEstimationIssueUseCase';
import { ConvertCheckboxToIssueInStoryIssueUseCase } from '../../../domain/usecases/ConvertCheckboxToIssueInStoryIssueUseCase';
import { ChangeStatusByStoryColorUseCase } from '../../../domain/usecases/ChangeStatusByStoryColorUseCase';
import { SetNoStoryIssueToStoryUseCase } from '../../../domain/usecases/SetNoStoryIssueToStoryUseCase';
import { CreateNewStoryByLabelUseCase } from '../../../domain/usecases/CreateNewStoryByLabelUseCase';
import { AssignNoAssigneeIssueToManagerUseCase } from '../../../domain/usecases/AssignNoAssigneeIssueToManagerUseCase';
import { UpdateIssueStatusByLabelUseCase } from '../../../domain/usecases/UpdateIssueStatusByLabelUseCase';
import { StartPreparationUseCase } from '../../../domain/usecases/StartPreparationUseCase';
import { NodeLocalCommandRunner } from '../../repositories/NodeLocalCommandRunner';
import { ProcTakeOwnershipSpawnRepository } from '../../repositories/ProcTakeOwnershipSpawnRepository';
import { ProxyClaudeTokenUsageRepository } from '../../repositories/ProxyClaudeTokenUsageRepository';
import { ProxyRateLimitCacheRepository } from '../../repositories/ProxyRateLimitCacheRepository';
import { UpdateRateLimitCacheUseCase } from '../../../domain/usecases/UpdateRateLimitCacheUseCase';
import { RevertOrphanedPreparationUseCase } from '../../../domain/usecases/RevertOrphanedPreparationUseCase';
import { RevertNotReadyReviewQueueIssueUseCase } from '../../../domain/usecases/RevertNotReadyReviewQueueIssueUseCase';
import { GitHubIssueCommentRepository } from '../../repositories/GitHubIssueCommentRepository';
import { SetupTowerDefenceProjectUseCase } from '../../../domain/usecases/SetupTowerDefenceProjectUseCase';
import { DailySecurityScanUseCase } from '../../../domain/usecases/DailySecurityScanUseCase';
import { KyHttpRepository } from '../../repositories/KyHttpRepository';
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
      'allowedIssueAuthors'
    > & {
      allowedIssueAuthors?: string | string[] | null;
      claudeCodeOauthTokenListJsonPath?: string;
      consoleDataOutputDir?: string;
      dashboardDataDir?: string;
      workflowBlockerStoryName?: string;
      inTmuxDataOutputDir?: string;
      inTmuxConsoleBaseUrl?: string;
      inTmuxConsoleToken?: string;
      inTmuxProjectOrder?: string[];
      inTmuxLauncherCommand?: string;
      sessionOutputRootDirectory?: string;
      sessionTranscriptRootDirectory?: string;
      ownerCallMarker?: string;
      subAgentOutputRootDirectory?: string;
      subAgentProcessMatchPattern?: string;
      subAgentTranscriptRootDirectory?: string;
      mainSilentThresholdSeconds?: number;
      subAgentSilentThresholdSeconds?: number;
      subAgentRunningThresholdSeconds?: number;
      silentNotificationCooldownSeconds?: number;
      silentNotificationStaggerSeconds?: number;
      silentMainStalledMessage?: string;
      silentSubAgentMessageHeader?: string;
      silentSubAgentMessageFooter?: string;
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

    if (!TYPIA.is<inputType>(input)) {
      throw new Error(
        `Invalid input: ${JSON.stringify(input)}\n\n${JSON.stringify(TYPIA.validate<inputType>(input))}`,
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
      allowIssueCacheMinutes:
        readmeConfig.allowIssueCacheMinutes ?? input.allowIssueCacheMinutes,
      claudeCodeOauthTokenListJsonPath:
        readmeConfig.claudeCodeOauthTokenListJsonPath ??
        input.claudeCodeOauthTokenListJsonPath,
      thresholdForAutoReject:
        readmeConfig.thresholdForAutoReject ?? input.thresholdForAutoReject,
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
              input.startPreparation.maximumPreparingIssuesCount,
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
    const cachePath = `./tmp/cache/${input.projectName}`;
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
      ...githubRepositoryParams,
    );
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
    const revertNotReadyReviewQueueIssueUseCase =
      new RevertNotReadyReviewQueueIssueUseCase(
        projectRepository,
        issueRepository,
        issueCommentRepository,
      );

    const dailySecurityScanUseCase = mergedInput.dailySecurityScan
      ? new DailySecurityScanUseCase(
          nodeLocalCommandRunner,
          issueRepository,
          new KyHttpRepository(),
        )
      : null;

    const handleScheduledEventUseCase = new HandleScheduledEventUseCase(
      setupTowerDefenceProjectUseCase,
      actionAnnouncement,
      setWorkflowManagementIssueToStoryUseCase,
      clearPastNextActionUseCase,
      analyzeProblemByIssueUseCase,
      analyzeStoriesUseCase,
      clearDependedIssueURLUseCase,
      setDependedIssueUrlForOpenTaskPRsUseCase,
      createEstimationIssueUseCase,
      convertCheckboxToIssueInStoryIssueUseCase,
      changeStatusByStoryColorUseCase,
      setNoStoryIssueToStoryUseCase,
      createNewStoryByLabel,
      assignNoAssigneeIssueToManagerUseCase,
      updateIssueStatusByLabelUseCase,
      startPreparationUseCase,
      revertOrphanedPreparationUseCase,
      revertNotReadyReviewQueueIssueUseCase,
      updateRateLimitCacheUseCase,
      dailySecurityScanUseCase,
      systemDateRepository,
      googleSpreadsheetRepository,
      projectRepository,
      issueRepository,
    );

    const result = await handleScheduledEventUseCase.run(mergedInput);
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
          allowIssueCacheMinutes: mergedInput.allowIssueCacheMinutes,
          thresholdForAutoReject: 3,
        },
        preparationProcessCheckCommand:
          mergedInput.startPreparation?.preparationProcessCheckCommand ?? null,
        localCommandRunner: nodeLocalCommandRunner,
      });

      try {
        writeConsoleLists({
          consoleDataOutputDir: mergedInput.consoleDataOutputDir ?? null,
          pjcode: input.projectName,
          assigneeLogin: input.manager,
          project: result.project,
          issues: result.issues,
          workflowBlockerStoryName:
            mergedInput.workflowBlockerStoryName ?? null,
        });
      } catch (error) {
        console.error(
          `Failed to write console lists: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }

      const dashboardDataDir =
        mergedInput.dashboardDataDir ?? DEFAULT_DASHBOARD_DATA_DIR;

      try {
        writeDashboardRow({
          dashboardDataDir,
          pjcode: input.projectName,
          assigneeLogin: input.manager,
          issues: result.issues,
        });
      } catch (error) {
        console.error(
          `Failed to write dashboard row: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }

      try {
        await writeMachineStatus({
          dashboardDataDir,
          allIssuesCacheDir: `${cachePath}/allIssues-${result.project.id}`,
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

      const inTmuxNow = new Date();

      try {
        writeInTmuxByHumanData({
          inTmuxDataOutputDir: mergedInput.inTmuxDataOutputDir ?? null,
          inTmuxConsoleBaseUrl: mergedInput.inTmuxConsoleBaseUrl ?? null,
          inTmuxConsoleToken: mergedInput.inTmuxConsoleToken ?? null,
          inTmuxProjectOrder: mergedInput.inTmuxProjectOrder ?? null,
          pjcode: input.projectName,
          assigneeLogin: input.manager,
          org: input.org,
          repo: input.workingReport.repo,
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
        await reconcileInTmuxByHumanSessions({
          inTmuxLauncherCommand: mergedInput.inTmuxLauncherCommand ?? null,
          assigneeLogin: input.manager,
          issues: result.issues,
          localCommandRunner: nodeLocalCommandRunner,
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
          allowCacheMinutes: mergedInput.allowIssueCacheMinutes,
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
        const sessionOutputRootDirectory =
          mergedInput.sessionOutputRootDirectory ??
          process.env.TDPM_SESSION_OUTPUT_ROOT_DIRECTORY ??
          null;
        const subAgentOutputRootDirectory =
          mergedInput.subAgentOutputRootDirectory ??
          process.env.TDPM_SUBAGENT_OUTPUT_ROOT_DIRECTORY ??
          null;
        const subAgentProcessMatchPattern =
          mergedInput.subAgentProcessMatchPattern ??
          process.env.TDPM_SUBAGENT_PROCESS_MATCH_PATTERN ??
          null;
        const sessionTranscriptRootDirectory =
          mergedInput.sessionTranscriptRootDirectory ??
          process.env.TDPM_SESSION_TRANSCRIPT_ROOT_DIRECTORY ??
          null;
        const ownerCallMarker =
          mergedInput.ownerCallMarker ??
          process.env.TDPM_SILENT_OWNER_CALL_MARKER ??
          null;
        const subAgentTranscriptRootDirectory =
          mergedInput.subAgentTranscriptRootDirectory ??
          process.env.TDPM_SUBAGENT_TRANSCRIPT_ROOT_DIRECTORY ??
          null;
        await notifySilentTmuxSessions({
          project: result.project,
          allowCacheMinutes: mergedInput.allowIssueCacheMinutes,
          issueRepository,
          localCommandRunner: nodeLocalCommandRunner,
          cacheRepository: localStorageCacheRepository,
          sessionOutputRootDirectory,
          sessionTranscriptRootDirectory,
          ownerCallMarker,
          subAgentOutputRootDirectory,
          subAgentProcessMatchPattern,
          subAgentTranscriptRootDirectory,
          mainSilentThresholdSeconds: readSilentSeconds(
            mergedInput.mainSilentThresholdSeconds,
            process.env.TDPM_MAIN_SILENT_THRESHOLD_SECONDS,
            DEFAULT_NOTIFY_SILENT_TMUX_SESSIONS_PARAMS.mainSilentThresholdSeconds,
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
          cooldownSeconds: readSilentSeconds(
            mergedInput.silentNotificationCooldownSeconds,
            process.env.TDPM_SILENT_NOTIFICATION_COOLDOWN_SECONDS,
            DEFAULT_NOTIFY_SILENT_TMUX_SESSIONS_PARAMS.cooldownSeconds,
          ),
          staggerSeconds: readSilentSeconds(
            mergedInput.silentNotificationStaggerSeconds,
            process.env.TDPM_SILENT_NOTIFICATION_STAGGER_SECONDS,
            DEFAULT_NOTIFY_SILENT_TMUX_SESSIONS_PARAMS.staggerSeconds,
          ),
          messageTemplates: {
            mainStalledMessage:
              mergedInput.silentMainStalledMessage ??
              process.env.TDPM_SILENT_MAIN_STALLED_MESSAGE ??
              null,
            subAgentMessageHeader:
              mergedInput.silentSubAgentMessageHeader ??
              process.env.TDPM_SILENT_SUBAGENT_MESSAGE_HEADER ??
              null,
            subAgentMessageFooter:
              mergedInput.silentSubAgentMessageFooter ??
              process.env.TDPM_SILENT_SUBAGENT_MESSAGE_FOOTER ??
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
    }
    return result;
  };
}
