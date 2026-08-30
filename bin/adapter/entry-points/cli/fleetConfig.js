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
exports.loadWorkflowImprovementIssueUrl = exports.loadStartPreparationFleetSettings = exports.loadPreparationWorkerSettings = exports.loadLiveSessionOauthTokenSelectionSettings = exports.resolveFleetConfigFilePath = exports.DEFAULT_START_PREPARATION_FLEET_SETTINGS = exports.DEFAULT_PREPARATION_WORKER_SETTINGS = exports.DEFAULT_GRAPHQL_RATE_LIMIT_FLOOR = exports.DEFAULT_MAX_CONCURRENT_WORKERS = exports.DEFAULT_FLEET_MAXIMUM_PREPARING_ISSUES_COUNT = exports.WORKFLOW_IMPROVEMENT_ISSUE_URL_KEY = exports.START_PREPARATION_SECTION_KEY = exports.PREPARATION_WORKER_SECTION_KEY = exports.LIVE_SESSION_OAUTH_TOKEN_SELECTION_SECTION_KEY = exports.FLEET_CONFIG_FILE_PATH_ENVIRONMENT_VARIABLE = void 0;
const fs = __importStar(require("fs"));
const yaml_1 = __importDefault(require("yaml"));
const LiveSessionOauthTokenSelectUseCase_1 = require("../../../domain/usecases/LiveSessionOauthTokenSelectUseCase");
const StartPreparationUseCase_1 = require("../../../domain/usecases/StartPreparationUseCase");
exports.FLEET_CONFIG_FILE_PATH_ENVIRONMENT_VARIABLE = 'TDPM_FLEET_CONFIG';
exports.LIVE_SESSION_OAUTH_TOKEN_SELECTION_SECTION_KEY = 'liveSessionOauthTokenSelection';
exports.PREPARATION_WORKER_SECTION_KEY = 'preparationWorker';
exports.START_PREPARATION_SECTION_KEY = 'startPreparation';
exports.WORKFLOW_IMPROVEMENT_ISSUE_URL_KEY = 'workflowImprovementIssueUrl';
exports.DEFAULT_FLEET_MAXIMUM_PREPARING_ISSUES_COUNT = 80;
exports.DEFAULT_MAX_CONCURRENT_WORKERS = 40;
exports.DEFAULT_GRAPHQL_RATE_LIMIT_FLOOR = 500;
exports.DEFAULT_PREPARATION_WORKER_SETTINGS = {
    normalConcurrentLimit: StartPreparationUseCase_1.NORMAL_CONCURRENT_LIMIT,
    maxConcurrentWorkers: exports.DEFAULT_MAX_CONCURRENT_WORKERS,
    graphqlRateLimitFloor: exports.DEFAULT_GRAPHQL_RATE_LIMIT_FLOOR,
};
exports.DEFAULT_START_PREPARATION_FLEET_SETTINGS = {
    maximumPreparingIssuesCount: exports.DEFAULT_FLEET_MAXIMUM_PREPARING_ISSUES_COUNT,
};
const resolveFleetConfigFilePath = (cliValue) => {
    if (cliValue !== null && cliValue !== '') {
        return cliValue;
    }
    const fromEnvironment = process.env[exports.FLEET_CONFIG_FILE_PATH_ENVIRONMENT_VARIABLE];
    if (fromEnvironment !== undefined && fromEnvironment !== '') {
        return fromEnvironment;
    }
    return null;
};
exports.resolveFleetConfigFilePath = resolveFleetConfigFilePath;
const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const parseFleetConfigTopLevel = (fleetConfigFilePath) => {
    const parsed = yaml_1.default.parse(fs.readFileSync(fleetConfigFilePath, 'utf8'));
    if (parsed === null || parsed === undefined) {
        return null;
    }
    if (!isRecord(parsed)) {
        throw new Error(`${fleetConfigFilePath} does not hold a mapping at its top level.`);
    }
    return parsed;
};
const readFleetConfigSection = (fleetConfigFilePath, sectionKey) => {
    const top = parseFleetConfigTopLevel(fleetConfigFilePath);
    if (top === null) {
        return null;
    }
    const section = top[sectionKey];
    if (section === undefined || section === null) {
        return null;
    }
    if (!isRecord(section)) {
        throw new Error(`${sectionKey} in ${fleetConfigFilePath} must be a mapping.`);
    }
    return section;
};
const readBoundedNumber = (section, sectionKey, key, fleetConfigFilePath, fallback, isAccepted, requirement) => {
    const value = section[key];
    if (value === undefined || value === null) {
        return fallback;
    }
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Error(`${sectionKey}.${key} in ${fleetConfigFilePath} must be a number ${requirement}.`);
    }
    if (!isAccepted(value)) {
        throw new Error(`${sectionKey}.${key} in ${fleetConfigFilePath} must be a number ${requirement}, but it is ${value}.`);
    }
    return value;
};
const loadLiveSessionOauthTokenSelectionSettings = (fleetConfigFilePath) => {
    if (fleetConfigFilePath === null) {
        return LiveSessionOauthTokenSelectUseCase_1.DEFAULT_LIVE_SESSION_OAUTH_TOKEN_SELECTION_SETTINGS;
    }
    const section = readFleetConfigSection(fleetConfigFilePath, exports.LIVE_SESSION_OAUTH_TOKEN_SELECTION_SECTION_KEY);
    if (section === null) {
        return LiveSessionOauthTokenSelectUseCase_1.DEFAULT_LIVE_SESSION_OAUTH_TOKEN_SELECTION_SETTINGS;
    }
    return {
        maxConcurrentSessionCount: readBoundedNumber(section, exports.LIVE_SESSION_OAUTH_TOKEN_SELECTION_SECTION_KEY, 'maxConcurrentSessionCount', fleetConfigFilePath, LiveSessionOauthTokenSelectUseCase_1.DEFAULT_LIVE_SESSION_OAUTH_TOKEN_SELECTION_SETTINGS.maxConcurrentSessionCount, (value) => Number.isInteger(value) && value >= 1, 'integer of at least 1'),
        fullSpeedFiveHourFreeRatio: readBoundedNumber(section, exports.LIVE_SESSION_OAUTH_TOKEN_SELECTION_SECTION_KEY, 'fullSpeedFiveHourFreeRatio', fleetConfigFilePath, LiveSessionOauthTokenSelectUseCase_1.DEFAULT_LIVE_SESSION_OAUTH_TOKEN_SELECTION_SETTINGS.fullSpeedFiveHourFreeRatio, (value) => value > 0 && value <= 1, 'above 0 and at most 1'),
        minFiveHourFreeRatio: readBoundedNumber(section, exports.LIVE_SESSION_OAUTH_TOKEN_SELECTION_SECTION_KEY, 'minFiveHourFreeRatio', fleetConfigFilePath, LiveSessionOauthTokenSelectUseCase_1.DEFAULT_LIVE_SESSION_OAUTH_TOKEN_SELECTION_SETTINGS.minFiveHourFreeRatio, (value) => value > 0 && value <= 1, 'above 0 and at most 1'),
        minSevenDayFreeRatio: readBoundedNumber(section, exports.LIVE_SESSION_OAUTH_TOKEN_SELECTION_SECTION_KEY, 'minSevenDayFreeRatio', fleetConfigFilePath, LiveSessionOauthTokenSelectUseCase_1.DEFAULT_LIVE_SESSION_OAUTH_TOKEN_SELECTION_SETTINGS.minSevenDayFreeRatio, (value) => value > 0 && value <= 1, 'above 0 and at most 1'),
    };
};
exports.loadLiveSessionOauthTokenSelectionSettings = loadLiveSessionOauthTokenSelectionSettings;
const loadPreparationWorkerSettings = (fleetConfigFilePath) => {
    if (fleetConfigFilePath === null) {
        return exports.DEFAULT_PREPARATION_WORKER_SETTINGS;
    }
    const section = readFleetConfigSection(fleetConfigFilePath, exports.PREPARATION_WORKER_SECTION_KEY);
    if (section === null) {
        return exports.DEFAULT_PREPARATION_WORKER_SETTINGS;
    }
    return {
        normalConcurrentLimit: readBoundedNumber(section, exports.PREPARATION_WORKER_SECTION_KEY, 'normalConcurrentLimit', fleetConfigFilePath, exports.DEFAULT_PREPARATION_WORKER_SETTINGS.normalConcurrentLimit, (value) => Number.isInteger(value) && value >= 1, 'integer of at least 1'),
        maxConcurrentWorkers: readBoundedNumber(section, exports.PREPARATION_WORKER_SECTION_KEY, 'maxConcurrentWorkers', fleetConfigFilePath, exports.DEFAULT_PREPARATION_WORKER_SETTINGS.maxConcurrentWorkers, (value) => Number.isInteger(value) && value >= 1, 'integer of at least 1'),
        graphqlRateLimitFloor: readBoundedNumber(section, exports.PREPARATION_WORKER_SECTION_KEY, 'graphqlRateLimitFloor', fleetConfigFilePath, exports.DEFAULT_PREPARATION_WORKER_SETTINGS.graphqlRateLimitFloor, (value) => Number.isInteger(value) && value >= 0, 'non-negative integer'),
    };
};
exports.loadPreparationWorkerSettings = loadPreparationWorkerSettings;
const loadStartPreparationFleetSettings = (fleetConfigFilePath) => {
    if (fleetConfigFilePath === null) {
        return exports.DEFAULT_START_PREPARATION_FLEET_SETTINGS;
    }
    const section = readFleetConfigSection(fleetConfigFilePath, exports.START_PREPARATION_SECTION_KEY);
    if (section === null) {
        return exports.DEFAULT_START_PREPARATION_FLEET_SETTINGS;
    }
    return {
        maximumPreparingIssuesCount: readBoundedNumber(section, exports.START_PREPARATION_SECTION_KEY, 'maximumPreparingIssuesCount', fleetConfigFilePath, exports.DEFAULT_START_PREPARATION_FLEET_SETTINGS.maximumPreparingIssuesCount, (value) => Number.isInteger(value) && value >= 1, 'integer of at least 1'),
    };
};
exports.loadStartPreparationFleetSettings = loadStartPreparationFleetSettings;
const loadWorkflowImprovementIssueUrl = (fleetConfigFilePath) => {
    if (fleetConfigFilePath === null) {
        return null;
    }
    const top = parseFleetConfigTopLevel(fleetConfigFilePath);
    if (top === null) {
        return null;
    }
    const value = top[exports.WORKFLOW_IMPROVEMENT_ISSUE_URL_KEY];
    if (value === undefined || value === null) {
        return null;
    }
    if (typeof value !== 'string') {
        throw new Error(`${exports.WORKFLOW_IMPROVEMENT_ISSUE_URL_KEY} in ${fleetConfigFilePath} must be a string URL.`);
    }
    return value;
};
exports.loadWorkflowImprovementIssueUrl = loadWorkflowImprovementIssueUrl;
//# sourceMappingURL=fleetConfig.js.map