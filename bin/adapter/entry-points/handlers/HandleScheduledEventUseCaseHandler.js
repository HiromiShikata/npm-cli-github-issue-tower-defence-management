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
exports.HandleScheduledEventUseCaseHandler = void 0;
const __typia_transform__validateReport = __importStar(require("typia/lib/internal/_validateReport.js"));
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
const CreateNewStoryByLabelUseCase_1 = require("../../../domain/usecases/CreateNewStoryByLabelUseCase");
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
            if (!(() => { const _io0 = input => "string" === typeof input.projectName && "string" === typeof input.org && "string" === typeof input.projectUrl && "string" === typeof input.manager && ("object" === typeof input.workingReport && null !== input.workingReport && _io1(input.workingReport)) && "string" === typeof input.urlOfStoryView && "string" === typeof input.disabledStatus && ("object" === typeof input.credentials && null !== input.credentials && _io2(input.credentials)); const _io1 = input => "string" === typeof input.repo && (Array.isArray(input.members) && input.members.every(elem => "string" === typeof elem)) && (undefined === input.warningThresholdHour || "number" === typeof input.warningThresholdHour) && "string" === typeof input.spreadsheetUrl && (undefined === input.reportIssueTemplate || "string" === typeof input.reportIssueTemplate) && (Array.isArray(input.reportIssueLabels) && input.reportIssueLabels.every(elem => "string" === typeof elem)); const _io2 = input => "object" === typeof input.manager && null !== input.manager && _io3(input.manager) && ("object" === typeof input.bot && null !== input.bot && _io7(input.bot)); const _io3 = input => "object" === typeof input.github && null !== input.github && _io4(input.github) && ("object" === typeof input.slack && null !== input.slack && _io5(input.slack)) && ("object" === typeof input.googleServiceAccount && null !== input.googleServiceAccount && _io6(input.googleServiceAccount)); const _io4 = input => "string" === typeof input.token; const _io5 = input => "string" === typeof input.userToken; const _io6 = input => "string" === typeof input.serviceAccountKey; const _io7 = input => "object" === typeof input.github && null !== input.github && _io8(input.github); const _io8 = input => "string" === typeof input.token && "string" === typeof input.name && "string" === typeof input.password && "string" === typeof input.authenticatorKey; return input => "object" === typeof input && null !== input && _io0(input); })()(input)) {
                throw new Error(`Invalid input: ${JSON.stringify(input)}\n\n${JSON.stringify((() => { const _io0 = input => "string" === typeof input.projectName && "string" === typeof input.org && "string" === typeof input.projectUrl && "string" === typeof input.manager && ("object" === typeof input.workingReport && null !== input.workingReport && _io1(input.workingReport)) && "string" === typeof input.urlOfStoryView && "string" === typeof input.disabledStatus && ("object" === typeof input.credentials && null !== input.credentials && _io2(input.credentials)); const _io1 = input => "string" === typeof input.repo && (Array.isArray(input.members) && input.members.every(elem => "string" === typeof elem)) && (undefined === input.warningThresholdHour || "number" === typeof input.warningThresholdHour) && "string" === typeof input.spreadsheetUrl && (undefined === input.reportIssueTemplate || "string" === typeof input.reportIssueTemplate) && (Array.isArray(input.reportIssueLabels) && input.reportIssueLabels.every(elem => "string" === typeof elem)); const _io2 = input => "object" === typeof input.manager && null !== input.manager && _io3(input.manager) && ("object" === typeof input.bot && null !== input.bot && _io7(input.bot)); const _io3 = input => "object" === typeof input.github && null !== input.github && _io4(input.github) && ("object" === typeof input.slack && null !== input.slack && _io5(input.slack)) && ("object" === typeof input.googleServiceAccount && null !== input.googleServiceAccount && _io6(input.googleServiceAccount)); const _io4 = input => "string" === typeof input.token; const _io5 = input => "string" === typeof input.userToken; const _io6 = input => "string" === typeof input.serviceAccountKey; const _io7 = input => "object" === typeof input.github && null !== input.github && _io8(input.github); const _io8 = input => "string" === typeof input.token && "string" === typeof input.name && "string" === typeof input.password && "string" === typeof input.authenticatorKey; const _vo0 = (input, _path, _exceptionable = true) => ["string" === typeof input.projectName || _report(_exceptionable, {
                        path: _path + ".projectName",
                        expected: "string",
                        value: input.projectName
                    }), "string" === typeof input.org || _report(_exceptionable, {
                        path: _path + ".org",
                        expected: "string",
                        value: input.org
                    }), "string" === typeof input.projectUrl || _report(_exceptionable, {
                        path: _path + ".projectUrl",
                        expected: "string",
                        value: input.projectUrl
                    }), "string" === typeof input.manager || _report(_exceptionable, {
                        path: _path + ".manager",
                        expected: "string",
                        value: input.manager
                    }), ("object" === typeof input.workingReport && null !== input.workingReport || _report(_exceptionable, {
                        path: _path + ".workingReport",
                        expected: "__type",
                        value: input.workingReport
                    })) && _vo1(input.workingReport, _path + ".workingReport", true && _exceptionable) || _report(_exceptionable, {
                        path: _path + ".workingReport",
                        expected: "__type",
                        value: input.workingReport
                    }), "string" === typeof input.urlOfStoryView || _report(_exceptionable, {
                        path: _path + ".urlOfStoryView",
                        expected: "string",
                        value: input.urlOfStoryView
                    }), "string" === typeof input.disabledStatus || _report(_exceptionable, {
                        path: _path + ".disabledStatus",
                        expected: "string",
                        value: input.disabledStatus
                    }), ("object" === typeof input.credentials && null !== input.credentials || _report(_exceptionable, {
                        path: _path + ".credentials",
                        expected: "__type.o1",
                        value: input.credentials
                    })) && _vo2(input.credentials, _path + ".credentials", true && _exceptionable) || _report(_exceptionable, {
                        path: _path + ".credentials",
                        expected: "__type.o1",
                        value: input.credentials
                    })].every(flag => flag); const _vo1 = (input, _path, _exceptionable = true) => ["string" === typeof input.repo || _report(_exceptionable, {
                        path: _path + ".repo",
                        expected: "string",
                        value: input.repo
                    }), (Array.isArray(input.members) || _report(_exceptionable, {
                        path: _path + ".members",
                        expected: "Array<string>",
                        value: input.members
                    })) && input.members.map((elem, _index3) => "string" === typeof elem || _report(_exceptionable, {
                        path: _path + ".members[" + _index3 + "]",
                        expected: "string",
                        value: elem
                    })).every(flag => flag) || _report(_exceptionable, {
                        path: _path + ".members",
                        expected: "Array<string>",
                        value: input.members
                    }), undefined === input.warningThresholdHour || "number" === typeof input.warningThresholdHour || _report(_exceptionable, {
                        path: _path + ".warningThresholdHour",
                        expected: "(number | undefined)",
                        value: input.warningThresholdHour
                    }), "string" === typeof input.spreadsheetUrl || _report(_exceptionable, {
                        path: _path + ".spreadsheetUrl",
                        expected: "string",
                        value: input.spreadsheetUrl
                    }), undefined === input.reportIssueTemplate || "string" === typeof input.reportIssueTemplate || _report(_exceptionable, {
                        path: _path + ".reportIssueTemplate",
                        expected: "(string | undefined)",
                        value: input.reportIssueTemplate
                    }), (Array.isArray(input.reportIssueLabels) || _report(_exceptionable, {
                        path: _path + ".reportIssueLabels",
                        expected: "Array<string>",
                        value: input.reportIssueLabels
                    })) && input.reportIssueLabels.map((elem, _index4) => "string" === typeof elem || _report(_exceptionable, {
                        path: _path + ".reportIssueLabels[" + _index4 + "]",
                        expected: "string",
                        value: elem
                    })).every(flag => flag) || _report(_exceptionable, {
                        path: _path + ".reportIssueLabels",
                        expected: "Array<string>",
                        value: input.reportIssueLabels
                    })].every(flag => flag); const _vo2 = (input, _path, _exceptionable = true) => [("object" === typeof input.manager && null !== input.manager || _report(_exceptionable, {
                        path: _path + ".manager",
                        expected: "__type.o2",
                        value: input.manager
                    })) && _vo3(input.manager, _path + ".manager", true && _exceptionable) || _report(_exceptionable, {
                        path: _path + ".manager",
                        expected: "__type.o2",
                        value: input.manager
                    }), ("object" === typeof input.bot && null !== input.bot || _report(_exceptionable, {
                        path: _path + ".bot",
                        expected: "__type.o6",
                        value: input.bot
                    })) && _vo7(input.bot, _path + ".bot", true && _exceptionable) || _report(_exceptionable, {
                        path: _path + ".bot",
                        expected: "__type.o6",
                        value: input.bot
                    })].every(flag => flag); const _vo3 = (input, _path, _exceptionable = true) => [("object" === typeof input.github && null !== input.github || _report(_exceptionable, {
                        path: _path + ".github",
                        expected: "__type.o3",
                        value: input.github
                    })) && _vo4(input.github, _path + ".github", true && _exceptionable) || _report(_exceptionable, {
                        path: _path + ".github",
                        expected: "__type.o3",
                        value: input.github
                    }), ("object" === typeof input.slack && null !== input.slack || _report(_exceptionable, {
                        path: _path + ".slack",
                        expected: "__type.o4",
                        value: input.slack
                    })) && _vo5(input.slack, _path + ".slack", true && _exceptionable) || _report(_exceptionable, {
                        path: _path + ".slack",
                        expected: "__type.o4",
                        value: input.slack
                    }), ("object" === typeof input.googleServiceAccount && null !== input.googleServiceAccount || _report(_exceptionable, {
                        path: _path + ".googleServiceAccount",
                        expected: "__type.o5",
                        value: input.googleServiceAccount
                    })) && _vo6(input.googleServiceAccount, _path + ".googleServiceAccount", true && _exceptionable) || _report(_exceptionable, {
                        path: _path + ".googleServiceAccount",
                        expected: "__type.o5",
                        value: input.googleServiceAccount
                    })].every(flag => flag); const _vo4 = (input, _path, _exceptionable = true) => ["string" === typeof input.token || _report(_exceptionable, {
                        path: _path + ".token",
                        expected: "string",
                        value: input.token
                    })].every(flag => flag); const _vo5 = (input, _path, _exceptionable = true) => ["string" === typeof input.userToken || _report(_exceptionable, {
                        path: _path + ".userToken",
                        expected: "string",
                        value: input.userToken
                    })].every(flag => flag); const _vo6 = (input, _path, _exceptionable = true) => ["string" === typeof input.serviceAccountKey || _report(_exceptionable, {
                        path: _path + ".serviceAccountKey",
                        expected: "string",
                        value: input.serviceAccountKey
                    })].every(flag => flag); const _vo7 = (input, _path, _exceptionable = true) => [("object" === typeof input.github && null !== input.github || _report(_exceptionable, {
                        path: _path + ".github",
                        expected: "__type.o7",
                        value: input.github
                    })) && _vo8(input.github, _path + ".github", true && _exceptionable) || _report(_exceptionable, {
                        path: _path + ".github",
                        expected: "__type.o7",
                        value: input.github
                    })].every(flag => flag); const _vo8 = (input, _path, _exceptionable = true) => ["string" === typeof input.token || _report(_exceptionable, {
                        path: _path + ".token",
                        expected: "string",
                        value: input.token
                    }), "string" === typeof input.name || _report(_exceptionable, {
                        path: _path + ".name",
                        expected: "string",
                        value: input.name
                    }), "string" === typeof input.password || _report(_exceptionable, {
                        path: _path + ".password",
                        expected: "string",
                        value: input.password
                    }), "string" === typeof input.authenticatorKey || _report(_exceptionable, {
                        path: _path + ".authenticatorKey",
                        expected: "string",
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
            const createNewStoryByLabel = new CreateNewStoryByLabelUseCase_1.CreateNewStoryByLabelUseCase(projectRepository, issueRepository);
            const handleScheduledEventUseCase = new HandleScheduledEventUseCase_1.HandleScheduledEventUseCase(generateWorkingTimeReportUseCase, actionAnnouncement, setWorkflowManagementIssueToStoryUseCase, clearNextActionHourUseCase, analyzeProblemByIssueUseCase, analyzeStoriesUseCase, clearDependedIssueURLUseCase, createEstimationIssueUseCase, convertCheckboxToIssueInStoryIssueUseCase, changeStatusLongInReviewIssueUseCase, changeStatusByStoryColorUseCase, setNoStoryIssueToStoryUseCase, createNewStoryByLabel, systemDateRepository, googleSpreadsheetRepository, projectRepository, issueRepository);
            return await handleScheduledEventUseCase.run(input);
        };
    }
}
exports.HandleScheduledEventUseCaseHandler = HandleScheduledEventUseCaseHandler;
//# sourceMappingURL=HandleScheduledEventUseCaseHandler.js.map