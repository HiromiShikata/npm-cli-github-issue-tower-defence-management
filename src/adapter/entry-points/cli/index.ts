#!/usr/bin/env node
import { Command } from 'commander';
import { HandleScheduledEventUseCaseHandler } from '../handlers/HandleScheduledEventUseCaseHandler';
export {
  ConfigFile,
  loadConfigFile,
  parseProjectReadmeConfig,
  mergeConfigs,
  fetchProjectReadme,
} from './projectConfig';
import {
  ConfigFile,
  loadConfigFile,
  parseProjectReadmeConfig,
  mergeConfigs,
  fetchProjectReadme,
} from './projectConfig';
import { StartPreparationUseCase } from '../../../domain/usecases/StartPreparationUseCase';
import { ProxyClaudeTokenUsageRepository } from '../../repositories/ProxyClaudeTokenUsageRepository';
import { NotifyFinishedIssuePreparationUseCase } from '../../../domain/usecases/NotifyFinishedIssuePreparationUseCase';
import { LocalStorageRepository } from '../../repositories/LocalStorageRepository';
import { GraphqlProjectRepository } from '../../repositories/GraphqlProjectRepository';
import { ApiV3IssueRepository } from '../../repositories/issue/ApiV3IssueRepository';
import { RestIssueRepository } from '../../repositories/issue/RestIssueRepository';
import { GraphqlProjectItemRepository } from '../../repositories/issue/GraphqlProjectItemRepository';
import { ApiV3CheerioRestIssueRepository } from '../../repositories/issue/ApiV3CheerioRestIssueRepository';
import { LocalStorageCacheRepository } from '../../repositories/LocalStorageCacheRepository';
import { BaseGitHubRepository } from '../../repositories/BaseGitHubRepository';
import { NodeLocalCommandRunner } from '../../repositories/NodeLocalCommandRunner';
import { GitHubIssueCommentRepository } from '../../repositories/GitHubIssueCommentRepository';
import { FetchWebhookRepository } from '../../repositories/FetchWebhookRepository';
import { RevertOrphanedPreparationUseCase } from '../../../domain/usecases/RevertOrphanedPreparationUseCase';

type StartDaemonOptions = {
  projectUrl?: string;
  defaultAgentName?: string;
  defaultLlmModelName?: string;
  defaultLlmAgentName?: string;
  maximumPreparingIssuesCount?: string;
  allowIssueCacheMinutes?: string;
  utilizationPercentageThreshold?: string;
  allowedIssueAuthors?: string;
  preparationProcessCheckCommand?: string;
  configFilePath: string;
};

type NotifyFinishedOptions = {
  issueUrl: string;
  projectUrl?: string;
  thresholdForAutoReject?: string;
  workflowBlockerResolvedWebhookUrl?: string;
  configFilePath: string;
};

const buildGithubRepositoryParams = (
  localStorageRepository: LocalStorageRepository,
  token: string,
): ConstructorParameters<typeof BaseGitHubRepository> => [
  localStorageRepository,
  token,
];

interface ScheduleOptions {
  trigger: 'issue' | 'schedule';
  config: string;
  issue?: string;
  verbose: boolean;
}

export const program = new Command();

program
  .name('github-issue-tower-defence-management')
  .description('CLI tool for GitHub Issue Tower Defence Management');

program
  .command('schedule', { isDefault: true })
  .description('Handle scheduled events (trigger: issue or schedule)')
  .requiredOption(
    '-t, --trigger <type>',
    'Trigger type: issue or schedule',
    /^(issue|schedule)$/i,
  )
  .requiredOption('-c, --config <path>', 'Path to config YAML file')
  .option('-v, --verbose', 'Verbose output')
  .option('-i, --issue <url>', 'GitHub Issue URL')
  .action(async (options: ScheduleOptions) => {
    if (options.trigger === 'issue' && !options.issue) {
      console.error('Issue URL is required when trigger type is "issue"');
      process.exit(1);
    }
    if (options.trigger === 'schedule') {
      const handler = new HandleScheduledEventUseCaseHandler();
      await handler.handle(options.config, options.verbose);
    }
  });

