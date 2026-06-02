#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.program = exports.fetchProjectReadme = exports.mergeConfigs = exports.parseProjectReadmeConfig = exports.loadConfigFile = void 0;
const commander_1 = require("commander");
const HandleScheduledEventUseCaseHandler_1 = require("../handlers/HandleScheduledEventUseCaseHandler");
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
        const handler = new HandleScheduledEventUseCaseHandler_1.HandleScheduledEventUseCaseHandler();
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
    .option('--defaultLlmAgentName <name>', 'Default LLM agent name')
    .option('--maximumPreparingIssuesCount <count>', 'Maximum number of issues in preparation status (default: 6 per available Claude OAuth token, otherwise 6)')
    .option('--allowIssueCacheMinutes <minutes>', 'Allow cache for issues in minutes (default: 10)')
    .option('--utilizationPercentageThreshold <percent>', 'Legacy Claude utilization threshold setting; token process slots decay from 80% utilization to 0 at 95% (default: 90)')
    .option('--allowedIssueAuthors <authors>', 'Comma-separated list of allowed issue authors')
    .option('--preparationProcessCheckCommand <template>', 'Shell command template with {URL} placeholder to check if a preparation process is alive')
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
    };
    const tempProjectUrl = cliOverrides.projectUrl ?? configFileValues.projectUrl;
    let readmeOverrides = {};
    if (tempProjectUrl) {
        const readme = await (0, projectConfig_2.fetchProjectReadme)(tempProjectUrl, token);
        if (readme) {
            readmeOverrides = (0, projectConfig_2.parseProjectReadmeConfig)(readme);
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
    const preparationResult = await useCase.run({
        projectUrl,
        defaultAgentName,
        defaultLlmModelName: config.defaultLlmModelName ?? null,
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
            readmeOverrides = (0, projectConfig_2.parseProjectReadmeConfig)(readme);
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
    });
});
/* istanbul ignore next */
if (process.argv && require.main === module) {
    exports.program.parse(process.argv);
}
//# sourceMappingURL=index.js.map