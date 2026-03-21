#!/usr/bin/env node
import YAML from 'yaml';
import { Command } from 'commander';
import * as fs from 'fs';
import { HandleScheduledEventUseCaseHandler } from '../handlers/HandleScheduledEventUseCaseHandler';
import { StartPreparationUseCase } from '../../../domain/usecases/StartPreparationUseCase';
import { NotifyFinishedIssuePreparationUseCase } from '../../../domain/usecases/NotifyFinishedIssuePreparationUseCase';
import { LocalStorageRepository } from '../../repositories/LocalStorageRepository';
import { GraphqlProjectRepository } from '../../repositories/GraphqlProjectRepository';
import { ApiV3IssueRepository } from '../../repositories/issue/ApiV3IssueRepository';
import { RestIssueRepository } from '../../repositories/issue/RestIssueRepository';
import { GraphqlProjectItemRepository } from '../../repositories/issue/GraphqlProjectItemRepository';
import { ApiV3CheerioRestIssueRepository } from '../../repositories/issue/ApiV3CheerioRestIssueRepository';
import { LocalStorageCacheRepository } from '../../repositories/LocalStorageCacheRepository';
import { CheerioProjectRepository } from '../../repositories/CheerioProjectRepository';
import { BaseGitHubRepository } from '../../repositories/BaseGitHubRepository';
import { NodeLocalCommandRunner } from '../../repositories/NodeLocalCommandRunner';
import { OauthAPIClaudeRepository } from '../../repositories/OauthAPIClaudeRepository';
import { GitHubIssueCommentRepository } from '../../repositories/GitHubIssueCommentRepository';
import { FetchWebhookRepository } from '../../repositories/FetchWebhookRepository';
import { Project } from '../../../domain/entities/Project';

type ConfigFile = {
  projectUrl?: string;
  awaitingWorkspaceStatus?: string;
  preparationStatus?: string;
  defaultAgentName?: string;
  logFilePath?: string;
  maximumPreparingIssuesCount?: number;
  allowIssueCacheMinutes?: number;
  awaitingQualityCheckStatus?: string;
  thresholdForAutoReject?: number;
  workflowBlockerResolvedWebhookUrl?: string;
  projectName?: string;
};

type StartDaemonOptions = {
  projectUrl?: string;
  awaitingWorkspaceStatus?: string;
  preparationStatus?: string;
  defaultAgentName?: string;
  logFilePath?: string;
  maximumPreparingIssuesCount?: string;
  allowIssueCacheMinutes?: string;
  configFilePath: string;
};

type NotifyFinishedOptions = {
  issueUrl: string;
  projectUrl?: string;
  preparationStatus?: string;
  awaitingWorkspaceStatus?: string;
  awaitingQualityCheckStatus?: string;
  thresholdForAutoReject?: string;
  workflowBlockerResolvedWebhookUrl?: string;
  configFilePath: string;
};

const getStringValue = (
  obj: Record<string, unknown>,
  key: string,
): string | undefined => {
  const value = obj[key];
  return typeof value === 'string' ? value : undefined;
};