program
  .command('startDaemon')
  .description('Start daemon to prepare GitHub issues')
  .requiredOption(
    '--configFilePath <path>',
    'Path to config file for tower defence management',
  )
  .option('--projectUrl <url>', 'GitHub project URL')
  .option('--defaultAgentName <name>', 'Default agent name')
  .option('--defaultLlmModelName <name>', 'Default LLM model name')
  .option('--defaultLlmAgentName <name>', 'Default LLM agent name')
  .option(
    '--maximumPreparingIssuesCount <count>',
    'Maximum number of issues in preparation status (default: 6 per available Claude OAuth token, otherwise 6)',
  )
  .option(
    '--allowIssueCacheMinutes <minutes>',
    'Allow cache for issues in minutes (default: 10)',
  )
  .option(
    '--utilizationPercentageThreshold <percent>',
    'Legacy Claude utilization threshold setting; token process slots decay from 80% utilization to 0 at 95% (default: 90)',
  )
  .option(
    '--allowedIssueAuthors <authors>',
    'Comma-separated list of allowed issue authors',
  )
  .option(
    '--preparationProcessCheckCommand <template>',
    'Shell command template with {URL} placeholder to check if a preparation process is alive',
  )
  .action(async (options: StartDaemonOptions) => {
    const token = process.env.GH_TOKEN;
    if (!token) {
      console.error('GH_TOKEN environment variable is required');
      process.exit(1);
    }

    const configFileValues = loadConfigFile(options.configFilePath);

    const cliOverrides: ConfigFile = {
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

    const tempProjectUrl =
      cliOverrides.projectUrl ?? configFileValues.projectUrl;

    let readmeOverrides: ConfigFile = {};
    if (tempProjectUrl) {
      const readme = await fetchProjectReadme(tempProjectUrl, token);
      if (readme) {
        readmeOverrides = parseProjectReadmeConfig(readme);
      }
    }

    const config = mergeConfigs(
      configFileValues,
      cliOverrides,
      readmeOverrides,
    );

    const projectUrl = config.projectUrl;
    const defaultAgentName = config.defaultAgentName;

    if (!projectUrl) {
      console.error(
        'projectUrl is required. Provide via --projectUrl, config file, or project README.',
      );
      process.exit(1);
    }
    if (!defaultAgentName) {
      console.error(
        'defaultAgentName is required. Provide via --defaultAgentName, config file, or project README.',
      );
      process.exit(1);
    }

    let maximumPreparingIssuesCount: number | null = null;
    const rawMaxCount = config.maximumPreparingIssuesCount;
    if (rawMaxCount !== undefined) {
      const parsedCount = Number(rawMaxCount);
      if (
        !Number.isFinite(parsedCount) ||
        !Number.isInteger(parsedCount) ||
        parsedCount <= 0
      ) {
        console.error(
          'Invalid value for --maximumPreparingIssuesCount. It must be a positive integer.',
        );
        process.exit(1);
      }
      maximumPreparingIssuesCount = parsedCount;
    }

    const allowIssueCacheMinutes = config.allowIssueCacheMinutes ?? 10;

    console.log(
      `maximumPreparingIssuesCount: ${maximumPreparingIssuesCount ?? 'null (default: 6 per available Claude OAuth token, otherwise 6)'}`,
    );

    const projectName = config.projectName ?? 'default';
    const localStorageRepository = new LocalStorageRepository();
    const cachePath = `./tmp/cache/${projectName}`;
    const localStorageCacheRepository = new LocalStorageCacheRepository(
      localStorageRepository,
      cachePath,
    );
    const githubRepositoryParams = buildGithubRepositoryParams(
      localStorageRepository,
      token,
    );
    const projectRepository = new GraphqlProjectRepository(
      ...githubRepositoryParams,
    );
    const apiV3IssueRepository = new ApiV3IssueRepository(
      ...githubRepositoryParams,
    );
    const restIssueRepository = new RestIssueRepository(
      ...githubRepositoryParams,
    );
    const graphqlProjectItemRepository = new GraphqlProjectItemRepository(
      ...githubRepositoryParams,
    );
    const issueRepository = new ApiV3CheerioRestIssueRepository(
      apiV3IssueRepository,
      restIssueRepository,
      graphqlProjectItemRepository,
      localStorageCacheRepository,
      ...githubRepositoryParams,
    );
    const localCommandRunner = new NodeLocalCommandRunner();

    const preparationProcessCheckCommand =
      config.preparationProcessCheckCommand;
    if (preparationProcessCheckCommand) {
      const revertIssueCommentRepository = new GitHubIssueCommentRepository(
        token,
      );
      const revertUseCase = new RevertOrphanedPreparationUseCase(
        projectRepository,
        issueRepository,
        revertIssueCommentRepository,
        localCommandRunner,
      );
      await revertUseCase.run({
        projectUrl,
        allowIssueCacheMinutes,
        preparationProcessCheckCommand,
        awLogDirectoryPath: config.awLogDirectoryPath,
        awLogStaleThresholdMinutes: config.awLogStaleThresholdMinutes,
      });
    }

    const claudeTokenUsageRepository = new ProxyClaudeTokenUsageRepository(
      config.claudeCodeOauthTokenListJsonPath ?? null,
    );
    const useCase = new StartPreparationUseCase(
      projectRepository,
      issueRepository,
      localCommandRunner,
      claudeTokenUsageRepository,
    );

    const rawAllowedIssueAuthors = config.allowedIssueAuthors;
    const allowedIssueAuthors = rawAllowedIssueAuthors
      ? rawAllowedIssueAuthors
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : null;

    const codexHomeCandidates =
      config.codexHomeCandidates && config.codexHomeCandidates.length > 0
        ? config.codexHomeCandidates
        : null;

    await useCase.run({
      projectUrl,
      defaultAgentName,
      defaultLlmModelName: config.defaultLlmModelName ?? null,
      defaultLlmAgentName: config.defaultLlmAgentName ?? null,
      configFilePath: options.configFilePath,
      maximumPreparingIssuesCount,
      utilizationPercentageThreshold:
        config.utilizationPercentageThreshold ?? 90,
      allowedIssueAuthors,
      codexHomeCandidates,
      allowIssueCacheMinutes,
    });
  });

program
  .command('notifyFinishedIssuePreparation')
  .description('Notify that issue preparation is finished')
  .requiredOption(
    '--configFilePath <path>',
    'Path to config file for tower defence management',
  )
  .requiredOption('--issueUrl <url>', 'GitHub issue URL')
  .option('--projectUrl <url>', 'GitHub project URL')
  .option(
    '--thresholdForAutoReject <count>',
    'Threshold for auto-escalation after consecutive rejections (default: 3)',
  )
  .option(
    '--workflowBlockerResolvedWebhookUrl <url>',
    'Webhook URL to notify when a workflow blocker issue status changes to awaiting quality check. Supports {URL} and {MESSAGE} placeholders.',
  )
  .action(async (options: NotifyFinishedOptions) => {
    const token = process.env.GH_TOKEN;
    if (!token) {
      console.error('GH_TOKEN environment variable is required');
      process.exit(1);
    }

    const configFileValues = loadConfigFile(options.configFilePath);

    const cliOverrides: ConfigFile = {
      projectUrl: options.projectUrl,
      thresholdForAutoReject: options.thresholdForAutoReject
        ? Number(options.thresholdForAutoReject)
        : undefined,
      workflowBlockerResolvedWebhookUrl:
        options.workflowBlockerResolvedWebhookUrl,
    };

    const tempProjectUrl =
      cliOverrides.projectUrl ?? configFileValues.projectUrl;

    let readmeOverrides: ConfigFile = {};
    if (tempProjectUrl) {
      const readme = await fetchProjectReadme(tempProjectUrl, token);
      if (readme) {
        readmeOverrides = parseProjectReadmeConfig(readme);
      }
    }

    const config = mergeConfigs(
      configFileValues,
      cliOverrides,
      readmeOverrides,
    );

    const projectUrl = config.projectUrl;

    if (!projectUrl) {
      console.error(
        'projectUrl is required. Provide via --projectUrl, config file, or project README.',
      );
      process.exit(1);
    }

    let thresholdForAutoReject = 3;
    const rawThreshold = config.thresholdForAutoReject;
    if (rawThreshold !== undefined) {
      const parsed = Number(rawThreshold);
      if (
        !Number.isFinite(parsed) ||
        !Number.isInteger(parsed) ||
        parsed <= 0
      ) {
        console.error(
          'Invalid value for --thresholdForAutoReject. It must be a positive integer.',
        );
        process.exit(1);
      }
      thresholdForAutoReject = parsed;
    }

    const workflowBlockerResolvedWebhookUrl: string | null =
      config.workflowBlockerResolvedWebhookUrl ?? null;

    const projectName = config.projectName ?? 'default';
    const localStorageRepository = new LocalStorageRepository();
    const cachePath = `./tmp/cache/${projectName}`;
    const localStorageCacheRepository = new LocalStorageCacheRepository(
      localStorageRepository,
      cachePath,
    );
    const githubRepositoryParams = buildGithubRepositoryParams(
      localStorageRepository,
      token,
    );
    const projectRepository = new GraphqlProjectRepository(
      ...githubRepositoryParams,
    );
    const apiV3IssueRepository = new ApiV3IssueRepository(
      ...githubRepositoryParams,
    );
    const restIssueRepository = new RestIssueRepository(
      ...githubRepositoryParams,
    );
    const graphqlProjectItemRepository = new GraphqlProjectItemRepository(
      ...githubRepositoryParams,
    );
    const issueRepository = new ApiV3CheerioRestIssueRepository(
      apiV3IssueRepository,
      restIssueRepository,
      graphqlProjectItemRepository,
      localStorageCacheRepository,
      ...githubRepositoryParams,
    );
    const issueCommentRepository = new GitHubIssueCommentRepository(token);
    const webhookRepository = new FetchWebhookRepository();

    const useCase = new NotifyFinishedIssuePreparationUseCase(
      projectRepository,
      issueRepository,
      issueCommentRepository,
      webhookRepository,
    );

    await useCase.run({
      projectUrl,
      issueUrl: options.issueUrl,
      thresholdForAutoReject,
      workflowBlockerResolvedWebhookUrl,
    });
  });

/* istanbul ignore next */
if (process.argv && require.main === module) {
  program.parse(process.argv);
}
