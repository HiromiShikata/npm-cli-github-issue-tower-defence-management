"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HandleScheduledEventUseCaseHandler = void 0;
const yaml_1 = __importDefault(require("yaml"));
const typia_1 = __importDefault(require("typia"));
const fs_1 = __importDefault(require("fs"));
const situationFileWriter_1 = require("./situationFileWriter");
const rotationOrderFileWriter_1 = require("./rotationOrderFileWriter");
const projectConfig_1 = require("../cli/projectConfig");
const SystemDateRepository_1 = require("../../repositories/SystemDateRepository");
const LocalStorageRepository_1 = require("../../repositories/LocalStorageRepository");
const GoogleSpreadsheetRepository_1 = require("../../repositories/GoogleSpreadsheetRepository");
const GraphqlProjectRepository_1 = require("../../repositories/GraphqlProjectRepository");
const ApiV3IssueRepository_1 = require("../../repositories/issue/ApiV3IssueRepository");
const RestIssueRepository_1 = require("../../repositories/issue/RestIssueRepository");
const GraphqlProjectItemRepository_1 = require("../../repositories/issue/GraphqlProjectItemRepository");
const ApiV3CheerioRestIssueRepository_1 = require("../../repositories/issue/ApiV3CheerioRestIssueRepository");
const HandleScheduledEventUseCase_1 = require("../../../domain/usecases/HandleScheduledEventUseCase");
const LocalStorageCacheRepository_1 = require("../../repositories/LocalStorageCacheRepository");
const ActionAnnouncementUseCase_1 = require("../../../domain/usecases/ActionAnnouncementUseCase");
const SetWorkflowManagementIssueToStoryUseCase_1 = require("../../../domain/usecases/SetWorkflowManagementIssueToStoryUseCase");
const ClearPastNextActionDateHourUseCase_1 = require("../../../domain/usecases/ClearPastNextActionDateHourUseCase");
const AnalyzeProblemByIssueUseCase_1 = require("../../../domain/usecases/AnalyzeProblemByIssueUseCase");
const AnalyzeStoriesUseCase_1 = require("../../../domain/usecases/AnalyzeStoriesUseCase");
const ClearDependedIssueURLUseCase_1 = require("../../../domain/usecases/ClearDependedIssueURLUseCase");
const SetDependedIssueUrlForOpenTaskPRsUseCase_1 = require("../../../domain/usecases/SetDependedIssueUrlForOpenTaskPRsUseCase");
const CreateEstimationIssueUseCase_1 = require("../../../domain/usecases/CreateEstimationIssueUseCase");
const ConvertCheckboxToIssueInStoryIssueUseCase_1 = require("../../../domain/usecases/ConvertCheckboxToIssueInStoryIssueUseCase");
const ChangeStatusByStoryColorUseCase_1 = require("../../../domain/usecases/ChangeStatusByStoryColorUseCase");
const SetNoStoryIssueToStoryUseCase_1 = require("../../../domain/usecases/SetNoStoryIssueToStoryUseCase");
const CreateNewStoryByLabelUseCase_1 = require("../../../domain/usecases/CreateNewStoryByLabelUseCase");
const AssignNoAssigneeIssueToManagerUseCase_1 = require("../../../domain/usecases/AssignNoAssigneeIssueToManagerUseCase");
const UpdateIssueStatusByLabelUseCase_1 = require("../../../domain/usecases/UpdateIssueStatusByLabelUseCase");
const StartPreparationUseCase_1 = require("../../../domain/usecases/StartPreparationUseCase");
const NodeLocalCommandRunner_1 = require("../../repositories/NodeLocalCommandRunner");
const ProxyClaudeTokenUsageRepository_1 = require("../../repositories/ProxyClaudeTokenUsageRepository");
const ProxyRateLimitCacheRepository_1 = require("../../repositories/ProxyRateLimitCacheRepository");
const UpdateRateLimitCacheUseCase_1 = require("../../../domain/usecases/UpdateRateLimitCacheUseCase");
const RevertOrphanedPreparationUseCase_1 = require("../../../domain/usecases/RevertOrphanedPreparationUseCase");
const RevertNotReadyAwaitingQualityCheckUseCase_1 = require("../../../domain/usecases/RevertNotReadyAwaitingQualityCheckUseCase");
const GitHubIssueCommentRepository_1 = require("../../repositories/GitHubIssueCommentRepository");
const SetupTowerDefenceProjectUseCase_1 = require("../../../domain/usecases/SetupTowerDefenceProjectUseCase");
const DailySecurityScanUseCase_1 = require("../../../domain/usecases/DailySecurityScanUseCase");
const KyHttpRepository_1 = require("../../repositories/KyHttpRepository");
const WorkflowStatus_1 = require("../../../domain/entities/WorkflowStatus");
class HandleScheduledEventUseCaseHandler {
    constructor() {
        this.handle = async (configFilePath, _verbose) => {
            const configFileContent = fs_1.default.readFileSync(configFilePath, 'utf8');
            const input = yaml_1.default.parse(configFileContent);
            if (!typia_1.default.is(input)) {
                throw new Error(`Invalid input: ${JSON.stringify(input)}\n\n${JSON.stringify(typia_1.default.validate(input))}`);
            }
            if (input.disabled) {
                return null;
            }
            const managerToken = input.credentials.manager.github.token;
            const readme = await (0, projectConfig_1.fetchProjectReadme)(input.projectUrl, managerToken);
            const readmeConfig = readme
                ? (0, projectConfig_1.parseProjectReadmeConfig)(readme, input.projectUrl)
                : {};
            const mergedInput = {
                ...input,
                allowIssueCacheMinutes: readmeConfig.allowIssueCacheMinutes ?? input.allowIssueCacheMinutes,
                claudeCodeOauthTokenListJsonPath: readmeConfig.claudeCodeOauthTokenListJsonPath ??
                    input.claudeCodeOauthTokenListJsonPath,
                thresholdForAutoReject: readmeConfig.thresholdForAutoReject ?? input.thresholdForAutoReject,
                startPreparation: input.startPreparation
                    ? {
                        ...input.startPreparation,
                        defaultAgentName: readmeConfig.defaultAgentName ??
                            input.startPreparation.defaultAgentName,
                        defaultLlmModelName: readmeConfig.defaultLlmModelName ??
                            input.startPreparation.defaultLlmModelName,
                        fallbackLlmModelName: readmeConfig.fallbackLlmModelName ??
                            input.startPreparation.fallbackLlmModelName,
                        defaultLlmAgentName: readmeConfig.defaultLlmAgentName ??
                            input.startPreparation.defaultLlmAgentName,
                        maximumPreparingIssuesCount: readmeConfig.maximumPreparingIssuesCount ??
                            input.startPreparation.maximumPreparingIssuesCount,
                        utilizationPercentageThreshold: readmeConfig.utilizationPercentageThreshold ??
                            input.startPreparation.utilizationPercentageThreshold,
                        allowedIssueAuthors: readmeConfig.allowedIssueAuthors
                            ? readmeConfig.allowedIssueAuthors
                                .split(',')
                                .map((s) => s.trim())
                                .filter(Boolean)
                            : input.startPreparation.allowedIssueAuthors,
                        preparationProcessCheckCommand: readmeConfig.preparationProcessCheckCommand ??
                            input.startPreparation.preparationProcessCheckCommand,
                        codexHomeCandidates: readmeConfig.codexHomeCandidates ??
                            input.startPreparation.codexHomeCandidates,
                    }
                    : input.startPreparation,
            };
            const resolveConfigSource = (readmeValue, configFileValue) => {
                if (readmeValue !== undefined && readmeValue !== null) {
                    return 'readmeOverride';
                }
                if (configFileValue !== undefined && configFileValue !== null) {
                    return 'configFile';
                }
                return 'unset (default)';
            };
            const formatEffectiveConfig = (value, readmeValue, configFileValue) => `${value ?? 'null'} (source: ${resolveConfigSource(readmeValue, configFileValue)})`;
            console.log(`Effective maximumPreparingIssuesCount: ${formatEffectiveConfig(mergedInput.startPreparation?.maximumPreparingIssuesCount, readmeConfig.maximumPreparingIssuesCount, input.startPreparation?.maximumPreparingIssuesCount)}`);
            console.log(`Effective defaultLlmModelName: ${formatEffectiveConfig(mergedInput.startPreparation?.defaultLlmModelName, readmeConfig.defaultLlmModelName, input.startPreparation?.defaultLlmModelName)}`);
            console.log(`Effective defaultAgentName: ${formatEffectiveConfig(mergedInput.startPreparation?.defaultAgentName, readmeConfig.defaultAgentName, input.startPreparation?.defaultAgentName)}`);
            const systemDateRepository = new SystemDateRepository_1.SystemDateRepository();
            const localStorageRepository = new LocalStorageRepository_1.LocalStorageRepository();
            const googleSpreadsheetRepository = new GoogleSpreadsheetRepository_1.GoogleSpreadsheetRepository(localStorageRepository, input.credentials.manager.googleServiceAccount.serviceAccountKey);
            const cachePath = `./tmp/cache/${input.projectName}`;
            const localStorageCacheRepository = new LocalStorageCacheRepository_1.LocalStorageCacheRepository(localStorageRepository, cachePath);
            const githubRepositoryParams = [localStorageRepository, input.credentials.bot.github.token];
            const projectRepository = new GraphqlProjectRepository_1.GraphqlProjectRepository(...githubRepositoryParams);
            const apiV3IssueRepository = new ApiV3IssueRepository_1.ApiV3IssueRepository(...githubRepositoryParams);
            const restIssueRepository = new RestIssueRepository_1.RestIssueRepository(...githubRepositoryParams);
            const graphqlProjectItemRepository = new GraphqlProjectItemRepository_1.GraphqlProjectItemRepository(...githubRepositoryParams);
            const issueRepository = new ApiV3CheerioRestIssueRepository_1.ApiV3CheerioRestIssueRepository(apiV3IssueRepository, restIssueRepository, graphqlProjectItemRepository, localStorageCacheRepository, ...githubRepositoryParams);
            const setupTowerDefenceProjectUseCase = new SetupTowerDefenceProjectUseCase_1.SetupTowerDefenceProjectUseCase(projectRepository, issueRepository);
            const actionAnnouncement = new ActionAnnouncementUseCase_1.ActionAnnouncementUseCase(issueRepository);
            const setWorkflowManagementIssueToStoryUseCase = new SetWorkflowManagementIssueToStoryUseCase_1.SetWorkflowManagementIssueToStoryUseCase(issueRepository);
            const clearPastNextActionUseCase = new ClearPastNextActionDateHourUseCase_1.ClearPastNextActionDateHourUseCase(issueRepository);
            const analyzeProblemByIssueUseCase = new AnalyzeProblemByIssueUseCase_1.AnalyzeProblemByIssueUseCase(issueRepository, systemDateRepository);
            const analyzeStoriesUseCase = new AnalyzeStoriesUseCase_1.AnalyzeStoriesUseCase(issueRepository, systemDateRepository);
            const clearDependedIssueURLUseCase = new ClearDependedIssueURLUseCase_1.ClearDependedIssueURLUseCase(issueRepository);
            const setDependedIssueUrlForOpenTaskPRsUseCase = new SetDependedIssueUrlForOpenTaskPRsUseCase_1.SetDependedIssueUrlForOpenTaskPRsUseCase(issueRepository);
            const createEstimationIssueUseCase = new CreateEstimationIssueUseCase_1.CreateEstimationIssueUseCase(issueRepository, systemDateRepository);
            const convertCheckboxToIssueInStoryIssueUseCase = new ConvertCheckboxToIssueInStoryIssueUseCase_1.ConvertCheckboxToIssueInStoryIssueUseCase(issueRepository);
            const changeStatusByStoryColorUseCase = new ChangeStatusByStoryColorUseCase_1.ChangeStatusByStoryColorUseCase(systemDateRepository, issueRepository);
            const setNoStoryIssueToStoryUseCase = new SetNoStoryIssueToStoryUseCase_1.SetNoStoryIssueToStoryUseCase(issueRepository);
            const createNewStoryByLabel = new CreateNewStoryByLabelUseCase_1.CreateNewStoryByLabelUseCase(projectRepository, issueRepository);
            const assignNoAssigneeIssueToManagerUseCase = new AssignNoAssigneeIssueToManagerUseCase_1.AssignNoAssigneeIssueToManagerUseCase(issueRepository);
            const updateIssueStatusByLabelUseCase = new UpdateIssueStatusByLabelUseCase_1.UpdateIssueStatusByLabelUseCase(issueRepository);
            const nodeLocalCommandRunner = new NodeLocalCommandRunner_1.NodeLocalCommandRunner();
            const claudeTokenUsageRepository = new ProxyClaudeTokenUsageRepository_1.ProxyClaudeTokenUsageRepository(mergedInput.claudeCodeOauthTokenListJsonPath ?? null);
            const startPreparationUseCase = new StartPreparationUseCase_1.StartPreparationUseCase(projectRepository, issueRepository, nodeLocalCommandRunner, claudeTokenUsageRepository);
            const proxyRateLimitCacheRepository = new ProxyRateLimitCacheRepository_1.ProxyRateLimitCacheRepository(mergedInput.claudeCodeOauthTokenListJsonPath ?? null);
            const updateRateLimitCacheUseCase = mergedInput.startPreparation
                ? new UpdateRateLimitCacheUseCase_1.UpdateRateLimitCacheUseCase(proxyRateLimitCacheRepository)
                : null;
            const issueCommentRepository = new GitHubIssueCommentRepository_1.GitHubIssueCommentRepository(input.credentials.bot.github.token);
            const revertOrphanedPreparationUseCase = new RevertOrphanedPreparationUseCase_1.RevertOrphanedPreparationUseCase(projectRepository, issueRepository, issueCommentRepository, nodeLocalCommandRunner);
            const revertNotReadyAwaitingQualityCheckUseCase = new RevertNotReadyAwaitingQualityCheckUseCase_1.RevertNotReadyAwaitingQualityCheckUseCase(projectRepository, issueRepository, issueCommentRepository);
            const dailySecurityScanUseCase = mergedInput.dailySecurityScan
                ? new DailySecurityScanUseCase_1.DailySecurityScanUseCase(nodeLocalCommandRunner, issueRepository, new KyHttpRepository_1.KyHttpRepository())
                : null;
            const handleScheduledEventUseCase = new HandleScheduledEventUseCase_1.HandleScheduledEventUseCase(setupTowerDefenceProjectUseCase, actionAnnouncement, setWorkflowManagementIssueToStoryUseCase, clearPastNextActionUseCase, analyzeProblemByIssueUseCase, analyzeStoriesUseCase, clearDependedIssueURLUseCase, setDependedIssueUrlForOpenTaskPRsUseCase, createEstimationIssueUseCase, convertCheckboxToIssueInStoryIssueUseCase, changeStatusByStoryColorUseCase, setNoStoryIssueToStoryUseCase, createNewStoryByLabel, assignNoAssigneeIssueToManagerUseCase, updateIssueStatusByLabelUseCase, startPreparationUseCase, revertOrphanedPreparationUseCase, revertNotReadyAwaitingQualityCheckUseCase, updateRateLimitCacheUseCase, dailySecurityScanUseCase, systemDateRepository, googleSpreadsheetRepository, projectRepository, issueRepository);
            const result = await handleScheduledEventUseCase.run(mergedInput);
            if (result) {
                if (result.rotationOrder !== null) {
                    (0, rotationOrderFileWriter_1.writeRotationOrderFile)(result.rotationOrder);
                }
                await (0, situationFileWriter_1.writeSituationFile)({
                    cachePath,
                    projectId: result.project.id,
                    issues: result.issues,
                    statusNames: {
                        awaitingQualityCheckStatus: WorkflowStatus_1.AWAITING_QUALITY_CHECK_STATUS_NAME,
                        preparationStatus: WorkflowStatus_1.PREPARATION_STATUS_NAME,
                        awaitingWorkspaceStatus: WorkflowStatus_1.AWAITING_WORKSPACE_STATUS_NAME,
                        failedPreparationStatus: WorkflowStatus_1.FAILED_PREPARATION_STATUS_NAME,
                    },
                    config: {
                        maximumPreparingIssuesCount: mergedInput.startPreparation?.maximumPreparingIssuesCount ?? null,
                        utilizationPercentageThreshold: mergedInput.startPreparation?.utilizationPercentageThreshold ?? 90,
                        allowIssueCacheMinutes: mergedInput.allowIssueCacheMinutes,
                        thresholdForAutoReject: 3,
                    },
                    preparationProcessCheckCommand: mergedInput.startPreparation?.preparationProcessCheckCommand ?? null,
                    localCommandRunner: nodeLocalCommandRunner,
                });
            }
            return result;
        };
    }
}
exports.HandleScheduledEventUseCaseHandler = HandleScheduledEventUseCaseHandler;
//# sourceMappingURL=HandleScheduledEventUseCaseHandler.js.map