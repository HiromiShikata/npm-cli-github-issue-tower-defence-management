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
const CheerioIssueRepository_1 = require("../../repositories/issue/CheerioIssueRepository");
const RestIssueRepository_1 = require("../../repositories/issue/RestIssueRepository");
const GraphqlProjectItemRepository_1 = require("../../repositories/issue/GraphqlProjectItemRepository");
const ApiV3CheerioRestIssueRepository_1 = require("../../repositories/issue/ApiV3CheerioRestIssueRepository");
const GenerateWorkingTimeReportUseCase_1 = require("../../../domain/usecases/GenerateWorkingTimeReportUseCase");
const HandleScheduledEventUseCase_1 = require("../../../domain/usecases/HandleScheduledEventUseCase");
const LocalStorageCacheRepository_1 = require("../../repositories/LocalStorageCacheRepository");
const ActionAnnouncementUseCase_1 = require("../../../domain/usecases/ActionAnnouncementUseCase");
const SetWorkflowManagementIssueToStoryUseCase_1 = require("../../../domain/usecases/SetWorkflowManagementIssueToStoryUseCase");
const InternalGraphqlIssueRepository_1 = require("../../repositories/issue/InternalGraphqlIssueRepository");
const ClearNextActionHourUseCase_1 = require("../../../domain/usecases/ClearNextActionHourUseCase");
const AnalyzeProblemByIssueUseCase_1 = require("../../../domain/usecases/AnalyzeProblemByIssueUseCase");
const AnalyzeStoriesUseCase_1 = require("../../../domain/usecases/AnalyzeStoriesUseCase");
const ClearDependedIssueURLUseCase_1 = require("../../../domain/usecases/ClearDependedIssueURLUseCase");
const CreateEstimationIssueUseCase_1 = require("../../../domain/usecases/CreateEstimationIssueUseCase");
const axios_1 = __importDefault(require("axios"));
const ConvertCheckboxToIssueInStoryIssueUseCase_1 = require("../../../domain/usecases/ConvertCheckboxToIssueInStoryIssueUseCase");
const ChangeStatusLongInReviewIssueUseCase_1 = require("../../../domain/usecases/ChangeStatusLongInReviewIssueUseCase");
const ChangeStatusByStoryColorUseCase_1 = require("../../../domain/usecases/ChangeStatusByStoryColorUseCase");
const SetNoStoryIssueToStoryUseCase_1 = require("../../../domain/usecases/SetNoStoryIssueToStoryUseCase");
class HandleScheduledEventUseCaseHandler {
    constructor() {
        this.handle = async (configFilePath, verbose) => {
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
            if (!(() => { const $io0 = input => "string" === typeof input.projectName && "string" === typeof input.org && "string" === typeof input.projectUrl && "string" === typeof input.manager && ("object" === typeof input.workingReport && null !== input.workingReport && $io1(input.workingReport)) && "string" === typeof input.urlOfStoryView && "string" === typeof input.disabledStatus && ("object" === typeof input.credentials && null !== input.credentials && $io2(input.credentials)); const $io1 = input => "string" === typeof input.repo && (Array.isArray(input.members) && input.members.every(elem => "string" === typeof elem)) && (undefined === input.warningThresholdHour || "number" === typeof input.warningThresholdHour) && "string" === typeof input.spreadsheetUrl && (undefined === input.reportIssueTemplate || "string" === typeof input.reportIssueTemplate) && (Array.isArray(input.reportIssueLabels) && input.reportIssueLabels.every(elem => "string" === typeof elem)); const $io2 = input => "object" === typeof input.manager && null !== input.manager && $io3(input.manager) && ("object" === typeof input.bot && null !== input.bot && $io7(input.bot)); const $io3 = input => "object" === typeof input.github && null !== input.github && $io4(input.github) && ("object" === typeof input.slack && null !== input.slack && $io5(input.slack)) && ("object" === typeof input.googleServiceAccount && null !== input.googleServiceAccount && $io6(input.googleServiceAccount)); const $io4 = input => "string" === typeof input.token; const $io5 = input => "string" === typeof input.userToken; const $io6 = input => "string" === typeof input.serviceAccountKey; const $io7 = input => "object" === typeof input.github && null !== input.github && $io8(input.github); const $io8 = input => "string" === typeof input.token && "string" === typeof input.name && "string" === typeof input.password && "string" === typeof input.authenticatorKey; return input => "object" === typeof input && null !== input && $io0(input); })()(input)) {
                throw new Error(`Invalid input: ${JSON.stringify(input)}\n\n${JSON.stringify((() => { const $io0 = input => "string" === typeof input.projectName && "string" === typeof input.org && "string" === typeof input.projectUrl && "string" === typeof input.manager && ("object" === typeof input.workingReport && null !== input.workingReport && $io1(input.workingReport)) && "string" === typeof input.urlOfStoryView && "string" === typeof input.disabledStatus && ("object" === typeof input.credentials && null !== input.credentials && $io2(input.credentials)); const $io1 = input => "string" === typeof input.repo && (Array.isArray(input.members) && input.members.every(elem => "string" === typeof elem)) && (undefined === input.warningThresholdHour || "number" === typeof input.warningThresholdHour) && "string" === typeof input.spreadsheetUrl && (undefined === input.reportIssueTemplate || "string" === typeof input.reportIssueTemplate) && (Array.isArray(input.reportIssueLabels) && input.reportIssueLabels.every(elem => "string" === typeof elem)); const $io2 = input => "object" === typeof input.manager && null !== input.manager && $io3(input.manager) && ("object" === typeof input.bot && null !== input.bot && $io7(input.bot)); const $io3 = input => "object" === typeof input.github && null !== input.github && $io4(input.github) && ("object" === typeof input.slack && null !== input.slack && $io5(input.slack)) && ("object" === typeof input.googleServiceAccount && null !== input.googleServiceAccount && $io6(input.googleServiceAccount)); const $io4 = input => "string" === typeof input.token; const $io5 = input => "string" === typeof input.userToken; const $io6 = input => "string" === typeof input.serviceAccountKey; const $io7 = input => "object" === typeof input.github && null !== input.github && $io8(input.github); const $io8 = input => "string" === typeof input.token && "string" === typeof input.name && "string" === typeof input.password && "string" === typeof input.authenticatorKey; const $vo0 = (input, _path, _exceptionable = true) => ["string" === typeof input.projectName || $report(_exceptionable, {
                        path: _path + ".projectName",
                        expected: "string",
                        value: input.projectName
                    }), "string" === typeof input.org || $report(_exceptionable, {
                        path: _path + ".org",
                        expected: "string",
                        value: input.org
                    }), "string" === typeof input.projectUrl || $report(_exceptionable, {
                        path: _path + ".projectUrl",
                        expected: "string",
                        value: input.projectUrl
                    }), "string" === typeof input.manager || $report(_exceptionable, {
                        path: _path + ".manager",
                        expected: "string",
                        value: input.manager
                    }), ("object" === typeof input.workingReport && null !== input.workingReport || $report(_exceptionable, {
                        path: _path + ".workingReport",
                        expected: "__type",
                        value: input.workingReport
                    })) && $vo1(input.workingReport, _path + ".workingReport", true && _exceptionable) || $report(_exceptionable, {
                        path: _path + ".workingReport",
                        expected: "__type",
                        value: input.workingReport
                    }), "string" === typeof input.urlOfStoryView || $report(_exceptionable, {
                        path: _path + ".urlOfStoryView",
                        expected: "string",
                        value: input.urlOfStoryView
                    }), "string" === typeof input.disabledStatus || $report(_exceptionable, {
                        path: _path + ".disabledStatus",
                        expected: "string",
                        value: input.disabledStatus
                    }), ("object" === typeof input.credentials && null !== input.credentials || $report(_exceptionable, {
                        path: _path + ".credentials",
                        expected: "__type.o1",
                        value: input.credentials
                    })) && $vo2(input.credentials, _path + ".credentials", true && _exceptionable) || $report(_exceptionable, {
                        path: _path + ".credentials",
                        expected: "__type.o1",
                        value: input.credentials
                    })].every(flag => flag); const $vo1 = (input, _path, _exceptionable = true) => ["string" === typeof input.repo || $report(_exceptionable, {
                        path: _path + ".repo",
                        expected: "string",
                        value: input.repo
                    }), (Array.isArray(input.members) || $report(_exceptionable, {
                        path: _path + ".members",
                        expected: "Array<string>",
                        value: input.members
                    })) && input.members.map((elem, _index3) => "string" === typeof elem || $report(_exceptionable, {
                        path: _path + ".members[" + _index3 + "]",
                        expected: "string",
                        value: elem
                    })).every(flag => flag) || $report(_exceptionable, {
                        path: _path + ".members",
                        expected: "Array<string>",
                        value: input.members
                    }), undefined === input.warningThresholdHour || "number" === typeof input.warningThresholdHour || $report(_exceptionable, {
                        path: _path + ".warningThresholdHour",
                        expected: "(number | undefined)",
                        value: input.warningThresholdHour
                    }), "string" === typeof input.spreadsheetUrl || $report(_exceptionable, {
                        path: _path + ".spreadsheetUrl",
                        expected: "string",
                        value: input.spreadsheetUrl
                    }), undefined === input.reportIssueTemplate || "string" === typeof input.reportIssueTemplate || $report(_exceptionable, {
                        path: _path + ".reportIssueTemplate",
                        expected: "(string | undefined)",
                        value: input.reportIssueTemplate
                    }), (Array.isArray(input.reportIssueLabels) || $report(_exceptionable, {
                        path: _path + ".reportIssueLabels",
                        expected: "Array<string>",
                        value: input.reportIssueLabels
                    })) && input.reportIssueLabels.map((elem, _index4) => "string" === typeof elem || $report(_exceptionable, {
                        path: _path + ".reportIssueLabels[" + _index4 + "]",
                        expected: "string",
                        value: elem
                    })).every(flag => flag) || $report(_exceptionable, {
                        path: _path + ".reportIssueLabels",
                        expected: "Array<string>",
                        value: input.reportIssueLabels
                    })].every(flag => flag); const $vo2 = (input, _path, _exceptionable = true) => [("object" === typeof input.manager && null !== input.manager || $report(_exceptionable, {
                        path: _path + ".manager",
                        expected: "__type.o2",
                        value: input.manager
                    })) && $vo3(input.manager, _path + ".manager", true && _exceptionable) || $report(_exceptionable, {
                        path: _path + ".manager",
                        expected: "__type.o2",
                        value: input.manager
                    }), ("object" === typeof input.bot && null !== input.bot || $report(_exceptionable, {
                        path: _path + ".bot",
                        expected: "__type.o6",
                        value: input.bot
                    })) && $vo7(input.bot, _path + ".bot", true && _exceptionable) || $report(_exceptionable, {
                        path: _path + ".bot",
                        expected: "__type.o6",
                        value: input.bot
                    })].every(flag => flag); const $vo3 = (input, _path, _exceptionable = true) => [("object" === typeof input.github && null !== input.github || $report(_exceptionable, {
                        path: _path + ".github",
                        expected: "__type.o3",
                        value: input.github
                    })) && $vo4(input.github, _path + ".github", true && _exceptionable) || $report(_exceptionable, {
                        path: _path + ".github",
                        expected: "__type.o3",
                        value: input.github
                    }), ("object" === typeof input.slack && null !== input.slack || $report(_exceptionable, {
                        path: _path + ".slack",
                        expected: "__type.o4",
                        value: input.slack
                    })) && $vo5(input.slack, _path + ".slack", true && _exceptionable) || $report(_exceptionable, {
                        path: _path + ".slack",
                        expected: "__type.o4",
                        value: input.slack
                    }), ("object" === typeof input.googleServiceAccount && null !== input.googleServiceAccount || $report(_exceptionable, {
                        path: _path + ".googleServiceAccount",
                        expected: "__type.o5",
                        value: input.googleServiceAccount
                    })) && $vo6(input.googleServiceAccount, _path + ".googleServiceAccount", true && _exceptionable) || $report(_exceptionable, {
                        path: _path + ".googleServiceAccount",
                        expected: "__type.o5",
                        value: input.googleServiceAccount
                    })].every(flag => flag); const $vo4 = (input, _path, _exceptionable = true) => ["string" === typeof input.token || $report(_exceptionable, {
                        path: _path + ".token",
                        expected: "string",
                        value: input.token
                    })].every(flag => flag); const $vo5 = (input, _path, _exceptionable = true) => ["string" === typeof input.userToken || $report(_exceptionable, {
                        path: _path + ".userToken",
                        expected: "string",
                        value: input.userToken
                    })].every(flag => flag); const $vo6 = (input, _path, _exceptionable = true) => ["string" === typeof input.serviceAccountKey || $report(_exceptionable, {
                        path: _path + ".serviceAccountKey",
                        expected: "string",
                        value: input.serviceAccountKey
                    })].every(flag => flag); const $vo7 = (input, _path, _exceptionable = true) => [("object" === typeof input.github && null !== input.github || $report(_exceptionable, {
                        path: _path + ".github",
                        expected: "__type.o7",
                        value: input.github
                    })) && $vo8(input.github, _path + ".github", true && _exceptionable) || $report(_exceptionable, {
                        path: _path + ".github",
                        expected: "__type.o7",
                        value: input.github
                    })].every(flag => flag); const $vo8 = (input, _path, _exceptionable = true) => ["string" === typeof input.token || $report(_exceptionable, {
                        path: _path + ".token",
                        expected: "string",
                        value: input.token
                    }), "string" === typeof input.name || $report(_exceptionable, {
                        path: _path + ".name",
                        expected: "string",
                        value: input.name
                    }), "string" === typeof input.password || $report(_exceptionable, {
                        path: _path + ".password",
                        expected: "string",
                        value: input.password
                    }), "string" === typeof input.authenticatorKey || $report(_exceptionable, {
                        path: _path + ".authenticatorKey",
                        expected: "string",
                        value: input.authenticatorKey
                    })].every(flag => flag); const __is = input => "object" === typeof input && null !== input && $io0(input); let errors; let $report; return input => {
                    if (false === __is(input)) {
                        errors = [];
                        $report = typia_1.default.validate.report(errors);
                        ((input, _path, _exceptionable = true) => ("object" === typeof input && null !== input || $report(true, {
                            path: _path + "",
                            expected: "inputType",
                            value: input
                        })) && $vo0(input, _path + "", true) || $report(true, {
                            path: _path + "",
                            expected: "inputType",
                            value: input
                        }))(input, "$input", true);
                        const success = 0 === errors.length;
                        return {
                            success,
                            errors,
                            data: success ? input : undefined
                        };
                    }
                    return {
                        success: true,
                        errors: [],
                        data: input
                    };
                }; })()(input))}`);
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
            const projectRepository = new GraphqlProjectRepository_1.GraphqlProjectRepository(...githubRepositoryParams);
            const apiV3IssueRepository = new ApiV3IssueRepository_1.ApiV3IssueRepository(...githubRepositoryParams);
            const internalGraphqlIssueRepository = new InternalGraphqlIssueRepository_1.InternalGraphqlIssueRepository(...githubRepositoryParams);
            const cheerioIssueRepository = new CheerioIssueRepository_1.CheerioIssueRepository(internalGraphqlIssueRepository, ...githubRepositoryParams);
            const restIssueRepository = new RestIssueRepository_1.RestIssueRepository(...githubRepositoryParams);
            const graphqlProjectItemRepository = new GraphqlProjectItemRepository_1.GraphqlProjectItemRepository(...githubRepositoryParams);
            const issueRepository = new ApiV3CheerioRestIssueRepository_1.ApiV3CheerioRestIssueRepository(apiV3IssueRepository, cheerioIssueRepository, restIssueRepository, graphqlProjectItemRepository, localStorageCacheRepository, ...githubRepositoryParams);
            const generateWorkingTimeReportUseCase = new GenerateWorkingTimeReportUseCase_1.GenerateWorkingTimeReportUseCase(issueRepository, googleSpreadsheetRepository, systemDateRepository);
            const actionAnnouncement = new ActionAnnouncementUseCase_1.ActionAnnouncementUseCase(issueRepository);
            const setWorkflowManagementIssueToStoryUseCase = new SetWorkflowManagementIssueToStoryUseCase_1.SetWorkflowManagementIssueToStoryUseCase(issueRepository);
            const clearNextActionHourUseCase = new ClearNextActionHourUseCase_1.ClearNextActionHourUseCase(issueRepository);
            const analyzeProblemByIssueUseCase = new AnalyzeProblemByIssueUseCase_1.AnalyzeProblemByIssueUseCase(issueRepository, systemDateRepository);
            const analyzeStoriesUseCase = new AnalyzeStoriesUseCase_1.AnalyzeStoriesUseCase(issueRepository, systemDateRepository);
            const clearDependedIssueURLUseCase = new ClearDependedIssueURLUseCase_1.ClearDependedIssueURLUseCase(issueRepository);
            const createEstimationIssueUseCase = new CreateEstimationIssueUseCase_1.CreateEstimationIssueUseCase(issueRepository, systemDateRepository);
            const convertCheckboxToIssueInStoryIssueUseCase = new ConvertCheckboxToIssueInStoryIssueUseCase_1.ConvertCheckboxToIssueInStoryIssueUseCase(issueRepository);
            const changeStatusLongInReviewIssueUseCase = new ChangeStatusLongInReviewIssueUseCase_1.ChangeStatusLongInReviewIssueUseCase(systemDateRepository, issueRepository);
            const changeStatusByStoryColorUseCase = new ChangeStatusByStoryColorUseCase_1.ChangeStatusByStoryColorUseCase(systemDateRepository, issueRepository);
            const setNoStoryIssueToStoryUseCase = new SetNoStoryIssueToStoryUseCase_1.SetNoStoryIssueToStoryUseCase(issueRepository);
            const handleScheduledEventUseCase = new HandleScheduledEventUseCase_1.HandleScheduledEventUseCase(generateWorkingTimeReportUseCase, actionAnnouncement, setWorkflowManagementIssueToStoryUseCase, clearNextActionHourUseCase, analyzeProblemByIssueUseCase, analyzeStoriesUseCase, clearDependedIssueURLUseCase, createEstimationIssueUseCase, convertCheckboxToIssueInStoryIssueUseCase, changeStatusLongInReviewIssueUseCase, changeStatusByStoryColorUseCase, setNoStoryIssueToStoryUseCase, systemDateRepository, googleSpreadsheetRepository, projectRepository, issueRepository);
            return await handleScheduledEventUseCase.run(input);
        };
    }
}
exports.HandleScheduledEventUseCaseHandler = HandleScheduledEventUseCaseHandler;
//# sourceMappingURL=HandleScheduledEventUseCaseHandler.js.map