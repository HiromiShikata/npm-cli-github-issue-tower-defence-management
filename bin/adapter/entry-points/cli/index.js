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
const NotifyFinishedIssuePreparationUseCase_1 = require("../../../domain/usecases/NotifyFinishedIssuePreparationUseCase");
const LocalStorageRepository_1 = require("../../repositories/LocalStorageRepository");
const GraphqlProjectRepository_1 = require("../../repositories/GraphqlProjectRepository");
const ApiV3IssueRepository_1 = require("../../repositories/issue/ApiV3IssueRepository");
const RestIssueRepository_1 = require("../../repositories/issue/RestIssueRepository");
const GraphqlProjectItemRepository_1 = require("../../repositories/issue/GraphqlProjectItemRepository");
const ApiV3CheerioRestIssueRepository_1 = require("../../repositories/issue/ApiV3CheerioRestIssueRepository");
const LocalStorageCacheRepository_1 = require("../../repositories/LocalStorageCacheRepository");
const NodeLocalCommandRunner_1 = require("../../repositories/NodeLocalCommandRunner");
const situationFileWriter_1 = require("../handlers/situationFileWriter");
const OauthAPIProxyClaudeRepository_1 = require("../../repositories/OauthAPIProxyClaudeRepository");
const GitHubIssueCommentRepository_1 = require("../../repositories/GitHubIssueCommentRepository");
const FetchWebhookRepository_1 = require("../../repositories/FetchWebhookRepository");
const RevertOrphanedPreparationUseCase_1 = require("../../../domain/usecases/RevertOrphanedPreparationUseCase");
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
    .option('--defaultLlmModelName <name>', 'Default LLM model name')
    .option('--defaultLlmAgentName <name>', 'Default LLM agent name')
    .option('--maximumPreparingIssuesCount <count>', 'Maximum number of issues in preparation status (default: 6)')
    .option('--allowIssueCacheMinutes <minutes>', 'Allow cache for issues in minutes (default: 0)')
    .option('--utilizationPercentageThreshold <percent>', 'Claude utilization percentage threshold (default: 90)')
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
        awaitingWorkspaceStatus: options.awaitingWorkspaceStatus,
        preparationStatus: options.preparationStatus,
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
    const awaitingWorkspaceStatus = config.awaitingWorkspaceStatus;
    const preparationStatus = config.preparationStatus;
    const defaultAgentName = config.defaultAgentName;
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
        prepareStatus: async (_name, project) => {
            return project;
        },
    };
    const apiV3IssueRepository = new ApiV3IssueRepository_1.ApiV3IssueRepository(...githubRepositoryParams);
    const restIssueRepository = new RestIssueRepository_1.RestIssueRepository(...githubRepositoryParams);
    const graphqlProjectItemRepository = new GraphqlProjectItemRepository_1.GraphqlProjectItemRepository(...githubRepositoryParams);
    const issueRepository = new ApiV3CheerioRestIssueRepository_1.ApiV3CheerioRestIssueRepository(apiV3IssueRepository, restIssueRepository, graphqlProjectItemRepository, localStorageCacheRepository, ...githubRepositoryParams);
    const claudeRepository = new OauthAPIProxyClaudeRepository_1.OauthAPIProxyClaudeRepository();
    const localCommandRunner = new NodeLocalCommandRunner_1.NodeLocalCommandRunner();
    const preparationProcessCheckCommand = config.preparationProcessCheckCommand;
    if (preparationProcessCheckCommand) {
        const revertIssueCommentRepository = new GitHubIssueCommentRepository_1.GitHubIssueCommentRepository(token);
        const revertUseCase = new RevertOrphanedPreparationUseCase_1.RevertOrphanedPreparationUseCase(projectRepository, issueRepository, revertIssueCommentRepository, localCommandRunner);
        await revertUseCase.run({
            projectUrl,
            preparationStatus,
            awaitingWorkspaceStatus,
            awaitingQualityCheckStatus: config.awaitingQualityCheckStatus,
            allowIssueCacheMinutes,
            preparationProcessCheckCommand,
            awLogDirectoryPath: config.awLogDirectoryPath,
            awLogStaleThresholdMinutes: config.awLogStaleThresholdMinutes,
        });
    }
    const useCase = new StartPreparationUseCase_1.StartPreparationUseCase(projectRepository, issueRepository, claudeRepository, localCommandRunner);
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
    await useCase.run({
        projectUrl,
        awaitingWorkspaceStatus,
        preparationStatus,
        defaultAgentName,
        defaultLlmModelName: config.defaultLlmModelName ?? null,
        defaultLlmAgentName: config.defaultLlmAgentName ?? null,
        configFilePath: options.configFilePath,
        maximumPreparingIssuesCount,
        utilizationPercentageThreshold: config.utilizationPercentageThreshold ?? 90,
        allowedIssueAuthors,
        codexHomeCandidates,
        allowIssueCacheMinutes,
    });
    const projectId = await projectRepository.findProjectIdByUrl(projectUrl);
    if (projectId) {
        await (0, situationFileWriter_1.writeSituationFile)({
            cachePath,
            projectId,
            issues: [],
            statusNames: {
                awaitingQualityCheckStatus: null,
                preparationStatus,
                awaitingWorkspaceStatus,
            },
            config: {
                maximumPreparingIssuesCount,
                utilizationPercentageThreshold: config.utilizationPercentageThreshold ?? 90,
                allowIssueCacheMinutes,
                thresholdForAutoReject: config.thresholdForAutoReject ?? 3,
            },
            preparationProcessCheckCommand: config.preparationProcessCheckCommand ?? null,
            localCommandRunner,
        });
    }
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
    const configFileValues = (0, projectConfig_2.loadConfigFile)(options.configFilePath);
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
        const readme = await (0, projectConfig_2.fetchProjectReadme)(tempProjectUrl, token);
        if (readme) {
            readmeOverrides = (0, projectConfig_2.parseProjectReadmeConfig)(readme);
        }
    }
    const config = (0, projectConfig_2.mergeConfigs)(configFileValues, cliOverrides, readmeOverrides);
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