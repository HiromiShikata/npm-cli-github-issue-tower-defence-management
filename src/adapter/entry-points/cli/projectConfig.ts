import YAML from 'yaml';
import * as fs from 'fs';

export type ConfigFile = {
  projectUrl?: string;
  defaultAgentName?: string;
  defaultLlmModelName?: string;
  fallbackLlmModelName?: string;
  defaultLlmAgentName?: string;
  maximumPreparingIssuesCount?: number;
  allowIssueCacheMinutes?: number;
  utilizationPercentageThreshold?: number;
  allowedIssueAuthors?: string;
  thresholdForAutoReject?: number;
  workflowBlockerResolvedWebhookUrl?: string;
  projectName?: string;
  preparationProcessCheckCommand?: string;
  codexHomeCandidates?: string[];
  claudeCodeOauthTokenListJsonPath?: string;
  awLogDirectoryPath?: string;
  awLogStaleThresholdMinutes?: number;
  labelsAsLlmAgentName?: string[];
  changeTargetPathAliases?: Record<string, string>;
  webConsoleAccessKey?: string;
  webConsolePort?: number;
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

const getStringRecordValue = (
  obj: Record<string, unknown>,
  key: string,
): Record<string, string> | undefined => {
  const value = obj[key];
  if (!isRecord(value)) {
    return undefined;
  }
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(value)) {
    if (typeof v !== 'string') {
      return undefined;
    }
    result[k] = v;
  }
  return result;
};

const getStringArrayValue = (
  obj: Record<string, unknown>,
  key: string,
): string[] | undefined => {
  const value = obj[key];
  if (!Array.isArray(value)) {
    return undefined;
  }
  const strings: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') {
      return undefined;
    }
    strings.push(item);
  }
  return strings;
};

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const knownProjectReadmeConfigKeys = [
  'defaultAgentName',
  'defaultLlmModelName',
  'fallbackLlmModelName',
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
  'changeTargetPathAliases',
  'webConsoleAccessKey',
  'webConsolePort',
] as const;

export const loadConfigFile = (configFilePath: string): ConfigFile => {
  try {
    const content = fs.readFileSync(configFilePath, 'utf-8');
    const parsed: unknown = YAML.parse(content);
    if (!isRecord(parsed)) {
      return {};
    }
    return {
      projectUrl: getStringValue(parsed, 'projectUrl'),
      defaultAgentName: getStringValue(parsed, 'defaultAgentName'),
      defaultLlmModelName: getStringValue(parsed, 'defaultLlmModelName'),
      fallbackLlmModelName: getStringValue(parsed, 'fallbackLlmModelName'),
      defaultLlmAgentName: getStringValue(parsed, 'defaultLlmAgentName'),
      maximumPreparingIssuesCount: getNumberValue(
        parsed,
        'maximumPreparingIssuesCount',
      ),
      allowIssueCacheMinutes: getNumberValue(parsed, 'allowIssueCacheMinutes'),
      utilizationPercentageThreshold: getNumberValue(
        parsed,
        'utilizationPercentageThreshold',
      ),
      allowedIssueAuthors: getStringValue(parsed, 'allowedIssueAuthors'),
      thresholdForAutoReject: getNumberValue(parsed, 'thresholdForAutoReject'),
      workflowBlockerResolvedWebhookUrl: getStringValue(
        parsed,
        'workflowBlockerResolvedWebhookUrl',
      ),
      projectName: getStringValue(parsed, 'projectName'),
      preparationProcessCheckCommand: getStringValue(
        parsed,
        'preparationProcessCheckCommand',
      ),
      codexHomeCandidates: getStringArrayValue(parsed, 'codexHomeCandidates'),
      claudeCodeOauthTokenListJsonPath: getStringValue(
        parsed,
        'claudeCodeOauthTokenListJsonPath',
      ),
      awLogDirectoryPath: getStringValue(parsed, 'awLogDirectoryPath'),
      awLogStaleThresholdMinutes: getNumberValue(
        parsed,
        'awLogStaleThresholdMinutes',
      ),
      labelsAsLlmAgentName: getStringArrayValue(parsed, 'labelsAsLlmAgentName'),
      changeTargetPathAliases: getStringRecordValue(
        parsed,
        'changeTargetPathAliases',
      ),
      webConsoleAccessKey: getStringValue(parsed, 'webConsoleAccessKey'),
      webConsolePort: getNumberValue(parsed, 'webConsolePort'),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `Failed to load configuration file "${configFilePath}": ${message}`,
    );
    process.exit(1);
  }
};

