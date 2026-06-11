import YAML from 'yaml';
import TYPIA from 'typia';
import fs from 'fs';
import { writeSituationFile } from './situationFileWriter';
import { writeRotationOrderFile } from './rotationOrderFileWriter';
import {
  readDoneStorePrUrls,
  writeAwaitingQualityCheckViewerFile,
} from './awaitingQualityCheckViewerWriter';
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
import { ProxyClaudeTokenUsageRepository } from '../../repositories/ProxyClaudeTokenUsageRepository';
import { ProxyRateLimitCacheRepository } from '../../repositories/ProxyRateLimitCacheRepository';
import { UpdateRateLimitCacheUseCase } from '../../../domain/usecases/UpdateRateLimitCacheUseCase';
import { RevertOrphanedPreparationUseCase } from '../../../domain/usecases/RevertOrphanedPreparationUseCase';
import { RevertNotReadyAwaitingQualityCheckUseCase } from '../../../domain/usecases/RevertNotReadyAwaitingQualityCheckUseCase';
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
    type inputType = Parameters<HandleScheduledEventUseCase['run']>[0] & {
      claudeCodeOauthTokenListJsonPath?: string;
      awaitingQualityCheckDoneStorePath?: string;
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

    const mergedInput = {
      ...input,
      allowIssueCacheMinutes:
        readmeConfig.allowIssueCacheMinutes ?? input.allowIssueCacheMinutes,
      claudeCodeOauthTokenListJsonPath:
        readmeConfig.claudeCodeOauthTokenListJsonPath ??
        input.claudeCodeOauthTokenListJsonPath,
      thresholdForAutoReject:
        readmeConfig.thresholdForAutoReject ?? input.thresholdForAutoReject,
      awaitingQualityCheckViewerOutputPath:
        readmeConfig.awaitingQualityCheckViewerOutputPath ??
        input.awaitingQualityCheckViewerOutputPath,
      awaitingQualityCheckDoneStorePath:
        readmeConfig.awaitingQualityCheckDoneStorePath ??
        input.awaitingQualityCheckDoneStorePath,
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
    const revertNotReadyAwaitingQualityCheckUseCase =
      new RevertNotReadyAwaitingQualityCheckUseCase(
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
      revertNotReadyAwaitingQualityCheckUseCase,
      updateRateLimitCacheUseCase,
      dailySecurityScanUseCase,
      systemDateRepository,
      googleSpreadsheetRepository,
      projectRepository,
      issueRepository,
    );

    const donePrUrls = mergedInput.awaitingQualityCheckDoneStorePath
      ? readDoneStorePrUrls(mergedInput.awaitingQualityCheckDoneStorePath)
      : null;

    const result = await handleScheduledEventUseCase.run({
      ...mergedInput,
      donePrUrls,
    });
    if (result) {
      if (result.rotationOrder !== null) {
        writeRotationOrderFile(result.rotationOrder);
      }
      if (
        result.viewerOutput !== null &&
        mergedInput.awaitingQualityCheckViewerOutputPath
      ) {
        writeAwaitingQualityCheckViewerFile(
          result.viewerOutput,
          mergedInput.awaitingQualityCheckViewerOutputPath,
        );
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
    }
    return result;
  };
}
