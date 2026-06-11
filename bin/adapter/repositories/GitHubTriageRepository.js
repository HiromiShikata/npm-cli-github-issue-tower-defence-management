"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitHubTriageRepository = void 0;
const BaseGitHubRepository_1 = require("./BaseGitHubRepository");
const ALLOWED_IMAGE_PROXY_HOSTNAMES = [
    'private-user-images.githubusercontent.com',
    'user-images.githubusercontent.com',
    'github.com',
];
const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const getStringProp = (record, key) => {
    const val = record[key];
    return typeof val === 'string' ? val : undefined;
};
const getNumberProp = (record, key) => {
    const val = record[key];
    return typeof val === 'number' ? val : undefined;
};
const getArrayProp = (record, key) => {
    const val = record[key];
    return Array.isArray(val) ? val : undefined;
};
const extractGraphQLErrors = (response) => {
    if (!isRecord(response))
        return null;
    const errors = getArrayProp(response, 'errors');
    if (!errors || errors.length === 0)
        return null;
    const messages = errors
        .filter(isRecord)
        .map((e) => getStringProp(e, 'message') ?? '')
        .filter((m) => m.length > 0);
    return messages.length > 0 ? messages.join('; ') : null;
};
const extractProjectData = (response) => {
    if (!isRecord(response))
        return null;
    const dataField = response['data'];
    if (!isRecord(dataField))
        return null;
    const orgField = dataField['organization'];
    const userField = dataField['user'];
    if (isRecord(orgField)) {
        const proj = orgField['projectV2'];
        if (isRecord(proj))
            return proj;
    }
    if (isRecord(userField)) {
        const proj = userField['projectV2'];
        if (isRecord(proj))
            return proj;
    }
    return null;
};
class GitHubTriageRepository extends BaseGitHubRepository_1.BaseGitHubRepository {
    constructor() {
        super(...arguments);
        this.extractGitHubErrorMessage = async (response) => {
            try {
                const body = await response.json();
                if (typeof body === 'object' &&
                    body !== null &&
                    'message' in body &&
                    typeof body['message'] === 'string') {
                    return body['message'];
                }
            }
            catch (_error) {
                void _error;
            }
            return `HTTP ${response.status}`;
        };
        this.getTriageData = async (projectUrl) => {
            const { owner, projectNumber } = this.extractProjectFromUrl(projectUrl);
            const projectData = await this.fetchProjectWithNoStoryItems(owner, projectNumber);
            return projectData;
        };
        this.extractProjectFromUrl = (projectUrl) => {
            const url = new URL(projectUrl);
            const path = url.pathname.split('/');
            const owner = path[2];
            const projectNumber = parseInt(path[4], 10);
            if (!owner || isNaN(projectNumber)) {
                throw new Error(`Invalid project URL format: ${projectUrl}. Expected format: https://github.com/orgs/{org}/projects/{number} or https://github.com/users/{user}/projects/{number}`);
            }
            return { owner, projectNumber };
        };
        this.fetchProjectWithNoStoryItems = async (login, projectNumber) => {
            const initialQuery = `query GetTriageProjectData($login: String!, $number: Int!) {
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
            isPullRequest: __typename
            ... on Issue {
              number
              title
              body
              url
              state
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
            isPullRequest: __typename
            ... on Issue {
              number
              title
              body
              url
              state
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
            const paginationQuery = `query GetTriageProjectItems($projectId: ID!, $cursor: String!) {
  node(id: $projectId) {
    ... on ProjectV2 {
      items(first: 100, after: $cursor) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          id
          content {
            isPullRequest: __typename
            ... on Issue {
              number
              title
              body
              url
              state
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
            const graphqlPost = async (queryStr, variables) => {
                const res = await fetch('https://api.github.com/graphql', {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${this.ghToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ query: queryStr, variables }),
                });
                if (!res.ok) {
                    const message = await this.extractGitHubErrorMessage(res);
                    throw new Error(`GraphQL request failed: ${message}`);
                }
                return res.json();
            };
            const rawResponse = await graphqlPost(initialQuery, {
                login,
                number: projectNumber,
            });
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
            let storyFieldId = null;
            let storyOptions = [];
            let noStoryOptionId = null;
            for (const fieldNode of fieldNodes) {
                if (!isRecord(fieldNode))
                    continue;
                const fieldId = getStringProp(fieldNode, 'id');
                const fieldName = getStringProp(fieldNode, 'name');
                if (!fieldId || !fieldName)
                    continue;
                if (fieldName.toLowerCase() !== 'story')
                    continue;
                storyFieldId = fieldId;
                const optionsRaw = getArrayProp(fieldNode, 'options') ?? [];
                const allOptions = [];
                for (const opt of optionsRaw) {
                    if (!isRecord(opt))
                        continue;
                    const optId = getStringProp(opt, 'id');
                    const optName = getStringProp(opt, 'name');
                    const optColor = getStringProp(opt, 'color');
                    if (!optId || !optName || !optColor)
                        continue;
                    if (optName.toLowerCase() === 'no story' ||
                        optName.toLowerCase() === 'no-story') {
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
            if (!noStoryOptionId) {
                throw new Error(`Story field found but no 'No Story' option exists. Cannot determine untriaged issues.`);
            }
            const extractItemsPage = (raw) => {
                if (!isRecord(raw))
                    return { nodes: [], hasNextPage: false, endCursor: null };
                const dataField = raw['data'];
                if (!isRecord(dataField))
                    return { nodes: [], hasNextPage: false, endCursor: null };
                const nodeField = dataField['node'];
                if (!isRecord(nodeField))
                    return { nodes: [], hasNextPage: false, endCursor: null };
                const itemsField = nodeField['items'];
                if (!isRecord(itemsField))
                    return { nodes: [], hasNextPage: false, endCursor: null };
                const nodes = getArrayProp(itemsField, 'nodes') ?? [];
                const pageInfoField = itemsField['pageInfo'];
                if (!isRecord(pageInfoField))
                    return { nodes, hasNextPage: false, endCursor: null };
                const hasNextPage = pageInfoField['hasNextPage'] === true;
                const endCursor = getStringProp(pageInfoField, 'endCursor') ?? null;
                return { nodes, hasNextPage, endCursor };
            };
            const itemsObj = projectData['items'];
            const firstPageNodes = isRecord(itemsObj)
                ? (getArrayProp(itemsObj, 'nodes') ?? [])
                : [];
            const firstPageInfo = isRecord(itemsObj) ? itemsObj['pageInfo'] : null;
            let hasNextPage = isRecord(firstPageInfo)
                ? firstPageInfo['hasNextPage'] === true
                : false;
            let endCursor = isRecord(firstPageInfo)
                ? (getStringProp(firstPageInfo, 'endCursor') ?? null)
                : null;
            const allItemNodes = [...firstPageNodes];
            while (hasNextPage && endCursor) {
                const pageRaw = await graphqlPost(paginationQuery, {
                    projectId,
                    cursor: endCursor,
                });
                const pageErr = extractGraphQLErrors(pageRaw);
                if (pageErr)
                    throw new Error(pageErr);
                const page = extractItemsPage(pageRaw);
                allItemNodes.push(...page.nodes);
                hasNextPage = page.hasNextPage;
                endCursor = page.endCursor;
            }
            const issues = [];
            for (const itemNode of allItemNodes) {
                if (!isRecord(itemNode))
                    continue;
                const itemId = getStringProp(itemNode, 'id');
                if (!itemId)
                    continue;
                const content = itemNode['content'];
                if (!isRecord(content))
                    continue;
                if (getStringProp(content, 'isPullRequest') === 'PullRequest')
                    continue;
                if (getStringProp(content, 'state') !== 'OPEN')
                    continue;
                const issueNumber = getNumberProp(content, 'number');
                const issueTitle = getStringProp(content, 'title');
                const issueUrl = getStringProp(content, 'url');
                if (!issueNumber || !issueTitle || !issueUrl)
                    continue;
                const fieldValuesObj = itemNode['fieldValues'];
                const fieldValueNodes = isRecord(fieldValuesObj)
                    ? (getArrayProp(fieldValuesObj, 'nodes') ?? [])
                    : [];
                let hasStoryAssigned = false;
                for (const fvNode of fieldValueNodes) {
                    if (!isRecord(fvNode))
                        continue;
                    const fvFieldObj = fvNode['field'];
                    if (!isRecord(fvFieldObj))
                        continue;
                    const fvFieldId = getStringProp(fvFieldObj, 'id');
                    if (fvFieldId !== storyFieldId)
                        continue;
                    const optionId = getStringProp(fvNode, 'optionId');
                    if (optionId && optionId !== noStoryOptionId) {
                        hasStoryAssigned = true;
                    }
                    break;
                }
                if (hasStoryAssigned)
                    continue;
                const urlMatch = issueUrl.match(/https:\/\/github\.com\/([^/]+)\/([^/]+)\/(issues|pull)\/\d+/);
                if (!urlMatch)
                    continue;
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
        this.setStory = async (projectId, storyFieldId, itemId, storyOptionId) => {
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
            const rawSetStoryResponse = await response.json();
            const setStoryError = extractGraphQLErrors(rawSetStoryResponse);
            if (setStoryError) {
                throw new Error(setStoryError);
            }
        };
        this.closeIssue = async (owner, repo, issueNumber, reason) => {
            if (!/^[a-zA-Z0-9_.-]+$/.test(owner) || !/^[a-zA-Z0-9_.-]+$/.test(repo)) {
                throw new Error('Invalid owner or repo name');
            }
            const baseUrl = new URL('https://api.github.com');
            baseUrl.pathname = [
                '',
                'repos',
                encodeURIComponent(owner),
                encodeURIComponent(repo),
                'issues',
                String(issueNumber),
            ].join('/');
            const url = baseUrl.toString();
            const response = await fetch(url, {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${this.ghToken}`,
                    'Content-Type': 'application/json',
                    Accept: 'application/vnd.github+json',
                },
                body: JSON.stringify({
                    state: 'closed',
                    state_reason: reason === 'duplicate' ? 'not_planned' : reason,
                }),
            });
            if (!response.ok) {
                const message = await this.extractGitHubErrorMessage(response);
                throw new Error(`closeIssue request failed: ${message}`);
            }
        };
        this.fetchImageProxy = async (targetUrl) => {
            let parsedUrl;
            try {
                parsedUrl = new URL(targetUrl);
            }
            catch {
                throw new Error('Invalid URL');
            }
            const allowedIndex = ALLOWED_IMAGE_PROXY_HOSTNAMES.indexOf(parsedUrl.hostname);
            if (allowedIndex === -1) {
                throw new Error('Hostname not allowed');
            }
            const safeHostname = ALLOWED_IMAGE_PROXY_HOSTNAMES[allowedIndex];
            const safeBase = new URL(`https://${safeHostname}`);
            safeBase.pathname = parsedUrl.pathname;
            safeBase.search = parsedUrl.search;
            const safeUrl = safeBase.toString();
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
            const contentType = response.headers.get('content-type') ?? 'application/octet-stream';
            return { content, contentType };
        };
    }
}
exports.GitHubTriageRepository = GitHubTriageRepository;
//# sourceMappingURL=GitHubTriageRepository.js.map