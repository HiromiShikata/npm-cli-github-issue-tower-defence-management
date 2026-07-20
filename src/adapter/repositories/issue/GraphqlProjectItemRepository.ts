import { HTTPError } from 'ky';
import { BaseGitHubRepository } from '../BaseGitHubRepository';
import { postGithubGraphqlJson } from '../githubGraphqlClient';
import { Project } from '../../../domain/entities/Project';
import { Issue } from '../../../domain/entities/Issue';
export type ProjectItem = {
  id: string;
  nameWithOwner: string;
  number: number;
  title: string;
  state: 'OPEN' | 'CLOSED' | 'MERGED';
  url: string;
  body: string | null;
  labels: string[];
  assignees: string[];
  createdAt: string;
  updatedAt: string;
  author: string;
  closingIssueReferenceUrls: string[];
  customFields: {
    name: string;
    value: string | null;
  }[];
};
export type ProjectItemLight = {
  id: string;
  updatedAt: string;
  url: string;
  number: number;
};
type ProjectV2ItemFieldValueNode = {
  text?: string;
  number?: number;
  date?: string;
  name?: string;
  field: {
    name: string;
  };
};
type ProjectV2ItemContentNode = {
  repository: { nameWithOwner: string };
  number: number;
  title: string;
  state: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  author: { login: string } | null;
  labels: { nodes: { name: string }[] };
  assignees: { nodes: { login: string }[] };
  closingIssuesReferences?: { nodes: { url: string }[] };
};
type ProjectV2ItemNode = {
  id: string;
  fieldValues: {
    nodes: ProjectV2ItemFieldValueNode[];
  };
  content: ProjectV2ItemContentNode;
};
// Rate-limit cost of a GraphQL query grows with the number of requested
// nodes (roughly totalNodes / 100, see
// https://docs.github.com/en/graphql/overview/rate-limits-and-node-limits-for-the-graphql-api).
// The previous values (labels first: 100, assignees first: 20) requested far
// more nodes than any issue in the managed projects actually carries: no
// operational issue has more than 20 labels or more than 10 assignees, so
// these reduced limits do not drop any data while cutting the per-item node
// budget to roughly one third.
export const PROJECT_ITEM_LABELS_FIRST = 20;
export const PROJECT_ITEM_ASSIGNEES_FIRST = 10;

const PROJECT_V2_ITEM_FIELD_VALUES_AND_CONTENT_SELECTION = `
          fieldValues(first: 10) {
            nodes {
              ... on ProjectV2ItemFieldTextValue {
                text
                field {
                  ... on ProjectV2Field{
                    name
                  }
                }
              }
              ... on ProjectV2ItemFieldNumberValue {
                number
                id
                field {
                  ... on ProjectV2Field{
                    name
                  }
                }
              }
              ... on ProjectV2ItemFieldDateValue {
                date
                field {
                  ... on ProjectV2Field{
                    name
                  }
                }
              }
              ... on ProjectV2ItemFieldSingleSelectValue {
                name
                field {
                  ... on ProjectV2SingleSelectField {
                    name
                  }
                }
              }
              ... on ProjectV2ItemFieldIterationValue {
                title
                field {
                  ... on ProjectV2Field{
                    name
                  }
                }
              }
            }
          }
          content {
            ... on Issue {
              number
              title
              state
              url
              createdAt
              updatedAt
              author {
                login
              }
              labels(first: ${PROJECT_ITEM_LABELS_FIRST}) {
                nodes {
                  name
                }
              }
              assignees(first: ${PROJECT_ITEM_ASSIGNEES_FIRST}) {
                nodes {
                  login
                }
              }
              repository {
                nameWithOwner
              }
            }
            ... on PullRequest {
              number
              title
              state
              url
              createdAt
              updatedAt
              author {
                login
              }
              labels(first: ${PROJECT_ITEM_LABELS_FIRST}) {
                nodes {
                  name
                }
              }
              assignees(first: ${PROJECT_ITEM_ASSIGNEES_FIRST}) {
                nodes {
                  login
                }
              }
              repository {
                nameWithOwner
              }
              closingIssuesReferences(first: 50) {
                nodes {
                  url
                }
              }
            }
          }`;
