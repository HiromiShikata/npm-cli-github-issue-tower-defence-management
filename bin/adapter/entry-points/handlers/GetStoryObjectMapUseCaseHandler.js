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
const SystemDateRepository_1 = require("../../repositories/SystemDateRepository");
const GetStoryObjectMapUseCase_1 = require("../../../domain/usecases/GetStoryObjectMapUseCase");
class GetStoryObjectMapUseCaseHandler {
    constructor() {
        this.handle = async (configFilePath, _verbose) => {
            const configFileContent = fs_1.default.readFileSync(configFilePath, 'utf8');
            const input = yaml_1.default.parse(configFileContent);
            const inputRecord = input;
            const credentialsRecord = inputRecord?.['credentials'];
            const botRecord = credentialsRecord?.['bot'];
            const githubRecord = botRecord?.['github'];
            if (typeof inputRecord?.['projectName'] !== 'string' ||
                typeof githubRecord?.['token'] !== 'string') {
                throw new Error(`Invalid input: required fields projectName and credentials.bot.github.token must be strings. Got: ${JSON.stringify(input)}`);
            }
            const typedInput = input;
            const localStorageRepository = new LocalStorageRepository_1.LocalStorageRepository();
            const cachePath = `./tmp/cache/${typedInput.projectName}`;
            const localStorageCacheRepository = new LocalStorageCacheRepository_1.LocalStorageCacheRepository(localStorageRepository, cachePath);
            const githubRepositoryParams = [localStorageRepository, typedInput.credentials.bot.github.token];
            const projectRepository = {
                ...new GraphqlProjectRepository_1.GraphqlProjectRepository(...githubRepositoryParams, localStorageCacheRepository),
            };
            const apiV3IssueRepository = new ApiV3IssueRepository_1.ApiV3IssueRepository(...githubRepositoryParams);
            const restIssueRepository = new RestIssueRepository_1.RestIssueRepository(...githubRepositoryParams);
            const graphqlProjectItemRepository = new GraphqlProjectItemRepository_1.GraphqlProjectItemRepository(...githubRepositoryParams);
            const issueRepository = new ApiV3CheerioRestIssueRepository_1.ApiV3CheerioRestIssueRepository(apiV3IssueRepository, restIssueRepository, graphqlProjectItemRepository, localStorageCacheRepository, projectRepository, new SystemDateRepository_1.SystemDateRepository(), ...githubRepositoryParams);
            const getStoryObjectMapUseCase = new GetStoryObjectMapUseCase_1.GetStoryObjectMapUseCase(projectRepository, issueRepository);
            return await getStoryObjectMapUseCase.run(typedInput);
        };
    }
}
exports.GetStoryObjectMapUseCaseHandler = GetStoryObjectMapUseCaseHandler;
//# sourceMappingURL=GetStoryObjectMapUseCaseHandler.js.map