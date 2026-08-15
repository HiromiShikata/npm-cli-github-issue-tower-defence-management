"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetStoryObjectMapUseCaseHandler = void 0;
const yaml_1 = __importDefault(require("yaml"));
const fs_1 = __importDefault(require("fs"));
const LocalStorageRepository_1 = require("../../repositories/LocalStorageRepository");
const GraphqlProjectRepository_1 = require("../../repositories/GraphqlProjectRepository");
const ApiV3IssueRepository_1 = require("../../repositories/issue/ApiV3IssueRepository");
const RestIssueRepository_1 = require("../../repositories/issue/RestIssueRepository");
const GraphqlProjectItemRepository_1 = require("../../repositories/issue/GraphqlProjectItemRepository");
const ApiV3CheerioRestIssueRepository_1 = require("../../repositories/issue/ApiV3CheerioRestIssueRepository");
const LocalStorageCacheRepository_1 = require("../../repositories/LocalStorageCacheRepository");
const localStorageCacheDirectory_1 = require("../../repositories/localStorageCacheDirectory");
const SystemDateRepository_1 = require("../../repositories/SystemDateRepository");
const GetStoryObjectMapUseCase_1 = require("../../../domain/usecases/GetStoryObjectMapUseCase");
class GetStoryObjectMapUseCaseHandler {
    constructor() {
        this.handle = async (configFilePath, _verbose) => {
            const configFileContent = fs_1.default.readFileSync(configFilePath, 'utf8');
            const input = yaml_1.default.parse(configFileContent);
            const isInputType = (v) => {
                if (typeof v !== 'object' || v === null)
                    return false;
                if (!('projectName' in v) || typeof v.projectName !== 'string')
                    return false;
                if (!('credentials' in v) ||
                    typeof v.credentials !== 'object' ||
                    v.credentials === null)
                    return false;
                const credentials = v.credentials;
                if (!('bot' in credentials) ||
                    typeof credentials.bot !== 'object' ||
                    credentials.bot === null)
                    return false;
                const bot = credentials.bot;
                if (!('github' in bot) ||
                    typeof bot.github !== 'object' ||
                    bot.github === null)
                    return false;
                const github = bot.github;
                if (!('token' in github) || typeof github.token !== 'string')
                    return false;
                return true;
            };
            if (!isInputType(input)) {
                throw new Error(`Invalid input: required fields projectName and credentials.bot.github.token must be strings. Got: ${JSON.stringify(input)}`);
            }
            const localStorageRepository = new LocalStorageRepository_1.LocalStorageRepository();
            const cachePath = (0, localStorageCacheDirectory_1.projectCacheDirectory)(input.projectName);
            const localStorageCacheRepository = new LocalStorageCacheRepository_1.LocalStorageCacheRepository(localStorageRepository, cachePath);
            const githubRepositoryParams = [localStorageRepository, input.credentials.bot.github.token];
            const projectRepository = {
                ...new GraphqlProjectRepository_1.GraphqlProjectRepository(...githubRepositoryParams, localStorageCacheRepository),
            };
            const apiV3IssueRepository = new ApiV3IssueRepository_1.ApiV3IssueRepository(...githubRepositoryParams);
            const restIssueRepository = new RestIssueRepository_1.RestIssueRepository(...githubRepositoryParams);
            const graphqlProjectItemRepository = new GraphqlProjectItemRepository_1.GraphqlProjectItemRepository(...githubRepositoryParams);
            const issueRepository = new ApiV3CheerioRestIssueRepository_1.ApiV3CheerioRestIssueRepository(apiV3IssueRepository, restIssueRepository, graphqlProjectItemRepository, localStorageCacheRepository, projectRepository, new SystemDateRepository_1.SystemDateRepository(), ...githubRepositoryParams);
            const getStoryObjectMapUseCase = new GetStoryObjectMapUseCase_1.GetStoryObjectMapUseCase(projectRepository, issueRepository);
            return await getStoryObjectMapUseCase.run(input);
        };
    }
}
exports.GetStoryObjectMapUseCaseHandler = GetStoryObjectMapUseCaseHandler;
//# sourceMappingURL=GetStoryObjectMapUseCaseHandler.js.map