export const PAGINATION_DELAY_MS = 5000;
export const FETCH_PROJECT_ITEMS_INITIAL_PAGE_SIZE = 100;
export const FETCH_PROJECT_ITEMS_BY_IDS_BATCH_SIZE = 100;
export const FETCH_PROJECT_ITEMS_GRAPHQL_ERROR_PAYLOAD_MAX_LENGTH = 4000;
export const RATE_LIMIT_MAX_RETRIES = 6;
export const RATE_LIMIT_MIN_BACKOFF_MS = 1000;
export const RATE_LIMIT_DEFAULT_BACKOFF_MS = 60000;
export const RATE_LIMIT_MAX_BACKOFF_MS = 300000;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const parseNonNegativeIntegerHeader = (value: string | null): number | null => {
  if (value === null) {
    return null;
  }
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) {
    return null;
  }
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const computeRateLimitBackoffMs = (
  headers: Headers | undefined,
  attempt: number,
  nowMs: number,
): number => {
  const exponentialMs = Math.min(
    RATE_LIMIT_MAX_BACKOFF_MS,
    RATE_LIMIT_DEFAULT_BACKOFF_MS * Math.pow(2, attempt),
  );
  const retryAfterSeconds = parseNonNegativeIntegerHeader(
    headers?.get('retry-after') ?? null,
  );
  if (retryAfterSeconds !== null) {
    return Math.min(
      RATE_LIMIT_MAX_BACKOFF_MS,
      Math.max(RATE_LIMIT_MIN_BACKOFF_MS, retryAfterSeconds * 1000),
    );
  }
  const remaining = parseNonNegativeIntegerHeader(
    headers?.get('x-ratelimit-remaining') ?? null,
  );
  const resetEpochSeconds = parseNonNegativeIntegerHeader(
    headers?.get('x-ratelimit-reset') ?? null,
  );
  if (remaining === 0 && resetEpochSeconds !== null) {
    const waitMs = resetEpochSeconds * 1000 - nowMs;
    return Math.min(
      RATE_LIMIT_MAX_BACKOFF_MS,
      Math.max(RATE_LIMIT_MIN_BACKOFF_MS, waitMs),
    );
  }
  return Math.max(RATE_LIMIT_MIN_BACKOFF_MS, exponentialMs);
};

const isRateLimitStatus = (status: number): boolean =>
  status === 429 || status === 403;

export const callWithRateLimitRetry = async <T>(
  request: () => Promise<T>,
): Promise<T> => {
  let attempt = 0;
  for (;;) {
    try {
      return await request();
    } catch (error) {
      if (
        !(error instanceof HTTPError) ||
        !isRateLimitStatus(error.response.status) ||
        attempt >= RATE_LIMIT_MAX_RETRIES
      ) {
        throw error;
      }
      const backoffMs = computeRateLimitBackoffMs(
        error.response.headers,
        attempt,
        Date.now(),
      );
      console.log(
        `fetchProjectItems: GitHub returned ${error.response.status} (rate limit). Backing off ${backoffMs}ms before retry ${attempt + 1}/${RATE_LIMIT_MAX_RETRIES}.`,
      );
      await sleep(backoffMs);
      attempt++;
    }
  }
};

const stringifyGraphqlErrorsForLog = (
  errors: { message: string }[],
): string => {
  const serialized = JSON.stringify(errors);
  if (
    serialized.length <= FETCH_PROJECT_ITEMS_GRAPHQL_ERROR_PAYLOAD_MAX_LENGTH
  ) {
    return serialized;
  }
  return `${serialized.slice(0, FETCH_PROJECT_ITEMS_GRAPHQL_ERROR_PAYLOAD_MAX_LENGTH)}...[truncated]`;
};

