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
Object.defineProperty(exports, "__esModule", { value: true });
exports.program = exports.fetchProjectReadme = exports.mergeConfigs = exports.parseProjectReadmeConfig = exports.loadConfigFile = void 0;
const commander_1 = require("commander");
var projectConfig_1 = require("./projectConfig");
Object.defineProperty(exports, "loadConfigFile", { enumerable: true, get: function () { return projectConfig_1.loadConfigFile; } });
Object.defineProperty(exports, "parseProjectReadmeConfig", { enumerable: true, get: function () { return projectConfig_1.parseProjectReadmeConfig; } });
Object.defineProperty(exports, "mergeConfigs", { enumerable: true, get: function () { return projectConfig_1.mergeConfigs; } });
Object.defineProperty(exports, "fetchProjectReadme", { enumerable: true, get: function () { return projectConfig_1.fetchProjectReadme; } });
const projectConfig_2 = require("./projectConfig");
const StartPreparationUseCase_1 = require("../../../domain/usecases/StartPreparationUseCase");
const rotationOrderFileWriter_1 = require("../handlers/rotationOrderFileWriter");
const ProxyClaudeTokenUsageRepository_1 = require("../../repositories/ProxyClaudeTokenUsageRepository");
const NotifyFinishedIssuePreparationUseCase_1 = require("../../../domain/usecases/NotifyFinishedIssuePreparationUseCase");
const CheckIssueReviewReadinessUseCase_1 = require("../../../domain/usecases/CheckIssueReviewReadinessUseCase");
const LocalStorageRepository_1 = require("../../repositories/LocalStorageRepository");
const GraphqlProjectRepository_1 = require("../../repositories/GraphqlProjectRepository");
const ApiV3IssueRepository_1 = require("../../repositories/issue/ApiV3IssueRepository");
const RestIssueRepository_1 = require("../../repositories/issue/RestIssueRepository");
const GraphqlProjectItemRepository_1 = require("../../repositories/issue/GraphqlProjectItemRepository");
const ApiV3CheerioRestIssueRepository_1 = require("../../repositories/issue/ApiV3CheerioRestIssueRepository");
const LocalStorageCacheRepository_1 = require("../../repositories/LocalStorageCacheRepository");
const NodeLocalCommandRunner_1 = require("../../repositories/NodeLocalCommandRunner");
const GitHubIssueCommentRepository_1 = require("../../repositories/GitHubIssueCommentRepository");
const FetchWebhookRepository_1 = require("../../repositories/FetchWebhookRepository");
const RevertOrphanedPreparationUseCase_1 = require("../../../domain/usecases/RevertOrphanedPreparationUseCase");
const ensurePrReviewViewerRunning_1 = require("../../proxy/ensurePrReviewViewerRunning");
const prReviewViewerEntry_1 = require("../../proxy/prReviewViewerEntry");
const buildGithubRepositoryParams = (localStorageRepository, token) => [
    localStorageRepository,
    token,
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
        const { HandleScheduledEventUseCaseHandler } = await Promise.resolve().then(() => __importStar(require('../handlers/HandleScheduledEventUseCaseHandler')));
        const handler = new HandleScheduledEventUseCaseHandler();
        await handler.handle(options.config, options.verbose);
    }
});
exports.program
    .command('startDaemon')
    .description('Start daemon to prepare GitHub issues')
    .requiredOption('--configFilePath <path>', 'Path to config file for tower defence management')
    .option('--projectUrl <url>', 'GitHub project URL')
    .option('--defaultAgentName <name>', 'Default agent name')
    .option('--defaultLlmModelName <name>', 'Default LLM model name')
    .option('--fallbackLlmModelName <name>', 'LLM model to fall back to when the default Sonnet model is selected but its 7-day weekly limit is exhausted across all tokens (default: claude-opus-4-8)')
    .option('--defaultLlmAgentName <name>', 'Default LLM agent name')
    .option('--maximumPreparingIssuesCount <count>', 'Maximum number of issues in preparation status (default: 6 per available Claude OAuth token, otherwise 6)')
    .option('--allowIssueCacheMinutes <minutes>', 'Allow cache for issues in minutes (default: 10)')
    .option('--utilizationPercentageThreshold <percent>', 'Per-token Claude 5h utilization % threshold; tokens at or above it are excluded from rotation. Per-token concurrency also tapers from 6 slots down to 1 as either the 5h or 7d utilization rises from 80% toward 100%, taking the more restrictive of the two (default: 90)')
    .option('--allowedIssueAuthors <authors>', 'Comma-separated list of allowed issue authors')
    .option('--preparationProcessCheckCommand <template>', 'Shell command template with {URL} placeholder to check if a preparation process is alive')
    .option('--prReviewViewerAccessKey <key>', 'Access key for the PR review viewer server (if set, the viewer server is started before the preparation cycle)')
    .option('--prReviewViewerPort <port>', `Port for the PR review viewer server (default: ${ensurePrReviewViewerRunning_1.PR_REVIEW_VIEWER_DEFAULT_PORT})`)
    .action(async (options) => {
    const token = process.env.GH_TOKEN;
    if (!token) {
        console.error('GH_TOKEN environment variable is required');
        process.exit(1);
    }
    const configFileValues = (0, projectConfig_2.loadConfigFile)(options.configFilePath);
    const cliOverrides = {
        projectUrl: options.projectUrl,
        defaultAgentName: options.defaultAgentName,
        defaultLlmModelName: options.defaultLlmModelName,
        fallbackLlmModelName: options.fallbackLlmModelName,
        defaultLlmAgentName: options.defaultLlmAgentName,
        maximumPreparingIssuesCount: options.maximumPreparingIssuesCount
            ? Number(options.maximumPreparingIssuesCount)
            : undefined,
        allowIssueCacheMinutes: options.allowIssueCacheMinutes
            ? Number(options.allowIssueCacheMinutes)
            : undefined,
        utilizationPercentageThreshold: options.utilizationPercentageThreshold
            ? Number(options.utilizationPercentageThreshold)
            : undefined,
        allowedIssueAuthors: options.allowedIssueAuthors,
        preparationProcessCheckCommand: options.preparationProcessCheckCommand,
        prReviewViewerAccessKey: options.prReviewViewerAccessKey,
        prReviewViewerPort: options.prReviewViewerPort
            ? Number(options.prReviewViewerPort)
            : undefined,
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
    const defaultAgentName = config.defaultAgentName;
    if (!projectUrl) {
        console.error('projectUrl is required. Provide via --projectUrl, config file, or project README.');
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
    const allowIssueCacheMinutes = config.allowIssueCacheMinutes ?? 10;
    console.log(`maximumPreparingIssuesCount: ${maximumPreparingIssuesCount ?? 'null (default: 6 per available Claude OAuth token, otherwise 6)'}`);
    const projectName = config.projectName ?? 'default';
    const localStorageRepository = new LocalStorageRepository_1.LocalStorageRepository();
    const cachePath = `./tmp/cache/${projectName}`;
    const localStorageCacheRepository = new LocalStorageCacheRepository_1.LocalStorageCacheRepository(localStorageRepository, cachePath);
    const githubRepositoryParams = buildGithubRepositoryParams(localStorageRepository, token);
    const projectRepository = new GraphqlProjectRepository_1.GraphqlProjectRepository(...githubRepositoryParams);
    const apiV3IssueRepository = new ApiV3IssueRepository_1.ApiV3IssueRepository(...githubRepositoryParams);
    const restIssueRepository = new RestIssueRepository_1.RestIssueRepository(...githubRepositoryParams);
    const graphqlProjectItemRepository = new GraphqlProjectItemRepository_1.GraphqlProjectItemRepository(...githubRepositoryParams);
    const issueRepository = new ApiV3CheerioRestIssueRepository_1.ApiV3CheerioRestIssueRepository(apiV3IssueRepository, restIssueRepository, graphqlProjectItemRepository, localStorageCacheRepository, ...githubRepositoryParams);
    const localCommandRunner = new NodeLocalCommandRunner_1.NodeLocalCommandRunner();
    const preparationProcessCheckCommand = config.preparationProcessCheckCommand;
    if (preparationProcessCheckCommand) {
        const revertIssueCommentRepository = new GitHubIssueCommentRepository_1.GitHubIssueCommentRepository(token);
        const revertUseCase = new RevertOrphanedPreparationUseCase_1.RevertOrphanedPreparationUseCase(projectRepository, issueRepository, revertIssueCommentRepository, localCommandRunner);
        await revertUseCase.run({
            projectUrl,
            allowIssueCacheMinutes,
            preparationProcessCheckCommand,
            thresholdForAutoReject: config.thresholdForAutoReject ?? 3,
            awLogDirectoryPath: config.awLogDirectoryPath,
            awLogStaleThresholdMinutes: config.awLogStaleThresholdMinutes,
            labelsAsLlmAgentName: config.labelsAsLlmAgentName ?? null,
        });
    }
    const claudeTokenUsageRepository = new ProxyClaudeTokenUsageRepository_1.ProxyClaudeTokenUsageRepository(config.claudeCodeOauthTokenListJsonPath ?? null);
    const useCase = new StartPreparationUseCase_1.StartPreparationUseCase(projectRepository, issueRepository, localCommandRunner, claudeTokenUsageRepository);
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
    const prReviewViewerAccessKey = config.prReviewViewerAccessKey;
    if (prReviewViewerAccessKey) {
        const prReviewViewerPort = config.prReviewViewerPort ?? ensurePrReviewViewerRunning_1.PR_REVIEW_VIEWER_DEFAULT_PORT;
        const viewerProcess = await (0, ensurePrReviewViewerRunning_1.ensurePrReviewViewerRunning)(prReviewViewerAccessKey, prReviewViewerPort);
        if (viewerProcess !== null) {
            const killViewer = () => {
                viewerProcess.kill();
            };
            process.once('SIGTERM', killViewer);
            process.once('SIGINT', killViewer);
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
        codexHomeCandidates,
        allowIssueCacheMinutes,
        labelsAsLlmAgentName: config.labelsAsLlmAgentName ?? null,
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
    .option('--workflowBlockerResolvedWebhookUrl <url>', 'Webhook URL to notify when a workflow blocker issue status changes to awaiting quality check. Supports {URL} and {MESSAGE} placeholders.')
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
    const projectUrl = config.projectUrl;
    if (!projectUrl) {
        console.error('projectUrl is required. Provide via --projectUrl, config file, or project README.');
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
    const githubRepositoryParams = buildGithubRepositoryParams(localStorageRepository, token);
    const projectRepository = new GraphqlProjectRepository_1.GraphqlProjectRepository(...githubRepositoryParams);
    const apiV3IssueRepository = new ApiV3IssueRepository_1.ApiV3IssueRepository(...githubRepositoryParams);
    const restIssueRepository = new RestIssueRepository_1.RestIssueRepository(...githubRepositoryParams);
    const graphqlProjectItemRepository = new GraphqlProjectItemRepository_1.GraphqlProjectItemRepository(...githubRepositoryParams);
    const issueRepository = new ApiV3CheerioRestIssueRepository_1.ApiV3CheerioRestIssueRepository(apiV3IssueRepository, restIssueRepository, graphqlProjectItemRepository, localStorageCacheRepository, ...githubRepositoryParams);
    const issueCommentRepository = new GitHubIssueCommentRepository_1.GitHubIssueCommentRepository(token);
    const webhookRepository = new FetchWebhookRepository_1.FetchWebhookRepository();
    const useCase = new NotifyFinishedIssuePreparationUseCase_1.NotifyFinishedIssuePreparationUseCase(projectRepository, issueRepository, issueCommentRepository, webhookRepository);
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
        workflowBlockerResolvedWebhookUrl,
        allowedIssueAuthors,
        labelsAsLlmAgentName: config.labelsAsLlmAgentName ?? null,
        changeTargetPathAliases: config.changeTargetPathAliases ?? null,
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
    const projectName = config.projectName ?? 'default';
    const localStorageRepository = new LocalStorageRepository_1.LocalStorageRepository();
    const cachePath = `./tmp/cache/${projectName}`;
    const localStorageCacheRepository = new LocalStorageCacheRepository_1.LocalStorageCacheRepository(localStorageRepository, cachePath);
    const githubRepositoryParams = buildGithubRepositoryParams(localStorageRepository, token);
    const apiV3IssueRepository = new ApiV3IssueRepository_1.ApiV3IssueRepository(...githubRepositoryParams);
    const restIssueRepository = new RestIssueRepository_1.RestIssueRepository(...githubRepositoryParams);
    const graphqlProjectItemRepository = new GraphqlProjectItemRepository_1.GraphqlProjectItemRepository(...githubRepositoryParams);
    const issueRepository = new ApiV3CheerioRestIssueRepository_1.ApiV3CheerioRestIssueRepository(apiV3IssueRepository, restIssueRepository, graphqlProjectItemRepository, localStorageCacheRepository, ...githubRepositoryParams);
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
    });
    process.stdout.write(`${JSON.stringify(result)}\n`);
});
exports.program
    .command('serve-pr-review-viewer')
    .description('Start the PR review viewer web server')
    .requiredOption('--accessKey <key>', 'Access key for the PR review viewer')
    .option('--port <port>', `Port to listen on (default: ${ensurePrReviewViewerRunning_1.PR_REVIEW_VIEWER_DEFAULT_PORT})`)
    .action((options) => {
    const port = options.port
        ? Number(options.port)
        : ensurePrReviewViewerRunning_1.PR_REVIEW_VIEWER_DEFAULT_PORT;
    (0, prReviewViewerEntry_1.startPrReviewViewer)(options.accessKey, port);
});
/* istanbul ignore next */
if (process.argv && require.main === module) {
    exports.program.parse(process.argv);
}
//# sourceMappingURL=index.js.map