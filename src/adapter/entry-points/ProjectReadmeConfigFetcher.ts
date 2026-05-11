import YAML from 'yaml';

export type ProjectReadmeConfig = {
  awaitingWorkspaceStatus?: string;
  preparationStatus?: string;
  defaultAgentName?: string;
  defaultLlmModelName?: string;
  defaultLlmAgentName?: string;
  maximumPreparingIssuesCount?: number;
  allowIssueCacheMinutes?: number;
  utilizationPercentageThreshold?: number;
  allowedIssueAuthors?: string;
  awaitingQualityCheckStatus?: string;
  thresholdForAutoReject?: number;
  workflowBlockerResolvedWebhookUrl?: string;
  preparationProcessCheckCommand?: string;
  codexHomeCandidates?: string[];
};

export const isRecord = (
  value: unknown,
): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const getStringValue = (
  obj: Record<string, unknown>,
  key: string,
): string | undefined => {
  const value = obj[key];
  return typeof value === 'string' ? value : undefined;
};

export const getNumberValue = (
  obj: Record<string, unknown>,
  key: string,
): number | undefined => {
  const value = obj[key];
  return typeof value === 'number' ? value : undefined;
};

export const getStringArrayValue = (
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

export const parseProjectReadmeConfig = (
  readme: string,
): ProjectReadmeConfig => {
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
      awaitingWorkspaceStatus: getStringValue(parsed, 'awaitingWorkspaceStatus'),
      preparationStatus: getStringValue(parsed, 'preparationStatus'),
      defaultAgentName: getStringValue(parsed, 'defaultAgentName'),
      defaultLlmModelName: getStringValue(parsed, 'defaultLlmModelName'),
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
      awaitingQualityCheckStatus: getStringValue(
        parsed,
        'awaitingQualityCheckStatus',
      ),
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
    };
  } catch {
    console.warn('Failed to parse YAML from project README config section');
    return {};
  }
};