export class GraphqlProjectItemRepository extends BaseGitHubRepository {
  fetchItemId = async (
    projectId: string,
    owner: string,
    repositoryName: string,
    issueNumber: number,
  ): Promise<string | undefined> => {
    const graphqlQuery = {
      query: `query GetProjectItemID( $owner: String!, $name: String!, $issueNumber: Int!) {
  repository(owner: $owner, name: $name) {
    issue(number: $issueNumber) {
      projectItems(first: 2) {
        nodes {
          id
          project {
            id
          }
        }
      }
    }
  }
}`,
      variables: {
        projectID: projectId,
        owner: owner,
        name: repositoryName,
        issueNumber: issueNumber,
      },
    };

    try {
      const response = await postGithubGraphqlJson<{
        data?: {
          repository: {
            issue: {
              projectItems: {
                nodes: {
                  id: string;
                  project: { id: string };
                }[];
              };
            };
          };
        };
        errors?: { message: string }[];
      }>({
        ghToken: this.ghToken,
        query: graphqlQuery.query,
        variables: graphqlQuery.variables,
      });

      if (!response.data) {
        const errorMessages = response.errors
          ? response.errors.map((e) => e.message).join('; ')
          : 'no data field in response';
        throw new Error(
          `GitHub GraphQL API returned no data for fetchItemId: ${errorMessages}`,
        );
      }
      const projectItems: {
        id: string;
        project: { id: string };
      }[] = response.data.repository.issue.projectItems.nodes;
      const projectItemId = projectItems.find(
        (item) => item.project.id === projectId,
      )?.id;
      return projectItemId;
    } catch (error) {
      console.error('Error fetching GitHub Project V2 ID:', error);
      return undefined;
    }
  };
  fetchProjectItems = async (
    projectId: string,
    query?: string,
  ): Promise<ProjectItem[]> => {
    const graphqlQueryString = `
query GetProjectItems($projectId: ID!, $after: String, $first: Int!, $query: String) {
  node(id: $projectId) {
    ... on ProjectV2 {
      items(first: $first, after: $after, query: $query) {
        totalCount
        pageInfo {
          endCursor
          hasNextPage
        }
        nodes {
          id${PROJECT_V2_ITEM_FIELD_VALUES_AND_CONTENT_SELECTION}
        }
      }
    }
  }
}
`;
    const callGraphql = async (
      projectId: string,
      after: string | null,
      first: number,
    ): Promise<{
      node: {
        items: {
          totalCount: number;
          pageInfo: {
            endCursor: string;
            startCursor: string;
            hasNextPage: boolean;
          };
          nodes: {
            id: string;
            fieldValues: {
              nodes: {
                text: string;
                number: number;
                date: string;
                field: {
                  name: string;
                };
              }[];
            };
            content: {
              repository: { nameWithOwner: string };
              number: number;
              title: string;
              state: string;
              url: string;
              createdAt: string;
              updatedAt: string;
              author: { login: string } | null;
              labels: { nodes: { name: string }[] };
              assignees: { nodes: { login: string }[] };
              closingIssuesReferences?: { nodes: { url: string }[] };
            };
          }[];
        };
      };
    }> => {
      const graphqlQuery = {
        query: graphqlQueryString,
        variables: {
          projectId: projectId,
          after: after,
          first: first,
          query: query ?? null,
        },
      };
      const response = await callWithRateLimitRetry(() =>
        postGithubGraphqlJson<{
          data: {
            node: {
              items: {
                totalCount: number;
                pageInfo: {
                  endCursor: string;
                  startCursor: string;
                  hasNextPage: boolean;
                };
                nodes: {
                  id: string;
                  fieldValues: {
                    nodes: {
                      text: string;
                      number: number;
                      date: string;
                      field: {
                        name: string;
                      };
                    }[];
                  };
                  content: {
                    repository: { nameWithOwner: string };
                    number: number;
                    title: string;
                    state: string;
                    url: string;
                    createdAt: string;
                    updatedAt: string;
                    author: { login: string } | null;
                    labels: { nodes: { name: string }[] };
                    assignees: { nodes: { login: string }[] };
                    closingIssuesReferences?: { nodes: { url: string }[] };
                  };
                }[];
              };
            } | null;
          } | null;
          errors?: { message: string }[];
        }>({
          ghToken: this.ghToken,
          query: graphqlQuery.query,
          variables: graphqlQuery.variables,
        }),
      );
      if (response.errors && response.errors.length > 0) {
        throw new Error(
          `GitHub GraphQL errors: ${stringifyGraphqlErrorsForLog(response.errors)}`,
        );
      }
      const rawData = response.data;
      if (!rawData) {
        throw new Error('No data returned from GitHub API');
      }
      const rawNode = rawData.node;
      if (rawNode === null) {
        throw new Error('No data returned from GitHub API');
      }
      return { node: rawNode };
    };
    const callGraphqlWithHalvingFallback = async (
      after: string | null,
    ): Promise<{
      node: {
        items: {
          totalCount: number;
          pageInfo: {
            endCursor: string;
            startCursor: string;
            hasNextPage: boolean;
          };
          nodes: {
            id: string;
            fieldValues: {
              nodes: {
                text: string;
                number: number;
                date: string;
                field: {
                  name: string;
                };
              }[];
            };
            content: {
              repository: { nameWithOwner: string };
              number: number;
              title: string;
              state: string;
              url: string;
              createdAt: string;
              updatedAt: string;
              author: { login: string } | null;
              labels: { nodes: { name: string }[] };
              assignees: { nodes: { login: string }[] };
              closingIssuesReferences?: { nodes: { url: string }[] };
            };
          }[];
        };
      };
    }> => {
      let attemptFirst = FETCH_PROJECT_ITEMS_INITIAL_PAGE_SIZE;
      let lastError: unknown = null;
      while (attemptFirst >= 1) {
        try {
          return await callGraphql(projectId, after, attemptFirst);
        } catch (error) {
          lastError = error;
          if (
            error instanceof HTTPError &&
            isRateLimitStatus(error.response.status)
          ) {
            throw error;
          }
          if (attemptFirst === 1) {
            throw error;
          }
          const nextFirst = Math.max(1, Math.floor(attemptFirst / 2));
          console.log(
            `fetchProjectItems: page request with first=${attemptFirst} failed, halving to first=${nextFirst}: ${error instanceof Error ? error.message : String(error)}`,
          );
          attemptFirst = nextFirst;
        }
      }
      throw lastError instanceof Error
        ? lastError
        : new Error(String(lastError));
    };
    const issues: ProjectItem[] = [];
    let after: string | null = null;
    let hasNextPage = true;
    let totalCount = 0;
    let cumulativeRawNodes = 0;
    let pageIndex = 0;

    while (hasNextPage) {
      if (after !== null) {
        await new Promise((resolve) =>
          setTimeout(resolve, PAGINATION_DELAY_MS),
        );
      }
      const data = await callGraphqlWithHalvingFallback(after);
      const pageNodes = data.node.items.nodes;
      const pageInfo = data.node.items.pageInfo;
      totalCount = data.node.items.totalCount;
      cumulativeRawNodes += pageNodes.length;
      pageIndex++;
      console.log(
        `fetchProjectItems: page ${pageIndex}, nodes: ${pageNodes.length}, cumulative: ${cumulativeRawNodes}/${totalCount}`,
      );
      const nodes: ProjectV2ItemNode[] = pageNodes;
      nodes.forEach((item) => {
        const projectItem = this.mapProjectV2ItemNodeToProjectItem(item);
        if (projectItem) {
          issues.push(projectItem);
        }
      });
      if (
        pageNodes.length > 0 &&
        !pageInfo.hasNextPage &&
        cumulativeRawNodes < totalCount
      ) {
        throw new Error(
          `fetchProjectItems: page ${pageIndex} has ${pageNodes.length} nodes with hasNextPage=false but only ${cumulativeRawNodes}/${totalCount} items accumulated`,
        );
      }
      hasNextPage = pageInfo.hasNextPage;
      after = pageInfo.endCursor;
    }
    console.log(
      `fetchProjectItems: completed, totalCount: ${totalCount}, cumulativeRawNodes: ${cumulativeRawNodes}, issues: ${issues.length}`,
    );
    if (cumulativeRawNodes !== totalCount) {
      throw new Error(
        `fetchProjectItems: expected ${totalCount} items but accumulated ${cumulativeRawNodes}`,
      );
    }
    return issues;
  };
  private mapProjectV2ItemNodeToProjectItem = (
    item: ProjectV2ItemNode | null,
  ): ProjectItem | null => {
    if (!item || !item.content || !item.content.repository) {
      return null;
    }
    return {
      id: item.id,
      nameWithOwner: item.content.repository.nameWithOwner,
      number: item.content.number,
      title: item.content.title,
      state: this.convertStrToState(item.content.state),
      url: item.content.url,
      body: null,
      labels: item.content.labels?.nodes?.map((l) => l.name) || [],
      assignees: item.content.assignees?.nodes?.map((a) => a.login) || [],
      createdAt: item.content.createdAt || new Date().toISOString(),
      updatedAt:
        item.content.updatedAt ||
        item.content.createdAt ||
        new Date().toISOString(),
      author: item.content.author?.login || '',
      closingIssueReferenceUrls:
        item.content.closingIssuesReferences?.nodes
          ?.map((node) => node.url)
          .filter((url) => url.length > 0) || [],
      customFields: item.fieldValues.nodes
        .filter((field) => !!field.field)
        .map((field) => {
          return {
            name: field.field.name,
            value:
              field.name ??
              field.text ??
              field.number?.toString() ??
              field.date ??
              null,
          };
        }),
    };
  };
  fetchProjectItemsLight = async (
    projectId: string,
    query?: string,
  ): Promise<ProjectItemLight[]> => {
    const graphqlQueryString = `
query GetProjectItemsLight($projectId: ID!, $after: String, $first: Int!, $query: String) {
  node(id: $projectId) {
    ... on ProjectV2 {
      items(first: $first, after: $after, query: $query) {
        totalCount
        pageInfo {
          endCursor
          hasNextPage
        }
        nodes {
          id
          updatedAt
          content {
            ... on Issue {
              url
              number
            }
            ... on PullRequest {
              url
              number
            }
          }
        }
      }
    }
  }
}
`;
    const callGraphql = async (
      after: string | null,
    ): Promise<{
      totalCount: number;
      pageInfo: { endCursor: string; hasNextPage: boolean };
      nodes: {
        id: string;
        updatedAt: string;
        content: { url: string; number: number } | null;
      }[];
    }> => {
      const response = await callWithRateLimitRetry(() =>
        postGithubGraphqlJson<{
          data: {
            node: {
              items: {
                totalCount: number;
                pageInfo: { endCursor: string; hasNextPage: boolean };
                nodes: {
                  id: string;
                  updatedAt: string;
                  content: { url: string; number: number } | null;
                }[];
              };
            } | null;
          } | null;
          errors?: { message: string }[];
        }>({
          ghToken: this.ghToken,
          query: graphqlQueryString,
          variables: {
            projectId: projectId,
            after: after,
            first: FETCH_PROJECT_ITEMS_INITIAL_PAGE_SIZE,
            query: query ?? null,
          },
        }),
      );
      if (response.errors && response.errors.length > 0) {
        throw new Error(
          `GitHub GraphQL errors: ${stringifyGraphqlErrorsForLog(response.errors)}`,
        );
      }
      const rawData = response.data;
      if (!rawData || rawData.node === null) {
        throw new Error('No data returned from GitHub API');
      }
      return rawData.node.items;
    };
    const fetchAllLightPages = async (): Promise<{
      lightItems: ProjectItemLight[];
      inconsistencyMessage: string | null;
    }> => {
      const lightItems: ProjectItemLight[] = [];
      let after: string | null = null;
      let hasNextPage = true;
      let totalCount = 0;
      let cumulativeRawNodes = 0;
      let pageIndex = 0;
      let inconsistencyMessage: string | null = null;
      while (hasNextPage) {
        if (after !== null) {
          await new Promise((resolve) =>
            setTimeout(resolve, PAGINATION_DELAY_MS),
          );
        }
        const items = await callGraphql(after);
        const pageNodes = items.nodes;
        const pageInfo = items.pageInfo;
        totalCount = items.totalCount;
        cumulativeRawNodes += pageNodes.length;
        pageIndex++;
        console.log(
          `fetchProjectItemsLight: page ${pageIndex}, nodes: ${pageNodes.length}, cumulative: ${cumulativeRawNodes}/${totalCount}`,
        );
        pageNodes.forEach((node) => {
          if (!node || !node.content || !node.content.url) {
            return;
          }
          lightItems.push({
            id: node.id,
            updatedAt: node.updatedAt,
            url: node.content.url,
            number: node.content.number,
          });
        });
        if (
          pageNodes.length > 0 &&
          !pageInfo.hasNextPage &&
          cumulativeRawNodes < totalCount
        ) {
          inconsistencyMessage = `fetchProjectItemsLight: page ${pageIndex} has ${pageNodes.length} nodes with hasNextPage=false but only ${cumulativeRawNodes}/${totalCount} items accumulated`;
        }
        hasNextPage = pageInfo.hasNextPage;
        after = pageInfo.endCursor;
      }
      console.log(
        `fetchProjectItemsLight: completed, totalCount: ${totalCount}, cumulativeRawNodes: ${cumulativeRawNodes}, items: ${lightItems.length}`,
      );
      if (inconsistencyMessage === null && cumulativeRawNodes !== totalCount) {
        inconsistencyMessage = `fetchProjectItemsLight: expected ${totalCount} items but accumulated ${cumulativeRawNodes}`;
      }
      return { lightItems, inconsistencyMessage };
    };
    const firstAttempt = await fetchAllLightPages();
    if (firstAttempt.inconsistencyMessage === null) {
      return firstAttempt.lightItems;
    }
    console.warn(
      `${firstAttempt.inconsistencyMessage}, retrying full fetch once`,
    );
    const retryAttempt = await fetchAllLightPages();
    if (retryAttempt.inconsistencyMessage === null) {
      return retryAttempt.lightItems;
    }
    console.warn(
      `${retryAttempt.inconsistencyMessage}, continuing with accumulated items after retry`,
    );
    return retryAttempt.lightItems;
  };
  fetchProjectItemsByIds = async (ids: string[]): Promise<ProjectItem[]> => {
    if (ids.length === 0) {
      return [];
    }
    const graphqlQueryString = `
query GetProjectItemsByIds($ids: [ID!]!) {
  nodes(ids: $ids) {
    ... on ProjectV2Item {
      id${PROJECT_V2_ITEM_FIELD_VALUES_AND_CONTENT_SELECTION}
    }
  }
}
`;
    const callGraphql = async (
      batchIds: string[],
    ): Promise<(ProjectV2ItemNode | null)[]> => {
      const response = await callWithRateLimitRetry(() =>
        postGithubGraphqlJson<{
          data: { nodes: (ProjectV2ItemNode | null)[] } | null;
          errors?: { message: string }[];
        }>({
          ghToken: this.ghToken,
          query: graphqlQueryString,
          variables: {
            ids: batchIds,
          },
        }),
      );
      if (response.errors && response.errors.length > 0) {
        throw new Error(
          `GitHub GraphQL errors: ${stringifyGraphqlErrorsForLog(response.errors)}`,
        );
      }
      if (!response.data) {
        throw new Error('No data returned from GitHub API');
      }
      return response.data.nodes;
    };
    const items: ProjectItem[] = [];
    let batchIndex = 0;
    for (
      let start = 0;
      start < ids.length;
      start += FETCH_PROJECT_ITEMS_BY_IDS_BATCH_SIZE
    ) {
      if (start > 0) {
        await new Promise((resolve) =>
          setTimeout(resolve, PAGINATION_DELAY_MS),
        );
      }
      const batchIds = ids.slice(
        start,
        start + FETCH_PROJECT_ITEMS_BY_IDS_BATCH_SIZE,
      );
      const nodes = await callGraphql(batchIds);
      batchIndex++;
      console.log(
        `fetchProjectItemsByIds: batch ${batchIndex}, ids: ${batchIds.length}, nodes: ${nodes.length}`,
      );
      nodes.forEach((node) => {
        const projectItem = this.mapProjectV2ItemNodeToProjectItem(node);
        if (projectItem) {
          items.push(projectItem);
        }
      });
    }
    return items;
  };
  getProjectItemFieldsFromIssueUrl = async (
    issueUrl: string,
  ): Promise<
    {
      fieldName: string;
      fieldValue: string;
    }[]
  > => {
    const { owner, repo, issueNumber } = this.extractIssueFromUrl(issueUrl);
    return this.getProjectItemFields(owner, repo, issueNumber);
  };

