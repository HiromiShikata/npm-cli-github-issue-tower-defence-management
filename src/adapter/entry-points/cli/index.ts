#!/usr/bin/env node
import { Command } from 'commander';
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
import { writeRotationOrderFile } from '../handlers/rotationOrderFileWriter';
import { ProxyClaudeTokenUsageRepository } from '../../repositories/ProxyClaudeTokenUsageRepository';
import { NotifyFinishedIssuePreparationUseCase } from '../../../domain/usecases/NotifyFinishedIssuePreparationUseCase';
import { CheckIssueReviewReadinessUseCase } from '../../../domain/usecases/CheckIssueReviewReadinessUseCase';
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
import * as path from 'path';
import {
  DEFAULT_DASHBOARD_PROJECT_NAMES,
  DEFAULT_WEB_PORT,
  startWebServer,
} from '../console/webServer';
import { IssueTitleStateCache } from '../console/consoleReadApi';
import {
  buildPjcodeToProjectUrl,
  createConsoleProjectResolver,
} from '../console/consoleProjectResolver';
import { OauthTokenSelectHandler } from '../handlers/OauthTokenSelectHandler';
import { LiveSessionOauthTokenSelectHandler } from '../handlers/LiveSessionOauthTokenSelectHandler';
import { InTmuxByHumanSessionTokenCountHandler } from '../handlers/InTmuxByHumanSessionTokenCountHandler';

