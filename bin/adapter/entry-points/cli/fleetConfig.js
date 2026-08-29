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
exports.loadLiveSessionOauthTokenSelectionSettings = exports.resolveFleetConfigFilePath = exports.LIVE_SESSION_OAUTH_TOKEN_SELECTION_SECTION_KEY = exports.FLEET_CONFIG_FILE_PATH_ENVIRONMENT_VARIABLE = void 0;
const yaml_1 = __importDefault(require("yaml"));
const fs = __importStar(require("fs"));
const LiveSessionOauthTokenSelectUseCase_1 = require("../../../domain/usecases/LiveSessionOauthTokenSelectUseCase");
exports.FLEET_CONFIG_FILE_PATH_ENVIRONMENT_VARIABLE = 'TDPM_FLEET_CONFIG';
exports.LIVE_SESSION_OAUTH_TOKEN_SELECTION_SECTION_KEY = 'liveSessionOauthTokenSelection';
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
const readSection = (fleetConfigFilePath) => {
    const parsed = yaml_1.default.parse(fs.readFileSync(fleetConfigFilePath, 'utf8'));
    if (parsed === null || parsed === undefined) {
        return null;
    }
    if (!isRecord(parsed)) {
        throw new Error(`${fleetConfigFilePath} does not hold a mapping at its top level.`);
    }
    const section = parsed[exports.LIVE_SESSION_OAUTH_TOKEN_SELECTION_SECTION_KEY];
    if (section === undefined || section === null) {
        return null;
    }
    if (!isRecord(section)) {
        throw new Error(`${exports.LIVE_SESSION_OAUTH_TOKEN_SELECTION_SECTION_KEY} in ${fleetConfigFilePath} must be a mapping.`);
    }
    return section;
};
const readBoundedNumber = (section, key, fleetConfigFilePath, fallback, isAccepted, requirement) => {
    const value = section[key];
    if (value === undefined || value === null) {
        return fallback;
    }
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Error(`${exports.LIVE_SESSION_OAUTH_TOKEN_SELECTION_SECTION_KEY}.${key} in ${fleetConfigFilePath} must be a number ${requirement}.`);
    }
    if (!isAccepted(value)) {
        throw new Error(`${exports.LIVE_SESSION_OAUTH_TOKEN_SELECTION_SECTION_KEY}.${key} in ${fleetConfigFilePath} must be a number ${requirement}, but it is ${value}.`);
    }
    return value;
};
const loadLiveSessionOauthTokenSelectionSettings = (fleetConfigFilePath) => {
    if (fleetConfigFilePath === null) {
        return LiveSessionOauthTokenSelectUseCase_1.DEFAULT_LIVE_SESSION_OAUTH_TOKEN_SELECTION_SETTINGS;
    }
    const section = readSection(fleetConfigFilePath);
    if (section === null) {
        return LiveSessionOauthTokenSelectUseCase_1.DEFAULT_LIVE_SESSION_OAUTH_TOKEN_SELECTION_SETTINGS;
    }
    return {
        maxConcurrentSessionCount: readBoundedNumber(section, 'maxConcurrentSessionCount', fleetConfigFilePath, LiveSessionOauthTokenSelectUseCase_1.DEFAULT_LIVE_SESSION_OAUTH_TOKEN_SELECTION_SETTINGS.maxConcurrentSessionCount, (value) => Number.isInteger(value) && value >= 1, 'integer of at least 1'),
        fullSpeedFiveHourFreeRatio: readBoundedNumber(section, 'fullSpeedFiveHourFreeRatio', fleetConfigFilePath, LiveSessionOauthTokenSelectUseCase_1.DEFAULT_LIVE_SESSION_OAUTH_TOKEN_SELECTION_SETTINGS.fullSpeedFiveHourFreeRatio, (value) => value > 0 && value <= 1, 'above 0 and at most 1'),
        minFiveHourFreeRatio: readBoundedNumber(section, 'minFiveHourFreeRatio', fleetConfigFilePath, LiveSessionOauthTokenSelectUseCase_1.DEFAULT_LIVE_SESSION_OAUTH_TOKEN_SELECTION_SETTINGS.minFiveHourFreeRatio, (value) => value > 0 && value <= 1, 'above 0 and at most 1'),
        minSevenDayFreeRatio: readBoundedNumber(section, 'minSevenDayFreeRatio', fleetConfigFilePath, LiveSessionOauthTokenSelectUseCase_1.DEFAULT_LIVE_SESSION_OAUTH_TOKEN_SELECTION_SETTINGS.minSevenDayFreeRatio, (value) => value > 0 && value <= 1, 'above 0 and at most 1'),
    };
};
exports.loadLiveSessionOauthTokenSelectionSettings = loadLiveSessionOauthTokenSelectionSettings;
//# sourceMappingURL=fleetConfig.js.map