  getProjectItemFields = async (
    owner: string,
    repositoryName: string,
    issueNumber: number,
  ): Promise<
    {
      fieldName: string;
      fieldValue: string;
    }[]
  > => {
    const graphqlQueryString = `
query GetProjectFields($owner: String!, $repository: String!, $issueNumber: Int!){
  repository(owner: $owner, name: $repository) {
    issue(number: $issueNumber) {
      projectItems(first: 2) {
        nodes {
          id
          fieldValues(first: 10) {
            totalCount
            nodes {
              __typename
              ... on ProjectV2ItemFieldDateValue {
                date
                field {
                  ... on ProjectV2Field {
                    name
                  }
                }
              }
              ... on ProjectV2ItemFieldSingleSelectValue {
                name
                field {
                  ... on ProjectV2SingleSelectField {
                    name
                  }
                }
              }
              ... on ProjectV2ItemFieldUserValue {
                users {
                  totalCount
                  nodes {
                    login
                  }
                }
                field {
                  ... on ProjectV2Field {
                    name
                  }
                }
              }
              ... on ProjectV2ItemFieldRepositoryValue {
                repository {
                  name
                }
                field {
                  __typename
                  ... on ProjectV2Field {
                    name
                  }
                }
              }
              ... on ProjectV2ItemFieldTextValue {
                text
              }
            }
          }
        }
      }
    }
  }
}

`;
    const graphqlQuery = {
      query: graphqlQueryString,
      variables: {
        owner: owner,
        repository: repositoryName,
        issueNumber: issueNumber,
      },
    };
    const response = await postGithubGraphqlJson<{
      data?: {
        repository: {
          issue: {
            projectItems: {
              nodes: {
                id: string;
                fieldValues: {
                  nodes: {
                    __typename: string;
                    field: { name: string };
                    date: string;
                    name: string;
                    text: string;
                    repository: { name: string };
                    user: { login: string };
                  }[];
                };
              }[];
            };
          };
        };
      };
      errors?: { message: string }[];
    }>({
      ghToken: this.ghToken,
      query: graphqlQuery.query,
      variables: graphqlQuery.variables,
    });

    if (!response.data) {
      const errorMessages = response.errors
        ? response.errors.map((e) => e.message).join('; ')
        : 'no data field in response';
      throw new Error(
        `GitHub GraphQL API returned no data for getProjectItemFields: ${errorMessages}`,
      );
    }
    const data = response.data;
    const issueFields: {
      fieldName: string;
      fieldValue: string;
    }[] = [];
    if (!data.repository.issue) {
      return issueFields;
    }
    const projectItems: {
      __typename: string;
      field: {
        name: string;
      };
      user?: {
        login: string;
      };
      repository?: {
        name: string;
      };
      date?: string;
      name?: string;
      text?: string;
    }[] = data.repository.issue.projectItems.nodes[0].fieldValues.nodes;
    projectItems.forEach((item) => {
      issueFields.push({
        fieldName: item.field?.name ?? '',
        fieldValue:
          item.date ??
          item.name ??
          item.text ??
          item.repository?.name ??
          item.user?.login ??
          '',
      });
    });
    return issueFields;
  };
  fetchProjectItemByUrl = async (
    issueUrl: string,
    projectId?: string,
  ): Promise<ProjectItem | null> => {
    const { owner, repo, issueNumber } = this.extractIssueFromUrl(issueUrl);
    const graphql = `query GetIssueOrPullRequest($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    issue(number: $number) {
      number
      title
      state
      url
      body
      createdAt
      updatedAt
      author {
        login
      }
      labels(first: ${PROJECT_ITEM_LABELS_FIRST}) {
        nodes {
          name
        }
      }
      assignees(first: ${PROJECT_ITEM_ASSIGNEES_FIRST}) {
        nodes {
          login
        }
      }
      repository {
        nameWithOwner
      }
      projectItems(first: 10) {
        nodes {
          id
          project {
            id
          }
          fieldValues(first: 10) {
            nodes {
              ... on ProjectV2ItemFieldTextValue {
                text
                field {
                  ... on ProjectV2Field {
                    name
                  }
                }
              }
              ... on ProjectV2ItemFieldNumberValue {
                number
                id
                field {
                  ... on ProjectV2Field {
                    name
                  }
                }
              }
              ... on ProjectV2ItemFieldDateValue {
                date
                field {
                  ... on ProjectV2Field {
                    name
                  }
                }
              }
              ... on ProjectV2ItemFieldSingleSelectValue {
                name
                field {
                  ... on ProjectV2SingleSelectField {
                    name
                  }
                }
              }
              ... on ProjectV2ItemFieldIterationValue {
                title
                field {
                  ... on ProjectV2Field {
                    name
                  }
                }
              }
            }
          }
        }
      }
    }
    pullRequest(number: $number) {
      number
      title
      state
      url
      body
      createdAt
      updatedAt
      author {
        login
      }
      labels(first: ${PROJECT_ITEM_LABELS_FIRST}) {
        nodes {
          name
        }
      }
      assignees(first: ${PROJECT_ITEM_ASSIGNEES_FIRST}) {
        nodes {
          login
        }
      }
      repository {
        nameWithOwner
      }
      closingIssuesReferences(first: 50) {
        nodes {
          url
        }
      }
      projectItems(first: 10) {
        nodes {
          id
          project {
            id
          }
          fieldValues(first: 10) {
            nodes {
              ... on ProjectV2ItemFieldTextValue {
                text
                field {
                  ... on ProjectV2Field {
                    name
                  }
                }
              }
              ... on ProjectV2ItemFieldNumberValue {
                number
                id
                field {
                  ... on ProjectV2Field {
                    name
                  }
                }
              }
              ... on ProjectV2ItemFieldDateValue {
                date
                field {
                  ... on ProjectV2Field {
                    name
                  }
                }
              }
              ... on ProjectV2ItemFieldSingleSelectValue {
                name
                field {
                  ... on ProjectV2SingleSelectField {
                    name
                  }
                }
              }
              ... on ProjectV2ItemFieldIterationValue {
                title
                field {
                  ... on ProjectV2Field {
                    name
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}`;
    const graphqlQuery = {
      query: graphql,
      variables: {
        owner: owner,
        repo: repo,
        number: issueNumber,
      },
    };
    type ContentNode = {
      number: number;
      title: string;
      state: string;
      url: string;
      body: string;
      createdAt: string;
      updatedAt: string;
      author: { login: string } | null;
      labels: { nodes: { name: string }[] };
      assignees: { nodes: { login: string }[] };
      repository: { nameWithOwner: string };
      closingIssuesReferences?: { nodes: { url: string }[] };
      projectItems: {
        nodes: {
          id: string;
          project: { id: string } | null;
          fieldValues: {
            nodes: {
              text: string;
              number: number;
              date: string;
              name: string;
              field: {
                name: string;
              };
            }[];
          };
        }[];
      };
    };
    const response = await postGithubGraphqlJson<{
      data?: {
        repository: {
          issue: ContentNode | null;
          pullRequest: ContentNode | null;
        } | null;
      };
      errors?: { message: string }[];
    }>({
      ghToken: this.ghToken,
      query: graphqlQuery.query,
      variables: graphqlQuery.variables,
    });
    if (!response.data) {
      const errorMessages = response.errors
        ? response.errors.map((e) => e.message).join('; ')
        : 'no data field in response';
      throw new Error(
        `GitHub GraphQL API returned no data for fetchProjectItemByUrl: ${errorMessages}`,
      );
    }
    const data = response.data;
    if (!data.repository) {
      return null;
    }
    const content = data.repository.issue ?? data.repository.pullRequest;
    if (!content) {
      return null;
    }
    const projectItems = content.projectItems.nodes;
    const item = projectId
      ? projectItems.find((node) => node.project?.id === projectId)
      : projectItems[0];
    if (!item) {
      console.warn(
        projectId
          ? `No project item found for issue ${issueUrl} on project ${projectId}`
          : `No project item found for issue ${issueUrl}`,
      );
      return null;
    }
    return {
      id: item.id,
      nameWithOwner: content.repository.nameWithOwner,
      number: content.number,
      title: content.title,
      state: this.convertStrToState(content.state),
      url: content.url,
      body: content.body,
      labels: content.labels?.nodes?.map((l) => l.name) || [],
      assignees: content.assignees?.nodes?.map((a) => a.login) || [],
      createdAt: content.createdAt || new Date().toISOString(),
      updatedAt:
        content.updatedAt || content.createdAt || new Date().toISOString(),
      author: content.author?.login || '',
      closingIssueReferenceUrls:
        content.closingIssuesReferences?.nodes
          ?.map((node) => node.url)
          .filter((url) => url.length > 0) || [],
      customFields: item.fieldValues.nodes
        .filter((field) => !!field.field)
        .map((field) => {
          return {
            name: field.field.name,
            value:
              field.name ??
              field.text ??
              field.number?.toString() ??
              field.date ??
              null,
          };
        }),
    };
  };
  convertStrToState = (state: string): 'OPEN' | 'CLOSED' | 'MERGED' => {
    return state === 'MERGED'
      ? 'MERGED'
      : state === 'CLOSED'
        ? 'CLOSED'
        : state === 'OPEN'
          ? 'OPEN'
          : 'OPEN';
  };

