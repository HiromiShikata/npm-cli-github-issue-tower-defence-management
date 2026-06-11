import { BaseGitHubRepository } from './BaseGitHubRepository';
import { TriageRepository } from '../../domain/usecases/adapter-interfaces/TriageRepository';
import {
  IssueCloseReason,
  StoryOption,
  TriageData,
  TriageIssue,
} from '../../domain/entities/TriageIssue';

const ALLOWED_IMAGE_PROXY_HOSTNAMES = [
  'private-user-images.githubusercontent.com',
  'user-images.githubusercontent.com',
  'github.com',
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const getStringProp = (
  record: Record<string, unknown>,
  key: string,
): string | undefined => {
  const val = record[key];
  return typeof val === 'string' ? val : undefined;
};

const getNumberProp = (
  record: Record<string, unknown>,
  key: string,
): number | undefined => {
  const val = record[key];
  return typeof val === 'number' ? val : undefined;
};

const getArrayProp = (
  record: Record<string, unknown>,
  key: string,
): unknown[] | undefined => {
  const val = record[key];
  return Array.isArray(val) ? val : undefined;
};

const extractGraphQLErrors = (response: unknown): string | null => {
  if (!isRecord(response)) return null;
  const errors = getArrayProp(response, 'errors');
  if (!errors || errors.length === 0) return null;
  const messages = errors
    .filter(isRecord)
    .map((e) => getStringProp(e, 'message') ?? '')
    .filter((m) => m.length > 0);
  return messages.length > 0 ? messages.join('; ') : null;
};

const extractProjectData = (
  response: unknown,
): Record<string, unknown> | null => {
  if (!isRecord(response)) return null;
  const dataField = response['data'];
  if (!isRecord(dataField)) return null;
  const orgField = dataField['organization'];
  const userField = dataField['user'];
  if (isRecord(orgField)) {
    const proj = orgField['projectV2'];
    if (isRecord(proj)) return proj;
  }
  if (isRecord(userField)) {
    const proj = userField['projectV2'];
    if (isRecord(proj)) return proj;
  }
  return null;
};

export class GitHubTriageRepository
  extends BaseGitHubRepository
  implements TriageRepository
{
  private extractGitHubErrorMessage = async (
    response: Response,
  ): Promise<string> => {
    try {
      const body: unknown = await response.json();
      if (
        typeof body === 'object' &&
        body !== null &&
        'message' in body &&
        typeof body['message'] === 'string'
      ) {
        return body['message'];
      }
    } catch (_error) {
      void _error;
    }
    return `HTTP ${response.status}`;
  };

  getTriageData = async (projectUrl: string): Promise<TriageData> => {
    const { owner, projectNumber } = this.extractProjectFromUrl(projectUrl);
    const projectData = await this.fetchProjectWithNoStoryItems(
      owner,
      projectNumber,
    );
    return projectData;
  };

  private extractProjectFromUrl = (
    projectUrl: string,
  ): { owner: string; projectNumber: number } => {
    const url = new URL(projectUrl);
    const path = url.pathname.split('/');
    const owner = path[2];
    const projectNumber = parseInt(path[4], 10);
    return { owner, projectNumber };
  };

  private fetchProjectWithNoStoryItems = async (
    login: string,
    projectNumber: number,
  ): Promise<TriageData> => {
    const query = `query GetTriageProjectData($login: String!, $number: Int!) {
  organization(login: $login) {
    projectV2(number: $number) {
      id
      fields(first: 50) {
        nodes {
          ... on ProjectV2SingleSelectField {
            id
            name
            options {
              id
              name
              color
            }
          }
        }
      }
      items(first: 100) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          id
          content {
            ... on Issue {
              number
              title
              body
              url
              state
              isPullRequest: __typename
            }
          }
          fieldValues(first: 20) {
            nodes {
              ... on ProjectV2ItemFieldSingleSelectValue {
                field {
                  ... on ProjectV2SingleSelectField {
                    id
                    name
                  }
                }
                optionId
              }
            }
          }
        }
      }
    }
  }
  user(login: $login) {
    projectV2(number: $number) {
      id
      fields(first: 50) {
        nodes {
          ... on ProjectV2SingleSelectField {
            id
            name
            options {
              id
              name
              color
            }
          }
        }
      }
      items(first: 100) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          id
          content {
            ... on Issue {
              number
              title
              body
              url
              state
              isPullRequest: __typename
            }
          }
          fieldValues(first: 20) {
            nodes {
              ... on ProjectV2ItemFieldSingleSelectValue {
                field {
                  ... on ProjectV2SingleSelectField {
                    id
                    name
                  }
                }
                optionId
              }
            }
          }
        }
      }
    }
  }
}`;

    const response = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.ghToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: { login, number: projectNumber },
      }),
    });

    if (!response.ok) {
      const message = await this.extractGitHubErrorMessage(response);
      throw new Error(`GraphQL request failed: ${message}`);
    }

    const rawResponse: unknown = await response.json();
    const graphqlError = extractGraphQLErrors(rawResponse);
    if (graphqlError) {
      throw new Error(graphqlError);
    }

    const projectData = extractProjectData(rawResponse);
    if (!projectData) {
      throw new Error(`Project not found for ${login}/${projectNumber}`);
    }

    const projectId = getStringProp(projectData, 'id') ?? '';
    const fieldsObj = projectData['fields'];
    const fieldNodes = isRecord(fieldsObj)
      ? (getArrayProp(fieldsObj, 'nodes') ?? [])
      : [];

    let storyFieldId: string | null = null;
    let storyOptions: StoryOption[] = [];
    let noStoryOptionId: string | null = null;

    for (const fieldNode of fieldNodes) {
      if (!isRecord(fieldNode)) continue;
      const fieldId = getStringProp(fieldNode, 'id');
      const fieldName = getStringProp(fieldNode, 'name');
      if (!fieldId || !fieldName) continue;
      if (fieldName.toLowerCase() !== 'story') continue;

      storyFieldId = fieldId;
      const optionsRaw = getArrayProp(fieldNode, 'options') ?? [];
      const allOptions: StoryOption[] = [];

      for (const opt of optionsRaw) {
        if (!isRecord(opt)) continue;
        const optId = getStringProp(opt, 'id');
        const optName = getStringProp(opt, 'name');
        const optColor = getStringProp(opt, 'color');
        if (!optId || !optName || !optColor) continue;
        if (
          optName.toLowerCase() === 'no story' ||
          optName.toLowerCase() === 'no-story'
        ) {
          noStoryOptionId = optId;
          continue;
        }
        allOptions.push({ id: optId, name: optName, color: optColor });
      }
      storyOptions = allOptions;
      break;
    }

    if (!storyFieldId) {
      return { issues: [], storyOptions: [], storyFieldId: '', projectId };
    }

    const itemsObj = projectData['items'];
    const itemNodes = isRecord(itemsObj)
      ? (getArrayProp(itemsObj, 'nodes') ?? [])
      : [];

    const issues: TriageIssue[] = [];
    for (const itemNode of itemNodes) {
      if (!isRecord(itemNode)) continue;
      const itemId = getStringProp(itemNode, 'id');
      if (!itemId) continue;

      const content = itemNode['content'];
      if (!isRecord(content)) continue;
      if (getStringProp(content, 'isPullRequest') === 'PullRequest') continue;
      if (getStringProp(content, 'state') !== 'OPEN') continue;

      const issueNumber = getNumberProp(content, 'number');
      const issueTitle = getStringProp(content, 'title');
      const issueUrl = getStringProp(content, 'url');
      if (!issueNumber || !issueTitle || !issueUrl) continue;

      const fieldValuesObj = itemNode['fieldValues'];
      const fieldValueNodes = isRecord(fieldValuesObj)
        ? (getArrayProp(fieldValuesObj, 'nodes') ?? [])
        : [];

      let hasStoryAssigned = false;
      for (const fvNode of fieldValueNodes) {
        if (!isRecord(fvNode)) continue;
        const fvFieldObj = fvNode['field'];
        if (!isRecord(fvFieldObj)) continue;
        const fvFieldId = getStringProp(fvFieldObj, 'id');
        if (fvFieldId !== storyFieldId) continue;
        const optionId = getStringProp(fvNode, 'optionId');
        if (optionId && optionId !== noStoryOptionId) {
          hasStoryAssigned = true;
        }
        break;
      }
      if (hasStoryAssigned) continue;

      const urlMatch = issueUrl.match(
        /https:\/\/github\.com\/([^/]+)\/([^/]+)\/(issues|pull)\/\d+/,
      );
      if (!urlMatch) continue;

      const issueBody = getStringProp(content, 'body') ?? '';
      issues.push({
        number: issueNumber,
        title: issueTitle,
        body: issueBody,
        url: issueUrl,
        owner: urlMatch[1],
        repo: urlMatch[2],
        itemId,
      });
    }

    return { issues, storyOptions, storyFieldId, projectId };
  };

  setStory = async (
    projectId: string,
    storyFieldId: string,
    itemId: string,
    storyOptionId: string,
  ): Promise<void> => {
    const query = `mutation UpdateProjectV2ItemFieldValue(
      $projectId: ID!
      $fieldId: ID!
      $itemId: ID!
      $optionId: String!
    ) {
      updateProjectV2ItemFieldValue(input: {
        projectId: $projectId
        fieldId: $fieldId
        itemId: $itemId
        value: { singleSelectOptionId: $optionId }
      }) {
        clientMutationId
      }
    }`;

    const response = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.ghToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: {
          projectId,
          fieldId: storyFieldId,
          itemId,
          optionId: storyOptionId,
        },
      }),
    });

    if (!response.ok) {
      const message = await this.extractGitHubErrorMessage(response);
      throw new Error(`setStory GraphQL request failed: ${message}`);
    }

    const rawSetStoryResponse: unknown = await response.json();
    const setStoryError = extractGraphQLErrors(rawSetStoryResponse);
    if (setStoryError) {
      throw new Error(setStoryError);
    }
  };

  closeIssue = async (
    owner: string,
    repo: string,
    issueNumber: number,
    reason: IssueCloseReason,
  ): Promise<void> => {
    if (!/^[a-zA-Z0-9_.-]+$/.test(owner) || !/^[a-zA-Z0-9_.-]+$/.test(repo)) {
      throw new Error('Invalid owner or repo name');
    }
    const url = `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`;

    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${this.ghToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/vnd.github+json',
      },
      body: JSON.stringify({
        state: 'closed',
        state_reason: reason,
      }),
    });

    if (!response.ok) {
      const message = await this.extractGitHubErrorMessage(response);
      throw new Error(`closeIssue request failed: ${message}`);
    }
  };

  fetchImageProxy = async (
    targetUrl: string,
  ): Promise<{ content: Buffer; contentType: string }> => {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(targetUrl);
    } catch {
      throw new Error('Invalid URL');
    }
    const allowedIndex = ALLOWED_IMAGE_PROXY_HOSTNAMES.indexOf(
      parsedUrl.hostname,
    );
    if (allowedIndex === -1) {
      throw new Error('Hostname not allowed');
    }
    const safeHostname = ALLOWED_IMAGE_PROXY_HOSTNAMES[allowedIndex];
    const encodedPathAndQuery =
      parsedUrl.pathname.split('/').map(encodeURIComponent).join('/') +
      (parsedUrl.search
        ? '?' +
          Array.from(parsedUrl.searchParams.entries())
            .map(
              ([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`,
            )
            .join('&')
        : '');
    const safeUrl = `https://${safeHostname}${encodedPathAndQuery}`;
    const response = await fetch(safeUrl, {
      headers: {
        Authorization: `token ${this.ghToken}`,
      },
    });
    if (!response.ok) {
      const message = await this.extractGitHubErrorMessage(response);
      throw new Error(message);
    }
    const arrayBuffer = await response.arrayBuffer();
    const content = Buffer.from(arrayBuffer);
    const contentType =
      response.headers.get('content-type') ?? 'application/octet-stream';
    return { content, contentType };
  };
}