const getNumberValue = (
  obj: Record<string, unknown>,
  key: string,
): number | undefined => {
  const value = obj[key];
  return typeof value === 'number' ? value : undefined;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const loadConfigFile = (configFilePath: string): ConfigFile => {
  try {
    const content = fs.readFileSync(configFilePath, 'utf-8');
    const parsed: unknown = YAML.parse(content);
    if (!isRecord(parsed)) {
      return {};
    }
    return {
      projectUrl: getStringValue(parsed, 'projectUrl'),
      awaitingWorkspaceStatus: getStringValue(
        parsed,
        'awaitingWorkspaceStatus',
      ),
      preparationStatus: getStringValue(parsed, 'preparationStatus'),
      defaultAgentName: getStringValue(parsed, 'defaultAgentName'),
      logFilePath: getStringValue(parsed, 'logFilePath'),
      maximumPreparingIssuesCount: getNumberValue(
        parsed,
        'maximumPreparingIssuesCount',
      ),
      allowIssueCacheMinutes: getNumberValue(parsed, 'allowIssueCacheMinutes'),
      awaitingQualityCheckStatus: getStringValue(
        parsed,
        'awaitingQualityCheckStatus',
      ),
      thresholdForAutoReject: getNumberValue(parsed, 'thresholdForAutoReject'),
      workflowBlockerResolvedWebhookUrl: getStringValue(
        parsed,
        'workflowBlockerResolvedWebhookUrl',
      ),
      projectName: getStringValue(parsed, 'projectName'),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `Failed to load configuration file "${configFilePath}": ${message}`,
    );
    process.exit(1);
  }
};

export const parseProjectReadmeConfig = (readme: string): ConfigFile => {
  const detailsRegex =
    /<details>\s*<summary>config<\/summary>([\s\S]*?)<\/details>/i;
  const match = detailsRegex.exec(readme);
  if (!match) {
    return {};
  }
  const yamlContent = match[1].trim();
  if (!yamlContent) {
    return {};
  }
  try {
    const parsed: unknown = YAML.parse(yamlContent);
    if (!isRecord(parsed)) {
      return {};
    }
    return {
      awaitingWorkspaceStatus: getStringValue(
        parsed,
        'awaitingWorkspaceStatus',
      ),
      preparationStatus: getStringValue(parsed, 'preparationStatus'),
      defaultAgentName: getStringValue(parsed, 'defaultAgentName'),
      logFilePath: getStringValue(parsed, 'logFilePath'),
      maximumPreparingIssuesCount: getNumberValue(
        parsed,
        'maximumPreparingIssuesCount',
      ),
      allowIssueCacheMinutes: getNumberValue(parsed, 'allowIssueCacheMinutes'),
      awaitingQualityCheckStatus: getStringValue(
        parsed,
        'awaitingQualityCheckStatus',
      ),
      thresholdForAutoReject: getNumberValue(parsed, 'thresholdForAutoReject'),
      workflowBlockerResolvedWebhookUrl: getStringValue(
        parsed,
        'workflowBlockerResolvedWebhookUrl',
      ),
    };
  } catch {
    console.warn('Failed to parse YAML from project README config section');
    return {};
  }
};

export const mergeConfigs = (
  configFile: ConfigFile,
  cliOverrides: ConfigFile,
  readmeOverrides: ConfigFile,
): ConfigFile => ({
  projectUrl: cliOverrides.projectUrl ?? configFile.projectUrl,
  awaitingWorkspaceStatus:
    readmeOverrides.awaitingWorkspaceStatus ??
    cliOverrides.awaitingWorkspaceStatus ??
    configFile.awaitingWorkspaceStatus,
  preparationStatus:
    readmeOverrides.preparationStatus ??
    cliOverrides.preparationStatus ??
    configFile.preparationStatus,
  defaultAgentName:
    readmeOverrides.defaultAgentName ??
    cliOverrides.defaultAgentName ??
    configFile.defaultAgentName,
  logFilePath:
    readmeOverrides.logFilePath ??
    cliOverrides.logFilePath ??
    configFile.logFilePath,
  maximumPreparingIssuesCount:
    readmeOverrides.maximumPreparingIssuesCount ??
    cliOverrides.maximumPreparingIssuesCount ??
    configFile.maximumPreparingIssuesCount,
  allowIssueCacheMinutes:
    readmeOverrides.allowIssueCacheMinutes ??
    cliOverrides.allowIssueCacheMinutes ??
    configFile.allowIssueCacheMinutes,
  awaitingQualityCheckStatus:
    readmeOverrides.awaitingQualityCheckStatus ??
    cliOverrides.awaitingQualityCheckStatus ??
    configFile.awaitingQualityCheckStatus,
  thresholdForAutoReject:
    readmeOverrides.thresholdForAutoReject ??
    cliOverrides.thresholdForAutoReject ??
    configFile.thresholdForAutoReject,
  workflowBlockerResolvedWebhookUrl:
    readmeOverrides.workflowBlockerResolvedWebhookUrl ??
    cliOverrides.workflowBlockerResolvedWebhookUrl ??
    configFile.workflowBlockerResolvedWebhookUrl,
  projectName: configFile.projectName,
});

type GraphqlProjectV2ReadmeResponse = {
  data?: {
    organization?: { projectV2?: { readme?: string | null } };
    user?: { projectV2?: { readme?: string | null } };
  };
};

const isGraphqlProjectV2ReadmeResponse = (
  value: unknown,
): value is GraphqlProjectV2ReadmeResponse => {
  if (!isRecord(value)) return false;
  const data = value['data'];
  if (data !== undefined && !isRecord(data)) return false;
  return true;
};

export const fetchProjectReadme = async (
  projectUrl: string,
  token: string,
): Promise<string | null> => {
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

    const responseData: unknown = await response.json();

    if (!isGraphqlProjectV2ReadmeResponse(responseData)) {
      return null;
    }

    const orgReadme = responseData.data?.organization?.projectV2?.readme;
    const userReadme = responseData.data?.user?.projectV2?.readme;
    const readme =
      typeof orgReadme === 'string'
        ? orgReadme
        : typeof userReadme === 'string'
          ? userReadme
          : null;

    return readme;
  } catch {
    console.warn('Failed to fetch project README');
    return null;
  }
};