  updateProjectField = async (
    projectId: string,
    fieldId: string,
    itemId: string,
    value:
      | { text: string }
      | { number: number }
      | { date: string }
      | { singleSelectOptionId: string },
  ): Promise<void> => {
    const graphqlQuery = {
      query: `mutation {
      updateProjectV2ItemFieldValue(input: {
        projectId: "${projectId}"
        fieldId: "${fieldId}"
        itemId: "${itemId}"
        value: ${JSON.stringify(value).replace(/"([^"]+)":/g, '$1:')},
      }) {
        clientMutationId
      }
    }`,
    };

    const res = await postGithubGraphqlJson<{
      data: {
        updateProjectV2ItemFieldValue: {
          clientMutationId: string;
        };
      };
      errors: { message: string }[];
    }>({
      ghToken: this.ghToken,
      query: graphqlQuery.query,
    });
    if (res.errors) {
      throw new Error(res.errors.map((e) => e.message).join('\n'));
    }
  };

  clearProjectField = async (
    projectId: string,
    fieldId: string,
    itemId: string,
  ): Promise<void> => {
    const graphqlQuery = {
      query: `mutation {
      clearProjectV2ItemFieldValue(input: {
        projectId: "${projectId}"
        fieldId: "${fieldId}"
        itemId: "${itemId}"
      }) {
        clientMutationId
      }
    }`,
    };

    const res = await postGithubGraphqlJson<{
      data: {
        clearProjectV2ItemFieldValue: {
          clientMutationId: string;
        };
      };
      errors: { message: string }[];
    }>({
      ghToken: this.ghToken,
      query: graphqlQuery.query,
    });
    if (res.errors) {
      throw new Error(res.errors.map((e) => e.message).join('\n'));
    }
  };
  updateProjectTextField = async (
    project: Project['id'],
    fieldId: string,
    issue: Issue['itemId'],
    text: string,
  ): Promise<void> => {
    await this.updateProjectField(project, fieldId, issue, { text });
  };

