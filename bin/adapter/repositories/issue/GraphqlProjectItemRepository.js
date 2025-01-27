"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GraphqlProjectItemRepository = void 0;
const axios_1 = __importDefault(require("axios"));
const BaseGitHubRepository_1 = require("../BaseGitHubRepository");
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
                const response = await (0, axios_1.default)({
                    url: 'https://api.github.com/graphql',
                    method: 'post',
                    headers: {
                        Authorization: `Bearer ${this.ghToken}`,
                        'Content-Type': 'application/json',
                    },
                    data: JSON.stringify(graphqlQuery),
                });
                const projectItems = response.data.data.repository.issue.projectItems.nodes;
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
query GetProjectItems($projectId: ID!, $after: String) {
  node(id: $projectId) {
    ... on ProjectV2 {
      items(first: 100, after: $after) {
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
              body
              repository {
                nameWithOwner
              }
            }
            ... on PullRequest {
              number
              title
              state
              url
              body
              repository {
                nameWithOwner
              }
            }
          }
        }
      }
    }
  }
}
`;
            const callGraphql = async (projectId, after) => {
                const graphqlQuery = {
                    query: graphqlQueryString,
                    variables: {
                        projectId: projectId,
                        after: after,
                    },
                };
                const response = await (0, axios_1.default)({
                    url: 'https://api.github.com/graphql',
                    method: 'post',
                    headers: {
                        Authorization: `Bearer ${this.ghToken}`,
                        'Content-Type': 'application/json',
                    },
                    data: JSON.stringify(graphqlQuery),
                });
                if (!response.data.data) {
                    throw new Error('No data returned from GitHub API');
                }
                return response.data.data;
            };
            const issues = [];
            let after = null;
            let totalCount = 1;
            while (issues.length < totalCount) {
                const data = await callGraphql(projectId, after);
                const projectItems = data.node.items.nodes;
                projectItems
                    // .filter(item => item.content.repository !== undefined)
                    .forEach((item) => {
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
                        body: item.content.body,
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
                totalCount = data.node.items.totalCount;
                const pageInfo = data.node.items.pageInfo;
                after = pageInfo.endCursor;
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
            const response = await (0, axios_1.default)({
                url: 'https://api.github.com/graphql',
                method: 'post',
                headers: {
                    Authorization: `Bearer ${this.ghToken}`,
                    'Content-Type': 'application/json',
                },
                data: JSON.stringify(graphqlQuery),
            });
            const data = response.data.data;
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
        this.fetchProjectItemByUrl = async (issueUrl) => {
            const { owner, repo, issueNumber } = this.extractIssueFromUrl(issueUrl);
            const graphql = `query GetIssue($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    issue(number: $number) {
      number
      title
      state
      url
      body
      repository {
        nameWithOwner
      }
      projectItems(first: 10) {
        nodes {
          id
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
            const response = await (0, axios_1.default)({
                url: 'https://api.github.com/graphql',
                method: 'post',
                headers: {
                    Authorization: `Bearer ${this.ghToken}`,
                    'Content-Type': 'application/json',
                },
                data: JSON.stringify(graphqlQuery),
            });
            const data = response.data.data;
            if (!data.repository.issue) {
                return null;
            }
            const projectItems = data.repository.issue.projectItems.nodes;
            const item = projectItems[0];
            if (!item) {
                throw new Error(`No project item found for issue ${issueUrl}`);
            }
            return {
                id: item.id,
                nameWithOwner: data.repository.issue.repository.nameWithOwner,
                number: data.repository.issue.number,
                title: data.repository.issue.title,
                state: this.convertStrToState(data.repository.issue.state),
                url: data.repository.issue.url,
                body: data.repository.issue.body,
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
            const res = await (0, axios_1.default)({
                url: 'https://api.github.com/graphql',
                method: 'post',
                headers: {
                    Authorization: `Bearer ${this.ghToken}`,
                    'Content-Type': 'application/json',
                },
                data: JSON.stringify(graphqlQuery),
            });
            if (res.status !== 200) {
                throw new Error('Failed to update project field');
            }
            else if (res.data.errors) {
                throw new Error(res.data.errors.map((e) => e.message).join('\n'));
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
            const res = await (0, axios_1.default)({
                url: 'https://api.github.com/graphql',
                method: 'post',
                headers: {
                    Authorization: `Bearer ${this.ghToken}`,
                    'Content-Type': 'application/json',
                },
                data: JSON.stringify(graphqlQuery),
            });
            if (res.status !== 200) {
                throw new Error('Failed to clear project field');
            }
            else if (res.data.errors) {
                throw new Error(res.data.errors.map((e) => e.message).join('\n'));
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
            const res = await (0, axios_1.default)({
                url: 'https://api.github.com/graphql',
                method: 'post',
                headers: {
                    Authorization: `Bearer ${this.ghToken}`,
                    'Content-Type': 'application/json',
                },
                data: JSON.stringify(graphqlQuery),
            });
            if (res.status !== 200) {
                throw new Error('Failed to remove item from project');
            }
            else if (res.data.errors) {
                throw new Error(res.data.errors.map((e) => e.message).join('\n'));
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
    }
}
exports.GraphqlProjectItemRepository = GraphqlProjectItemRepository;
//# sourceMappingURL=GraphqlProjectItemRepository.js.map