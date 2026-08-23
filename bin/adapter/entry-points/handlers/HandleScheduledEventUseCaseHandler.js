"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HandleScheduledEventUseCaseHandler = void 0;
const yaml_1 = __importDefault(require("yaml"));
const fs_1 = __importDefault(require("fs"));
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const situationFileWriter_1 = require("./situationFileWriter");
const consoleListsWriter_1 = require("./consoleListsWriter");
const dashboardRowWriter_1 = require("./dashboardRowWriter");
const machineStatusWriter_1 = require("./machineStatusWriter");
const tokenStatusWriter_1 = require("./tokenStatusWriter");
const inTmuxByHumanDataWriter_1 = require("./inTmuxByHumanDataWriter");
const ownerCallFileCleaner_1 = require("./ownerCallFileCleaner");
const inTmuxByHumanSessionReconciler_1 = require("./inTmuxByHumanSessionReconciler");
const tokenExhaustionHandover_1 = require("./tokenExhaustionHandover");
const staleTmuxSessionCleaner_1 = require("./staleTmuxSessionCleaner");
const notifySilentTmuxSessions_1 = require("./notifySilentTmuxSessions");
const ownerReplyMarkerDirectoryResolve_1 = require("./ownerReplyMarkerDirectoryResolve");
const TranscriptOwnerCallStatusProvider_1 = require("../../repositories/TranscriptOwnerCallStatusProvider");
const NoUnansweredOwnerCallStatusProvider_1 = require("../../repositories/NoUnansweredOwnerCallStatusProvider");
const resetDegeneratedTmuxSessions_1 = require("./resetDegeneratedTmuxSessions");
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
const localStorageCacheDirectory_1 = require("../../repositories/localStorageCacheDirectory");
const ActionAnnouncementUseCase_1 = require("../../../domain/usecases/ActionAnnouncementUseCase");
const SetWorkflowManagementIssueToStoryUseCase_1 = require("../../../domain/usecases/SetWorkflowManagementIssueToStoryUseCase");
const ClearPastNextActionDateHourUseCase_1 = require("../../../domain/usecases/ClearPastNextActionDateHourUseCase");
const AnalyzeProblemByIssueUseCase_1 = require("../../../domain/usecases/AnalyzeProblemByIssueUseCase");
const AnalyzeStoriesUseCase_1 = require("../../../domain/usecases/AnalyzeStoriesUseCase");
const ClearDependedIssueURLUseCase_1 = require("../../../domain/usecases/ClearDependedIssueURLUseCase");
const SetDependedIssueUrlForOpenTaskPRsUseCase_1 = require("../../../domain/usecases/SetDependedIssueUrlForOpenTaskPRsUseCase");
const StaleTaskPullRequestCloseUseCase_1 = require("../../../domain/usecases/StaleTaskPullRequestCloseUseCase");
const CreateEstimationIssueUseCase_1 = require("../../../domain/usecases/CreateEstimationIssueUseCase");
const ConvertCheckboxToIssueInStoryIssueUseCase_1 = require("../../../domain/usecases/ConvertCheckboxToIssueInStoryIssueUseCase");
const ChangeStatusByStoryColorUseCase_1 = require("../../../domain/usecases/ChangeStatusByStoryColorUseCase");
const SetNoStoryIssueToStoryUseCase_1 = require("../../../domain/usecases/SetNoStoryIssueToStoryUseCase");
const CreateNewStoryByLabelUseCase_1 = require("../../../domain/usecases/CreateNewStoryByLabelUseCase");
const AssignNoAssigneeIssueToManagerUseCase_1 = require("../../../domain/usecases/AssignNoAssigneeIssueToManagerUseCase");
const UpdateIssueStatusByLabelUseCase_1 = require("../../../domain/usecases/UpdateIssueStatusByLabelUseCase");
const StartPreparationUseCase_1 = require("../../../domain/usecases/StartPreparationUseCase");
const NodeLocalCommandRunner_1 = require("../../repositories/NodeLocalCommandRunner");
const ProcTakeOwnershipSpawnRepository_1 = require("../../repositories/ProcTakeOwnershipSpawnRepository");
const ProxyClaudeTokenUsageRepository_1 = require("../../repositories/ProxyClaudeTokenUsageRepository");
const ProxyRateLimitCacheRepository_1 = require("../../repositories/ProxyRateLimitCacheRepository");
const UpdateRateLimitCacheUseCase_1 = require("../../../domain/usecases/UpdateRateLimitCacheUseCase");
const RevertOrphanedPreparationUseCase_1 = require("../../../domain/usecases/RevertOrphanedPreparationUseCase");
const RevertNotReadyReviewQueueIssueUseCase_1 = require("../../../domain/usecases/RevertNotReadyReviewQueueIssueUseCase");
const AgentDesignationLabelAdoptUseCase_1 = require("../../../domain/usecases/AgentDesignationLabelAdoptUseCase");
const GitHubIssueCommentRepository_1 = require("../../repositories/GitHubIssueCommentRepository");
const ProjectRequiredFieldCreateUseCase_1 = require("../../../domain/usecases/ProjectRequiredFieldCreateUseCase");
const SetupTowerDefenceProjectUseCase_1 = require("../../../domain/usecases/SetupTowerDefenceProjectUseCase");
const DailySecurityScanUseCase_1 = require("../../../domain/usecases/DailySecurityScanUseCase");
const QualityCheckAdvanceUseCase_1 = require("../../../domain/usecases/QualityCheckAdvanceUseCase");
const KyHttpRepository_1 = require("../../repositories/KyHttpRepository");
const FileSystemKevReportWatermarkRepository_1 = require("../../repositories/FileSystemKevReportWatermarkRepository");
const WorkflowStatus_1 = require("../../../domain/entities/WorkflowStatus");
const DEFAULT_DASHBOARD_DATA_DIR = null;
const readSilentSeconds = (configValue, envValue, defaultValue) => {
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
class HandleScheduledEventUseCaseHandler {
    constructor() {
        this.handle = async (configFilePath, _verbose, inTmuxProjectOrderOverride = null) => {
            const configFileContent = fs_1.default.readFileSync(configFilePath, 'utf8');
            const input = yaml_1.default.parse(configFileContent);
            const isInputType = (v) => {
                if (typeof v !== 'object' || v === null)
                    return false;
                if (!('credentials' in v) ||
                    typeof v.credentials !== 'object' ||
                    v.credentials === null)
                    return false;
                const credentials = v.credentials;
                if (!('manager' in credentials) ||
                    typeof credentials.manager !== 'object' ||
                    credentials.manager === null)
                    return false;
                const manager = credentials.manager;
                if (!('github' in manager) ||
                    typeof manager.github !== 'object' ||
                    manager.github === null)
                    return false;
                if (!('token' in manager.github) ||
                    typeof manager.github.token !== 'string')
                    return false;
                if (!('slack' in manager) ||
                    typeof manager.slack !== 'object' ||
                    manager.slack === null)
                    return false;
                if (!('userToken' in manager.slack) ||
                    typeof manager.slack.userToken !== 'string')
                    return false;
                if (!('googleServiceAccount' in manager) ||
                    typeof manager.googleServiceAccount !== 'object' ||
                    manager.googleServiceAccount === null)
                    return false;
                if (!('serviceAccountKey' in manager.googleServiceAccount) ||
                    typeof manager.googleServiceAccount.serviceAccountKey !== 'string')
                    return false;
                if (!('bot' in credentials) ||
                    typeof credentials.bot !== 'object' ||
                    credentials.bot === null)
                    return false;
                const bot = credentials.bot;
                if (!('github' in bot) ||
                    typeof bot.github !== 'object' ||
                    bot.github === null)
                    return false;
                if (!('token' in bot.github) || typeof bot.github.token !== 'string')
                    return false;
                return true;
            };
            if (!isInputType(input)) {
                throw new Error(`Invalid input: required credential fields are missing. Got: ${JSON.stringify(input)}`);
            }
            if (input.disabled) {
                return null;
            }
            const managerToken = input.credentials.manager.github.token;
            const readme = await (0, projectConfig_1.fetchProjectReadme)(input.projectUrl, managerToken);
            const readmeConfig = readme
                ? (0, projectConfig_1.parseProjectReadmeConfig)(readme, input.projectUrl)
                : {};
            const normalizeAllowedIssueAuthors = (value) => {
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
                allowedIssueAuthors: normalizeAllowedIssueAuthors(input.allowedIssueAuthors),
                autoAssignManagerAuthors: normalizeAllowedIssueAuthors(readmeConfig.autoAssignManagerAuthors ?? input.autoAssignManagerAuthors),
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
            const cachePath = (0, localStorageCacheDirectory_1.projectCacheDirectory)(input.projectName);
            const localStorageCacheRepository = new LocalStorageCacheRepository_1.LocalStorageCacheRepository(localStorageRepository, cachePath);
            const githubRepositoryParams = [localStorageRepository, input.credentials.bot.github.token];
            const projectRepository = new GraphqlProjectRepository_1.GraphqlProjectRepository(...githubRepositoryParams, localStorageCacheRepository);
            const apiV3IssueRepository = new ApiV3IssueRepository_1.ApiV3IssueRepository(...githubRepositoryParams);
            const restIssueRepository = new RestIssueRepository_1.RestIssueRepository(...githubRepositoryParams);
            const graphqlProjectItemRepository = new GraphqlProjectItemRepository_1.GraphqlProjectItemRepository(...githubRepositoryParams);
            const issueRepository = new ApiV3CheerioRestIssueRepository_1.ApiV3CheerioRestIssueRepository(apiV3IssueRepository, restIssueRepository, graphqlProjectItemRepository, localStorageCacheRepository, projectRepository, systemDateRepository, ...githubRepositoryParams);
            const projectRequiredFieldCreateUseCase = new ProjectRequiredFieldCreateUseCase_1.ProjectRequiredFieldCreateUseCase(projectRepository);
            const setupTowerDefenceProjectUseCase = new SetupTowerDefenceProjectUseCase_1.SetupTowerDefenceProjectUseCase(projectRepository, issueRepository);
            const actionAnnouncement = new ActionAnnouncementUseCase_1.ActionAnnouncementUseCase(issueRepository);
            const setWorkflowManagementIssueToStoryUseCase = new SetWorkflowManagementIssueToStoryUseCase_1.SetWorkflowManagementIssueToStoryUseCase(issueRepository);
            const clearPastNextActionUseCase = new ClearPastNextActionDateHourUseCase_1.ClearPastNextActionDateHourUseCase(issueRepository);
            const analyzeProblemByIssueUseCase = new AnalyzeProblemByIssueUseCase_1.AnalyzeProblemByIssueUseCase(issueRepository, systemDateRepository);
            const analyzeStoriesUseCase = new AnalyzeStoriesUseCase_1.AnalyzeStoriesUseCase(issueRepository, systemDateRepository);
            const clearDependedIssueURLUseCase = new ClearDependedIssueURLUseCase_1.ClearDependedIssueURLUseCase(issueRepository);
            const setDependedIssueUrlForOpenTaskPRsUseCase = new SetDependedIssueUrlForOpenTaskPRsUseCase_1.SetDependedIssueUrlForOpenTaskPRsUseCase(issueRepository);
            const staleTaskPullRequestCloseUseCase = new StaleTaskPullRequestCloseUseCase_1.StaleTaskPullRequestCloseUseCase(issueRepository);
            const createEstimationIssueUseCase = new CreateEstimationIssueUseCase_1.CreateEstimationIssueUseCase(issueRepository, systemDateRepository);
            const convertCheckboxToIssueInStoryIssueUseCase = new ConvertCheckboxToIssueInStoryIssueUseCase_1.ConvertCheckboxToIssueInStoryIssueUseCase(issueRepository);
            const changeStatusByStoryColorUseCase = new ChangeStatusByStoryColorUseCase_1.ChangeStatusByStoryColorUseCase(systemDateRepository, issueRepository);
            const setNoStoryIssueToStoryUseCase = new SetNoStoryIssueToStoryUseCase_1.SetNoStoryIssueToStoryUseCase(issueRepository);
            const createNewStoryByLabel = new CreateNewStoryByLabelUseCase_1.CreateNewStoryByLabelUseCase(projectRepository, issueRepository);
            const assignNoAssigneeIssueToManagerUseCase = new AssignNoAssigneeIssueToManagerUseCase_1.AssignNoAssigneeIssueToManagerUseCase(issueRepository);
            const updateIssueStatusByLabelUseCase = new UpdateIssueStatusByLabelUseCase_1.UpdateIssueStatusByLabelUseCase(issueRepository);
            const nodeLocalCommandRunner = new NodeLocalCommandRunner_1.NodeLocalCommandRunner();
            const claudeTokenUsageRepository = new ProxyClaudeTokenUsageRepository_1.ProxyClaudeTokenUsageRepository(mergedInput.claudeCodeOauthTokenListJsonPath ?? null);
            const startPreparationUseCase = new StartPreparationUseCase_1.StartPreparationUseCase(projectRepository, issueRepository, nodeLocalCommandRunner, claudeTokenUsageRepository, new ProcTakeOwnershipSpawnRepository_1.ProcTakeOwnershipSpawnRepository());
            const proxyRateLimitCacheRepository = new ProxyRateLimitCacheRepository_1.ProxyRateLimitCacheRepository(mergedInput.claudeCodeOauthTokenListJsonPath ?? null);
            const updateRateLimitCacheUseCase = mergedInput.startPreparation
                ? new UpdateRateLimitCacheUseCase_1.UpdateRateLimitCacheUseCase(proxyRateLimitCacheRepository)
                : null;
            const issueCommentRepository = new GitHubIssueCommentRepository_1.GitHubIssueCommentRepository(input.credentials.bot.github.token);
            const revertOrphanedPreparationUseCase = new RevertOrphanedPreparationUseCase_1.RevertOrphanedPreparationUseCase(projectRepository, issueRepository, issueCommentRepository, nodeLocalCommandRunner);
            const revertNotReadyReviewQueueIssueUseCase = new RevertNotReadyReviewQueueIssueUseCase_1.RevertNotReadyReviewQueueIssueUseCase(projectRepository, issueRepository, issueCommentRepository);
            const agentDesignationLabelAdoptUseCase = new AgentDesignationLabelAdoptUseCase_1.AgentDesignationLabelAdoptUseCase(projectRepository, issueRepository);
            const dailySecurityScanUseCase = mergedInput.dailySecurityScan
                ? new DailySecurityScanUseCase_1.DailySecurityScanUseCase(nodeLocalCommandRunner, issueRepository, new KyHttpRepository_1.KyHttpRepository(), new FileSystemKevReportWatermarkRepository_1.FileSystemKevReportWatermarkRepository())
                : null;
            const qualityCheckAdvanceUseCase = new QualityCheckAdvanceUseCase_1.QualityCheckAdvanceUseCase(issueRepository);
            const handleScheduledEventUseCase = new HandleScheduledEventUseCase_1.HandleScheduledEventUseCase(projectRequiredFieldCreateUseCase, setupTowerDefenceProjectUseCase, actionAnnouncement, setWorkflowManagementIssueToStoryUseCase, clearPastNextActionUseCase, analyzeProblemByIssueUseCase, analyzeStoriesUseCase, clearDependedIssueURLUseCase, setDependedIssueUrlForOpenTaskPRsUseCase, staleTaskPullRequestCloseUseCase, createEstimationIssueUseCase, convertCheckboxToIssueInStoryIssueUseCase, changeStatusByStoryColorUseCase, setNoStoryIssueToStoryUseCase, createNewStoryByLabel, assignNoAssigneeIssueToManagerUseCase, updateIssueStatusByLabelUseCase, startPreparationUseCase, revertOrphanedPreparationUseCase, revertNotReadyReviewQueueIssueUseCase, agentDesignationLabelAdoptUseCase, updateRateLimitCacheUseCase, dailySecurityScanUseCase, qualityCheckAdvanceUseCase, systemDateRepository, googleSpreadsheetRepository, projectRepository, issueRepository);
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
                        thresholdForAutoReject: 3,
                    },
                    preparationProcessCheckCommand: mergedInput.startPreparation?.preparationProcessCheckCommand ?? null,
                    localCommandRunner: nodeLocalCommandRunner,
                });
                try {
                    const issuesFetchedAt = issueRepository.getLastIssuesFetchedAt(result.project.id);
                    if (issuesFetchedAt === null) {
                        throw new Error(`No GitHub read time recorded for the project the console lists describe. projectId: ${result.project.id}`);
                    }
                    (0, consoleListsWriter_1.writeConsoleLists)({
                        consoleDataOutputDir: mergedInput.consoleDataOutputDir ?? null,
                        pjcode: input.projectName,
                        assigneeLogin: input.manager,
                        project: result.project,
                        issues: result.issues,
                        generatedAt: (0, consoleListsWriter_1.formatConsoleGeneratedAt)(new Date(issuesFetchedAt)),
                        workflowBlockerStoryName: mergedInput.workflowBlockerStoryName ?? null,
                    });
                }
                catch (error) {
                    console.error(`Failed to write console lists: ${error instanceof Error ? error.message : String(error)}`);
                }
                const dashboardDataDir = mergedInput.dashboardDataDir ?? DEFAULT_DASHBOARD_DATA_DIR;
                try {
                    (0, dashboardRowWriter_1.writeDashboardRow)({
                        dashboardDataDir,
                        pjcode: input.projectName,
                        assigneeLogin: input.manager,
                        issues: result.issues,
                    });
                }
                catch (error) {
                    console.error(`Failed to write dashboard row: ${error instanceof Error ? error.message : String(error)}`);
                }
                try {
                    await (0, machineStatusWriter_1.writeMachineStatus)({
                        dashboardDataDir,
                        allIssuesCacheDir: `${cachePath}/allIssues-${result.project.id}`,
                        disks: mergedInput.disks ?? null,
                    });
                }
                catch (error) {
                    console.error(`Failed to write machine status: ${error instanceof Error ? error.message : String(error)}`);
                }
                try {
                    (0, tokenStatusWriter_1.writeTokenStatus)({
                        dashboardDataDir,
                        tokenListJsonPath: mergedInput.claudeCodeOauthTokenListJsonPath ?? null,
                        issues: result.issues,
                        pjcode: input.projectName,
                    });
                }
                catch (error) {
                    console.error(`Failed to write token status: ${error instanceof Error ? error.message : String(error)}`);
                }
                const inTmuxNow = new Date();
                const inTmuxGetuid = process.getuid?.bind(process);
                const ownerCallMarker = mergedInput.ownerCallMarker ??
                    process.env.TDPM_SILENT_OWNER_CALL_MARKER ??
                    null;
                const ownerReplyMarkerDirectory = (0, ownerReplyMarkerDirectoryResolve_1.ownerReplyMarkerDirectoryResolve)(mergedInput.ownerReplyMarkerDirectory ?? null, process.env, inTmuxGetuid === undefined ? null : inTmuxGetuid());
                const transcriptOwnerCallStatusProvider = ownerCallMarker !== null && ownerCallMarker.length > 0
                    ? new TranscriptOwnerCallStatusProvider_1.TranscriptOwnerCallStatusProvider(ownerCallMarker, ownerReplyMarkerDirectory)
                    : null;
                const ownerCallStatusProvider = transcriptOwnerCallStatusProvider ??
                    new NoUnansweredOwnerCallStatusProvider_1.NoUnansweredOwnerCallStatusProvider();
                try {
                    (0, inTmuxByHumanDataWriter_1.writeInTmuxByHumanData)({
                        inTmuxDataOutputDir: mergedInput.inTmuxDataOutputDir ?? null,
                        inTmuxConsoleBaseUrl: mergedInput.inTmuxConsoleBaseUrl ?? null,
                        inTmuxConsoleToken: mergedInput.inTmuxConsoleToken ?? null,
                        inTmuxProjectOrder: inTmuxProjectOrderOverride ??
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
                }
                catch (error) {
                    console.error(`Failed to write in-tmux-by-human data: ${error instanceof Error ? error.message : String(error)}`);
                }
                try {
                    (0, ownerCallFileCleaner_1.cleanClosedIssueOwnerCallFiles)({
                        inTmuxDataOutputDir: mergedInput.inTmuxDataOutputDir ?? null,
                        pjcode: input.projectName,
                        issues: result.issues,
                    });
                }
                catch (error) {
                    console.error(`Failed to clean owner call files of closed issues: ${error instanceof Error ? error.message : String(error)}`);
                }
                try {
                    await (0, tokenExhaustionHandover_1.handleTokenExhaustionHandover)({
                        enabled: mergedInput.tokenExhaustionHandoverEnabled ?? false,
                        tokenListJsonPath: mergedInput.claudeCodeOauthTokenListJsonPath ?? null,
                        handoverMessage: mergedInput.tokenExhaustionHandoverMessage ?? null,
                        bareNameLeaderHandoverMessage: mergedInput.tokenExhaustionHandoverBareNameLeaderMessage ?? null,
                        tokenRateLimitSnapshotBaseDir: mergedInput.tokenRateLimitSnapshotBaseDir ?? null,
                        gracePeriodSeconds: mergedInput.tokenExhaustionGracePeriodSeconds ?? null,
                        stateFilePath: mergedInput.tokenExhaustionHandoverStateFilePath ?? null,
                        localCommandRunner: nodeLocalCommandRunner,
                        now: inTmuxNow,
                    });
                }
                catch (error) {
                    console.error(`Failed to handle token exhaustion handover: ${error instanceof Error ? error.message : String(error)}`);
                }
                try {
                    await (0, inTmuxByHumanSessionReconciler_1.reconcileInTmuxByHumanSessions)({
                        inTmuxLauncherCommand: mergedInput.inTmuxLauncherCommand ?? null,
                        assigneeLogin: input.manager,
                        issues: result.issues,
                        localCommandRunner: nodeLocalCommandRunner,
                        issueStateRepository: issueRepository,
                        now: inTmuxNow,
                    });
                }
                catch (error) {
                    console.error(`Failed to reconcile in-tmux-by-human sessions: ${error instanceof Error ? error.message : String(error)}`);
                }
                try {
                    await (0, staleTmuxSessionCleaner_1.cleanStaleTmuxSessions)({
                        project: result.project,
                        issueRepository,
                        localCommandRunner: nodeLocalCommandRunner,
                        now: inTmuxNow,
                    });
                }
                catch (error) {
                    console.error(`Failed to clean stale tmux sessions: ${error instanceof Error ? error.message : String(error)}`);
                }
                try {
                    const silentNotificationEnabled = mergedInput.silentNotificationEnabled ??
                        process.env.TDPM_SILENT_NOTIFICATION_ENABLED === 'true';
                    const subAgentOutputRootDirectory = mergedInput.subAgentOutputRootDirectory ??
                        process.env.TDPM_SUBAGENT_OUTPUT_ROOT_DIRECTORY ??
                        null;
                    const subAgentProcessMatchPattern = mergedInput.subAgentProcessMatchPattern ??
                        process.env.TDPM_SUBAGENT_PROCESS_MATCH_PATTERN ??
                        null;
                    const subAgentTranscriptRootDirectory = mergedInput.subAgentTranscriptRootDirectory ??
                        process.env.TDPM_SUBAGENT_TRANSCRIPT_ROOT_DIRECTORY ??
                        null;
                    const getuid = process.getuid?.bind(process);
                    const subAgentRuntimeRootDirectory = mergedInput.subAgentRuntimeRootDirectory ??
                        process.env.TDPM_SUBAGENT_RUNTIME_ROOT_DIRECTORY ??
                        (getuid === undefined
                            ? null
                            : path_1.default.join(os_1.default.tmpdir(), `claude-${getuid()}`));
                    await (0, notifySilentTmuxSessions_1.notifySilentTmuxSessions)({
                        enabled: silentNotificationEnabled,
                        localCommandRunner: nodeLocalCommandRunner,
                        ownerCallStatusProvider,
                        subAgentOutputRootDirectory,
                        subAgentProcessMatchPattern,
                        subAgentTranscriptRootDirectory,
                        subAgentRuntimeRootDirectory,
                        mainSilentThresholdSeconds: readSilentSeconds(mergedInput.mainSilentThresholdSeconds, process.env.TDPM_MAIN_SILENT_THRESHOLD_SECONDS, notifySilentTmuxSessions_1.DEFAULT_NOTIFY_SILENT_TMUX_SESSIONS_PARAMS.mainSilentThresholdSeconds),
                        unansweredOwnerCallGraceSeconds: readSilentSeconds(mergedInput.unansweredOwnerCallGraceSeconds, process.env.TDPM_SILENT_UNANSWERED_OWNER_CALL_GRACE_SECONDS, notifySilentTmuxSessions_1.DEFAULT_NOTIFY_SILENT_TMUX_SESSIONS_PARAMS.unansweredOwnerCallGraceSeconds),
                        subAgentSilentThresholdSeconds: readSilentSeconds(mergedInput.subAgentSilentThresholdSeconds, process.env.TDPM_SUBAGENT_SILENT_THRESHOLD_SECONDS, notifySilentTmuxSessions_1.DEFAULT_NOTIFY_SILENT_TMUX_SESSIONS_PARAMS.subAgentSilentThresholdSeconds),
                        subAgentRunningThresholdSeconds: readSilentSeconds(mergedInput.subAgentRunningThresholdSeconds, process.env.TDPM_SUBAGENT_RUNNING_THRESHOLD_SECONDS, notifySilentTmuxSessions_1.DEFAULT_NOTIFY_SILENT_TMUX_SESSIONS_PARAMS.subAgentRunningThresholdSeconds),
                        staggerSeconds: readSilentSeconds(mergedInput.silentNotificationStaggerSeconds, process.env.TDPM_SILENT_NOTIFICATION_STAGGER_SECONDS, notifySilentTmuxSessions_1.DEFAULT_NOTIFY_SILENT_TMUX_SESSIONS_PARAMS.staggerSeconds),
                        candidateDebounceRecencyWindowSeconds: readSilentSeconds(mergedInput.candidateDebounceRecencyWindowSeconds, process.env.TDPM_SILENT_CANDIDATE_DEBOUNCE_RECENCY_WINDOW_SECONDS, notifySilentTmuxSessions_1.DEFAULT_NOTIFY_SILENT_TMUX_SESSIONS_PARAMS.candidateDebounceRecencyWindowSeconds),
                        candidateDebounceStateFilePath: mergedInput.candidateDebounceStateFilePath ??
                            process.env.TDPM_SILENT_CANDIDATE_DEBOUNCE_STATE_FILE_PATH ??
                            null,
                        activeHubTaskStatus: mergedInput.activeHubTaskStatus ??
                            process.env.TDPM_ACTIVE_HUB_TASK_STATUS ??
                            null,
                        hubTaskStatusResolver: issueRepository,
                        hubTaskStatusCacheStateFilePath: mergedInput.hubTaskStatusCacheStateFilePath ??
                            process.env.TDPM_SILENT_HUB_TASK_STATUS_CACHE_STATE_FILE_PATH ??
                            null,
                        hubTaskStatusCacheTtlSeconds: readSilentSeconds(mergedInput.hubTaskStatusCacheTtlSeconds, process.env.TDPM_SILENT_HUB_TASK_STATUS_CACHE_TTL_SECONDS, notifySilentTmuxSessions_1.DEFAULT_NOTIFY_SILENT_TMUX_SESSIONS_PARAMS.hubTaskStatusCacheTtlSeconds),
                        messageTemplates: {
                            mainStalledMessage: mergedInput.silentMainStalledMessage ??
                                process.env.TDPM_SILENT_MAIN_STALLED_MESSAGE ??
                                null,
                            mainStalledStaleOwnerCallMessage: mergedInput.silentMainStalledStaleOwnerCallMessage ??
                                process.env.TDPM_SILENT_MAIN_STALLED_STALE_OWNER_CALL_MESSAGE ??
                                null,
                            subAgentIdleMessageHeader: mergedInput.silentSubAgentIdleMessageHeader ??
                                process.env.TDPM_SILENT_SUBAGENT_IDLE_MESSAGE_HEADER ??
                                null,
                            subAgentIdleMessageFooter: mergedInput.silentSubAgentIdleMessageFooter ??
                                process.env.TDPM_SILENT_SUBAGENT_IDLE_MESSAGE_FOOTER ??
                                null,
                            subAgentLongRunningMessageHeader: mergedInput.silentSubAgentLongRunningMessageHeader ??
                                process.env.TDPM_SILENT_SUBAGENT_LONG_RUNNING_MESSAGE_HEADER ??
                                null,
                            subAgentLongRunningMessageFooter: mergedInput.silentSubAgentLongRunningMessageFooter ??
                                process.env.TDPM_SILENT_SUBAGENT_LONG_RUNNING_MESSAGE_FOOTER ??
                                null,
                        },
                        now: inTmuxNow,
                    });
                }
                catch (error) {
                    console.error(`Failed to notify silent tmux sessions: ${error instanceof Error ? error.message : String(error)}`);
                }
                try {
                    const outputDegenerationResetEnabled = mergedInput.outputDegenerationResetEnabled ??
                        process.env.TDPM_OUTPUT_DEGENERATION_RESET_ENABLED === 'true';
                    await (0, resetDegeneratedTmuxSessions_1.resetDegeneratedTmuxSessions)({
                        enabled: outputDegenerationResetEnabled,
                        localCommandRunner: nodeLocalCommandRunner,
                        warningMessage: mergedInput.outputDegenerationWarningMessage ??
                            process.env.TDPM_OUTPUT_DEGENERATION_WARNING_MESSAGE ??
                            resetDegeneratedTmuxSessions_1.DEFAULT_RESET_DEGENERATED_TMUX_SESSIONS_PARAMS.warningMessage,
                        graceSeconds: readSilentSeconds(mergedInput.outputDegenerationGraceSeconds, process.env.TDPM_OUTPUT_DEGENERATION_GRACE_SECONDS, resetDegeneratedTmuxSessions_1.DEFAULT_RESET_DEGENERATED_TMUX_SESSIONS_PARAMS.graceSeconds),
                        cooldownSeconds: readSilentSeconds(mergedInput.outputDegenerationCooldownSeconds, process.env.TDPM_OUTPUT_DEGENERATION_COOLDOWN_SECONDS, resetDegeneratedTmuxSessions_1.DEFAULT_RESET_DEGENERATED_TMUX_SESSIONS_PARAMS.cooldownSeconds),
                        cooldownStateFilePath: mergedInput.outputDegenerationCooldownStateFilePath ??
                            process.env.TDPM_OUTPUT_DEGENERATION_COOLDOWN_STATE_FILE_PATH ??
                            null,
                        now: inTmuxNow,
                    });
                }
                catch (error) {
                    console.error(`Failed to reset degenerated tmux sessions: ${error instanceof Error ? error.message : String(error)}`);
                }
            }
            return result;
        };
    }
}
exports.HandleScheduledEventUseCaseHandler = HandleScheduledEventUseCaseHandler;
//# sourceMappingURL=HandleScheduledEventUseCaseHandler.js.map