  removeItemFromProject = async (
    projectId: string,
    itemId: string,
  ): Promise<void> => {
    const graphqlQuery = {
      query: `mutation RemoveProjectV2Item($projectId: ID!, $itemId: ID!) {
        deleteProjectV2Item(input: { projectId: $projectId, itemId: $itemId }) {
          clientMutationId
        }
      }`,
      variables: {
        projectId,
        itemId,
      },
    };

    const res = await postGithubGraphqlJson<{
      data: {
        deleteProjectV2Item: {
          clientMutationId: string;
        };
      };
      errors?: { message: string }[];
    }>({
      ghToken: this.ghToken,
      query: graphqlQuery.query,
      variables: graphqlQuery.variables,
    });

    if (res.errors) {
      throw new Error(res.errors.map((e) => e.message).join('\n'));
    }
  };

  removeItemFromProjectByIssueUrl = async (
    issueUrl: string,
    projectId: string,
  ): Promise<void> => {
    const { owner, repo, issueNumber } = this.extractIssueFromUrl(issueUrl);
    const itemId = await this.fetchItemId(projectId, owner, repo, issueNumber);
    if (!itemId) {
      throw new Error(
        `Issue not found in project. URL: ${issueUrl}, Project ID: ${projectId}`,
      );
    }
    await this.removeItemFromProject(projectId, itemId);
  };

