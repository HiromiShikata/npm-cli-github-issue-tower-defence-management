"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.GraphqlProjectItemRepository = exports.callWithRateLimitRetry = exports.RATE_LIMIT_MAX_BACKOFF_MS = exports.RATE_LIMIT_DEFAULT_BACKOFF_MS = exports.RATE_LIMIT_MIN_BACKOFF_MS = exports.RATE_LIMIT_MAX_RETRIES = exports.FETCH_PROJECT_ITEMS_GRAPHQL_ERROR_PAYLOAD_MAX_LENGTH = exports.FETCH_PROJECT_ITEMS_INITIAL_PAGE_SIZE = exports.PAGINATION_DELAY_MS = void 0;
const ky_1 = __importStar(require("ky"));
const BaseGitHubRepository_1 = require("../BaseGitHubRepository");
exports.PAGINATION_DELAY_MS = 5000;
exports.FETCH_PROJECT_ITEMS_INITIAL_PAGE_SIZE = 100;
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
                const response = await ky_1.default
                    .post('https://api.github.com/graphql', {
                    json: graphqlQuery,
                    headers: {
                        Authorization: `Bearer ${this.ghToken}`,
                    },
                })
                    .json();
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
        this.fetchProjectItems = async (projectId) => {
            const graphqlQueryString = `
query GetProjectItems($projectId: ID!, $after: String, $first: Int!) {
  node(id: $projectId) {
    ... on ProjectV2 {
      items(first: $first, after: $after) {
        totalCount
        pageInfo {
          endCursor
          hasNextPage
        }
        nodes {
          id
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
              author {
                login
              }
              labels(first: 100) {
                nodes {
                  name
                }
              }
              assignees(first: 20) {
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
              author {
                login
              }
              labels(first: 100) {
                nodes {
                  name
                }
              }
              assignees(first: 20) {
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
          }
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
                    },
                };
                const response = await (0, exports.callWithRateLimitRetry)(() => ky_1.default
                    .post('https://api.github.com/graphql', {
                    json: graphqlQuery,
                    headers: {
                        Authorization: `Bearer ${this.ghToken}`,
                    },
                })
                    .json());
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
                const projectItems = pageNodes;
                projectItems.forEach((item) => {
                    if (!item || !item.content || !item.content.repository) {
                        return;
                    }
                    issues.push({
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
                    });
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
            const response = await ky_1.default
                .post('https://api.github.com/graphql', {
                json: graphqlQuery,
                headers: {
                    Authorization: `Bearer ${this.ghToken}`,
                },
            })
                .json();
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
      author {
        login
      }
      labels(first: 100) {
        nodes {
          name
        }
      }
      assignees(first: 20) {
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
      author {
        login
      }
      labels(first: 100) {
        nodes {
          name
        }
      }
      assignees(first: 20) {
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
            const response = await ky_1.default
                .post('https://api.github.com/graphql', {
                json: graphqlQuery,
                headers: {
                    Authorization: `Bearer ${this.ghToken}`,
                },
            })
                .json();
            if (!response.data) {
                const errorMessages = response.errors
                    ? response.errors.map((e) => e.message).join('; ')
                    : 'no data field in response';
                throw new Error(`GitHub GraphQL API returned no data for fetchProjectItemByUrl: ${errorMessages}`);
            }
            const data = response.data;
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
            const res = await ky_1.default
                .post('https://api.github.com/graphql', {
                json: graphqlQuery,
                headers: {
                    Authorization: `Bearer ${this.ghToken}`,
                },
            })
                .json();
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
            const res = await ky_1.default
                .post('https://api.github.com/graphql', {
                json: graphqlQuery,
                headers: {
                    Authorization: `Bearer ${this.ghToken}`,
                },
            })
                .json();
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
            const res = await ky_1.default
                .post('https://api.github.com/graphql', {
                json: graphqlQuery,
                headers: {
                    Authorization: `Bearer ${this.ghToken}`,
                },
            })
                .json();
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
            const nodeIdRes = await ky_1.default
                .post('https://api.github.com/graphql', {
                json: nodeIdQuery,
                headers: {
                    Authorization: `Bearer ${this.ghToken}`,
                },
            })
                .json();
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
            const addRes = await ky_1.default
                .post('https://api.github.com/graphql', {
                json: addQuery,
                headers: {
                    Authorization: `Bearer ${this.ghToken}`,
                },
            })
                .json();
            if (addRes.errors) {
                throw new Error(addRes.errors.map((e) => e.message).join('\n'));
            }
            return addRes.data.addProjectV2ItemById.item.id;
        };
    }
}
exports.GraphqlProjectItemRepository = GraphqlProjectItemRepository;
//# sourceMappingURL=GraphqlProjectItemRepository.js.map