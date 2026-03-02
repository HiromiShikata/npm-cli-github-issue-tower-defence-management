"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetStoryObjectMapUseCaseHandler = void 0;
const __typia_transform__validateReport = __importStar(require("typia/lib/internal/_validateReport.js"));
const yaml_1 = __importDefault(require("yaml"));
const typia_1 = __importDefault(require("typia"));
const fs_1 = __importDefault(require("fs"));
const LocalStorageRepository_1 = require("../../repositories/LocalStorageRepository");
const GraphqlProjectRepository_1 = require("../../repositories/GraphqlProjectRepository");
const ApiV3IssueRepository_1 = require("../../repositories/issue/ApiV3IssueRepository");
const RestIssueRepository_1 = require("../../repositories/issue/RestIssueRepository");
const GraphqlProjectItemRepository_1 = require("../../repositories/issue/GraphqlProjectItemRepository");
const ApiV3CheerioRestIssueRepository_1 = require("../../repositories/issue/ApiV3CheerioRestIssueRepository");
const LocalStorageCacheRepository_1 = require("../../repositories/LocalStorageCacheRepository");
const axios_1 = __importDefault(require("axios"));
const CheerioProjectRepository_1 = require("../../repositories/CheerioProjectRepository");
const GetStoryObjectMapUseCase_1 = require("../../../domain/usecases/GetStoryObjectMapUseCase");
class GetStoryObjectMapUseCaseHandler {
    constructor() {
        this.handle = async (configFilePath, verbose, allowCacheMinutes) => {
            axios_1.default.interceptors.response.use((response) => response, (error) => {
                if (verbose) {
                    throw new Error(`API Error: ${JSON.stringify(error)}`);
                }
                if (error.response) {
                    throw new Error(`API Error: ${error.response.status}`);
                }
                throw new Error('Network Error');
            });
            const configFileContent = fs_1.default.readFileSync(configFilePath, 'utf8');
            const input = yaml_1.default.parse(configFileContent);
            if (!(() => { const _io0 = input => "string" === typeof input.projectUrl && "number" === typeof input.allowIssueCacheMinutes && "string" === typeof input.projectName && ("object" === typeof input.credentials && null !== input.credentials && _io1(input.credentials)); const _io1 = input => "object" === typeof input.bot && null !== input.bot && _io2(input.bot); const _io2 = input => "object" === typeof input.github && null !== input.github && _io3(input.github); const _io3 = input => "string" === typeof input.token && (undefined === input.name || "string" === typeof input.name) && (undefined === input.password || "string" === typeof input.password) && (undefined === input.authenticatorKey || "string" === typeof input.authenticatorKey); return input => "object" === typeof input && null !== input && _io0(input); })()(input)) {
                throw new Error(`Invalid input: ${JSON.stringify(input)}\n\n${JSON.stringify((() => { const _io0 = input => "string" === typeof input.projectUrl && "number" === typeof input.allowIssueCacheMinutes && "string" === typeof input.projectName && ("object" === typeof input.credentials && null !== input.credentials && _io1(input.credentials)); const _io1 = input => "object" === typeof input.bot && null !== input.bot && _io2(input.bot); const _io2 = input => "object" === typeof input.github && null !== input.github && _io3(input.github); const _io3 = input => "string" === typeof input.token && (undefined === input.name || "string" === typeof input.name) && (undefined === input.password || "string" === typeof input.password) && (undefined === input.authenticatorKey || "string" === typeof input.authenticatorKey); const _vo0 = (input, _path, _exceptionable = true) => ["string" === typeof input.projectUrl || _report(_exceptionable, {
                        path: _path + ".projectUrl",
                        expected: "string",
                        value: input.projectUrl
                    }), "number" === typeof input.allowIssueCacheMinutes || _report(_exceptionable, {
                        path: _path + ".allowIssueCacheMinutes",
                        expected: "number",
                        value: input.allowIssueCacheMinutes
                    }), "string" === typeof input.projectName || _report(_exceptionable, {
                        path: _path + ".projectName",
                        expected: "string",
                        value: input.projectName
                    }), ("object" === typeof input.credentials && null !== input.credentials || _report(_exceptionable, {
                        path: _path + ".credentials",
                        expected: "__type",
                        value: input.credentials
                    })) && _vo1(input.credentials, _path + ".credentials", true && _exceptionable) || _report(_exceptionable, {
                        path: _path + ".credentials",
                        expected: "__type",
                        value: input.credentials
                    })].every(flag => flag); const _vo1 = (input, _path, _exceptionable = true) => [("object" === typeof input.bot && null !== input.bot || _report(_exceptionable, {
                        path: _path + ".bot",
                        expected: "__type.o1",
                        value: input.bot
                    })) && _vo2(input.bot, _path + ".bot", true && _exceptionable) || _report(_exceptionable, {
                        path: _path + ".bot",
                        expected: "__type.o1",
                        value: input.bot
                    })].every(flag => flag); const _vo2 = (input, _path, _exceptionable = true) => [("object" === typeof input.github && null !== input.github || _report(_exceptionable, {
                        path: _path + ".github",
                        expected: "__type.o2",
                        value: input.github
                    })) && _vo3(input.github, _path + ".github", true && _exceptionable) || _report(_exceptionable, {
                        path: _path + ".github",
                        expected: "__type.o2",
                        value: input.github
                    })].every(flag => flag); const _vo3 = (input, _path, _exceptionable = true) => ["string" === typeof input.token || _report(_exceptionable, {
                        path: _path + ".token",
                        expected: "string",
                        value: input.token
                    }), undefined === input.name || "string" === typeof input.name || _report(_exceptionable, {
                        path: _path + ".name",
                        expected: "(string | undefined)",
                        value: input.name
                    }), undefined === input.password || "string" === typeof input.password || _report(_exceptionable, {
                        path: _path + ".password",
                        expected: "(string | undefined)",
                        value: input.password
                    }), undefined === input.authenticatorKey || "string" === typeof input.authenticatorKey || _report(_exceptionable, {
                        path: _path + ".authenticatorKey",
                        expected: "(string | undefined)",
                        value: input.authenticatorKey
                    })].every(flag => flag); const __is = input => "object" === typeof input && null !== input && _io0(input); let errors; let _report; return input => {
                    if (false === __is(input)) {
                        errors = [];
                        _report = __typia_transform__validateReport._validateReport(errors);
                        ((input, _path, _exceptionable = true) => ("object" === typeof input && null !== input || _report(true, {
                            path: _path + "",
                            expected: "inputType",
                            value: input
                        })) && _vo0(input, _path + "", true) || _report(true, {
                            path: _path + "",
                            expected: "inputType",
                            value: input
                        }))(input, "$input", true);
                        const success = 0 === errors.length;
                        return success ? {
                            success,
                            data: input
                        } : {
                            success,
                            errors,
                            data: input
                        };
                    }
                    return {
                        success: true,
                        data: input
                    };
                }; })()(input))}`);
            }
            const localStorageRepository = new LocalStorageRepository_1.LocalStorageRepository();
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
            };
            const apiV3IssueRepository = new ApiV3IssueRepository_1.ApiV3IssueRepository(...githubRepositoryParams);
            const restIssueRepository = new RestIssueRepository_1.RestIssueRepository(...githubRepositoryParams);
            const graphqlProjectItemRepository = new GraphqlProjectItemRepository_1.GraphqlProjectItemRepository(...githubRepositoryParams);
            const issueRepository = new ApiV3CheerioRestIssueRepository_1.ApiV3CheerioRestIssueRepository(apiV3IssueRepository, restIssueRepository, graphqlProjectItemRepository, localStorageCacheRepository, ...githubRepositoryParams);
            const getStoryObjectMapUseCase = new GetStoryObjectMapUseCase_1.GetStoryObjectMapUseCase(projectRepository, issueRepository);
            const useCaseInput = allowCacheMinutes !== undefined
                ? { ...input, allowIssueCacheMinutes: allowCacheMinutes }
                : input;
            return await getStoryObjectMapUseCase.run(useCaseInput);
        };
    }
}
exports.GetStoryObjectMapUseCaseHandler = GetStoryObjectMapUseCaseHandler;
//# sourceMappingURL=GetStoryObjectMapUseCaseHandler.js.map