const buildGithubRepositoryParams = (
  localStorageRepository: LocalStorageRepository,
  cachePath: string,
  token: string,
): ConstructorParameters<typeof BaseGitHubRepository> => [
  localStorageRepository,
  `${cachePath}/github.com.cookies.json`,
  token,
  undefined,
  undefined,
  undefined,
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
  .option(
    '--awaitingWorkspaceStatus <status>',
    'Status for issues awaiting workspace',
  )
  .option('--preparationStatus <status>', 'Status for issues in preparation')
  .option('--defaultAgentName <name>', 'Default agent name')
  .option('--logFilePath <path>', 'Path to log file')
  .option(
    '--maximumPreparingIssuesCount <count>',
    'Maximum number of issues in preparation status (default: 6)',
  )
  .option(
    '--allowIssueCacheMinutes <minutes>',
    'Allow cache for issues in minutes (default: 0)',
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
    const awaitingWorkspaceStatus = config.awaitingWorkspaceStatus;
    const preparationStatus = config.preparationStatus;
    const defaultAgentName = config.defaultAgentName;
    const logFilePath = config.logFilePath;

    if (!projectUrl) {
      console.error(
        'projectUrl is required. Provide via --projectUrl, config file, or project README.',
      );
      process.exit(1);
    }
    if (!awaitingWorkspaceStatus) {
      console.error(
        'awaitingWorkspaceStatus is required. Provide via --awaitingWorkspaceStatus, config file, or project README.',
      );
      process.exit(1);
    }
    if (!preparationStatus) {
      console.error(
        'preparationStatus is required. Provide via --preparationStatus, config file, or project README.',
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

    const allowIssueCacheMinutes = config.allowIssueCacheMinutes ?? 0;

    console.log(
      `maximumPreparingIssuesCount: ${maximumPreparingIssuesCount ?? 'null (default: 6)'}`,
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
      cachePath,
      token,
    );
    const projectRepository = {
      ...new GraphqlProjectRepository(...githubRepositoryParams),
      ...new CheerioProjectRepository(...githubRepositoryParams),
    };
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
    const claudeRepository = new OauthAPIClaudeRepository();
    const localCommandRunner = new NodeLocalCommandRunner();

    const useCase = new StartPreparationUseCase(
      projectRepository,
      issueRepository,
      claudeRepository,
      localCommandRunner,
    );

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

program
  .command('notifyFinishedIssuePreparation')
  .description('Notify that issue preparation is finished')
  .requiredOption(
    '--configFilePath <path>',
    'Path to config file for tower defence management',
  )
  .requiredOption('--issueUrl <url>', 'GitHub issue URL')
  .option('--projectUrl <url>', 'GitHub project URL')
  .option('--preparationStatus <status>', 'Status for issues in preparation')
  .option(
    '--awaitingWorkspaceStatus <status>',
    'Status for issues awaiting workspace',
  )
  .option(
    '--awaitingQualityCheckStatus <status>',
    'Status for issues awaiting quality check',
  )
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
      preparationStatus: options.preparationStatus,
      awaitingWorkspaceStatus: options.awaitingWorkspaceStatus,
      awaitingQualityCheckStatus: options.awaitingQualityCheckStatus,
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
    const preparationStatus = config.preparationStatus;
    const awaitingWorkspaceStatus = config.awaitingWorkspaceStatus;
    const awaitingQualityCheckStatus = config.awaitingQualityCheckStatus;

    if (!projectUrl) {
      console.error(
        'projectUrl is required. Provide via --projectUrl, config file, or project README.',
      );
      process.exit(1);
    }
    if (!preparationStatus) {
      console.error(
        'preparationStatus is required. Provide via --preparationStatus, config file, or project README.',
      );
      process.exit(1);
    }
    if (!awaitingWorkspaceStatus) {
      console.error(
        'awaitingWorkspaceStatus is required. Provide via --awaitingWorkspaceStatus, config file, or project README.',
      );
      process.exit(1);
    }
    if (!awaitingQualityCheckStatus) {
      console.error(
        'awaitingQualityCheckStatus is required. Provide via --awaitingQualityCheckStatus, config file, or project README.',
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
      cachePath,
      token,
    );
    const projectRepository = {
      ...new GraphqlProjectRepository(...githubRepositoryParams),
      ...new CheerioProjectRepository(...githubRepositoryParams),
      prepareStatus: async (
        _name: string,
        project: Project,
      ): Promise<Project> => {
        return project;
      },
    };
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
      preparationStatus,
      awaitingWorkspaceStatus,
      awaitingQualityCheckStatus,
      thresholdForAutoReject,
      workflowBlockerResolvedWebhookUrl,
    });
  });

/* istanbul ignore next */
if (process.argv && require.main === module) {
  program.parse(process.argv);
}
