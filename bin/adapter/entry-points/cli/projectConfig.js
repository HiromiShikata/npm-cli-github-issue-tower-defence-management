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
exports.fetchProjectReadme = exports.mergeConfigs = exports.parseProjectReadmeConfig = exports.knownProjectReadmeConfigKeys = exports.loadConfigFile = exports.isRecord = void 0;
const yaml_1 = __importDefault(require("yaml"));
const fs = __importStar(require("fs"));
const getStringValue = (obj, key) => {
    const value = obj[key];
    return typeof value === 'string' ? value : undefined;
};
const getNumberValue = (obj, key) => {
    const value = obj[key];
    return typeof value === 'number' ? value : undefined;
};
const getStringArrayValue = (obj, key) => {
    const value = obj[key];
    if (!Array.isArray(value)) {
        return undefined;
    }
    const strings = [];
    for (const item of value) {
        if (typeof item !== 'string') {
            return undefined;
        }
        strings.push(item);
    }
    return strings;
};
const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
exports.isRecord = isRecord;
const loadConfigFile = (configFilePath) => {
    try {
        const content = fs.readFileSync(configFilePath, 'utf-8');
        const parsed = yaml_1.default.parse(content);
        if (!(0, exports.isRecord)(parsed)) {
            return {};
        }
        return {
            projectUrl: getStringValue(parsed, 'projectUrl'),
            defaultAgentName: getStringValue(parsed, 'defaultAgentName'),
            defaultLlmModelName: getStringValue(parsed, 'defaultLlmModelName'),
            defaultLlmAgentName: getStringValue(parsed, 'defaultLlmAgentName'),
            maximumPreparingIssuesCount: getNumberValue(parsed, 'maximumPreparingIssuesCount'),
            allowIssueCacheMinutes: getNumberValue(parsed, 'allowIssueCacheMinutes'),
            utilizationPercentageThreshold: getNumberValue(parsed, 'utilizationPercentageThreshold'),
            allowedIssueAuthors: getStringValue(parsed, 'allowedIssueAuthors'),
            thresholdForAutoReject: getNumberValue(parsed, 'thresholdForAutoReject'),
            workflowBlockerResolvedWebhookUrl: getStringValue(parsed, 'workflowBlockerResolvedWebhookUrl'),
            projectName: getStringValue(parsed, 'projectName'),
            preparationProcessCheckCommand: getStringValue(parsed, 'preparationProcessCheckCommand'),
            codexHomeCandidates: getStringArrayValue(parsed, 'codexHomeCandidates'),
            claudeCodeOauthTokenListJsonPath: getStringValue(parsed, 'claudeCodeOauthTokenListJsonPath'),
            awLogDirectoryPath: getStringValue(parsed, 'awLogDirectoryPath'),
            awLogStaleThresholdMinutes: getNumberValue(parsed, 'awLogStaleThresholdMinutes'),
        };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Failed to load configuration file "${configFilePath}": ${message}`);
        process.exit(1);
    }
};
exports.loadConfigFile = loadConfigFile;
exports.knownProjectReadmeConfigKeys = [
    'defaultAgentName',
    'defaultLlmModelName',
    'defaultLlmAgentName',
    'maximumPreparingIssuesCount',
    'allowIssueCacheMinutes',
    'utilizationPercentageThreshold',
    'allowedIssueAuthors',
    'thresholdForAutoReject',
    'workflowBlockerResolvedWebhookUrl',
    'preparationProcessCheckCommand',
    'codexHomeCandidates',
    'claudeCodeOauthTokenListJsonPath',
    'awLogDirectoryPath',
    'awLogStaleThresholdMinutes',
];
const parseProjectReadmeConfig = (readme, projectUrl) => {
    const detailsRegex = /<details>\s*<summary>config<\/summary>([\s\S]*?)<\/details>/i;
    const match = detailsRegex.exec(readme);
    if (!match) {
        return {};
    }
    const yamlContent = match[1].trim();
    if (!yamlContent) {
        return {};
    }
    try {
        const parsed = yaml_1.default.parse(yamlContent);
        if (!(0, exports.isRecord)(parsed)) {
            return {};
        }
        const knownKeySet = new Set(exports.knownProjectReadmeConfigKeys);
        const unknownKeys = Object.keys(parsed).filter((key) => !knownKeySet.has(key));
        const projectUrlSuffix = projectUrl ? ` (project: ${projectUrl})` : '';
        for (const unknownKey of unknownKeys) {
            console.warn(`Unknown key "${unknownKey}" in project README config section${projectUrlSuffix}`);
        }
        return {
            defaultAgentName: getStringValue(parsed, 'defaultAgentName'),
            defaultLlmModelName: getStringValue(parsed, 'defaultLlmModelName'),
            defaultLlmAgentName: getStringValue(parsed, 'defaultLlmAgentName'),
            maximumPreparingIssuesCount: getNumberValue(parsed, 'maximumPreparingIssuesCount'),
            allowIssueCacheMinutes: getNumberValue(parsed, 'allowIssueCacheMinutes'),
            utilizationPercentageThreshold: getNumberValue(parsed, 'utilizationPercentageThreshold'),
            allowedIssueAuthors: getStringValue(parsed, 'allowedIssueAuthors'),
            thresholdForAutoReject: getNumberValue(parsed, 'thresholdForAutoReject'),
            workflowBlockerResolvedWebhookUrl: getStringValue(parsed, 'workflowBlockerResolvedWebhookUrl'),
            preparationProcessCheckCommand: getStringValue(parsed, 'preparationProcessCheckCommand'),
            codexHomeCandidates: getStringArrayValue(parsed, 'codexHomeCandidates'),
            claudeCodeOauthTokenListJsonPath: getStringValue(parsed, 'claudeCodeOauthTokenListJsonPath'),
            awLogDirectoryPath: getStringValue(parsed, 'awLogDirectoryPath'),
            awLogStaleThresholdMinutes: getNumberValue(parsed, 'awLogStaleThresholdMinutes'),
        };
    }
    catch {
        console.warn('Failed to parse YAML from project README config section');
        return {};
    }
};
exports.parseProjectReadmeConfig = parseProjectReadmeConfig;
const mergeConfigs = (configFile, cliOverrides, readmeOverrides) => ({
    projectUrl: cliOverrides.projectUrl ?? configFile.projectUrl,
    defaultAgentName: readmeOverrides.defaultAgentName ??
        cliOverrides.defaultAgentName ??
        configFile.defaultAgentName,
    defaultLlmModelName: readmeOverrides.defaultLlmModelName ??
        cliOverrides.defaultLlmModelName ??
        configFile.defaultLlmModelName,
    defaultLlmAgentName: readmeOverrides.defaultLlmAgentName ??
        cliOverrides.defaultLlmAgentName ??
        configFile.defaultLlmAgentName,
    maximumPreparingIssuesCount: readmeOverrides.maximumPreparingIssuesCount ??
        cliOverrides.maximumPreparingIssuesCount ??
        configFile.maximumPreparingIssuesCount,
    allowIssueCacheMinutes: readmeOverrides.allowIssueCacheMinutes ??
        cliOverrides.allowIssueCacheMinutes ??
        configFile.allowIssueCacheMinutes,
    utilizationPercentageThreshold: readmeOverrides.utilizationPercentageThreshold ??
        cliOverrides.utilizationPercentageThreshold ??
        configFile.utilizationPercentageThreshold,
    allowedIssueAuthors: readmeOverrides.allowedIssueAuthors ??
        cliOverrides.allowedIssueAuthors ??
        configFile.allowedIssueAuthors,
    thresholdForAutoReject: readmeOverrides.thresholdForAutoReject ??
        cliOverrides.thresholdForAutoReject ??
        configFile.thresholdForAutoReject,
    workflowBlockerResolvedWebhookUrl: readmeOverrides.workflowBlockerResolvedWebhookUrl ??
        cliOverrides.workflowBlockerResolvedWebhookUrl ??
        configFile.workflowBlockerResolvedWebhookUrl,
    projectName: configFile.projectName,
    preparationProcessCheckCommand: readmeOverrides.preparationProcessCheckCommand ??
        cliOverrides.preparationProcessCheckCommand ??
        configFile.preparationProcessCheckCommand,
    codexHomeCandidates: readmeOverrides.codexHomeCandidates ??
        cliOverrides.codexHomeCandidates ??
        configFile.codexHomeCandidates,
    claudeCodeOauthTokenListJsonPath: readmeOverrides.claudeCodeOauthTokenListJsonPath ??
        cliOverrides.claudeCodeOauthTokenListJsonPath ??
        configFile.claudeCodeOauthTokenListJsonPath,
    awLogDirectoryPath: readmeOverrides.awLogDirectoryPath ??
        cliOverrides.awLogDirectoryPath ??
        configFile.awLogDirectoryPath,
    awLogStaleThresholdMinutes: readmeOverrides.awLogStaleThresholdMinutes ??
        cliOverrides.awLogStaleThresholdMinutes ??
        configFile.awLogStaleThresholdMinutes,
});
exports.mergeConfigs = mergeConfigs;
const isGraphqlProjectV2ReadmeResponse = (value) => {
    if (!(0, exports.isRecord)(value))
        return false;
    const data = value['data'];
    if (data !== undefined && !(0, exports.isRecord)(data))
        return false;
    return true;
};
const fetchProjectReadme = async (projectUrl, token) => {
    try {
        const urlParts = projectUrl.split('/');
        const projectNumber = parseInt(urlParts[urlParts.length - 1], 10);
        const owner = urlParts[urlParts.length - 3];
        const query = `
      query($owner: String!, $number: Int!) {
        organization(login: $owner) {
          projectV2(number: $number) {
            readme
          }
        }
        user(login: $owner) {
          projectV2(number: $number) {
            readme
          }
        }
      }
    `;
        const response = await fetch('https://api.github.com/graphql', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                query,
                variables: { owner, number: projectNumber },
            }),
        });
        if (!response.ok) {
            throw new Error(`GraphQL request failed: ${response.status}`);
        }
        const responseData = await response.json();
        if (!isGraphqlProjectV2ReadmeResponse(responseData)) {
            return null;
        }
        const orgReadme = responseData.data?.organization?.projectV2?.readme;
        const userReadme = responseData.data?.user?.projectV2?.readme;
        const readme = typeof orgReadme === 'string'
            ? orgReadme
            : typeof userReadme === 'string'
                ? userReadme
                : null;
        return readme;
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`Failed to fetch project README: ${message}`);
        return null;
    }
};
exports.fetchProjectReadme = fetchProjectReadme;
//# sourceMappingURL=projectConfig.js.map