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
exports.runCliProgram = exports.reportFatalErrorAndExit = exports.program = exports.parseProjectReadmeConfig = exports.mergeConfigs = exports.loadConfigFile = exports.fetchProjectReadme = void 0;
const commander_1 = require("commander");
const fs_1 = __importDefault(require("fs"));
var projectConfig_1 = require("./projectConfig");
Object.defineProperty(exports, "fetchProjectReadme", { enumerable: true, get: function () { return projectConfig_1.fetchProjectReadme; } });
Object.defineProperty(exports, "loadConfigFile", { enumerable: true, get: function () { return projectConfig_1.loadConfigFile; } });
Object.defineProperty(exports, "mergeConfigs", { enumerable: true, get: function () { return projectConfig_1.mergeConfigs; } });
Object.defineProperty(exports, "parseProjectReadmeConfig", { enumerable: true, get: function () { return projectConfig_1.parseProjectReadmeConfig; } });
const path = __importStar(require("path"));
const CheckIssueReviewReadinessUseCase_1 = require("../../../domain/usecases/CheckIssueReviewReadinessUseCase");
const CliErrorReportUseCase_1 = require("../../../domain/usecases/CliErrorReportUseCase");
const DashboardProjectCode_1 = require("../../../domain/usecases/dashboard/DashboardProjectCode");
const OwnerCallFile_1 = require("../../../domain/usecases/intmux/OwnerCallFile");
const NotifyFinishedIssuePreparationUseCase_1 = require("../../../domain/usecases/NotifyFinishedIssuePreparationUseCase");
const RevertOrphanedPreparationUseCase_1 = require("../../../domain/usecases/RevertOrphanedPreparationUseCase");
const StartPreparationUseCase_1 = require("../../../domain/usecases/StartPreparationUseCase");
const FetchWebhookRepository_1 = require("../../repositories/FetchWebhookRepository");
const GitHubIssueCommentRepository_1 = require("../../repositories/GitHubIssueCommentRepository");
const GraphqlProjectRepository_1 = require("../../repositories/GraphqlProjectRepository");
const ApiV3CheerioRestIssueRepository_1 = require("../../repositories/issue/ApiV3CheerioRestIssueRepository");
const ApiV3IssueRepository_1 = require("../../repositories/issue/ApiV3IssueRepository");
const GraphqlProjectItemRepository_1 = require("../../repositories/issue/GraphqlProjectItemRepository");
const RestIssueRepository_1 = require("../../repositories/issue/RestIssueRepository");
const LocalCommandIssueAttachmentRepository_1 = require("../../repositories/LocalCommandIssueAttachmentRepository");
const LocalStorageCacheRepository_1 = require("../../repositories/LocalStorageCacheRepository");
const LocalStorageRepository_1 = require("../../repositories/LocalStorageRepository");
const localStorageCacheDirectory_1 = require("../../repositories/localStorageCacheDirectory");
const NodeLocalCommandRunner_1 = require("../../repositories/NodeLocalCommandRunner");
const NodeTmuxSessionRepository_1 = require("../../repositories/NodeTmuxSessionRepository");
const ProcTakeOwnershipSpawnRepository_1 = require("../../repositories/ProcTakeOwnershipSpawnRepository");
const resolveNextStepAgentDispatchRepetition_1 = require("../../../domain/usecases/resolveNextStepAgentDispatchRepetition");
const ProxyClaudeTokenUsageRepository_1 = require("../../repositories/ProxyClaudeTokenUsageRepository");
const SystemDateRepository_1 = require("../../repositories/SystemDateRepository");
const os = __importStar(require("os"));
const consoleGithubTokenResolver_1 = require("../console/consoleGithubTokenResolver");
const consoleProjectResolver_1 = require("../console/consoleProjectResolver");
const consoleReadApi_1 = require("../console/consoleReadApi");
const ensureConsoleRunning_1 = require("../console/ensureConsoleRunning");
const webServer_1 = require("../console/webServer");
const FileSystemConsoleTabsRepository_1 = require("../handlers/FileSystemConsoleTabsRepository");
const InTmuxByHumanSessionTokenCountHandler_1 = require("../handlers/InTmuxByHumanSessionTokenCountHandler");
const LiveSessionOauthTokenSelectHandler_1 = require("../handlers/LiveSessionOauthTokenSelectHandler");
const OauthTokenSelectHandler_1 = require("../handlers/OauthTokenSelectHandler");
const ownerCallFileStore_1 = require("../handlers/ownerCallFileStore");
const rotationOrderFileWriter_1 = require("../handlers/rotationOrderFileWriter");
const fleetConfig_1 = require("./fleetConfig");
const projectConfig_2 = require("./projectConfig");
const resolvePositiveIntegerOption = (rawValue, optionName, fallback) => {
    if (rawValue === undefined) {
        return fallback;
    }
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
        console.error(`Invalid value for --${optionName}. It must be a positive integer.`);
        process.exit(1);
    }
    return parsed;
};
const DEFAULT_IN_TMUX_DATA_DIR = '/home/hiromi/0_workspaces/workspace1/jsonpub/in-tmux-by-human';
const DEFAULT_DASHBOARD_DIR = '/home/hiromi/0_workspaces/workspace1/jsonpub';
const DEFAULT_DASHBOARD_DATA_DIR = null;
const parseDashboardProjectNames = (raw) => {
    const names = (raw ?? '')
        .split(',')
        .map((name) => name.trim())
        .filter((name) => name.length > 0);
    if (names.length === 0) {
        console.error('--dashboardProjectNames must list at least one project name');
        return process.exit(1);
    }
    try {
        (0, DashboardProjectCode_1.assertDashboardDisplayLabelsUnique)(names);
    }
    catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        return process.exit(1);
    }
    return names;
};
const resolveScopeLibPath = () => {
    const explicitPath = process.env.CL_SCOPE_LIB_PATH;
    if (explicitPath !== undefined && fs_1.default.existsSync(explicitPath)) {
        return explicitPath;
    }
    const defaultPath = path.join(os.homedir(), 'git', 'secretary', 'machine', 'sk', 'sh', 'cl-scope-lib.sh');
    return fs_1.default.existsSync(defaultPath) ? defaultPath : null;
};
const buildGithubRepositoryParams = (localStorageRepository, token) => [
    localStorageRepository,
    token,
];
const parseInTmuxProjectOrder = (raw) => {
    if (raw === undefined) {
        return null;
    }
    return raw
        .split(',')
        .map((name) => name.trim())
        .filter((name) => name.length > 0);
};
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
    .option('--inTmuxProjectOrder <names>', 'Comma-separated project names, in display order, for the in-tmux-by-human session list. When omitted, falls back to the inTmuxProjectOrder value in the config file.')
    .action(async (options) => {
    if (options.trigger === 'issue' && !options.issue) {
        console.error('Issue URL is required when trigger type is "issue"');
        process.exit(1);
    }
    if (options.trigger === 'schedule') {
        const { HandleScheduledEventUseCaseHandler } = await Promise.resolve().then(() => __importStar(require('../handlers/HandleScheduledEventUseCaseHandler')));
        const handler = new HandleScheduledEventUseCaseHandler();
        await handler.handle(options.config, options.verbose, parseInTmuxProjectOrder(options.inTmuxProjectOrder));
    }
});
exports.program
    .command('startDaemon')
    .description('Start daemon to prepare GitHub issues')
    .requiredOption('--configFilePath <path>', 'Path to config file for tower defence management')
    .option('--projectUrl <url>', 'GitHub project URL')
    .option('--manager <login>', 'GitHub login of the manager; only Awaiting Workspace issues assigned to this login are picked up')
    .option('--defaultAgentName <name>', 'Default agent name')
    .option('--defaultLlmModelName <name>', 'Default LLM model name')
    .option('--fallbackLlmModelName <name>', 'LLM model to fall back to when the default Sonnet model is selected but its 7-day weekly limit is exhausted across all tokens (default: claude-opus-4-8)')
    .option('--defaultLlmAgentName <name>', 'Default LLM agent name')
    .option('--maximumPreparingIssuesCount <count>', 'Maximum number of issues in preparation status (default: 6 per available Claude OAuth token, otherwise 6)')
    .option('--utilizationPercentageThreshold <percent>', 'Per-token Claude 5h utilization % threshold; tokens at or above it are excluded from rotation. Per-token concurrency also tapers from 6 slots down to 1 as either the 5h or 7d utilization rises from 80% toward 100%, taking the more restrictive of the two (default: 90)')
    .option('--allowedIssueAuthors <authors>', 'Comma-separated list of allowed issue authors')
    .option('--preparationProcessCheckCommand <template>', 'Shell command template with {URL} placeholder to check if a preparation process is alive')
    .option('--fleetConfigFilePath <path>', 'Path to the fleet-wide YAML config file holding the preparationWorker mapping (normalConcurrentLimit); falls back to the TDPM_FLEET_CONFIG environment variable, and to the built-in values when neither is set')
    .action(async (options) => {
    const token = process.env.GH_TOKEN;
    if (!token) {
        console.error('GH_TOKEN environment variable is required');
        process.exit(1);
    }
    const configFileValues = (0, projectConfig_2.loadConfigFile)(options.configFilePath);
    const cliOverrides = {
        projectUrl: options.projectUrl,
        manager: options.manager,
        defaultAgentName: options.defaultAgentName,
        defaultLlmModelName: options.defaultLlmModelName,
        fallbackLlmModelName: options.fallbackLlmModelName,
        defaultLlmAgentName: options.defaultLlmAgentName,
        maximumPreparingIssuesCount: options.maximumPreparingIssuesCount
            ? Number(options.maximumPreparingIssuesCount)
            : undefined,
        utilizationPercentageThreshold: options.utilizationPercentageThreshold
            ? Number(options.utilizationPercentageThreshold)
            : undefined,
        allowedIssueAuthors: options.allowedIssueAuthors,
        preparationProcessCheckCommand: options.preparationProcessCheckCommand,
    };
    const tempProjectUrl = cliOverrides.projectUrl ?? configFileValues.projectUrl;
    let readmeOverrides = {};
    if (tempProjectUrl) {
        const readme = await (0, projectConfig_2.fetchProjectReadme)(tempProjectUrl, token);
        if (readme) {
            readmeOverrides = (0, projectConfig_2.parseProjectReadmeConfig)(readme, tempProjectUrl);
        }
    }
    const config = (0, projectConfig_2.mergeConfigs)(configFileValues, cliOverrides, readmeOverrides);
    if (config.errorReportingRepository) {
        process.env.TDPM_ERROR_REPORT_REPOSITORY =
            config.errorReportingRepository;
    }
    const projectUrl = config.projectUrl;
    const defaultAgentName = config.defaultAgentName;
    const manager = config.manager;
    if (!projectUrl) {
        console.error('projectUrl is required. Provide via --projectUrl, config file, or project README.');
        process.exit(1);
    }
    if (!defaultAgentName) {
        console.error('defaultAgentName is required. Provide via --defaultAgentName, config file, or project README.');
        process.exit(1);
    }
    if (!manager) {
        console.error('manager is required. Provide via the config file so that only issues assigned to the manager are picked up.');
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
    console.log(`maximumPreparingIssuesCount: ${maximumPreparingIssuesCount ?? 'null (default: 6 per available Claude OAuth token, otherwise 6)'}`);
    const fleetConfigFilePath = (0, fleetConfig_1.resolveFleetConfigFilePath)(options.fleetConfigFilePath ?? null);
    const preparationWorkerSettings = (0, fleetConfig_1.loadPreparationWorkerSettings)(fleetConfigFilePath);
    console.log(`Effective normalConcurrentLimit: ${preparationWorkerSettings.normalConcurrentLimit}${fleetConfigFilePath !== null ? ' (source: fleetConfig)' : ' (source: built-in default)'}`);
    const projectName = config.projectName ?? 'default';
    const localStorageRepository = new LocalStorageRepository_1.LocalStorageRepository();
    const cachePath = (0, localStorageCacheDirectory_1.projectCacheDirectory)(projectName);
    const localStorageCacheRepository = new LocalStorageCacheRepository_1.LocalStorageCacheRepository(localStorageRepository, cachePath);
    const githubRepositoryParams = buildGithubRepositoryParams(localStorageRepository, token);
    const projectRepository = new GraphqlProjectRepository_1.GraphqlProjectRepository(...githubRepositoryParams, localStorageCacheRepository);
    const apiV3IssueRepository = new ApiV3IssueRepository_1.ApiV3IssueRepository(...githubRepositoryParams);
    const restIssueRepository = new RestIssueRepository_1.RestIssueRepository(...githubRepositoryParams);
    const graphqlProjectItemRepository = new GraphqlProjectItemRepository_1.GraphqlProjectItemRepository(...githubRepositoryParams);
    const issueRepository = new ApiV3CheerioRestIssueRepository_1.ApiV3CheerioRestIssueRepository(apiV3IssueRepository, restIssueRepository, graphqlProjectItemRepository, localStorageCacheRepository, projectRepository, new SystemDateRepository_1.SystemDateRepository(), ...githubRepositoryParams);
    const localCommandRunner = new NodeLocalCommandRunner_1.NodeLocalCommandRunner();
    const preparationProcessCheckCommand = config.preparationProcessCheckCommand;
    if (preparationProcessCheckCommand) {
        const revertIssueCommentRepository = new GitHubIssueCommentRepository_1.GitHubIssueCommentRepository(token);
        const revertUseCase = new RevertOrphanedPreparationUseCase_1.RevertOrphanedPreparationUseCase(projectRepository, issueRepository, revertIssueCommentRepository, localCommandRunner);
        await revertUseCase.run({
            projectUrl,
            preparationProcessCheckCommand,
            thresholdForAutoReject: config.thresholdForAutoReject ?? 3,
            thresholdForDispatchLoop: config.thresholdForDispatchLoop,
            awLogDirectoryPath: config.awLogDirectoryPath,
            awLogStaleThresholdMinutes: config.awLogStaleThresholdMinutes,
            labelsAsLlmAgentName: config.labelsAsLlmAgentName ?? null,
            labelsNotRequiringPullRequest: config.labelsNotRequiringPullRequest ?? null,
        });
    }
    const claudeTokenUsageRepository = new ProxyClaudeTokenUsageRepository_1.ProxyClaudeTokenUsageRepository(config.claudeCodeOauthTokenListJsonPath ?? null);
    const useCase = new StartPreparationUseCase_1.StartPreparationUseCase(projectRepository, issueRepository, localCommandRunner, claudeTokenUsageRepository, new ProcTakeOwnershipSpawnRepository_1.ProcTakeOwnershipSpawnRepository());
    const rawAllowedIssueAuthors = config.allowedIssueAuthors;
    const allowedIssueAuthors = rawAllowedIssueAuthors
        ? rawAllowedIssueAuthors
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : null;
    const codexHomeCandidates = config.codexHomeCandidates && config.codexHomeCandidates.length > 0
        ? config.codexHomeCandidates
        : null;
    if (config.consoleAccessToken) {
        const consoleProcess = await (0, ensureConsoleRunning_1.ensureConsoleRunning)(options.configFilePath, webServer_1.DEFAULT_WEB_PORT, Object.keys(config.consoleProjects ?? {}));
        if (consoleProcess !== null) {
            process.once('SIGTERM', () => {
                consoleProcess.kill();
                process.exit(0);
            });
            process.once('SIGINT', () => {
                consoleProcess.kill();
                process.exit(0);
            });
        }
    }
    const preparationResult = await useCase.run({
        projectUrl,
        defaultAgentName,
        defaultLlmModelName: config.defaultLlmModelName ?? null,
        fallbackLlmModelName: config.fallbackLlmModelName ?? null,
        defaultLlmAgentName: config.defaultLlmAgentName ?? null,
        configFilePath: options.configFilePath,
        maximumPreparingIssuesCount,
        utilizationPercentageThreshold: config.utilizationPercentageThreshold ?? 90,
        allowedIssueAuthors,
        manager,
        codexHomeCandidates,
        labelsAsLlmAgentName: config.labelsAsLlmAgentName ?? null,
        agents: config.agents ?? null,
        normalConcurrentLimit: preparationWorkerSettings.normalConcurrentLimit,
    });
    if (preparationResult.rotationOrder !== null) {
        (0, rotationOrderFileWriter_1.writeRotationOrderFile)(preparationResult.rotationOrder);
    }
});
exports.program
    .command('notifyFinishedIssuePreparation')
    .description('Notify that issue preparation is finished')
    .requiredOption('--configFilePath <path>', 'Path to config file for tower defence management')
    .requiredOption('--issueUrl <url>', 'GitHub issue URL')
    .option('--projectUrl <url>', 'GitHub project URL')
    .option('--thresholdForAutoReject <count>', 'Threshold for auto-escalation after consecutive rejections (default: 3)')
    .option('--thresholdForDispatchLoop <count>', 'Threshold for auto-escalation after one agent is dispatched this many times since the last human comment, whether it names itself or two agents name each other in turn (default: 6)')
    .option('--workflowBlockerResolvedWebhookUrl <url>', 'Webhook URL to notify when a workflow blocker issue status changes to awaiting quality check. Supports {URL} and {MESSAGE} placeholders.')
    .option('--missingAgentName <name>', 'Agent definition name that was not found, triggering the missing-agent task creation path')
    .option('--sessionErrorLine <line>', 'Exact error line from the session log to include in the task issue body')
    .option('--deferPreparation', 'Defer the item via the Reactivation Trigger fields (sets nextActionDate to tomorrow) without creating any issue; use for transient upstream failures')
    .action(async (options) => {
    const token = process.env.GH_TOKEN;
    if (!token) {
        console.error('GH_TOKEN environment variable is required');
        process.exit(1);
    }
    const configFileValues = (0, projectConfig_2.loadConfigFile)(options.configFilePath);
    const cliOverrides = {
        projectUrl: options.projectUrl,
        thresholdForAutoReject: options.thresholdForAutoReject
            ? Number(options.thresholdForAutoReject)
            : undefined,
        thresholdForDispatchLoop: options.thresholdForDispatchLoop
            ? Number(options.thresholdForDispatchLoop)
            : undefined,
        workflowBlockerResolvedWebhookUrl: options.workflowBlockerResolvedWebhookUrl,
    };
    const tempProjectUrl = cliOverrides.projectUrl ?? configFileValues.projectUrl;
    let readmeOverrides = {};
    if (tempProjectUrl) {
        const readme = await (0, projectConfig_2.fetchProjectReadme)(tempProjectUrl, token);
        if (readme) {
            readmeOverrides = (0, projectConfig_2.parseProjectReadmeConfig)(readme, tempProjectUrl);
        }
    }
    const config = (0, projectConfig_2.mergeConfigs)(configFileValues, cliOverrides, readmeOverrides);
    if (config.errorReportingRepository) {
        process.env.TDPM_ERROR_REPORT_REPOSITORY =
            config.errorReportingRepository;
    }
    const projectUrl = config.projectUrl;
    if (!projectUrl) {
        console.error('projectUrl is required. Provide via --projectUrl, config file, or project README.');
        process.exit(1);
    }
    const thresholdForAutoReject = resolvePositiveIntegerOption(config.thresholdForAutoReject, 'thresholdForAutoReject', 3);
    const thresholdForDispatchLoop = resolvePositiveIntegerOption(config.thresholdForDispatchLoop, 'thresholdForDispatchLoop', resolveNextStepAgentDispatchRepetition_1.DEFAULT_THRESHOLD_FOR_DISPATCH_LOOP);
    const workflowBlockerResolvedWebhookUrl = config.workflowBlockerResolvedWebhookUrl ?? null;
    const projectName = config.projectName ?? 'default';
    const localStorageRepository = new LocalStorageRepository_1.LocalStorageRepository();
    const cachePath = (0, localStorageCacheDirectory_1.projectCacheDirectory)(projectName);
    const localStorageCacheRepository = new LocalStorageCacheRepository_1.LocalStorageCacheRepository(localStorageRepository, cachePath);
    const githubRepositoryParams = buildGithubRepositoryParams(localStorageRepository, token);
    const projectRepository = new GraphqlProjectRepository_1.GraphqlProjectRepository(...githubRepositoryParams, localStorageCacheRepository);
    const apiV3IssueRepository = new ApiV3IssueRepository_1.ApiV3IssueRepository(...githubRepositoryParams);
    const restIssueRepository = new RestIssueRepository_1.RestIssueRepository(...githubRepositoryParams);
    const graphqlProjectItemRepository = new GraphqlProjectItemRepository_1.GraphqlProjectItemRepository(...githubRepositoryParams);
    const issueRepository = new ApiV3CheerioRestIssueRepository_1.ApiV3CheerioRestIssueRepository(apiV3IssueRepository, restIssueRepository, graphqlProjectItemRepository, localStorageCacheRepository, projectRepository, new SystemDateRepository_1.SystemDateRepository(), ...githubRepositoryParams);
    const issueCommentRepository = new GitHubIssueCommentRepository_1.GitHubIssueCommentRepository(token);
    const webhookRepository = new FetchWebhookRepository_1.FetchWebhookRepository();
    const consoleDataOutputDir = config.consoleDataOutputDir ?? null;
    const consoleTabsRepository = consoleDataOutputDir !== null
        ? new FileSystemConsoleTabsRepository_1.FileSystemConsoleTabsRepository(consoleDataOutputDir, projectName)
        : null;
    const useCase = new NotifyFinishedIssuePreparationUseCase_1.NotifyFinishedIssuePreparationUseCase(projectRepository, issueRepository, issueCommentRepository, webhookRepository, consoleTabsRepository);
    const rawAllowedIssueAuthors = config.allowedIssueAuthors;
    const allowedIssueAuthors = rawAllowedIssueAuthors
        ? rawAllowedIssueAuthors
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : null;
    await useCase.run({
        projectUrl,
        issueUrl: options.issueUrl,
        thresholdForAutoReject,
        thresholdForDispatchLoop,
        workflowBlockerResolvedWebhookUrl,
        allowedIssueAuthors,
        labelsAsLlmAgentName: config.labelsAsLlmAgentName ?? null,
        labelsNotRequiringPullRequest: config.labelsNotRequiringPullRequest ?? null,
        changeTargetPathAliases: config.changeTargetPathAliases ?? null,
        agents: config.agents ?? null,
        missingAgentName: options.missingAgentName ?? null,
        sessionErrorLine: options.sessionErrorLine ?? null,
        manager: config.manager ?? null,
        developerAgentName: config.developerAgentName ?? null,
        deferPreparation: options.deferPreparation ?? null,
    });
});
exports.program
    .command('checkIssueReviewReadiness')
    .description('Check whether an issue is in a review-ready state without mutating any field or posting any comment')
    .requiredOption('--configFilePath <path>', 'Path to config file for tower defence management')
    .requiredOption('--issueUrl <url>', 'GitHub issue URL')
    .option('--projectUrl <url>', 'GitHub project URL (optional)')
    .action(async (options) => {
    const token = process.env.GH_TOKEN;
    if (!token) {
        console.error('GH_TOKEN environment variable is required');
        process.exit(1);
    }
    const configFileValues = (0, projectConfig_2.loadConfigFile)(options.configFilePath);
    const cliOverrides = {
        projectUrl: options.projectUrl,
    };
    const tempProjectUrl = cliOverrides.projectUrl ?? configFileValues.projectUrl;
    let readmeOverrides = {};
    if (tempProjectUrl) {
        const readme = await (0, projectConfig_2.fetchProjectReadme)(tempProjectUrl, token);
        if (readme) {
            readmeOverrides = (0, projectConfig_2.parseProjectReadmeConfig)(readme, tempProjectUrl);
        }
    }
    const config = (0, projectConfig_2.mergeConfigs)(configFileValues, cliOverrides, readmeOverrides);
    if (config.errorReportingRepository) {
        process.env.TDPM_ERROR_REPORT_REPOSITORY =
            config.errorReportingRepository;
    }
    const projectName = config.projectName ?? 'default';
    const localStorageRepository = new LocalStorageRepository_1.LocalStorageRepository();
    const cachePath = (0, localStorageCacheDirectory_1.projectCacheDirectory)(projectName);
    const localStorageCacheRepository = new LocalStorageCacheRepository_1.LocalStorageCacheRepository(localStorageRepository, cachePath);
    const githubRepositoryParams = buildGithubRepositoryParams(localStorageRepository, token);
    const apiV3IssueRepository = new ApiV3IssueRepository_1.ApiV3IssueRepository(...githubRepositoryParams);
    const restIssueRepository = new RestIssueRepository_1.RestIssueRepository(...githubRepositoryParams);
    const graphqlProjectItemRepository = new GraphqlProjectItemRepository_1.GraphqlProjectItemRepository(...githubRepositoryParams);
    const projectRepository = new GraphqlProjectRepository_1.GraphqlProjectRepository(...githubRepositoryParams, localStorageCacheRepository);
    const issueRepository = new ApiV3CheerioRestIssueRepository_1.ApiV3CheerioRestIssueRepository(apiV3IssueRepository, restIssueRepository, graphqlProjectItemRepository, localStorageCacheRepository, projectRepository, new SystemDateRepository_1.SystemDateRepository(), ...githubRepositoryParams);
    const issueCommentRepository = new GitHubIssueCommentRepository_1.GitHubIssueCommentRepository(token);
    const rawAllowedIssueAuthors = config.allowedIssueAuthors;
    const allowedIssueAuthors = rawAllowedIssueAuthors
        ? rawAllowedIssueAuthors
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : null;
    const useCase = new CheckIssueReviewReadinessUseCase_1.CheckIssueReviewReadinessUseCase(issueRepository, issueCommentRepository);
    const result = await useCase.run({
        issueUrl: options.issueUrl,
        allowedIssueAuthors,
        labelsAsLlmAgentName: config.labelsAsLlmAgentName ?? null,
        labelsNotRequiringPullRequest: config.labelsNotRequiringPullRequest ?? null,
        developerAgentName: config.developerAgentName ?? null,
    });
    process.stdout.write(`${JSON.stringify(result)}\n`);
});
const runServeWeb = async (options) => {
    const config = (0, projectConfig_2.loadConfigFile)(options.configFilePath);
    const accessToken = config.consoleAccessToken;
    if (!accessToken) {
        console.error('consoleAccessToken is required. Provide it via the config file.');
        process.exit(1);
    }
    let port = webServer_1.DEFAULT_WEB_PORT;
    if (options.port !== undefined) {
        const parsedPort = Number(options.port);
        if (!Number.isFinite(parsedPort) ||
            !Number.isInteger(parsedPort) ||
            parsedPort <= 0 ||
            parsedPort > 65535) {
            console.error('Invalid value for --port. It must be a positive integer between 1 and 65535.');
            process.exit(1);
        }
        port = parsedPort;
    }
    const token = process.env.GH_TOKEN;
    if (!token) {
        console.error('GH_TOKEN environment variable is required');
        process.exit(1);
    }
    const projectUrl = config.projectUrl;
    if (!projectUrl) {
        console.error('projectUrl is required. Provide it via the config file or project README.');
        process.exit(1);
    }
    const dashboardProjectNames = parseDashboardProjectNames(options.dashboardProjectNames);
    const projectName = config.projectName ?? 'default';
    const localStorageRepository = new LocalStorageRepository_1.LocalStorageRepository();
    const cachePath = (0, localStorageCacheDirectory_1.projectCacheDirectory)(projectName);
    const localStorageCacheRepository = new LocalStorageCacheRepository_1.LocalStorageCacheRepository(localStorageRepository, cachePath);
    const githubRepositoryParams = buildGithubRepositoryParams(localStorageRepository, token);
    const projectRepository = new GraphqlProjectRepository_1.GraphqlProjectRepository(...githubRepositoryParams, localStorageCacheRepository);
    const apiV3IssueRepository = new ApiV3IssueRepository_1.ApiV3IssueRepository(...githubRepositoryParams);
    const restIssueRepository = new RestIssueRepository_1.RestIssueRepository(...githubRepositoryParams);
    const graphqlProjectItemRepository = new GraphqlProjectItemRepository_1.GraphqlProjectItemRepository(...githubRepositoryParams);
    const issueRepository = new ApiV3CheerioRestIssueRepository_1.ApiV3CheerioRestIssueRepository(apiV3IssueRepository, restIssueRepository, graphqlProjectItemRepository, localStorageCacheRepository, projectRepository, new SystemDateRepository_1.SystemDateRepository(), ...githubRepositoryParams);
    const resolveGithubToken = (0, consoleGithubTokenResolver_1.createConsoleGithubTokenResolver)(token, config.consoleProjects ?? null, config.consoleGithubTokenFileDir ?? null, (filePath) => fs_1.default.readFileSync(filePath, 'utf8'));
    const issueRepositoryByToken = new Map();
    issueRepositoryByToken.set(token, issueRepository);
    const buildIssueRepositoryForToken = (repositoryToken) => {
        const alreadyBuilt = issueRepositoryByToken.get(repositoryToken);
        if (alreadyBuilt !== undefined) {
            return alreadyBuilt;
        }
        const repositoryParams = buildGithubRepositoryParams(localStorageRepository, repositoryToken);
        const built = new ApiV3CheerioRestIssueRepository_1.ApiV3CheerioRestIssueRepository(new ApiV3IssueRepository_1.ApiV3IssueRepository(...repositoryParams), new RestIssueRepository_1.RestIssueRepository(...repositoryParams), new GraphqlProjectItemRepository_1.GraphqlProjectItemRepository(...repositoryParams), localStorageCacheRepository, new GraphqlProjectRepository_1.GraphqlProjectRepository(...repositoryParams, localStorageCacheRepository), new SystemDateRepository_1.SystemDateRepository(), ...repositoryParams);
        issueRepositoryByToken.set(repositoryToken, built);
        return built;
    };
    const resolveIssueRepository = (0, consoleGithubTokenResolver_1.createConsoleIssueRepositoryResolver)(resolveGithubToken, buildIssueRepositoryForToken);
    const resolveGithubTokenForItemUrl = (0, consoleGithubTokenResolver_1.createConsoleGithubTokenResolverByItemUrl)(resolveGithubToken);
    const projectRepositoryByToken = new Map();
    projectRepositoryByToken.set(token, projectRepository);
    const buildProjectRepositoryForToken = (repositoryToken) => {
        const alreadyBuilt = projectRepositoryByToken.get(repositoryToken);
        if (alreadyBuilt !== undefined) {
            return alreadyBuilt;
        }
        const built = new GraphqlProjectRepository_1.GraphqlProjectRepository(...buildGithubRepositoryParams(localStorageRepository, repositoryToken), localStorageCacheRepository);
        projectRepositoryByToken.set(repositoryToken, built);
        return built;
    };
    const resolveProjectRepository = (0, consoleGithubTokenResolver_1.createConsoleProjectRepositoryResolver)(resolveGithubToken, buildProjectRepositoryForToken);
    const pjcodeToProjectUrl = (0, consoleProjectResolver_1.buildPjcodeToProjectUrl)(projectName, projectUrl, config.consoleProjects ?? null);
    const isPjcodeConfigured = (0, consoleProjectResolver_1.createPjcodeConfigChecker)(pjcodeToProjectUrl);
    const { resolve: resolveProject, invalidate: invalidateProject, updateEntry: updateProjectCacheEntry, } = (0, consoleProjectResolver_1.createConsoleProjectResolver)(pjcodeToProjectUrl, (0, consoleProjectResolver_1.createConsoleProjectLoader)(resolveProjectRepository, (targetProjectId) => issueRepository.getCachedProject(targetProjectId), (message) => console.error(message)));
    const uiDistDir = path.join(__dirname, '..', 'console', 'ui-dist');
    const consoleDataOutputDir = options.consoleDataOutputDir ?? null;
    const inTmuxDataDir = options.inTmuxDataDir ?? DEFAULT_IN_TMUX_DATA_DIR;
    const dashboardDir = options.dashboardDir ?? DEFAULT_DASHBOARD_DIR;
    const dashboardDataDir = options.dashboardDataDir ?? DEFAULT_DASHBOARD_DATA_DIR;
    await (0, webServer_1.startWebServer)({
        accessToken,
        uiDistDir,
        consoleDataOutputDir,
        inTmuxDataDir,
        dashboardDir,
        dashboardDataDir,
        dashboardProjectNames,
        resolveGithubToken,
        issueRepository,
        resolveIssueRepository,
        resolveProject,
        isPjcodeConfigured,
        resolveProjectRepository,
        invalidateProject,
        updateProjectCacheEntry,
        issueAttachmentRepository: new LocalCommandIssueAttachmentRepository_1.LocalCommandIssueAttachmentRepository(new NodeLocalCommandRunner_1.NodeLocalCommandRunner(), resolveGithubTokenForItemUrl),
        issueTitleStateCache: new consoleReadApi_1.IssueTitleStateCache(),
        pullRequestStatusCache: new consoleReadApi_1.PullRequestStatusCache(),
        port,
        enableAirplaneMode: options.enableAirplaneMode === true,
    });
    console.log(`TDPM web server listening on port ${port}`);
};
const addServeWebOptions = (command) => command
    .requiredOption('--configFilePath <path>', 'Path to config file for tower defence management')
    .option('--port <number>', `Port for the web HTTP server (default: ${webServer_1.DEFAULT_WEB_PORT})`)
    .option('--consoleDataOutputDir <path>', 'Directory where console data files are written and served from')
    .option('--inTmuxDataDir <path>', `Directory containing the flat in-tmux-by-human static JSON files served at /in-tmux-by-human/*.json (default: ${DEFAULT_IN_TMUX_DATA_DIR})`)
    .option('--dashboardDir <path>', `Directory containing the static dashboard HTML fragment tdpm.txt served at /tdpm.txt when compose mode is not active (default: ${DEFAULT_DASHBOARD_DIR})`)
    .option('--dashboardDataDir <path>', 'Directory containing the dashboard data files (projects/<projectName>.json, machine-status.json, token-status.json); when set and every required file is present the server composes the /tdpm.txt fragment from them at request time, otherwise it falls back to serving the static tdpm.txt from --dashboardDir (unset when not configured)')
    .option('--dashboardProjectNames <names>', 'Comma-separated project names, in display order, for the dashboard project grid; the display label of each project is its first 2 characters, which must be unique across the listed names')
    .option('--enableAirplaneMode', 'Enable the airplane mode feature');
addServeWebOptions(exports.program.command('serveWeb'))
    .description('Start the local TDPM web server (console tabs, dashboard, and in-tmux session list)')
    .action(async (options) => {
    await runServeWeb(options);
});
addServeWebOptions(exports.program.command('serveConsole'))
    .description('Deprecated alias for serveWeb. Use serveWeb instead.')
    .action(async (options) => {
    await runServeWeb(options);
});
exports.program
    .command('selectOauthToken')
    .description('Print exactly one Claude Code OAuth token chosen by a rate-limit-aware filter. Among rate-limit-eligible tokens the choice is weighted-random, with each token weighted by its per-token selectionWeight (default 1) multiplied by how urgent its 7d window is (the free share of that window times 168 divided by the hours left before it resets, with those hours floored at 1), so a token holding unused allowance that resets soon is chosen more often. When every eligible weight is identical, the choice stays deterministic and no random draw is made. The token string is written to stdout (pipeable); the per-candidate decision trace is written to stderr. Exits non-zero when no token passes the filter.')
    .option('--tokenListJsonPath <path>', 'Path to the JSON array of { name, token, selectionWeight? } records. selectionWeight is an optional positive number (default 1) that biases how often this token is chosen among rate-limit-eligible candidates; a smaller weight is chosen proportionally less often and never bypasses eligibility filtering or starves a sole eligible token. Falls back to the CLAUDE_CODE_OAUTH_TOKEN_LIST_JSON_PATH environment variable.')
    .option('--cacheDir <path>', 'Directory holding per-token rate-limit cache files. Falls back to the TDPM_RATELIMIT_CACHE_DIR environment variable, then to ${XDG_CACHE_HOME:-~/.cache}/tdpm/ratelimit.')
    .action((options) => {
    const handler = new OauthTokenSelectHandler_1.OauthTokenSelectHandler();
    const output = handler.handle({
        tokenListJsonPath: options.tokenListJsonPath ?? null,
        cacheDirectory: options.cacheDir ?? null,
        nowEpochSeconds: Date.now() / 1000,
    });
    for (const line of output.diagnostics) {
        console.error(line);
    }
    if (output.selectedToken === null) {
        process.exit(1);
    }
    process.stdout.write(`${output.selectedToken}\n`);
});
exports.program
    .command('selectLiveSessionOauthToken')
    .description('Print exactly one Claude Code OAuth token chosen for a new live interactive session. The choice is deterministic. Each rate-limit-eligible token gets a concurrent session limit of maxConcurrentSessionCount (default 10), scaled by its per-token selectionWeight (default 1). That limit is held at full value while the free share of the 5h window is at or above fullSpeedFiveHourFreeRatio (default 0.5) and is tapered in proportion below it, never dropping under 1; the 7d window never lowers the limit, so a weekly allowance that is about to expire is drained at full speed instead of being discarded unused. Among eligible tokens still under that limit the token whose 7d window resets soonest wins; ties go to the token carrying fewer live sessions (by distinct CLAUDE_CODE_SESSION_ID found in running Claude Code processes). When every eligible token is at its limit the soonest-resetting one is still returned. The token string is written to stdout (pipeable); the per-candidate decision trace is written to stderr. Exits non-zero when no token passes the filter.')
    .option('--tokenListJsonPath <path>', 'Path to the JSON array of { name, token, selectionWeight? } records. selectionWeight is an optional positive number (default 1) that scales this token concurrent live session limit; a smaller weight allows fewer simultaneous sessions and never bypasses eligibility filtering or starves a sole eligible token. Falls back to the CLAUDE_CODE_OAUTH_TOKEN_LIST_JSON_PATH environment variable.')
    .option('--cacheDir <path>', 'Directory holding per-token rate-limit cache files. Falls back to the TDPM_RATELIMIT_CACHE_DIR environment variable, then to ${XDG_CACHE_HOME:-~/.cache}/tdpm/ratelimit.')
    .option('--fleetConfigFilePath <path>', 'Path to the fleet-wide YAML config file holding the liveSessionOauthTokenSelection mapping (maxConcurrentSessionCount, fullSpeedFiveHourFreeRatio). Falls back to the TDPM_FLEET_CONFIG environment variable; when neither is set the built-in values are used. A key the file omits keeps its built-in value, and an unreadable file or an out-of-range value is reported as an error instead of being ignored.')
    .action((options) => {
    const handler = new LiveSessionOauthTokenSelectHandler_1.LiveSessionOauthTokenSelectHandler();
    const output = handler.handle({
        tokenListJsonPath: options.tokenListJsonPath ?? null,
        cacheDirectory: options.cacheDir ?? null,
        nowEpochSeconds: Date.now() / 1000,
        selectionSettings: (0, fleetConfig_1.loadLiveSessionOauthTokenSelectionSettings)((0, fleetConfig_1.resolveFleetConfigFilePath)(options.fleetConfigFilePath ?? null)),
    });
    for (const line of output.diagnostics) {
        console.error(line);
    }
    if (output.selectedToken === null) {
        process.exit(1);
    }
    process.stdout.write(`${output.selectedToken}\n`);
});
exports.program
    .command('countInTmuxByHumanSessionsPerToken')
    .description('Print, per Claude Code OAuth token, the count of live interactive sessions (cl-launched Claude processes carrying CLAUDE_CODE_OAUTH_TOKEN and CLAUDE_CODE_SESSION_ID with a --name <issue-url> argument, excluding Take ownership spawns) whose issue is currently in GitHub Project Status "In Tmux by human". One tab-separated line per token (<tokenName>\\t<count>) is written to stdout; the decision trace is written to stderr. Token values are never printed.')
    .requiredOption('--configFilePath <path>', 'Path to config file for tower defence management')
    .option('--projectUrl <url>', 'GitHub project URL (optional)')
    .option('--tokenListJsonPath <path>', 'Path to the JSON array of { name, token } records. Falls back to the claudeCodeOauthTokenListJsonPath config value, then to the CLAUDE_CODE_OAUTH_TOKEN_LIST_JSON_PATH environment variable.')
    .action(async (options) => {
    const token = process.env.GH_TOKEN;
    if (!token) {
        console.error('GH_TOKEN environment variable is required');
        process.exit(1);
    }
    const configFileValues = (0, projectConfig_2.loadConfigFile)(options.configFilePath);
    const cliOverrides = {
        projectUrl: options.projectUrl,
    };
    const tempProjectUrl = cliOverrides.projectUrl ?? configFileValues.projectUrl;
    let readmeOverrides = {};
    if (tempProjectUrl) {
        const readme = await (0, projectConfig_2.fetchProjectReadme)(tempProjectUrl, token);
        if (readme) {
            readmeOverrides = (0, projectConfig_2.parseProjectReadmeConfig)(readme, tempProjectUrl);
        }
    }
    const config = (0, projectConfig_2.mergeConfigs)(configFileValues, cliOverrides, readmeOverrides);
    const projectUrl = config.projectUrl;
    if (!projectUrl) {
        console.error('projectUrl is required. Provide via --projectUrl, config file, or project README.');
        process.exit(1);
    }
    const projectName = config.projectName ?? 'default';
    const localStorageRepository = new LocalStorageRepository_1.LocalStorageRepository();
    const cachePath = (0, localStorageCacheDirectory_1.projectCacheDirectory)(projectName);
    const localStorageCacheRepository = new LocalStorageCacheRepository_1.LocalStorageCacheRepository(localStorageRepository, cachePath);
    const githubRepositoryParams = buildGithubRepositoryParams(localStorageRepository, token);
    const projectRepository = new GraphqlProjectRepository_1.GraphqlProjectRepository(...githubRepositoryParams, localStorageCacheRepository);
    const apiV3IssueRepository = new ApiV3IssueRepository_1.ApiV3IssueRepository(...githubRepositoryParams);
    const restIssueRepository = new RestIssueRepository_1.RestIssueRepository(...githubRepositoryParams);
    const graphqlProjectItemRepository = new GraphqlProjectItemRepository_1.GraphqlProjectItemRepository(...githubRepositoryParams);
    const issueRepository = new ApiV3CheerioRestIssueRepository_1.ApiV3CheerioRestIssueRepository(apiV3IssueRepository, restIssueRepository, graphqlProjectItemRepository, localStorageCacheRepository, projectRepository, new SystemDateRepository_1.SystemDateRepository(), ...githubRepositoryParams);
    const projectId = await projectRepository.findProjectIdByUrl(projectUrl);
    if (!projectId) {
        console.error(`No project found for projectUrl ${projectUrl}`);
        process.exit(1);
    }
    const { issues } = await issueRepository.getAllIssues(projectId);
    const handler = new InTmuxByHumanSessionTokenCountHandler_1.InTmuxByHumanSessionTokenCountHandler();
    const output = handler.handle({
        tokenListJsonPath: options.tokenListJsonPath ??
            config.claudeCodeOauthTokenListJsonPath ??
            null,
        issues,
    });
    for (const line of output.diagnostics) {
        console.error(line);
    }
    for (const line of output.lines) {
        process.stdout.write(`${line}\n`);
    }
});
exports.program
    .command('killTmuxSession')
    .description('Cleanly kill a tmux session by running tmux kill-session and stopping its cl-*.scope systemd --user unit. Use --session <name> to kill another named session, or --self to terminate the current session from inside it.')
    .option('--session <name>', 'Name of the tmux session to kill')
    .option('--self', 'Terminate the current session by stopping its own cl-*.scope systemd user unit, derived from /proc/self/cgroup')
    .action(async (options) => {
    if (!options.session && !options.self) {
        console.error('Either --session <name> or --self is required');
        process.exit(1);
    }
    if (options.session && options.self) {
        console.error('--session and --self cannot be used together');
        process.exit(1);
    }
    const localCommandRunner = new NodeLocalCommandRunner_1.NodeLocalCommandRunner();
    const tmuxSessionRepository = new NodeTmuxSessionRepository_1.NodeTmuxSessionRepository(localCommandRunner);
    if (options.self) {
        await tmuxSessionRepository.killOwnSession();
    }
    else if (options.session) {
        await tmuxSessionRepository.killSession(options.session);
    }
});
exports.program
    .command('ownerCallFileAppend')
    .description('Append one owner call as a YAML document to the per-session owner call file. The project the session belongs to is resolved from the in-tmux-by-human data in the data directory, and a session no project lists is written under NA. The file is created when it does not exist, and every later call is appended after the existing documents so the oldest call stays first. Nothing is written to stdout on success.')
    .requiredOption('--session <name>', 'tmux session name that raised the call')
    .requiredOption('--calledAt <timestamp>', 'Time the call was raised, as UTC ISO-8601 with second precision and a trailing Z')
    .requiredOption('--body-file <path>', 'Path to the file holding the call body; the body is read from a file because it is multi-line and can be long')
    .option('--inTmuxDataDir <path>', `Directory the owner call files are written under, the same directory serveWeb serves them from (default: ${DEFAULT_IN_TMUX_DATA_DIR})`)
    .action((options) => {
    if (!(0, OwnerCallFile_1.isOwnerCallCalledAtValid)(options.calledAt)) {
        console.error('--calledAt must be a UTC ISO-8601 timestamp with second precision and a trailing Z, for example 2026-08-14T04:22:28Z');
        return process.exit(1);
    }
    const dataDir = options.inTmuxDataDir ?? DEFAULT_IN_TMUX_DATA_DIR;
    (0, ownerCallFileStore_1.ownerCallFileAppend)({
        dataDir,
        projectCode: (0, ownerCallFileStore_1.ownerCallProjectCodeInInTmuxByHumanData)(dataDir, options.session),
        ownerCall: {
            sessionName: options.session,
            calledAt: options.calledAt,
            body: fs_1.default.readFileSync(options.bodyFile, 'utf-8'),
        },
    });
});
exports.program
    .command('ownerCallFileDelete')
    .description('Delete the owner call file of one session, whichever project directory holds it, so a session that moved between projects after its call was appended leaves nothing behind. It succeeds when the file is already absent, so a reset that runs twice is not an error. Nothing is written to stdout on success.')
    .requiredOption('--session <name>', 'tmux session name that raised the call')
    .option('--inTmuxDataDir <path>', `Directory the owner call files are written under, the same directory serveWeb serves them from (default: ${DEFAULT_IN_TMUX_DATA_DIR})`)
    .action((options) => {
    (0, ownerCallFileStore_1.ownerCallFileDeleteInEveryProject)({
        dataDir: options.inTmuxDataDir ?? DEFAULT_IN_TMUX_DATA_DIR,
        sessionName: options.session,
    });
});
exports.program
    .command('attachOrCreate')
    .description('Attach to an existing tmux session registered for the given issue URL, or create a new one. Looks up the cl session registry via cl-scope-lib.sh to find a registered session name; if that session is still alive it attaches to it, otherwise creates a new interactive session running cl for the issue URL.')
    .requiredOption('--issueUrl <url>', 'GitHub issue URL to attach to or create a session for')
    .action(async (options) => {
    const localCommandRunner = new NodeLocalCommandRunner_1.NodeLocalCommandRunner();
    const tmuxSessionRepository = new NodeTmuxSessionRepository_1.NodeTmuxSessionRepository(localCommandRunner);
    const scopeLibPath = resolveScopeLibPath();
    await tmuxSessionRepository.attachOrCreateInteractiveSession(options.issueUrl, scopeLibPath);
});
const reportFatalErrorAndExit = (error) => {
    console.error(error);
    process.exit(1);
};
exports.reportFatalErrorAndExit = reportFatalErrorAndExit;
const buildCliErrorReporter = () => {
    const token = process.env.GH_TOKEN;
    const targetRepo = process.env.TDPM_ERROR_REPORT_REPOSITORY;
    if (!token || !targetRepo) {
        return null;
    }
    const slashIndex = targetRepo.indexOf('/');
    if (slashIndex <= 0 || slashIndex === targetRepo.length - 1) {
        return null;
    }
    const owner = targetRepo.slice(0, slashIndex);
    const repo = targetRepo.slice(slashIndex + 1);
    const localStorageRepository = new LocalStorageRepository_1.LocalStorageRepository();
    const githubRepositoryParams = buildGithubRepositoryParams(localStorageRepository, token);
    const apiV3IssueRepository = new ApiV3IssueRepository_1.ApiV3IssueRepository(...githubRepositoryParams);
    const restIssueRepository = new RestIssueRepository_1.RestIssueRepository(...githubRepositoryParams);
    const useCase = new CliErrorReportUseCase_1.CliErrorReportUseCase({
        searchIssue: apiV3IssueRepository.searchIssue.bind(apiV3IssueRepository),
        createNewIssue: restIssueRepository.createNewIssue.bind(restIssueRepository),
        createCommentByUrl: async (issueOrPrUrl, commentBody) => {
            await restIssueRepository.createComment(issueOrPrUrl, commentBody);
        },
    });
    return { useCase, owner, repo };
};
const runCliProgram = async (argv, handleFatalError) => {
    let reported = false;
    const safeReport = async (error) => {
        if (reported) {
            return;
        }
        reported = true;
        const reporter = buildCliErrorReporter();
        if (!reporter) {
            return;
        }
        await reporter.useCase.run({
            error,
            owner: reporter.owner,
            repo: reporter.repo,
            commandLine: argv.join(' '),
        });
    };
    process.on('uncaughtException', (error) => {
        void safeReport(error).then(() => {
            (0, exports.reportFatalErrorAndExit)(error);
        });
    });
    process.on('unhandledRejection', (reason) => {
        void safeReport(reason).then(() => {
            (0, exports.reportFatalErrorAndExit)(reason);
        });
    });
    try {
        await exports.program.parseAsync(argv);
    }
    catch (error) {
        await safeReport(error);
        handleFatalError(error);
    }
};
exports.runCliProgram = runCliProgram;
/* istanbul ignore next */
if (process.argv && require.main === module) {
    void (0, exports.runCliProgram)(process.argv, exports.reportFatalErrorAndExit);
}
//# sourceMappingURL=index.js.map