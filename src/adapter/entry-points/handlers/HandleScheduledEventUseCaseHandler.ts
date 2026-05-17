import YAML from 'yaml';
import TYPIA from 'typia';
import fs from 'fs';
import { writeSituationFile } from './situationFileWriter';
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
import { CreateEstimationIssueUseCase } from '../../../domain/usecases/CreateEstimationIssueUseCase';
import { ConvertCheckboxToIssueInStoryIssueUseCase } from '../../../domain/usecases/ConvertCheckboxToIssueInStoryIssueUseCase';
import { ChangeStatusByStoryColorUseCase } from '../../../domain/usecases/ChangeStatusByStoryColorUseCase';
import { SetNoStoryIssueToStoryUseCase } from '../../../domain/usecases/SetNoStoryIssueToStoryUseCase';
import { CreateNewStoryByLabelUseCase } from '../../../domain/usecases/CreateNewStoryByLabelUseCase';
import { AssignNoAssigneeIssueToManagerUseCase } from '../../../domain/usecases/AssignNoAssigneeIssueToManagerUseCase';
import { UpdateIssueStatusByLabelUseCase } from '../../../domain/usecases/UpdateIssueStatusByLabelUseCase';
import { StartPreparationUseCase } from '../../../domain/usecases/StartPreparationUseCase';
import { NodeLocalCommandRunner } from '../../repositories/NodeLocalCommandRunner';
import { OauthAPIProxyClaudeRepository } from '../../repositories/OauthAPIProxyClaudeRepository';
import { NotifyFinishedIssuePreparationUseCase } from '../../../domain/usecases/NotifyFinishedIssuePreparationUseCase';
import { RevertOrphanedPreparationUseCase } from '../../../domain/usecases/RevertOrphanedPreparationUseCase';
import { GitHubIssueCommentRepository } from '../../repositories/GitHubIssueCommentRepository';
import { FetchWebhookRepository } from '../../repositories/FetchWebhookRepository';
import { SetupTowerDefenceProjectUseCase } from '../../../domain/usecases/SetupTowerDefenceProjectUseCase';
import {
  AWAITING_QUALITY_CHECK_STATUS_NAME,
  AWAITING_WORKSPACE_STATUS_NAME,
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
            name?: string;
            password?: string;
            authenticatorKey?: string;
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
    const readmeConfig = readme ? parseProjectReadmeConfig(readme) : {};

    const mergedInput = {
      ...input,
      allowIssueCacheMinutes:
        readmeConfig.allowIssueCacheMinutes ?? input.allowIssueCacheMinutes,
      startPreparation: input.startPreparation
        ? {
            ...input.startPreparation,
            defaultAgentName:
              readmeConfig.defaultAgentName ??
              input.startPreparation.defaultAgentName,
            defaultLlmModelName:
              readmeConfig.defaultLlmModelName ??
              input.startPreparation.defaultLlmModelName,
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
      notifyFinishedPreparation: input.notifyFinishedPreparation
        ? {
            ...input.notifyFinishedPreparation,
            thresholdForAutoReject:
              readmeConfig.thresholdForAutoReject ??
              input.notifyFinishedPreparation.thresholdForAutoReject,
            workflowBlockerResolvedWebhookUrl:
              readmeConfig.workflowBlockerResolvedWebhookUrl ??
              input.notifyFinishedPreparation.workflowBlockerResolvedWebhookUrl,
          }
        : input.notifyFinishedPreparation,
    };

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
    > = [
      localStorageRepository,
      `${cachePath}/github.com.cookies.json`,
      input.credentials.bot.github.token,
      input.credentials.bot.github.name,
      input.credentials.bot.github.password,
      input.credentials.bot.github.authenticatorKey,
    ];
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
    const claudeRepository = new OauthAPIProxyClaudeRepository();
    const startPreparationUseCase = new StartPreparationUseCase(
      projectRepository,
      issueRepository,
      claudeRepository,
      nodeLocalCommandRunner,
    );
    const issueCommentRepository = new GitHubIssueCommentRepository(
      input.credentials.bot.github.token,
    );
    const webhookRepository = new FetchWebhookRepository();
    const notifyFinishedIssuePreparationUseCase =
      new NotifyFinishedIssuePreparationUseCase(
        projectRepository,
        issueRepository,
        issueCommentRepository,
        webhookRepository,
      );
    const revertOrphanedPreparationUseCase =
      new RevertOrphanedPreparationUseCase(
        projectRepository,
        issueRepository,
        issueCommentRepository,
        nodeLocalCommandRunner,
      );

    const handleScheduledEventUseCase = new HandleScheduledEventUseCase(
      setupTowerDefenceProjectUseCase,
      actionAnnouncement,
      setWorkflowManagementIssueToStoryUseCase,
      clearPastNextActionUseCase,
      analyzeProblemByIssueUseCase,
      analyzeStoriesUseCase,
      clearDependedIssueURLUseCase,
      createEstimationIssueUseCase,
      convertCheckboxToIssueInStoryIssueUseCase,
      changeStatusByStoryColorUseCase,
      setNoStoryIssueToStoryUseCase,
      createNewStoryByLabel,
      assignNoAssigneeIssueToManagerUseCase,
      updateIssueStatusByLabelUseCase,
      startPreparationUseCase,
      notifyFinishedIssuePreparationUseCase,
      revertOrphanedPreparationUseCase,
      systemDateRepository,
      googleSpreadsheetRepository,
      projectRepository,
      issueRepository,
    );

    const result = await handleScheduledEventUseCase.run(mergedInput);
    if (result) {
      await writeSituationFile({
        cachePath,
        projectId: result.project.id,
        issues: result.issues,
        statusNames: {
          awaitingQualityCheckStatus: AWAITING_QUALITY_CHECK_STATUS_NAME,
          preparationStatus: PREPARATION_STATUS_NAME,
          awaitingWorkspaceStatus: AWAITING_WORKSPACE_STATUS_NAME,
        },
        config: {
          maximumPreparingIssuesCount:
            mergedInput.startPreparation?.maximumPreparingIssuesCount ?? null,
          utilizationPercentageThreshold:
            mergedInput.startPreparation?.utilizationPercentageThreshold ?? 90,
          allowIssueCacheMinutes: mergedInput.allowIssueCacheMinutes,
          thresholdForAutoReject:
            mergedInput.notifyFinishedPreparation?.thresholdForAutoReject ?? 3,
        },
        preparationProcessCheckCommand:
          mergedInput.startPreparation?.preparationProcessCheckCommand ?? null,
        localCommandRunner: nodeLocalCommandRunner,
      });
    }
    return result;
  };
}
