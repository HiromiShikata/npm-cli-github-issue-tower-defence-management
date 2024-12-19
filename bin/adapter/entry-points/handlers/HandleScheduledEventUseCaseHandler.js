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
class HandleScheduledEventUseCaseHandler {
    constructor() {
        this.handle = async (configFilePath) => {
            const configFileContent = fs_1.default.readFileSync(configFilePath, 'utf8');
            const input = yaml_1.default.parse(configFileContent);
            if (!(() => { const $io0 = input => "string" === typeof input.org && "string" === typeof input.projectUrl && "string" === typeof input.manager && ("object" === typeof input.workingReport && null !== input.workingReport && $io1(input.workingReport)); const $io1 = input => "string" === typeof input.repo && (Array.isArray(input.members) && input.members.every(elem => "string" === typeof elem)) && (undefined === input.warningThresholdHour || "number" === typeof input.warningThresholdHour) && "string" === typeof input.spreadsheetUrl && (undefined === input.reportIssueTemplate || "string" === typeof input.reportIssueTemplate) && (Array.isArray(input.reportIssueLabels) && input.reportIssueLabels.every(elem => "string" === typeof elem)); return input => "object" === typeof input && null !== input && $io0(input); })()(input)) {
                throw new Error(`Invalid input: ${JSON.stringify(input)}\n\n${JSON.stringify((() => { const $io0 = input => "string" === typeof input.org && "string" === typeof input.projectUrl && "string" === typeof input.manager && ("object" === typeof input.workingReport && null !== input.workingReport && $io1(input.workingReport)); const $io1 = input => "string" === typeof input.repo && (Array.isArray(input.members) && input.members.every(elem => "string" === typeof elem)) && (undefined === input.warningThresholdHour || "number" === typeof input.warningThresholdHour) && "string" === typeof input.spreadsheetUrl && (undefined === input.reportIssueTemplate || "string" === typeof input.reportIssueTemplate) && (Array.isArray(input.reportIssueLabels) && input.reportIssueLabels.every(elem => "string" === typeof elem)); const $vo0 = (input, _path, _exceptionable = true) => ["string" === typeof input.org || $report(_exceptionable, {
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
                        expected: "__type.o1",
                        value: input.workingReport
                    })) && $vo1(input.workingReport, _path + ".workingReport", true && _exceptionable) || $report(_exceptionable, {
                        path: _path + ".workingReport",
                        expected: "__type.o1",
                        value: input.workingReport
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
                    })].every(flag => flag); const __is = input => "object" === typeof input && null !== input && $io0(input); let errors; let $report; return input => {
                    if (false === __is(input)) {
                        errors = [];
                        $report = typia_1.default.validate.report(errors);
                        ((input, _path, _exceptionable = true) => ("object" === typeof input && null !== input || $report(true, {
                            path: _path + "",
                            expected: "__type",
                            value: input
                        })) && $vo0(input, _path + "", true) || $report(true, {
                            path: _path + "",
                            expected: "__type",
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
            const googleSpreadsheetRepository = new GoogleSpreadsheetRepository_1.GoogleSpreadsheetRepository(localStorageRepository);
            const localStorageCacheRepository = new LocalStorageCacheRepository_1.LocalStorageCacheRepository(localStorageRepository);
            const projectRepository = new GraphqlProjectRepository_1.GraphqlProjectRepository();
            const apiV3IssueRepository = new ApiV3IssueRepository_1.ApiV3IssueRepository();
            const internalGraphqlIssueRepository = new InternalGraphqlIssueRepository_1.InternalGraphqlIssueRepository();
            const cheerioIssueRepository = new CheerioIssueRepository_1.CheerioIssueRepository(internalGraphqlIssueRepository);
            const restIssueRepository = new RestIssueRepository_1.RestIssueRepository();
            const graphqlProjectItemRepository = new GraphqlProjectItemRepository_1.GraphqlProjectItemRepository();
            const issueRepository = new ApiV3CheerioRestIssueRepository_1.ApiV3CheerioRestIssueRepository(apiV3IssueRepository, cheerioIssueRepository, restIssueRepository, graphqlProjectItemRepository, localStorageCacheRepository);
            const generateWorkingTimeReportUseCase = new GenerateWorkingTimeReportUseCase_1.GenerateWorkingTimeReportUseCase(issueRepository, googleSpreadsheetRepository, systemDateRepository);
            const actionAnnouncement = new ActionAnnouncementUseCase_1.ActionAnnouncementUseCase(issueRepository);
            const setWorkflowManagementIssueToStoryUseCase = new SetWorkflowManagementIssueToStoryUseCase_1.SetWorkflowManagementIssueToStoryUseCase(issueRepository);
            const clearNextActionHourUseCase = new ClearNextActionHourUseCase_1.ClearNextActionHourUseCase(issueRepository);
            const analyzeProblemByIssueUseCase = new AnalyzeProblemByIssueUseCase_1.AnalyzeProblemByIssueUseCase(issueRepository, systemDateRepository);
            const handleScheduledEventUseCase = new HandleScheduledEventUseCase_1.HandleScheduledEventUseCase(generateWorkingTimeReportUseCase, actionAnnouncement, setWorkflowManagementIssueToStoryUseCase, clearNextActionHourUseCase, analyzeProblemByIssueUseCase, systemDateRepository, googleSpreadsheetRepository, projectRepository, issueRepository);
            return await handleScheduledEventUseCase.run(input);
        };
    }
}
exports.HandleScheduledEventUseCaseHandler = HandleScheduledEventUseCaseHandler;
//# sourceMappingURL=HandleScheduledEventUseCaseHandler.js.map