export const parseProjectReadmeConfig = (
  readme: string,
  projectUrl?: string,
): ConfigFile => {
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
    const knownKeySet = new Set<string>(knownProjectReadmeConfigKeys);
    const projectUrlSuffix = projectUrl ? ` (project URL: ${projectUrl})` : '';
    for (const key of Object.keys(parsed)) {
      if (!knownKeySet.has(key)) {
        console.warn(
          `Unknown key "${key}" in project README config section${projectUrlSuffix}`,
        );
      }
    }
    return {
      defaultAgentName: getStringValue(parsed, 'defaultAgentName'),
      defaultLlmModelName: getStringValue(parsed, 'defaultLlmModelName'),
      fallbackLlmModelName: getStringValue(parsed, 'fallbackLlmModelName'),
      defaultLlmAgentName: getStringValue(parsed, 'defaultLlmAgentName'),
      maximumPreparingIssuesCount: getNumberValue(
        parsed,
        'maximumPreparingIssuesCount',
      ),
      allowIssueCacheMinutes: getNumberValue(parsed, 'allowIssueCacheMinutes'),
      utilizationPercentageThreshold: getNumberValue(
        parsed,
        'utilizationPercentageThreshold',
      ),
      allowedIssueAuthors: getStringValue(parsed, 'allowedIssueAuthors'),
      thresholdForAutoReject: getNumberValue(parsed, 'thresholdForAutoReject'),
      workflowBlockerResolvedWebhookUrl: getStringValue(
        parsed,
        'workflowBlockerResolvedWebhookUrl',
      ),
      preparationProcessCheckCommand: getStringValue(
        parsed,
        'preparationProcessCheckCommand',
      ),
      codexHomeCandidates: getStringArrayValue(parsed, 'codexHomeCandidates'),
      claudeCodeOauthTokenListJsonPath: getStringValue(
        parsed,
        'claudeCodeOauthTokenListJsonPath',
      ),
      awLogDirectoryPath: getStringValue(parsed, 'awLogDirectoryPath'),
      awLogStaleThresholdMinutes: getNumberValue(
        parsed,
        'awLogStaleThresholdMinutes',
      ),
      changeTargetPathAliases: getStringRecordValue(
        parsed,
        'changeTargetPathAliases',
      ),
      webConsoleAccessKey: getStringValue(parsed, 'webConsoleAccessKey'),
      webConsolePort: getNumberValue(parsed, 'webConsolePort'),
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
  defaultAgentName:
    readmeOverrides.defaultAgentName ??
    cliOverrides.defaultAgentName ??
    configFile.defaultAgentName,
  defaultLlmModelName:
    readmeOverrides.defaultLlmModelName ??
    cliOverrides.defaultLlmModelName ??
    configFile.defaultLlmModelName,
  fallbackLlmModelName:
    readmeOverrides.fallbackLlmModelName ??
    cliOverrides.fallbackLlmModelName ??
    configFile.fallbackLlmModelName,
  defaultLlmAgentName:
    readmeOverrides.defaultLlmAgentName ??
    cliOverrides.defaultLlmAgentName ??
    configFile.defaultLlmAgentName,
  maximumPreparingIssuesCount:
    readmeOverrides.maximumPreparingIssuesCount ??
    cliOverrides.maximumPreparingIssuesCount ??
    configFile.maximumPreparingIssuesCount,
  allowIssueCacheMinutes:
    readmeOverrides.allowIssueCacheMinutes ??
    cliOverrides.allowIssueCacheMinutes ??
    configFile.allowIssueCacheMinutes,
  utilizationPercentageThreshold:
    readmeOverrides.utilizationPercentageThreshold ??
    cliOverrides.utilizationPercentageThreshold ??
    configFile.utilizationPercentageThreshold,
  allowedIssueAuthors:
    readmeOverrides.allowedIssueAuthors ??
    cliOverrides.allowedIssueAuthors ??
    configFile.allowedIssueAuthors,
  thresholdForAutoReject:
    readmeOverrides.thresholdForAutoReject ??
    cliOverrides.thresholdForAutoReject ??
    configFile.thresholdForAutoReject,
  workflowBlockerResolvedWebhookUrl:
    readmeOverrides.workflowBlockerResolvedWebhookUrl ??
    cliOverrides.workflowBlockerResolvedWebhookUrl ??
    configFile.workflowBlockerResolvedWebhookUrl,
  projectName: configFile.projectName,
  preparationProcessCheckCommand:
    readmeOverrides.preparationProcessCheckCommand ??
    cliOverrides.preparationProcessCheckCommand ??
    configFile.preparationProcessCheckCommand,
  codexHomeCandidates:
    readmeOverrides.codexHomeCandidates ??
    cliOverrides.codexHomeCandidates ??
    configFile.codexHomeCandidates,
  claudeCodeOauthTokenListJsonPath:
    readmeOverrides.claudeCodeOauthTokenListJsonPath ??
    cliOverrides.claudeCodeOauthTokenListJsonPath ??
    configFile.claudeCodeOauthTokenListJsonPath,
  awLogDirectoryPath:
    readmeOverrides.awLogDirectoryPath ??
    cliOverrides.awLogDirectoryPath ??
    configFile.awLogDirectoryPath,
  awLogStaleThresholdMinutes:
    readmeOverrides.awLogStaleThresholdMinutes ??
    cliOverrides.awLogStaleThresholdMinutes ??
    configFile.awLogStaleThresholdMinutes,
  labelsAsLlmAgentName:
    readmeOverrides.labelsAsLlmAgentName ??
    cliOverrides.labelsAsLlmAgentName ??
    configFile.labelsAsLlmAgentName,
  changeTargetPathAliases:
    readmeOverrides.changeTargetPathAliases ??
    cliOverrides.changeTargetPathAliases ??
    configFile.changeTargetPathAliases,
  webConsoleAccessKey:
    readmeOverrides.webConsoleAccessKey ??
    cliOverrides.webConsoleAccessKey ??
    configFile.webConsoleAccessKey,
  webConsolePort:
    readmeOverrides.webConsolePort ??
    cliOverrides.webConsolePort ??
    configFile.webConsolePort,
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
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Failed to fetch project README: ${message}`);
    return null;
  }
};
