"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HandleScheduledEventUseCaseHandler = void 0;
const yaml_1 = __importDefault(require("yaml"));
const typia_1 = __importDefault(require("typia"));
const fs_1 = __importDefault(require("fs"));
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
const ClearNextActionHourUseCase_1 = require("../../../domain/usecases/ClearNextActionHourUseCase");
const AnalyzeProblemByIssueUseCase_1 = require("../../../domain/usecases/AnalyzeProblemByIssueUseCase");
const AnalyzeStoriesUseCase_1 = require("../../../domain/usecases/AnalyzeStoriesUseCase");
const ClearDependedIssueURLUseCase_1 = require("../../../domain/usecases/ClearDependedIssueURLUseCase");
const CreateEstimationIssueUseCase_1 = require("../../../domain/usecases/CreateEstimationIssueUseCase");
const axios_1 = __importDefault(require("axios"));
const ConvertCheckboxToIssueInStoryIssueUseCase_1 = require("../../../domain/usecases/ConvertCheckboxToIssueInStoryIssueUseCase");
const ChangeStatusByStoryColorUseCase_1 = require("../../../domain/usecases/ChangeStatusByStoryColorUseCase");
const SetNoStoryIssueToStoryUseCase_1 = require("../../../domain/usecases/SetNoStoryIssueToStoryUseCase");
const CreateNewStoryByLabelUseCase_1 = require("../../../domain/usecases/CreateNewStoryByLabelUseCase");
const CheerioProjectRepository_1 = require("../../repositories/CheerioProjectRepository");
const AssignNoAssigneeIssueToManagerUseCase_1 = require("../../../domain/usecases/AssignNoAssigneeIssueToManagerUseCase");
const UpdateIssueStatusByLabelUseCase_1 = require("../../../domain/usecases/UpdateIssueStatusByLabelUseCase");
const StartPreparationUseCase_1 = require("../../../domain/usecases/StartPreparationUseCase");
const NodeLocalCommandRunner_1 = require("../../repositories/NodeLocalCommandRunner");
const StubClaudeRepository_1 = require("../../repositories/StubClaudeRepository");
const NotifyFinishedIssuePreparationUseCase_1 = require("../../../domain/usecases/NotifyFinishedIssuePreparationUseCase");
const GitHubIssueCommentRepository_1 = require("../../repositories/GitHubIssueCommentRepository");
const FetchWebhookRepository_1 = require("../../repositories/FetchWebhookRepository");
class HandleScheduledEventUseCaseHandler {
    constructor() {
        this.handle = async (configFilePath, verbose) => {
            axios_1.default.interceptors.response.use((response) => response, (error) => {
                if (verbose) {
                    const sanitizedHeaders = error.config?.headers
                        ? { ...error.config.headers, Authorization: '[REDACTED]' }
                        : undefined;
                    const errorInfo = {
                        message: error.message,
                        status: error.response?.status,
                        statusText: error.response?.statusText,
                        data: error.response?.data,
                        config: error.config
                            ? { ...error.config, headers: sanitizedHeaders }
                            : undefined,
                    };
                    throw new Error(`API Error: ${JSON.stringify(errorInfo)}`);
                }
                if (error.response) {
                    throw new Error(`API Error: ${error.response.status}`);
                }
                throw new Error('Network Error');
            });
            const configFileContent = fs_1.default.readFileSync(configFilePath, 'utf8');
            const input = yaml_1.default.parse(configFileContent);
            if (!typia_1.default.is(input)) {
                throw new Error(`Invalid input: ${JSON.stringify(input)}\n\n${JSON.stringify(typia_1.default.validate(input))}`);
            }
            if (input.disabled) {
                return null;
            }
            const systemDateRepository = new SystemDateRepository_1.SystemDateRepository();
            const localStorageRepository = new LocalStorageRepository_1.LocalStorageRepository();
            const googleSpreadsheetRepository = new GoogleSpreadsheetRepository_1.GoogleSpreadsheetRepository(localStorageRepository, input.credentials.manager.googleServiceAccount.serviceAccountKey);
            const cachePath = `./tmp/cache/${input.projectName}`;
            const localStorageCacheRepository = new LocalStorageCacheRepository_1.LocalStorageCacheRepository(localStorageRepository, cachePath);
            const githubRepositoryParams = [
                localStorageRepository,
                `${cachePath}/github.com.cookies.json`,
                input.credentials.bot.github.token,
                input.credentials.bot.github.name,
                input.credentials.bot.github.password,
                input.credentials.bot.github.authenticatorKey,
            ];
            const projectRepository = {
                ...new GraphqlProjectRepository_1.GraphqlProjectRepository(...githubRepositoryParams),
                ...new CheerioProjectRepository_1.CheerioProjectRepository(...githubRepositoryParams),
                prepareStatus: async (_name, project) => {
                    return project;
                },
            };
            const apiV3IssueRepository = new ApiV3IssueRepository_1.ApiV3IssueRepository(...githubRepositoryParams);
            const restIssueRepository = new RestIssueRepository_1.RestIssueRepository(...githubRepositoryParams);
            const graphqlProjectItemRepository = new GraphqlProjectItemRepository_1.GraphqlProjectItemRepository(...githubRepositoryParams);
            const issueRepository = new ApiV3CheerioRestIssueRepository_1.ApiV3CheerioRestIssueRepository(apiV3IssueRepository, restIssueRepository, graphqlProjectItemRepository, localStorageCacheRepository, ...githubRepositoryParams);
            const actionAnnouncement = new ActionAnnouncementUseCase_1.ActionAnnouncementUseCase(issueRepository);
            const setWorkflowManagementIssueToStoryUseCase = new SetWorkflowManagementIssueToStoryUseCase_1.SetWorkflowManagementIssueToStoryUseCase(issueRepository);
            const clearNextActionHourUseCase = new ClearNextActionHourUseCase_1.ClearNextActionHourUseCase(issueRepository);
            const analyzeProblemByIssueUseCase = new AnalyzeProblemByIssueUseCase_1.AnalyzeProblemByIssueUseCase(issueRepository, systemDateRepository);
            const analyzeStoriesUseCase = new AnalyzeStoriesUseCase_1.AnalyzeStoriesUseCase(issueRepository, systemDateRepository);
            const clearDependedIssueURLUseCase = new ClearDependedIssueURLUseCase_1.ClearDependedIssueURLUseCase(issueRepository);
            const createEstimationIssueUseCase = new CreateEstimationIssueUseCase_1.CreateEstimationIssueUseCase(issueRepository, systemDateRepository);
            const convertCheckboxToIssueInStoryIssueUseCase = new ConvertCheckboxToIssueInStoryIssueUseCase_1.ConvertCheckboxToIssueInStoryIssueUseCase(issueRepository);
            const changeStatusByStoryColorUseCase = new ChangeStatusByStoryColorUseCase_1.ChangeStatusByStoryColorUseCase(systemDateRepository, issueRepository);
            const setNoStoryIssueToStoryUseCase = new SetNoStoryIssueToStoryUseCase_1.SetNoStoryIssueToStoryUseCase(issueRepository);
            const createNewStoryByLabel = new CreateNewStoryByLabelUseCase_1.CreateNewStoryByLabelUseCase(projectRepository, issueRepository);
            const assignNoAssigneeIssueToManagerUseCase = new AssignNoAssigneeIssueToManagerUseCase_1.AssignNoAssigneeIssueToManagerUseCase(issueRepository);
            const updateIssueStatusByLabelUseCase = new UpdateIssueStatusByLabelUseCase_1.UpdateIssueStatusByLabelUseCase(issueRepository);
            const nodeLocalCommandRunner = new NodeLocalCommandRunner_1.NodeLocalCommandRunner();
            const stubClaudeRepository = new StubClaudeRepository_1.StubClaudeRepository();
            const startPreparationUseCase = new StartPreparationUseCase_1.StartPreparationUseCase(projectRepository, issueRepository, stubClaudeRepository, nodeLocalCommandRunner);
            const issueCommentRepository = new GitHubIssueCommentRepository_1.GitHubIssueCommentRepository(input.credentials.bot.github.token);
            const webhookRepository = new FetchWebhookRepository_1.FetchWebhookRepository();
            const notifyFinishedIssuePreparationUseCase = new NotifyFinishedIssuePreparationUseCase_1.NotifyFinishedIssuePreparationUseCase(projectRepository, issueRepository, issueCommentRepository, webhookRepository);
            const handleScheduledEventUseCase = new HandleScheduledEventUseCase_1.HandleScheduledEventUseCase(actionAnnouncement, setWorkflowManagementIssueToStoryUseCase, clearNextActionHourUseCase, analyzeProblemByIssueUseCase, analyzeStoriesUseCase, clearDependedIssueURLUseCase, createEstimationIssueUseCase, convertCheckboxToIssueInStoryIssueUseCase, changeStatusByStoryColorUseCase, setNoStoryIssueToStoryUseCase, createNewStoryByLabel, assignNoAssigneeIssueToManagerUseCase, updateIssueStatusByLabelUseCase, startPreparationUseCase, notifyFinishedIssuePreparationUseCase, systemDateRepository, googleSpreadsheetRepository, projectRepository, issueRepository);
            return await handleScheduledEventUseCase.run(input);
        };
    }
}
exports.HandleScheduledEventUseCaseHandler = HandleScheduledEventUseCaseHandler;
//# sourceMappingURL=HandleScheduledEventUseCaseHandler.js.map