type StartDaemonOptions = {
  projectUrl?: string;
  defaultAgentName?: string;
  defaultLlmModelName?: string;
  fallbackLlmModelName?: string;
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

type CheckIssueReviewReadinessOptions = {
  issueUrl: string;
  projectUrl?: string;
  configFilePath: string;
};

type ServeWebOptions = {
  configFilePath: string;
  port?: string;
  consoleDataOutputDir?: string;
  inTmuxDataDir?: string;
  dashboardDir?: string;
  dashboardDataDir?: string;
  dashboardProjectNames?: string;
};

const DEFAULT_IN_TMUX_DATA_DIR =
  '/home/hiromi/0_workspaces/workspace1/jsonpub/in-tmux-by-human';

const DEFAULT_DASHBOARD_DIR = '/home/hiromi/0_workspaces/workspace1/jsonpub';

const DEFAULT_DASHBOARD_DATA_DIR: string | null = null;

const parseDashboardProjectNames = (raw: string | undefined): string[] => {
  if (raw === undefined) {
    return DEFAULT_DASHBOARD_PROJECT_NAMES;
  }
  const names = raw
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
  return names.length > 0 ? names : DEFAULT_DASHBOARD_PROJECT_NAMES;
};

type SelectOauthTokenOptions = {
  tokenListJsonPath?: string;
  cacheDir?: string;
};

type SelectLiveSessionOauthTokenOptions = {
  tokenListJsonPath?: string;
  cacheDir?: string;
};

type CountInTmuxByHumanSessionsPerTokenOptions = {
  configFilePath: string;
  projectUrl?: string;
  tokenListJsonPath?: string;
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
      const { HandleScheduledEventUseCaseHandler } =
        await import('../handlers/HandleScheduledEventUseCaseHandler');
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
  .option(
    '--fallbackLlmModelName <name>',
    'LLM model to fall back to when the default Sonnet model is selected but its 7-day weekly limit is exhausted across all tokens (default: claude-opus-4-8)',
  )
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
    'Per-token Claude 5h utilization % threshold; tokens at or above it are excluded from rotation. Per-token concurrency also tapers from 6 slots down to 1 as either the 5h or 7d utilization rises from 80% toward 100%, taking the more restrictive of the two (default: 90)',
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
    };

    const tempProjectUrl =
      cliOverrides.projectUrl ?? configFileValues.projectUrl;

    let readmeOverrides: ConfigFile = {};
    if (tempProjectUrl) {
      const readme = await fetchProjectReadme(tempProjectUrl, token);
      if (readme) {
        readmeOverrides = parseProjectReadmeConfig(readme, tempProjectUrl);
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
      localStorageCacheRepository,
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
        thresholdForAutoReject: config.thresholdForAutoReject ?? 3,
        awLogDirectoryPath: config.awLogDirectoryPath,
        awLogStaleThresholdMinutes: config.awLogStaleThresholdMinutes,
        labelsAsLlmAgentName: config.labelsAsLlmAgentName ?? null,
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

    const preparationResult = await useCase.run({
      projectUrl,
      defaultAgentName,
      defaultLlmModelName: config.defaultLlmModelName ?? null,
      fallbackLlmModelName: config.fallbackLlmModelName ?? null,
      defaultLlmAgentName: config.defaultLlmAgentName ?? null,
      configFilePath: options.configFilePath,
      maximumPreparingIssuesCount,
      utilizationPercentageThreshold:
        config.utilizationPercentageThreshold ?? 90,
      allowedIssueAuthors,
      codexHomeCandidates,
      allowIssueCacheMinutes,
      labelsAsLlmAgentName: config.labelsAsLlmAgentName ?? null,
    });
    if (preparationResult.rotationOrder !== null) {
      writeRotationOrderFile(preparationResult.rotationOrder);
    }
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
        readmeOverrides = parseProjectReadmeConfig(readme, tempProjectUrl);
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
      localStorageCacheRepository,
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

program
  .command('checkIssueReviewReadiness')
  .description(
    'Check whether an issue is in a review-ready state without mutating any field or posting any comment',
  )
  .requiredOption(
    '--configFilePath <path>',
    'Path to config file for tower defence management',
  )
  .requiredOption('--issueUrl <url>', 'GitHub issue URL')
  .option('--projectUrl <url>', 'GitHub project URL (optional)')
  .action(async (options: CheckIssueReviewReadinessOptions) => {
    const token = process.env.GH_TOKEN;
    if (!token) {
      console.error('GH_TOKEN environment variable is required');
      process.exit(1);
    }

    const configFileValues = loadConfigFile(options.configFilePath);

    const cliOverrides: ConfigFile = {
      projectUrl: options.projectUrl,
    };

    const tempProjectUrl =
      cliOverrides.projectUrl ?? configFileValues.projectUrl;

    let readmeOverrides: ConfigFile = {};
    if (tempProjectUrl) {
      const readme = await fetchProjectReadme(tempProjectUrl, token);
      if (readme) {
        readmeOverrides = parseProjectReadmeConfig(readme, tempProjectUrl);
      }
    }

    const config = mergeConfigs(
      configFileValues,
      cliOverrides,
      readmeOverrides,
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

    const rawAllowedIssueAuthors = config.allowedIssueAuthors;
    const allowedIssueAuthors = rawAllowedIssueAuthors
      ? rawAllowedIssueAuthors
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : null;

    const useCase = new CheckIssueReviewReadinessUseCase(
      issueRepository,
      issueCommentRepository,
    );

    const result = await useCase.run({
      issueUrl: options.issueUrl,
      allowedIssueAuthors,
      labelsAsLlmAgentName: config.labelsAsLlmAgentName ?? null,
    });

    process.stdout.write(`${JSON.stringify(result)}\n`);
  });

const runServeWeb = async (options: ServeWebOptions): Promise<void> => {
  const config = loadConfigFile(options.configFilePath);

  const accessToken = config.consoleAccessToken;
  if (!accessToken) {
    console.error(
      'consoleAccessToken is required. Provide it via the config file.',
    );
    process.exit(1);
  }

  let port = DEFAULT_WEB_PORT;
  if (options.port !== undefined) {
    const parsedPort = Number(options.port);
    if (
      !Number.isFinite(parsedPort) ||
      !Number.isInteger(parsedPort) ||
      parsedPort <= 0 ||
      parsedPort > 65535
    ) {
      console.error(
        'Invalid value for --port. It must be a positive integer between 1 and 65535.',
      );
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
    console.error(
      'projectUrl is required. Provide it via the config file or project README.',
    );
    process.exit(1);
  }

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
    localStorageCacheRepository,
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

  const pjcodeToProjectUrl = buildPjcodeToProjectUrl(
    projectName,
    projectUrl,
    config.consoleProjects ?? null,
  );
  const resolveProject = createConsoleProjectResolver(
    pjcodeToProjectUrl,
    async (targetProjectUrl: string) => {
      const targetProjectId =
        await projectRepository.findProjectIdByUrl(targetProjectUrl);
      if (!targetProjectId) {
        console.error(`No project found for projectUrl ${targetProjectUrl}`);
        return null;
      }
      const loadedProject = await projectRepository.getProject(targetProjectId);
      if (!loadedProject) {
        console.error(
          `Failed to load project for projectUrl ${targetProjectUrl}`,
        );
        return null;
      }
      return loadedProject;
    },
  );

  const uiDistDir = path.join(__dirname, '..', 'console', 'ui-dist');
  const consoleDataOutputDir = options.consoleDataOutputDir ?? null;
  const inTmuxDataDir = options.inTmuxDataDir ?? DEFAULT_IN_TMUX_DATA_DIR;
  const dashboardDir = options.dashboardDir ?? DEFAULT_DASHBOARD_DIR;
  const dashboardDataDir =
    options.dashboardDataDir ?? DEFAULT_DASHBOARD_DATA_DIR;
  const dashboardProjectNames = parseDashboardProjectNames(
    options.dashboardProjectNames,
  );

  await startWebServer({
    accessToken,
    uiDistDir,
    consoleDataOutputDir,
    inTmuxDataDir,
    dashboardDir,
    dashboardDataDir,
    dashboardProjectNames,
    githubToken: token,
    issueRepository,
    resolveProject,
    issueTitleStateCache: new IssueTitleStateCache(),
    port,
  });
  console.log(`TDPM web server listening on port ${port}`);
};

const addServeWebOptions = (command: Command): Command =>
  command
    .requiredOption(
      '--configFilePath <path>',
      'Path to config file for tower defence management',
    )
    .option(
      '--port <number>',
      `Port for the web HTTP server (default: ${DEFAULT_WEB_PORT})`,
    )
    .option(
      '--consoleDataOutputDir <path>',
      'Directory where console data files are written and served from',
    )
    .option(
      '--inTmuxDataDir <path>',
      `Directory containing the flat in-tmux-by-human static JSON files served at /in-tmux-by-human/*.json (default: ${DEFAULT_IN_TMUX_DATA_DIR})`,
    )
    .option(
      '--dashboardDir <path>',
      `Directory containing the static dashboard HTML fragment tdpm.txt served at /tdpm.txt when compose mode is not active (default: ${DEFAULT_DASHBOARD_DIR})`,
    )
    .option(
      '--dashboardDataDir <path>',
      'Directory containing the dashboard data files (projects/<projectName>.json, machine-status.json, token-status.json); when set and every required file is present the server composes the /tdpm.txt fragment from them at request time, otherwise it falls back to serving the static tdpm.txt from --dashboardDir (unset when not configured)',
    )
    .option(
      '--dashboardProjectNames <names>',
      `Comma-separated project names, in display order, for the dashboard project grid (default: ${DEFAULT_DASHBOARD_PROJECT_NAMES.join(',')})`,
    );

addServeWebOptions(program.command('serveWeb'))
  .description(
    'Start the local TDPM web server (console tabs, dashboard, and in-tmux session list)',
  )
  .action(async (options: ServeWebOptions) => {
    await runServeWeb(options);
  });

addServeWebOptions(program.command('serveConsole'))
  .description('Deprecated alias for serveWeb. Use serveWeb instead.')
  .action(async (options: ServeWebOptions) => {
    await runServeWeb(options);
  });

program
  .command('selectOauthToken')
  .description(
    'Print exactly one Claude Code OAuth token chosen by a rate-limit-aware filter. The token string is written to stdout (pipeable); the per-candidate decision trace is written to stderr. Exits non-zero when no token passes the filter.',
  )
  .option(
    '--tokenListJsonPath <path>',
    'Path to the JSON array of { name, token } records. Falls back to the CLAUDE_CODE_OAUTH_TOKEN_LIST_JSON_PATH environment variable.',
  )
  .option(
    '--cacheDir <path>',
    'Directory holding per-token rate-limit cache files. Falls back to the TDPM_RATELIMIT_CACHE_DIR environment variable, then to ${XDG_CACHE_HOME:-~/.cache}/tdpm/ratelimit.',
  )
  .action((options: SelectOauthTokenOptions) => {
    const handler = new OauthTokenSelectHandler();
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

program
  .command('selectLiveSessionOauthToken')
  .description(
    'Print exactly one Claude Code OAuth token chosen for a new live interactive session. Among rate-limit-eligible tokens it prefers the one with the fewest current live sessions (by distinct CLAUDE_CODE_SESSION_ID found in running Claude Code processes), tiebreaking on the soonest 7d reset. The token string is written to stdout (pipeable); the per-candidate decision trace is written to stderr. Exits non-zero when no token passes the filter.',
  )
  .option(
    '--tokenListJsonPath <path>',
    'Path to the JSON array of { name, token } records. Falls back to the CLAUDE_CODE_OAUTH_TOKEN_LIST_JSON_PATH environment variable.',
  )
  .option(
    '--cacheDir <path>',
    'Directory holding per-token rate-limit cache files. Falls back to the TDPM_RATELIMIT_CACHE_DIR environment variable, then to ${XDG_CACHE_HOME:-~/.cache}/tdpm/ratelimit.',
  )
  .action((options: SelectLiveSessionOauthTokenOptions) => {
    const handler = new LiveSessionOauthTokenSelectHandler();
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

program
  .command('countInTmuxByHumanSessionsPerToken')
  .description(
    'Print, per Claude Code OAuth token, the count of live interactive sessions (cl-launched Claude processes carrying CLAUDE_CODE_OAUTH_TOKEN and CLAUDE_CODE_SESSION_ID with a --name <issue-url> argument, excluding Take ownership spawns) whose issue is currently in GitHub Project Status "In Tmux by human". One tab-separated line per token (<tokenName>\\t<count>) is written to stdout; the decision trace is written to stderr. Token values are never printed.',
  )
  .requiredOption(
    '--configFilePath <path>',
    'Path to config file for tower defence management',
  )
  .option('--projectUrl <url>', 'GitHub project URL (optional)')
  .option(
    '--tokenListJsonPath <path>',
    'Path to the JSON array of { name, token } records. Falls back to the claudeCodeOauthTokenListJsonPath config value, then to the CLAUDE_CODE_OAUTH_TOKEN_LIST_JSON_PATH environment variable.',
  )
  .action(async (options: CountInTmuxByHumanSessionsPerTokenOptions) => {
    const token = process.env.GH_TOKEN;
    if (!token) {
      console.error('GH_TOKEN environment variable is required');
      process.exit(1);
    }

    const configFileValues = loadConfigFile(options.configFilePath);

    const cliOverrides: ConfigFile = {
      projectUrl: options.projectUrl,
    };

    const tempProjectUrl =
      cliOverrides.projectUrl ?? configFileValues.projectUrl;

    let readmeOverrides: ConfigFile = {};
    if (tempProjectUrl) {
      const readme = await fetchProjectReadme(tempProjectUrl, token);
      if (readme) {
        readmeOverrides = parseProjectReadmeConfig(readme, tempProjectUrl);
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
      localStorageCacheRepository,
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

    const projectId = await projectRepository.findProjectIdByUrl(projectUrl);
    if (!projectId) {
      console.error(`No project found for projectUrl ${projectUrl}`);
      process.exit(1);
    }

    const allowIssueCacheMinutes = config.allowIssueCacheMinutes ?? 10;
    const { issues } = await issueRepository.getAllIssues(
      projectId,
      allowIssueCacheMinutes,
    );

    const handler = new InTmuxByHumanSessionTokenCountHandler();
    const output = handler.handle({
      tokenListJsonPath:
        options.tokenListJsonPath ??
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

/* istanbul ignore next */
if (process.argv && require.main === module) {
  program.parse(process.argv);
}
