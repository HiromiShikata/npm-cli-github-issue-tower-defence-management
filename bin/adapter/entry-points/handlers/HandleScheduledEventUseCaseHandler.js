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
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HandleScheduledEventUseCaseHandler = void 0;
const __typia_transform__validateReport = __importStar(require("typia/lib/internal/_validateReport"));
const yaml_1 = __importDefault(require("yaml"));
const typia_1 = __importDefault(require("typia"));
const fs_1 = __importDefault(require("fs"));
const situationFileWriter_1 = require("./situationFileWriter");
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
const CreateEstimationIssueUseCase_1 = require("../../../domain/usecases/CreateEstimationIssueUseCase");
const ConvertCheckboxToIssueInStoryIssueUseCase_1 = require("../../../domain/usecases/ConvertCheckboxToIssueInStoryIssueUseCase");
const ChangeStatusByStoryColorUseCase_1 = require("../../../domain/usecases/ChangeStatusByStoryColorUseCase");
const SetNoStoryIssueToStoryUseCase_1 = require("../../../domain/usecases/SetNoStoryIssueToStoryUseCase");
const CreateNewStoryByLabelUseCase_1 = require("../../../domain/usecases/CreateNewStoryByLabelUseCase");
const AssignNoAssigneeIssueToManagerUseCase_1 = require("../../../domain/usecases/AssignNoAssigneeIssueToManagerUseCase");
const UpdateIssueStatusByLabelUseCase_1 = require("../../../domain/usecases/UpdateIssueStatusByLabelUseCase");
const StartPreparationUseCase_1 = require("../../../domain/usecases/StartPreparationUseCase");
const NodeLocalCommandRunner_1 = require("../../repositories/NodeLocalCommandRunner");
const OauthAPIProxyClaudeRepository_1 = require("../../repositories/OauthAPIProxyClaudeRepository");
const ProxyClaudeTokenUsageRepository_1 = require("../../repositories/ProxyClaudeTokenUsageRepository");
const RevertOrphanedPreparationUseCase_1 = require("../../../domain/usecases/RevertOrphanedPreparationUseCase");
const RevertNotReadyAwaitingQualityCheckUseCase_1 = require("../../../domain/usecases/RevertNotReadyAwaitingQualityCheckUseCase");
const GitHubIssueCommentRepository_1 = require("../../repositories/GitHubIssueCommentRepository");
const SetupTowerDefenceProjectUseCase_1 = require("../../../domain/usecases/SetupTowerDefenceProjectUseCase");
const WorkflowStatus_1 = require("../../../domain/entities/WorkflowStatus");
class HandleScheduledEventUseCaseHandler {
    constructor() {
        this.handle = async (configFilePath, _verbose) => {
            const configFileContent = fs_1.default.readFileSync(configFilePath, 'utf8');
            const input = yaml_1.default.parse(configFileContent);
            if (!(() => { const _io0 = input => "string" === typeof input.projectName && "string" === typeof input.org && "string" === typeof input.projectUrl && "string" === typeof input.manager && ("object" === typeof input.workingReport && null !== input.workingReport && _io1(input.workingReport)) && "string" === typeof input.urlOfStoryView && "boolean" === typeof input.disabled && "number" === typeof input.allowIssueCacheMinutes && (null === input.startPreparation || undefined === input.startPreparation || "object" === typeof input.startPreparation && null !== input.startPreparation && _io2(input.startPreparation)) && (null === input.notifyFinishedPreparation || undefined === input.notifyFinishedPreparation || "object" === typeof input.notifyFinishedPreparation && null !== input.notifyFinishedPreparation && false === Array.isArray(input.notifyFinishedPreparation) && _io3(input.notifyFinishedPreparation)) && ("object" === typeof input.credentials && null !== input.credentials && _io4(input.credentials)); const _io1 = input => "string" === typeof input.repo && (Array.isArray(input.members) && input.members.every(elem => "string" === typeof elem)) && "string" === typeof input.spreadsheetUrl; const _io2 = input => "string" === typeof input.defaultAgentName && (null === input.defaultLlmModelName || undefined === input.defaultLlmModelName || "string" === typeof input.defaultLlmModelName) && (null === input.defaultLlmAgentName || undefined === input.defaultLlmAgentName || "string" === typeof input.defaultLlmAgentName) && "string" === typeof input.configFilePath && (null === input.maximumPreparingIssuesCount || "number" === typeof input.maximumPreparingIssuesCount) && (undefined === input.utilizationPercentageThreshold || "number" === typeof input.utilizationPercentageThreshold) && (null === input.allowedIssueAuthors || undefined === input.allowedIssueAuthors || Array.isArray(input.allowedIssueAuthors) && input.allowedIssueAuthors.every(elem => "string" === typeof elem)) && (undefined === input.preparationProcessCheckCommand || "string" === typeof input.preparationProcessCheckCommand) && (null === input.codexHomeCandidates || undefined === input.codexHomeCandidates || Array.isArray(input.codexHomeCandidates) && input.codexHomeCandidates.every(elem => "string" === typeof elem)) && (undefined === input.awLogDirectoryPath || "string" === typeof input.awLogDirectoryPath) && (undefined === input.awLogStaleThresholdMinutes || "number" === typeof input.awLogStaleThresholdMinutes) && (null === input.awaitingQualityCheckStatus || undefined === input.awaitingQualityCheckStatus || "string" === typeof input.awaitingQualityCheckStatus); const _io3 = input => null === input.awaitingQualityCheckStatusName || undefined === input.awaitingQualityCheckStatusName || "string" === typeof input.awaitingQualityCheckStatusName; const _io4 = input => "object" === typeof input.manager && null !== input.manager && _io5(input.manager) && ("object" === typeof input.bot && null !== input.bot && _io9(input.bot)); const _io5 = input => "object" === typeof input.github && null !== input.github && _io6(input.github) && ("object" === typeof input.slack && null !== input.slack && _io7(input.slack)) && ("object" === typeof input.googleServiceAccount && null !== input.googleServiceAccount && _io8(input.googleServiceAccount)); const _io6 = input => "string" === typeof input.token; const _io7 = input => "string" === typeof input.userToken; const _io8 = input => "string" === typeof input.serviceAccountKey; const _io9 = input => "object" === typeof input.github && null !== input.github && _io10(input.github); const _io10 = input => "string" === typeof input.token && (undefined === input.name || "string" === typeof input.name) && (undefined === input.password || "string" === typeof input.password) && (undefined === input.authenticatorKey || "string" === typeof input.authenticatorKey); return input => "object" === typeof input && null !== input && _io0(input); })()(input)) {
                throw new Error(`Invalid input: ${JSON.stringify(input)}\n\n${JSON.stringify((() => { const _io0 = input => "string" === typeof input.projectName && "string" === typeof input.org && "string" === typeof input.projectUrl && "string" === typeof input.manager && ("object" === typeof input.workingReport && null !== input.workingReport && _io1(input.workingReport)) && "string" === typeof input.urlOfStoryView && "boolean" === typeof input.disabled && "number" === typeof input.allowIssueCacheMinutes && (null === input.startPreparation || undefined === input.startPreparation || "object" === typeof input.startPreparation && null !== input.startPreparation && _io2(input.startPreparation)) && (null === input.notifyFinishedPreparation || undefined === input.notifyFinishedPreparation || "object" === typeof input.notifyFinishedPreparation && null !== input.notifyFinishedPreparation && false === Array.isArray(input.notifyFinishedPreparation) && _io3(input.notifyFinishedPreparation)) && ("object" === typeof input.credentials && null !== input.credentials && _io4(input.credentials)); const _io1 = input => "string" === typeof input.repo && (Array.isArray(input.members) && input.members.every(elem => "string" === typeof elem)) && "string" === typeof input.spreadsheetUrl; const _io2 = input => "string" === typeof input.defaultAgentName && (null === input.defaultLlmModelName || undefined === input.defaultLlmModelName || "string" === typeof input.defaultLlmModelName) && (null === input.defaultLlmAgentName || undefined === input.defaultLlmAgentName || "string" === typeof input.defaultLlmAgentName) && "string" === typeof input.configFilePath && (null === input.maximumPreparingIssuesCount || "number" === typeof input.maximumPreparingIssuesCount) && (undefined === input.utilizationPercentageThreshold || "number" === typeof input.utilizationPercentageThreshold) && (null === input.allowedIssueAuthors || undefined === input.allowedIssueAuthors || Array.isArray(input.allowedIssueAuthors) && input.allowedIssueAuthors.every(elem => "string" === typeof elem)) && (undefined === input.preparationProcessCheckCommand || "string" === typeof input.preparationProcessCheckCommand) && (null === input.codexHomeCandidates || undefined === input.codexHomeCandidates || Array.isArray(input.codexHomeCandidates) && input.codexHomeCandidates.every(elem => "string" === typeof elem)) && (undefined === input.awLogDirectoryPath || "string" === typeof input.awLogDirectoryPath) && (undefined === input.awLogStaleThresholdMinutes || "number" === typeof input.awLogStaleThresholdMinutes) && (null === input.awaitingQualityCheckStatus || undefined === input.awaitingQualityCheckStatus || "string" === typeof input.awaitingQualityCheckStatus); const _io3 = input => null === input.awaitingQualityCheckStatusName || undefined === input.awaitingQualityCheckStatusName || "string" === typeof input.awaitingQualityCheckStatusName; const _io4 = input => "object" === typeof input.manager && null !== input.manager && _io5(input.manager) && ("object" === typeof input.bot && null !== input.bot && _io9(input.bot)); const _io5 = input => "object" === typeof input.github && null !== input.github && _io6(input.github) && ("object" === typeof input.slack && null !== input.slack && _io7(input.slack)) && ("object" === typeof input.googleServiceAccount && null !== input.googleServiceAccount && _io8(input.googleServiceAccount)); const _io6 = input => "string" === typeof input.token; const _io7 = input => "string" === typeof input.userToken; const _io8 = input => "string" === typeof input.serviceAccountKey; const _io9 = input => "object" === typeof input.github && null !== input.github && _io10(input.github); const _io10 = input => "string" === typeof input.token && (undefined === input.name || "string" === typeof input.name) && (undefined === input.password || "string" === typeof input.password) && (undefined === input.authenticatorKey || "string" === typeof input.authenticatorKey); const _vo0 = (input, _path, _exceptionable = true) => ["string" === typeof input.projectName || _report(_exceptionable, {
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
                    }), "boolean" === typeof input.disabled || _report(_exceptionable, {
                        path: _path + ".disabled",
                        expected: "boolean",
                        value: input.disabled
                    }), "number" === typeof input.allowIssueCacheMinutes || _report(_exceptionable, {
                        path: _path + ".allowIssueCacheMinutes",
                        expected: "number",
                        value: input.allowIssueCacheMinutes
                    }), null === input.startPreparation || undefined === input.startPreparation || ("object" === typeof input.startPreparation && null !== input.startPreparation || _report(_exceptionable, {
                        path: _path + ".startPreparation",
                        expected: "(__type.o1 | null | undefined)",
                        value: input.startPreparation
                    })) && _vo2(input.startPreparation, _path + ".startPreparation", true && _exceptionable) || _report(_exceptionable, {
                        path: _path + ".startPreparation",
                        expected: "(__type.o1 | null | undefined)",
                        value: input.startPreparation
                    }), null === input.notifyFinishedPreparation || undefined === input.notifyFinishedPreparation || ("object" === typeof input.notifyFinishedPreparation && null !== input.notifyFinishedPreparation && false === Array.isArray(input.notifyFinishedPreparation) || _report(_exceptionable, {
                        path: _path + ".notifyFinishedPreparation",
                        expected: "(__type.o2 | null | undefined)",
                        value: input.notifyFinishedPreparation
                    })) && _vo3(input.notifyFinishedPreparation, _path + ".notifyFinishedPreparation", true && _exceptionable) || _report(_exceptionable, {
                        path: _path + ".notifyFinishedPreparation",
                        expected: "(__type.o2 | null | undefined)",
                        value: input.notifyFinishedPreparation
                    }), ("object" === typeof input.credentials && null !== input.credentials || _report(_exceptionable, {
                        path: _path + ".credentials",
                        expected: "__type.o3",
                        value: input.credentials
                    })) && _vo4(input.credentials, _path + ".credentials", true && _exceptionable) || _report(_exceptionable, {
                        path: _path + ".credentials",
                        expected: "__type.o3",
                        value: input.credentials
                    })].every(flag => flag); const _vo1 = (input, _path, _exceptionable = true) => ["string" === typeof input.repo || _report(_exceptionable, {
                        path: _path + ".repo",
                        expected: "string",
                        value: input.repo
                    }), (Array.isArray(input.members) || _report(_exceptionable, {
                        path: _path + ".members",
                        expected: "Array<string>",
                        value: input.members
                    })) && input.members.map((elem, _index4) => "string" === typeof elem || _report(_exceptionable, {
                        path: _path + ".members[" + _index4 + "]",
                        expected: "string",
                        value: elem
                    })).every(flag => flag) || _report(_exceptionable, {
                        path: _path + ".members",
                        expected: "Array<string>",
                        value: input.members
                    }), "string" === typeof input.spreadsheetUrl || _report(_exceptionable, {
                        path: _path + ".spreadsheetUrl",
                        expected: "string",
                        value: input.spreadsheetUrl
                    })].every(flag => flag); const _vo2 = (input, _path, _exceptionable = true) => ["string" === typeof input.defaultAgentName || _report(_exceptionable, {
                        path: _path + ".defaultAgentName",
                        expected: "string",
                        value: input.defaultAgentName
                    }), null === input.defaultLlmModelName || undefined === input.defaultLlmModelName || "string" === typeof input.defaultLlmModelName || _report(_exceptionable, {
                        path: _path + ".defaultLlmModelName",
                        expected: "(null | string | undefined)",
                        value: input.defaultLlmModelName
                    }), null === input.defaultLlmAgentName || undefined === input.defaultLlmAgentName || "string" === typeof input.defaultLlmAgentName || _report(_exceptionable, {
                        path: _path + ".defaultLlmAgentName",
                        expected: "(null | string | undefined)",
                        value: input.defaultLlmAgentName
                    }), "string" === typeof input.configFilePath || _report(_exceptionable, {
                        path: _path + ".configFilePath",
                        expected: "string",
                        value: input.configFilePath
                    }), null === input.maximumPreparingIssuesCount || "number" === typeof input.maximumPreparingIssuesCount || _report(_exceptionable, {
                        path: _path + ".maximumPreparingIssuesCount",
                        expected: "(null | number)",
                        value: input.maximumPreparingIssuesCount
                    }), undefined === input.utilizationPercentageThreshold || "number" === typeof input.utilizationPercentageThreshold || _report(_exceptionable, {
                        path: _path + ".utilizationPercentageThreshold",
                        expected: "(number | undefined)",
                        value: input.utilizationPercentageThreshold
                    }), null === input.allowedIssueAuthors || undefined === input.allowedIssueAuthors || (Array.isArray(input.allowedIssueAuthors) || _report(_exceptionable, {
                        path: _path + ".allowedIssueAuthors",
                        expected: "(Array<string> | null | undefined)",
                        value: input.allowedIssueAuthors
                    })) && input.allowedIssueAuthors.map((elem, _index5) => "string" === typeof elem || _report(_exceptionable, {
                        path: _path + ".allowedIssueAuthors[" + _index5 + "]",
                        expected: "string",
                        value: elem
                    })).every(flag => flag) || _report(_exceptionable, {
                        path: _path + ".allowedIssueAuthors",
                        expected: "(Array<string> | null | undefined)",
                        value: input.allowedIssueAuthors
                    }), undefined === input.preparationProcessCheckCommand || "string" === typeof input.preparationProcessCheckCommand || _report(_exceptionable, {
                        path: _path + ".preparationProcessCheckCommand",
                        expected: "(string | undefined)",
                        value: input.preparationProcessCheckCommand
                    }), null === input.codexHomeCandidates || undefined === input.codexHomeCandidates || (Array.isArray(input.codexHomeCandidates) || _report(_exceptionable, {
                        path: _path + ".codexHomeCandidates",
                        expected: "(Array<string> | null | undefined)",
                        value: input.codexHomeCandidates
                    })) && input.codexHomeCandidates.map((elem, _index6) => "string" === typeof elem || _report(_exceptionable, {
                        path: _path + ".codexHomeCandidates[" + _index6 + "]",
                        expected: "string",
                        value: elem
                    })).every(flag => flag) || _report(_exceptionable, {
                        path: _path + ".codexHomeCandidates",
                        expected: "(Array<string> | null | undefined)",
                        value: input.codexHomeCandidates
                    }), undefined === input.awLogDirectoryPath || "string" === typeof input.awLogDirectoryPath || _report(_exceptionable, {
                        path: _path + ".awLogDirectoryPath",
                        expected: "(string | undefined)",
                        value: input.awLogDirectoryPath
                    }), undefined === input.awLogStaleThresholdMinutes || "number" === typeof input.awLogStaleThresholdMinutes || _report(_exceptionable, {
                        path: _path + ".awLogStaleThresholdMinutes",
                        expected: "(number | undefined)",
                        value: input.awLogStaleThresholdMinutes
                    }), null === input.awaitingQualityCheckStatus || undefined === input.awaitingQualityCheckStatus || "string" === typeof input.awaitingQualityCheckStatus || _report(_exceptionable, {
                        path: _path + ".awaitingQualityCheckStatus",
                        expected: "(null | string | undefined)",
                        value: input.awaitingQualityCheckStatus
                    })].every(flag => flag); const _vo3 = (input, _path, _exceptionable = true) => [null === input.awaitingQualityCheckStatusName || undefined === input.awaitingQualityCheckStatusName || "string" === typeof input.awaitingQualityCheckStatusName || _report(_exceptionable, {
                        path: _path + ".awaitingQualityCheckStatusName",
                        expected: "(null | string | undefined)",
                        value: input.awaitingQualityCheckStatusName
                    })].every(flag => flag); const _vo4 = (input, _path, _exceptionable = true) => [("object" === typeof input.manager && null !== input.manager || _report(_exceptionable, {
                        path: _path + ".manager",
                        expected: "__type.o4",
                        value: input.manager
                    })) && _vo5(input.manager, _path + ".manager", true && _exceptionable) || _report(_exceptionable, {
                        path: _path + ".manager",
                        expected: "__type.o4",
                        value: input.manager
                    }), ("object" === typeof input.bot && null !== input.bot || _report(_exceptionable, {
                        path: _path + ".bot",
                        expected: "__type.o8",
                        value: input.bot
                    })) && _vo9(input.bot, _path + ".bot", true && _exceptionable) || _report(_exceptionable, {
                        path: _path + ".bot",
                        expected: "__type.o8",
                        value: input.bot
                    })].every(flag => flag); const _vo5 = (input, _path, _exceptionable = true) => [("object" === typeof input.github && null !== input.github || _report(_exceptionable, {
                        path: _path + ".github",
                        expected: "__type.o5",
                        value: input.github
                    })) && _vo6(input.github, _path + ".github", true && _exceptionable) || _report(_exceptionable, {
                        path: _path + ".github",
                        expected: "__type.o5",
                        value: input.github
                    }), ("object" === typeof input.slack && null !== input.slack || _report(_exceptionable, {
                        path: _path + ".slack",
                        expected: "__type.o6",
                        value: input.slack
                    })) && _vo7(input.slack, _path + ".slack", true && _exceptionable) || _report(_exceptionable, {
                        path: _path + ".slack",
                        expected: "__type.o6",
                        value: input.slack
                    }), ("object" === typeof input.googleServiceAccount && null !== input.googleServiceAccount || _report(_exceptionable, {
                        path: _path + ".googleServiceAccount",
                        expected: "__type.o7",
                        value: input.googleServiceAccount
                    })) && _vo8(input.googleServiceAccount, _path + ".googleServiceAccount", true && _exceptionable) || _report(_exceptionable, {
                        path: _path + ".googleServiceAccount",
                        expected: "__type.o7",
                        value: input.googleServiceAccount
                    })].every(flag => flag); const _vo6 = (input, _path, _exceptionable = true) => ["string" === typeof input.token || _report(_exceptionable, {
                        path: _path + ".token",
                        expected: "string",
                        value: input.token
                    })].every(flag => flag); const _vo7 = (input, _path, _exceptionable = true) => ["string" === typeof input.userToken || _report(_exceptionable, {
                        path: _path + ".userToken",
                        expected: "string",
                        value: input.userToken
                    })].every(flag => flag); const _vo8 = (input, _path, _exceptionable = true) => ["string" === typeof input.serviceAccountKey || _report(_exceptionable, {
                        path: _path + ".serviceAccountKey",
                        expected: "string",
                        value: input.serviceAccountKey
                    })].every(flag => flag); const _vo9 = (input, _path, _exceptionable = true) => [("object" === typeof input.github && null !== input.github || _report(_exceptionable, {
                        path: _path + ".github",
                        expected: "__type.o9",
                        value: input.github
                    })) && _vo10(input.github, _path + ".github", true && _exceptionable) || _report(_exceptionable, {
                        path: _path + ".github",
                        expected: "__type.o9",
                        value: input.github
                    })].every(flag => flag); const _vo10 = (input, _path, _exceptionable = true) => ["string" === typeof input.token || _report(_exceptionable, {
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
            if (input.disabled) {
                return null;
            }
            const managerToken = input.credentials.manager.github.token;
            const readme = await (0, projectConfig_1.fetchProjectReadme)(input.projectUrl, managerToken);
            const readmeConfig = readme ? (0, projectConfig_1.parseProjectReadmeConfig)(readme) : {};
            const mergedInput = {
                ...input,
                allowIssueCacheMinutes: readmeConfig.allowIssueCacheMinutes ?? input.allowIssueCacheMinutes,
                startPreparation: input.startPreparation
                    ? {
                        ...input.startPreparation,
                        defaultAgentName: readmeConfig.defaultAgentName ??
                            input.startPreparation.defaultAgentName,
                        defaultLlmModelName: readmeConfig.defaultLlmModelName ??
                            input.startPreparation.defaultLlmModelName,
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
            const restIssueRepository = new RestIssueRepository_1.RestIssueRepository(...githubRepositoryParams);
            const graphqlProjectItemRepository = new GraphqlProjectItemRepository_1.GraphqlProjectItemRepository(...githubRepositoryParams);
            const issueRepository = new ApiV3CheerioRestIssueRepository_1.ApiV3CheerioRestIssueRepository(apiV3IssueRepository, restIssueRepository, graphqlProjectItemRepository, localStorageCacheRepository, ...githubRepositoryParams);
            const setupTowerDefenceProjectUseCase = new SetupTowerDefenceProjectUseCase_1.SetupTowerDefenceProjectUseCase(projectRepository);
            const actionAnnouncement = new ActionAnnouncementUseCase_1.ActionAnnouncementUseCase(issueRepository);
            const setWorkflowManagementIssueToStoryUseCase = new SetWorkflowManagementIssueToStoryUseCase_1.SetWorkflowManagementIssueToStoryUseCase(issueRepository);
            const clearPastNextActionUseCase = new ClearPastNextActionDateHourUseCase_1.ClearPastNextActionDateHourUseCase(issueRepository);
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
            const claudeRepository = new OauthAPIProxyClaudeRepository_1.OauthAPIProxyClaudeRepository();
            const claudeTokenUsageRepository = new ProxyClaudeTokenUsageRepository_1.ProxyClaudeTokenUsageRepository(null);
            const startPreparationUseCase = new StartPreparationUseCase_1.StartPreparationUseCase(projectRepository, issueRepository, claudeRepository, nodeLocalCommandRunner, claudeTokenUsageRepository);
            const issueCommentRepository = new GitHubIssueCommentRepository_1.GitHubIssueCommentRepository(input.credentials.bot.github.token);
            const revertOrphanedPreparationUseCase = new RevertOrphanedPreparationUseCase_1.RevertOrphanedPreparationUseCase(projectRepository, issueRepository, issueCommentRepository, nodeLocalCommandRunner);
            const revertNotReadyAwaitingQualityCheckUseCase = new RevertNotReadyAwaitingQualityCheckUseCase_1.RevertNotReadyAwaitingQualityCheckUseCase(projectRepository, issueRepository, issueCommentRepository);
            const handleScheduledEventUseCase = new HandleScheduledEventUseCase_1.HandleScheduledEventUseCase(setupTowerDefenceProjectUseCase, actionAnnouncement, setWorkflowManagementIssueToStoryUseCase, clearPastNextActionUseCase, analyzeProblemByIssueUseCase, analyzeStoriesUseCase, clearDependedIssueURLUseCase, createEstimationIssueUseCase, convertCheckboxToIssueInStoryIssueUseCase, changeStatusByStoryColorUseCase, setNoStoryIssueToStoryUseCase, createNewStoryByLabel, assignNoAssigneeIssueToManagerUseCase, updateIssueStatusByLabelUseCase, startPreparationUseCase, revertOrphanedPreparationUseCase, revertNotReadyAwaitingQualityCheckUseCase, systemDateRepository, googleSpreadsheetRepository, projectRepository, issueRepository);
            const result = await handleScheduledEventUseCase.run(mergedInput);
            if (result) {
                await (0, situationFileWriter_1.writeSituationFile)({
                    cachePath,
                    projectId: result.project.id,
                    issues: result.issues,
                    statusNames: {
                        awaitingQualityCheckStatus: WorkflowStatus_1.AWAITING_QUALITY_CHECK_STATUS_NAME,
                        preparationStatus: WorkflowStatus_1.PREPARATION_STATUS_NAME,
                        awaitingWorkspaceStatus: WorkflowStatus_1.AWAITING_WORKSPACE_STATUS_NAME,
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