#!/usr/bin/env node
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
exports.program = exports.fetchProjectReadme = exports.mergeConfigs = exports.parseProjectReadmeConfig = exports.loadConfigFile = void 0;
const yaml_1 = __importDefault(require("yaml"));
const commander_1 = require("commander");
const fs = __importStar(require("fs"));
const HandleScheduledEventUseCaseHandler_1 = require("../handlers/HandleScheduledEventUseCaseHandler");
const StartPreparationUseCase_1 = require("../../../domain/usecases/StartPreparationUseCase");
const NotifyFinishedIssuePreparationUseCase_1 = require("../../../domain/usecases/NotifyFinishedIssuePreparationUseCase");
const LocalStorageRepository_1 = require("../../repositories/LocalStorageRepository");
const GraphqlProjectRepository_1 = require("../../repositories/GraphqlProjectRepository");
const ApiV3IssueRepository_1 = require("../../repositories/issue/ApiV3IssueRepository");
const RestIssueRepository_1 = require("../../repositories/issue/RestIssueRepository");
const GraphqlProjectItemRepository_1 = require("../../repositories/issue/GraphqlProjectItemRepository");
const ApiV3CheerioRestIssueRepository_1 = require("../../repositories/issue/ApiV3CheerioRestIssueRepository");
const LocalStorageCacheRepository_1 = require("../../repositories/LocalStorageCacheRepository");
const CheerioProjectRepository_1 = require("../../repositories/CheerioProjectRepository");
const NodeLocalCommandRunner_1 = require("../../repositories/NodeLocalCommandRunner");
const OauthAPIClaudeRepository_1 = require("../../repositories/OauthAPIClaudeRepository");
const GitHubIssueCommentRepository_1 = require("../../repositories/GitHubIssueCommentRepository");
const FetchWebhookRepository_1 = require("../../repositories/FetchWebhookRepository");
const getStringValue = (obj, key) => {
    const value = obj[key];
    return typeof value === 'string' ? value : undefined;
};
const getNumberValue = (obj, key) => {
    const value = obj[key];
    return typeof value === 'number' ? value : undefined;
};
const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const loadConfigFile = (configFilePath) => {
    try {
        const content = fs.readFileSync(configFilePath, 'utf-8');
        const parsed = yaml_1.default.parse(content);
        if (!isRecord(parsed)) {
            return {};
        }
        return {
            projectUrl: getStringValue(parsed, 'projectUrl'),
            awaitingWorkspaceStatus: getStringValue(parsed, 'awaitingWorkspaceStatus'),
            preparationStatus: getStringValue(parsed, 'preparationStatus'),
            defaultAgentName: getStringValue(parsed, 'defaultAgentName'),
            logFilePath: getStringValue(parsed, 'logFilePath'),
            maximumPreparingIssuesCount: getNumberValue(parsed, 'maximumPreparingIssuesCount'),
            allowIssueCacheMinutes: getNumberValue(parsed, 'allowIssueCacheMinutes'),
            awaitingQualityCheckStatus: getStringValue(parsed, 'awaitingQualityCheckStatus'),
            thresholdForAutoReject: getNumberValue(parsed, 'thresholdForAutoReject'),
            workflowBlockerResolvedWebhookUrl: getStringValue(parsed, 'workflowBlockerResolvedWebhookUrl'),
            projectName: getStringValue(parsed, 'projectName'),
        };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Failed to load configuration file "${configFilePath}": ${message}`);
        process.exit(1);
    }
};
exports.loadConfigFile = loadConfigFile;
const parseProjectReadmeConfig = (readme) => {
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
        if (!isRecord(parsed)) {
            return {};
        }
        return {
            awaitingWorkspaceStatus: getStringValue(parsed, 'awaitingWorkspaceStatus'),
            preparationStatus: getStringValue(parsed, 'preparationStatus'),
            defaultAgentName: getStringValue(parsed, 'defaultAgentName'),
            logFilePath: getStringValue(parsed, 'logFilePath'),
            maximumPreparingIssuesCount: getNumberValue(parsed, 'maximumPreparingIssuesCount'),
            allowIssueCacheMinutes: getNumberValue(parsed, 'allowIssueCacheMinutes'),
            awaitingQualityCheckStatus: getStringValue(parsed, 'awaitingQualityCheckStatus'),
            thresholdForAutoReject: getNumberValue(parsed, 'thresholdForAutoReject'),
            workflowBlockerResolvedWebhookUrl: getStringValue(parsed, 'workflowBlockerResolvedWebhookUrl'),
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
    awaitingWorkspaceStatus: readmeOverrides.awaitingWorkspaceStatus ??
        cliOverrides.awaitingWorkspaceStatus ??
        configFile.awaitingWorkspaceStatus,
    preparationStatus: readmeOverrides.preparationStatus ??
        cliOverrides.preparationStatus ??
        configFile.preparationStatus,
    defaultAgentName: readmeOverrides.defaultAgentName ??
        cliOverrides.defaultAgentName ??
        configFile.defaultAgentName,
    logFilePath: readmeOverrides.logFilePath ??
        cliOverrides.logFilePath ??
        configFile.logFilePath,
    maximumPreparingIssuesCount: readmeOverrides.maximumPreparingIssuesCount ??
        cliOverrides.maximumPreparingIssuesCount ??
        configFile.maximumPreparingIssuesCount,
    allowIssueCacheMinutes: readmeOverrides.allowIssueCacheMinutes ??
        cliOverrides.allowIssueCacheMinutes ??
        configFile.allowIssueCacheMinutes,
    awaitingQualityCheckStatus: readmeOverrides.awaitingQualityCheckStatus ??
        cliOverrides.awaitingQualityCheckStatus ??
        configFile.awaitingQualityCheckStatus,
    thresholdForAutoReject: readmeOverrides.thresholdForAutoReject ??
        cliOverrides.thresholdForAutoReject ??
        configFile.thresholdForAutoReject,
    workflowBlockerResolvedWebhookUrl: readmeOverrides.workflowBlockerResolvedWebhookUrl ??
        cliOverrides.workflowBlockerResolvedWebhookUrl ??
        configFile.workflowBlockerResolvedWebhookUrl,
    projectName: configFile.projectName,
});
exports.mergeConfigs = mergeConfigs;
const isGraphqlProjectV2ReadmeResponse = (value) => {
    if (!isRecord(value))
        return false;
    const data = value['data'];
    if (data !== undefined && !isRecord(data))
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
    catch {
        console.warn('Failed to fetch project README');
        return null;
    }
};
exports.fetchProjectReadme = fetchProjectReadme;
const buildGithubRepositoryParams = (localStorageRepository, cachePath, token) => [
    localStorageRepository,
    `${cachePath}/github.com.cookies.json`,
    token,
    undefined,
    undefined,
    undefined,
];
exports.program = new commander_1.Command();
exports.program
    .name('github-issue-tower-defence-management')
    .description('CLI tool for GitHub Issue Tower Defence Management');
exports.program
    .command('schedule', { isDefault: true })
    .description('Handle scheduled events (trigger: issue or schedule)')
    .requiredOption('-t, --trigger <type>', 'Trigger type: issue or schedule', /^(issue|schedule)$/i)
    .requiredOption('-c, --config <path>', 'Path to config YAML file')
    .option('-v, --verbose', 'Verbose output')
    .option('-i, --issue <url>', 'GitHub Issue URL')
    .action(async (options) => {
    if (options.trigger === 'issue' && !options.issue) {
        console.error('Issue URL is required when trigger type is "issue"');
        process.exit(1);
    }
    if (options.trigger === 'schedule') {
        const handler = new HandleScheduledEventUseCaseHandler_1.HandleScheduledEventUseCaseHandler();
        await handler.handle(options.config, options.verbose);
    }
});
exports.program
    .command('startDaemon')
    .description('Start daemon to prepare GitHub issues')
    .requiredOption('--configFilePath <path>', 'Path to config file for tower defence management')
    .option('--projectUrl <url>', 'GitHub project URL')
    .option('--awaitingWorkspaceStatus <status>', 'Status for issues awaiting workspace')
    .option('--preparationStatus <status>', 'Status for issues in preparation')
    .option('--defaultAgentName <name>', 'Default agent name')
    .option('--logFilePath <path>', 'Path to log file')
    .option('--maximumPreparingIssuesCount <count>', 'Maximum number of issues in preparation status (default: 6)')
    .option('--allowIssueCacheMinutes <minutes>', 'Allow cache for issues in minutes (default: 0)')
    .action(async (options) => {
    const token = process.env.GH_TOKEN;
    if (!token) {
        console.error('GH_TOKEN environment variable is required');
        process.exit(1);
    }
    const configFileValues = (0, exports.loadConfigFile)(options.configFilePath);
    const cliOverrides = {
        projectUrl: options.projectUrl,
        awaitingWorkspaceStatus: options.awaitingWorkspaceStatus,
        preparationStatus: options.preparationStatus,
        defaultAgentName: options.defaultAgentName,
        logFilePath: options.logFilePath,
        maximumPreparingIssuesCount: options.maximumPreparingIssuesCount
            ? Number(options.maximumPreparingIssuesCount)
            : undefined,
        allowIssueCacheMinutes: options.allowIssueCacheMinutes
            ? Number(options.allowIssueCacheMinutes)
            : undefined,
    };
    const tempProjectUrl = cliOverrides.projectUrl ?? configFileValues.projectUrl;
    let readmeOverrides = {};
    if (tempProjectUrl) {
        const readme = await (0, exports.fetchProjectReadme)(tempProjectUrl, token);
        if (readme) {
            readmeOverrides = (0, exports.parseProjectReadmeConfig)(readme);
        }
    }
    const config = (0, exports.mergeConfigs)(configFileValues, cliOverrides, readmeOverrides);
    const projectUrl = config.projectUrl;
    const awaitingWorkspaceStatus = config.awaitingWorkspaceStatus;
    const preparationStatus = config.preparationStatus;
    const defaultAgentName = config.defaultAgentName;
    const logFilePath = config.logFilePath;
    if (!projectUrl) {
        console.error('projectUrl is required. Provide via --projectUrl, config file, or project README.');
        process.exit(1);
    }
    if (!awaitingWorkspaceStatus) {
        console.error('awaitingWorkspaceStatus is required. Provide via --awaitingWorkspaceStatus, config file, or project README.');
        process.exit(1);
    }
    if (!preparationStatus) {
        console.error('preparationStatus is required. Provide via --preparationStatus, config file, or project README.');
        process.exit(1);
    }
    if (!defaultAgentName) {
        console.error('defaultAgentName is required. Provide via --defaultAgentName, config file, or project README.');
        process.exit(1);
    }
    let maximumPreparingIssuesCount = null;
    const rawMaxCount = config.maximumPreparingIssuesCount;
    if (rawMaxCount !== undefined) {
        const parsedCount = Number(rawMaxCount);
        if (!Number.isFinite(parsedCount) ||
            !Number.isInteger(parsedCount) ||
            parsedCount <= 0) {
            console.error('Invalid value for --maximumPreparingIssuesCount. It must be a positive integer.');
            process.exit(1);
        }
        maximumPreparingIssuesCount = parsedCount;
    }
    const allowIssueCacheMinutes = config.allowIssueCacheMinutes ?? 0;
    console.log(`maximumPreparingIssuesCount: ${maximumPreparingIssuesCount ?? 'null (default: 6)'}`);
    const projectName = config.projectName ?? 'default';
    const localStorageRepository = new LocalStorageRepository_1.LocalStorageRepository();
    const cachePath = `./tmp/cache/${projectName}`;
    const localStorageCacheRepository = new LocalStorageCacheRepository_1.LocalStorageCacheRepository(localStorageRepository, cachePath);
    const githubRepositoryParams = buildGithubRepositoryParams(localStorageRepository, cachePath, token);
    const projectRepository = {
        ...new GraphqlProjectRepository_1.GraphqlProjectRepository(...githubRepositoryParams),
        ...new CheerioProjectRepository_1.CheerioProjectRepository(...githubRepositoryParams),
    };
    const apiV3IssueRepository = new ApiV3IssueRepository_1.ApiV3IssueRepository(...githubRepositoryParams);
    const restIssueRepository = new RestIssueRepository_1.RestIssueRepository(...githubRepositoryParams);
    const graphqlProjectItemRepository = new GraphqlProjectItemRepository_1.GraphqlProjectItemRepository(...githubRepositoryParams);
    const issueRepository = new ApiV3CheerioRestIssueRepository_1.ApiV3CheerioRestIssueRepository(apiV3IssueRepository, restIssueRepository, graphqlProjectItemRepository, localStorageCacheRepository, ...githubRepositoryParams);
    const claudeRepository = new OauthAPIClaudeRepository_1.OauthAPIClaudeRepository();
    const localCommandRunner = new NodeLocalCommandRunner_1.NodeLocalCommandRunner();
    const useCase = new StartPreparationUseCase_1.StartPreparationUseCase(projectRepository, issueRepository, claudeRepository, localCommandRunner);
    await useCase.run({
        projectUrl,
        awaitingWorkspaceStatus,
        preparationStatus,
        defaultAgentName,
        logFilePath: logFilePath ?? undefined,
        maximumPreparingIssuesCount,
        allowIssueCacheMinutes,
    });
});
exports.program
    .command('notifyFinishedIssuePreparation')
    .description('Notify that issue preparation is finished')
    .requiredOption('--configFilePath <path>', 'Path to config file for tower defence management')
    .requiredOption('--issueUrl <url>', 'GitHub issue URL')
    .option('--projectUrl <url>', 'GitHub project URL')
    .option('--preparationStatus <status>', 'Status for issues in preparation')
    .option('--awaitingWorkspaceStatus <status>', 'Status for issues awaiting workspace')
    .option('--awaitingQualityCheckStatus <status>', 'Status for issues awaiting quality check')
    .option('--thresholdForAutoReject <count>', 'Threshold for auto-escalation after consecutive rejections (default: 3)')
    .option('--workflowBlockerResolvedWebhookUrl <url>', 'Webhook URL to notify when a workflow blocker issue status changes to awaiting quality check. Supports {URL} and {MESSAGE} placeholders.')
    .action(async (options) => {
    const token = process.env.GH_TOKEN;
    if (!token) {
        console.error('GH_TOKEN environment variable is required');
        process.exit(1);
    }
    const configFileValues = (0, exports.loadConfigFile)(options.configFilePath);
    const cliOverrides = {
        projectUrl: options.projectUrl,
        preparationStatus: options.preparationStatus,
        awaitingWorkspaceStatus: options.awaitingWorkspaceStatus,
        awaitingQualityCheckStatus: options.awaitingQualityCheckStatus,
        thresholdForAutoReject: options.thresholdForAutoReject
            ? Number(options.thresholdForAutoReject)
            : undefined,
        workflowBlockerResolvedWebhookUrl: options.workflowBlockerResolvedWebhookUrl,
    };
    const tempProjectUrl = cliOverrides.projectUrl ?? configFileValues.projectUrl;
    let readmeOverrides = {};
    if (tempProjectUrl) {
        const readme = await (0, exports.fetchProjectReadme)(tempProjectUrl, token);
        if (readme) {
            readmeOverrides = (0, exports.parseProjectReadmeConfig)(readme);
        }
    }
    const config = (0, exports.mergeConfigs)(configFileValues, cliOverrides, readmeOverrides);
    const projectUrl = config.projectUrl;
    const preparationStatus = config.preparationStatus;
    const awaitingWorkspaceStatus = config.awaitingWorkspaceStatus;
    const awaitingQualityCheckStatus = config.awaitingQualityCheckStatus;
    if (!projectUrl) {
        console.error('projectUrl is required. Provide via --projectUrl, config file, or project README.');
        process.exit(1);
    }
    if (!preparationStatus) {
        console.error('preparationStatus is required. Provide via --preparationStatus, config file, or project README.');
        process.exit(1);
    }
    if (!awaitingWorkspaceStatus) {
        console.error('awaitingWorkspaceStatus is required. Provide via --awaitingWorkspaceStatus, config file, or project README.');
        process.exit(1);
    }
    if (!awaitingQualityCheckStatus) {
        console.error('awaitingQualityCheckStatus is required. Provide via --awaitingQualityCheckStatus, config file, or project README.');
        process.exit(1);
    }
    let thresholdForAutoReject = 3;
    const rawThreshold = config.thresholdForAutoReject;
    if (rawThreshold !== undefined) {
        const parsed = Number(rawThreshold);
        if (!Number.isFinite(parsed) ||
            !Number.isInteger(parsed) ||
            parsed <= 0) {
            console.error('Invalid value for --thresholdForAutoReject. It must be a positive integer.');
            process.exit(1);
        }
        thresholdForAutoReject = parsed;
    }
    const workflowBlockerResolvedWebhookUrl = config.workflowBlockerResolvedWebhookUrl ?? null;
    const projectName = config.projectName ?? 'default';
    const localStorageRepository = new LocalStorageRepository_1.LocalStorageRepository();
    const cachePath = `./tmp/cache/${projectName}`;
    const localStorageCacheRepository = new LocalStorageCacheRepository_1.LocalStorageCacheRepository(localStorageRepository, cachePath);
    const githubRepositoryParams = buildGithubRepositoryParams(localStorageRepository, cachePath, token);
    const projectRepository = {
        ...new GraphqlProjectRepository_1.GraphqlProjectRepository(...githubRepositoryParams),
        ...new CheerioProjectRepository_1.CheerioProjectRepository(...githubRepositoryParams),
        prepareStatus: async (_name, project) => {
            return project;
        },
    };
    const apiV3IssueRepository = new ApiV3IssueRepository_1.ApiV3IssueRepository(...githubRepositoryParams);
    const restIssueRepository = new RestIssueRepository_1.RestIssueRepository(...githubRepositoryParams);
    const graphqlProjectItemRepository = new GraphqlProjectItemRepository_1.GraphqlProjectItemRepository(...githubRepositoryParams);
    const issueRepository = new ApiV3CheerioRestIssueRepository_1.ApiV3CheerioRestIssueRepository(apiV3IssueRepository, restIssueRepository, graphqlProjectItemRepository, localStorageCacheRepository, ...githubRepositoryParams);
    const issueCommentRepository = new GitHubIssueCommentRepository_1.GitHubIssueCommentRepository(token);
    const webhookRepository = new FetchWebhookRepository_1.FetchWebhookRepository();
    const useCase = new NotifyFinishedIssuePreparationUseCase_1.NotifyFinishedIssuePreparationUseCase(projectRepository, issueRepository, issueCommentRepository, webhookRepository);
    await useCase.run({
        projectUrl,
        issueUrl: options.issueUrl,
        preparationStatus,
        awaitingWorkspaceStatus,
        awaitingQualityCheckStatus,
        thresholdForAutoReject,
        workflowBlockerResolvedWebhookUrl,
    });
});
/* istanbul ignore next */
if (process.argv && require.main === module) {
    exports.program.parse(process.argv);
}
//# sourceMappingURL=index.js.map