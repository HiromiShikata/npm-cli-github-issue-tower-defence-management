"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GraphqlProjectItemRepository = exports.callWithRateLimitRetry = exports.RATE_LIMIT_MAX_BACKOFF_MS = exports.RATE_LIMIT_DEFAULT_BACKOFF_MS = exports.RATE_LIMIT_MIN_BACKOFF_MS = exports.RATE_LIMIT_MAX_RETRIES = exports.FETCH_PROJECT_ITEMS_GRAPHQL_ERROR_PAYLOAD_MAX_LENGTH = exports.FETCH_PROJECT_ITEMS_BY_IDS_BATCH_SIZE = exports.FETCH_PROJECT_ITEMS_INITIAL_PAGE_SIZE = exports.PAGINATION_DELAY_MS = exports.PROJECT_ITEM_ASSIGNEES_FIRST = exports.PROJECT_ITEM_LABELS_FIRST = void 0;
const ky_1 = require("ky");
const BaseGitHubRepository_1 = require("../BaseGitHubRepository");
const githubGraphqlClient_1 = require("../githubGraphqlClient");
// Rate-limit cost of a GraphQL query grows with the number of requested
// nodes (roughly totalNodes / 100, see
// https://docs.github.com/en/graphql/overview/rate-limits-and-node-limits-for-the-graphql-api).
// The previous values (labels first: 100, assignees first: 20) requested far
// more nodes than any issue in the managed projects actually carries: no
// operational issue has more than 20 labels or more than 10 assignees, so
// these reduced limits do not drop any data while cutting the per-item node
// budget to roughly one third.
exports.PROJECT_ITEM_LABELS_FIRST = 20;
exports.PROJECT_ITEM_ASSIGNEES_FIRST = 10;
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
              labels(first: ${exports.PROJECT_ITEM_LABELS_FIRST}) {
                nodes {
                  name
                }
              }
              assignees(first: ${exports.PROJECT_ITEM_ASSIGNEES_FIRST}) {
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
              labels(first: ${exports.PROJECT_ITEM_LABELS_FIRST}) {
                nodes {
                  name
                }
              }
              assignees(first: ${exports.PROJECT_ITEM_ASSIGNEES_FIRST}) {
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
exports.PAGINATION_DELAY_MS = 5000;
exports.FETCH_PROJECT_ITEMS_INITIAL_PAGE_SIZE = 100;
exports.FETCH_PROJECT_ITEMS_BY_IDS_BATCH_SIZE = 100;
exports.FETCH_PROJECT_ITEMS_GRAPHQL_ERROR_PAYLOAD_MAX_LENGTH = 4000;
exports.RATE_LIMIT_MAX_RETRIES = 6;
exports.RATE_LIMIT_MIN_BACKOFF_MS = 1000;
exports.RATE_LIMIT_DEFAULT_BACKOFF_MS = 60000;
exports.RATE_LIMIT_MAX_BACKOFF_MS = 300000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const parseNonNegativeIntegerHeader = (value) => {
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
const computeRateLimitBackoffMs = (headers, attempt, nowMs) => {
    const exponentialMs = Math.min(exports.RATE_LIMIT_MAX_BACKOFF_MS, exports.RATE_LIMIT_DEFAULT_BACKOFF_MS * Math.pow(2, attempt));
    const retryAfterSeconds = parseNonNegativeIntegerHeader(headers?.get('retry-after') ?? null);
    if (retryAfterSeconds !== null) {
        return Math.min(exports.RATE_LIMIT_MAX_BACKOFF_MS, Math.max(exports.RATE_LIMIT_MIN_BACKOFF_MS, retryAfterSeconds * 1000));
    }
    const remaining = parseNonNegativeIntegerHeader(headers?.get('x-ratelimit-remaining') ?? null);
    const resetEpochSeconds = parseNonNegativeIntegerHeader(headers?.get('x-ratelimit-reset') ?? null);
    if (remaining === 0 && resetEpochSeconds !== null) {
        const waitMs = resetEpochSeconds * 1000 - nowMs;
        return Math.min(exports.RATE_LIMIT_MAX_BACKOFF_MS, Math.max(exports.RATE_LIMIT_MIN_BACKOFF_MS, waitMs));
    }
    return Math.max(exports.RATE_LIMIT_MIN_BACKOFF_MS, exponentialMs);
};
const isRateLimitStatus = (status) => status === 429 || status === 403;
const callWithRateLimitRetry = async (request) => {
    let attempt = 0;
    for (;;) {
        try {
            return await request();
        }
        catch (error) {
            if (!(error instanceof ky_1.HTTPError) ||
                !isRateLimitStatus(error.response.status) ||
                attempt >= exports.RATE_LIMIT_MAX_RETRIES) {
                throw error;
            }
            const backoffMs = computeRateLimitBackoffMs(error.response.headers, attempt, Date.now());
            console.log(`fetchProjectItems: GitHub returned ${error.response.status} (rate limit). Backing off ${backoffMs}ms before retry ${attempt + 1}/${exports.RATE_LIMIT_MAX_RETRIES}.`);
            await sleep(backoffMs);
            attempt++;
        }
    }
};
exports.callWithRateLimitRetry = callWithRateLimitRetry;
const stringifyGraphqlErrorsForLog = (errors) => {
    const serialized = JSON.stringify(errors);
    if (serialized.length <= exports.FETCH_PROJECT_ITEMS_GRAPHQL_ERROR_PAYLOAD_MAX_LENGTH) {
        return serialized;
    }
    return `${serialized.slice(0, exports.FETCH_PROJECT_ITEMS_GRAPHQL_ERROR_PAYLOAD_MAX_LENGTH)}...[truncated]`;
};
class GraphqlProjectItemRepository extends BaseGitHubRepository_1.BaseGitHubRepository {
    constructor() {
        super(...arguments);
        this.fetchItemId = async (projectId, owner, repositoryName, issueNumber) => {
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
                const response = await (0, githubGraphqlClient_1.postGithubGraphqlJson)({
                    ghToken: this.ghToken,
                    query: graphqlQuery.query,
                    variables: graphqlQuery.variables,
                });
                if (!response.data) {
                    const errorMessages = response.errors
                        ? response.errors.map((e) => e.message).join('; ')
                        : 'no data field in response';
                    throw new Error(`GitHub GraphQL API returned no data for fetchItemId: ${errorMessages}`);
                }
                const projectItems = response.data.repository.issue.projectItems.nodes;
                const projectItemId = projectItems.find((item) => item.project.id === projectId)?.id;
                return projectItemId;
            }
            catch (error) {
                console.error('Error fetching GitHub Project V2 ID:', error);
                return undefined;
            }
        };
        this.fetchProjectItems = async (projectId, query) => {
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
            const callGraphql = async (projectId, after, first) => {
                const graphqlQuery = {
                    query: graphqlQueryString,
                    variables: {
                        projectId: projectId,
                        after: after,
                        first: first,
                        query: query ?? null,
                    },
                };
                const response = await (0, exports.callWithRateLimitRetry)(() => (0, githubGraphqlClient_1.postGithubGraphqlJson)({
                    ghToken: this.ghToken,
                    query: graphqlQuery.query,
                    variables: graphqlQuery.variables,
                }));
                if (response.errors && response.errors.length > 0) {
                    throw new Error(`GitHub GraphQL errors: ${stringifyGraphqlErrorsForLog(response.errors)}`);
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
            const callGraphqlWithHalvingFallback = async (after) => {
                let attemptFirst = exports.FETCH_PROJECT_ITEMS_INITIAL_PAGE_SIZE;
                let lastError = null;
                while (attemptFirst >= 1) {
                    try {
                        return await callGraphql(projectId, after, attemptFirst);
                    }
                    catch (error) {
                        lastError = error;
                        if (error instanceof ky_1.HTTPError &&
                            isRateLimitStatus(error.response.status)) {
                            throw error;
                        }
                        if (attemptFirst === 1) {
                            throw error;
                        }
                        const nextFirst = Math.max(1, Math.floor(attemptFirst / 2));
                        console.log(`fetchProjectItems: page request with first=${attemptFirst} failed, halving to first=${nextFirst}: ${error instanceof Error ? error.message : String(error)}`);
                        attemptFirst = nextFirst;
                    }
                }
                throw lastError instanceof Error
                    ? lastError
                    : new Error(String(lastError));
            };
            const issues = [];
            let after = null;
            let hasNextPage = true;
            let totalCount = 0;
            let cumulativeRawNodes = 0;
            let pageIndex = 0;
            while (hasNextPage) {
                if (after !== null) {
                    await new Promise((resolve) => setTimeout(resolve, exports.PAGINATION_DELAY_MS));
                }
                const data = await callGraphqlWithHalvingFallback(after);
                const pageNodes = data.node.items.nodes;
                const pageInfo = data.node.items.pageInfo;
                totalCount = data.node.items.totalCount;
                cumulativeRawNodes += pageNodes.length;
                pageIndex++;
                console.log(`fetchProjectItems: page ${pageIndex}, nodes: ${pageNodes.length}, cumulative: ${cumulativeRawNodes}/${totalCount}`);
                const nodes = pageNodes;
                nodes.forEach((item) => {
                    const projectItem = this.mapProjectV2ItemNodeToProjectItem(item);
                    if (projectItem) {
                        issues.push(projectItem);
                    }
                });
                if (pageNodes.length > 0 &&
                    !pageInfo.hasNextPage &&
                    cumulativeRawNodes < totalCount) {
                    throw new Error(`fetchProjectItems: page ${pageIndex} has ${pageNodes.length} nodes with hasNextPage=false but only ${cumulativeRawNodes}/${totalCount} items accumulated`);
                }
                hasNextPage = pageInfo.hasNextPage;
                after = pageInfo.endCursor;
            }
            console.log(`fetchProjectItems: completed, totalCount: ${totalCount}, cumulativeRawNodes: ${cumulativeRawNodes}, issues: ${issues.length}`);
            if (cumulativeRawNodes !== totalCount) {
                throw new Error(`fetchProjectItems: expected ${totalCount} items but accumulated ${cumulativeRawNodes}`);
            }
            return issues;
        };
        this.mapProjectV2ItemNodeToProjectItem = (item) => {
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
                updatedAt: item.content.updatedAt ||
                    item.content.createdAt ||
                    new Date().toISOString(),
                author: item.content.author?.login || '',
                closingIssueReferenceUrls: item.content.closingIssuesReferences?.nodes
                    ?.map((node) => node.url)
                    .filter((url) => url.length > 0) || [],
                customFields: item.fieldValues.nodes
                    .filter((field) => !!field.field)
                    .map((field) => {
                    return {
                        name: field.field.name,
                        value: field.name ??
                            field.text ??
                            field.number?.toString() ??
                            field.date ??
                            null,
                    };
                }),
            };
        };
        this.fetchProjectItemsLight = async (projectId, query) => {
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
            const callGraphql = async (after) => {
                const response = await (0, exports.callWithRateLimitRetry)(() => (0, githubGraphqlClient_1.postGithubGraphqlJson)({
                    ghToken: this.ghToken,
                    query: graphqlQueryString,
                    variables: {
                        projectId: projectId,
                        after: after,
                        first: exports.FETCH_PROJECT_ITEMS_INITIAL_PAGE_SIZE,
                        query: query ?? null,
                    },
                }));
                if (response.errors && response.errors.length > 0) {
                    throw new Error(`GitHub GraphQL errors: ${stringifyGraphqlErrorsForLog(response.errors)}`);
                }
                const rawData = response.data;
                if (!rawData || rawData.node === null) {
                    throw new Error('No data returned from GitHub API');
                }
                return rawData.node.items;
            };
            const lightItems = [];
            let after = null;
            let hasNextPage = true;
            let totalCount = 0;
            let cumulativeRawNodes = 0;
            let pageIndex = 0;
            while (hasNextPage) {
                if (after !== null) {
                    await new Promise((resolve) => setTimeout(resolve, exports.PAGINATION_DELAY_MS));
                }
                const items = await callGraphql(after);
                const pageNodes = items.nodes;
                const pageInfo = items.pageInfo;
                totalCount = items.totalCount;
                cumulativeRawNodes += pageNodes.length;
                pageIndex++;
                console.log(`fetchProjectItemsLight: page ${pageIndex}, nodes: ${pageNodes.length}, cumulative: ${cumulativeRawNodes}/${totalCount}`);
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
                if (pageNodes.length > 0 &&
                    !pageInfo.hasNextPage &&
                    cumulativeRawNodes < totalCount) {
                    throw new Error(`fetchProjectItemsLight: page ${pageIndex} has ${pageNodes.length} nodes with hasNextPage=false but only ${cumulativeRawNodes}/${totalCount} items accumulated`);
                }
                hasNextPage = pageInfo.hasNextPage;
                after = pageInfo.endCursor;
            }
            console.log(`fetchProjectItemsLight: completed, totalCount: ${totalCount}, cumulativeRawNodes: ${cumulativeRawNodes}, items: ${lightItems.length}`);
            if (cumulativeRawNodes !== totalCount) {
                throw new Error(`fetchProjectItemsLight: expected ${totalCount} items but accumulated ${cumulativeRawNodes}`);
            }
            return lightItems;
        };
        this.fetchProjectItemsByIds = async (ids) => {
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
            const callGraphql = async (batchIds) => {
                const response = await (0, exports.callWithRateLimitRetry)(() => (0, githubGraphqlClient_1.postGithubGraphqlJson)({
                    ghToken: this.ghToken,
                    query: graphqlQueryString,
                    variables: {
                        ids: batchIds,
                    },
                }));
                if (response.errors && response.errors.length > 0) {
                    throw new Error(`GitHub GraphQL errors: ${stringifyGraphqlErrorsForLog(response.errors)}`);
                }
                if (!response.data) {
                    throw new Error('No data returned from GitHub API');
                }
                return response.data.nodes;
            };
            const items = [];
            let batchIndex = 0;
            for (let start = 0; start < ids.length; start += exports.FETCH_PROJECT_ITEMS_BY_IDS_BATCH_SIZE) {
                if (start > 0) {
                    await new Promise((resolve) => setTimeout(resolve, exports.PAGINATION_DELAY_MS));
                }
                const batchIds = ids.slice(start, start + exports.FETCH_PROJECT_ITEMS_BY_IDS_BATCH_SIZE);
                const nodes = await callGraphql(batchIds);
                batchIndex++;
                console.log(`fetchProjectItemsByIds: batch ${batchIndex}, ids: ${batchIds.length}, nodes: ${nodes.length}`);
                nodes.forEach((node) => {
                    const projectItem = this.mapProjectV2ItemNodeToProjectItem(node);
                    if (projectItem) {
                        items.push(projectItem);
                    }
                });
            }
            return items;
        };
        this.getProjectItemFieldsFromIssueUrl = async (issueUrl) => {
            const { owner, repo, issueNumber } = this.extractIssueFromUrl(issueUrl);
            return this.getProjectItemFields(owner, repo, issueNumber);
        };
        this.getProjectItemFields = async (owner, repositoryName, issueNumber) => {
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
            const response = await (0, githubGraphqlClient_1.postGithubGraphqlJson)({
                ghToken: this.ghToken,
                query: graphqlQuery.query,
                variables: graphqlQuery.variables,
            });
            if (!response.data) {
                const errorMessages = response.errors
                    ? response.errors.map((e) => e.message).join('; ')
                    : 'no data field in response';
                throw new Error(`GitHub GraphQL API returned no data for getProjectItemFields: ${errorMessages}`);
            }
            const data = response.data;
            const issueFields = [];
            if (!data.repository.issue) {
                return issueFields;
            }
            const projectItems = data.repository.issue.projectItems.nodes[0].fieldValues.nodes;
            projectItems.forEach((item) => {
                issueFields.push({
                    fieldName: item.field?.name ?? '',
                    fieldValue: item.date ??
                        item.name ??
                        item.text ??
                        item.repository?.name ??
                        item.user?.login ??
                        '',
                });
            });
            return issueFields;
        };
        this.fetchProjectItemByUrl = async (issueUrl, projectId) => {
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
      labels(first: ${exports.PROJECT_ITEM_LABELS_FIRST}) {
        nodes {
          name
        }
      }
      assignees(first: ${exports.PROJECT_ITEM_ASSIGNEES_FIRST}) {
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
      labels(first: ${exports.PROJECT_ITEM_LABELS_FIRST}) {
        nodes {
          name
        }
      }
      assignees(first: ${exports.PROJECT_ITEM_ASSIGNEES_FIRST}) {
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
            const response = await (0, githubGraphqlClient_1.postGithubGraphqlJson)({
                ghToken: this.ghToken,
                query: graphqlQuery.query,
                variables: graphqlQuery.variables,
            });
            if (!response.data) {
                const errorMessages = response.errors
                    ? response.errors.map((e) => e.message).join('; ')
                    : 'no data field in response';
                throw new Error(`GitHub GraphQL API returned no data for fetchProjectItemByUrl: ${errorMessages}`);
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
                console.warn(projectId
                    ? `No project item found for issue ${issueUrl} on project ${projectId}`
                    : `No project item found for issue ${issueUrl}`);
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
                updatedAt: content.updatedAt || content.createdAt || new Date().toISOString(),
                author: content.author?.login || '',
                closingIssueReferenceUrls: content.closingIssuesReferences?.nodes
                    ?.map((node) => node.url)
                    .filter((url) => url.length > 0) || [],
                customFields: item.fieldValues.nodes
                    .filter((field) => !!field.field)
                    .map((field) => {
                    return {
                        name: field.field.name,
                        value: field.name ??
                            field.text ??
                            field.number?.toString() ??
                            field.date ??
                            null,
                    };
                }),
            };
        };
        this.convertStrToState = (state) => {
            return state === 'MERGED'
                ? 'MERGED'
                : state === 'CLOSED'
                    ? 'CLOSED'
                    : state === 'OPEN'
                        ? 'OPEN'
                        : 'OPEN';
        };
        this.updateProjectField = async (projectId, fieldId, itemId, value) => {
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
            const res = await (0, githubGraphqlClient_1.postGithubGraphqlJson)({
                ghToken: this.ghToken,
                query: graphqlQuery.query,
            });
            if (res.errors) {
                throw new Error(res.errors.map((e) => e.message).join('\n'));
            }
        };
        this.clearProjectField = async (projectId, fieldId, itemId) => {
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
            const res = await (0, githubGraphqlClient_1.postGithubGraphqlJson)({
                ghToken: this.ghToken,
                query: graphqlQuery.query,
            });
            if (res.errors) {
                throw new Error(res.errors.map((e) => e.message).join('\n'));
            }
        };
        this.updateProjectTextField = async (project, fieldId, issue, text) => {
            await this.updateProjectField(project, fieldId, issue, { text });
        };
        this.removeItemFromProject = async (projectId, itemId) => {
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
            const res = await (0, githubGraphqlClient_1.postGithubGraphqlJson)({
                ghToken: this.ghToken,
                query: graphqlQuery.query,
                variables: graphqlQuery.variables,
            });
            if (res.errors) {
                throw new Error(res.errors.map((e) => e.message).join('\n'));
            }
        };
        this.removeItemFromProjectByIssueUrl = async (issueUrl, projectId) => {
            const { owner, repo, issueNumber } = this.extractIssueFromUrl(issueUrl);
            const itemId = await this.fetchItemId(projectId, owner, repo, issueNumber);
            if (!itemId) {
                throw new Error(`Issue not found in project. URL: ${issueUrl}, Project ID: ${projectId}`);
            }
            await this.removeItemFromProject(projectId, itemId);
        };
        this.addIssueToProject = async (projectId, issueUrl) => {
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
            const nodeIdRes = await (0, githubGraphqlClient_1.postGithubGraphqlJson)({
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
            const addRes = await (0, githubGraphqlClient_1.postGithubGraphqlJson)({
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
}
exports.GraphqlProjectItemRepository = GraphqlProjectItemRepository;
//# sourceMappingURL=GraphqlProjectItemRepository.js.map