  addIssueToProject = async (
    projectId: string,
    issueUrl: string,
  ): Promise<string> => {
    const { owner, repo, issueNumber } = this.extractIssueFromUrl(issueUrl);
    const nodeIdQuery = {
      query: `query GetContentNodeId($owner: String!, $repo: String!, $number: Int!) {
        repository(owner: $owner, name: $repo) {
          issueOrPullRequest(number: $number) {
            ... on Issue {
              id
            }
            ... on PullRequest {
              id
            }
          }
        }
      }`,
      variables: { owner, repo, number: issueNumber },
    };
    const nodeIdRes = await postGithubGraphqlJson<{
      data: {
        repository: {
          issueOrPullRequest: {
            id: string;
          } | null;
        };
      };
      errors?: { message: string }[];
    }>({
      ghToken: this.ghToken,
      query: nodeIdQuery.query,
      variables: nodeIdQuery.variables,
    });
    if (nodeIdRes.errors) {
      throw new Error(nodeIdRes.errors.map((e) => e.message).join('\n'));
    }
    const contentId = nodeIdRes.data.repository.issueOrPullRequest?.id;
    if (!contentId) {
      throw new Error(`Content not found for url ${issueUrl}`);
    }

    const addQuery = {
      query: `mutation AddIssueToProject($projectId: ID!, $contentId: ID!) {
        addProjectV2ItemById(input: { projectId: $projectId, contentId: $contentId }) {
          item { id }
        }
      }`,
      variables: { projectId, contentId },
    };
    const addRes = await postGithubGraphqlJson<{
      data: {
        addProjectV2ItemById: {
          item: { id: string };
        };
      };
      errors?: { message: string }[];
    }>({
      ghToken: this.ghToken,
      query: addQuery.query,
      variables: addQuery.variables,
    });
    if (addRes.errors) {
      throw new Error(addRes.errors.map((e) => e.message).join('\n'));
    }
    return addRes.data.addProjectV2ItemById.item.id;
  };
}
