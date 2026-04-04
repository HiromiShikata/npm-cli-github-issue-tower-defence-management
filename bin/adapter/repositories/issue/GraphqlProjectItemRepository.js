"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GraphqlProjectItemRepository = exports.PAGINATION_DELAY_MS = void 0;
const ky_1 = __importDefault(require("ky"));
const BaseGitHubRepository_1 = require("../BaseGitHubRepository");
exports.PAGINATION_DELAY_MS = 5000;
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
              createdAt
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
              body
              createdAt
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
                const response = await ky_1.default
                    .post('https://api.github.com/graphql', {
                    json: graphqlQuery,
                    headers: {
                        Authorization: `Bearer ${this.ghToken}`,
                    },
                })
                    .json();
                if (!response.data) {
                    throw new Error('No data returned from GitHub API');
                }
                return response.data;
            };
            const issues = [];
            let after = null;
            let hasNextPage = true;
            while (hasNextPage) {
                if (after !== null) {
                    await new Promise((resolve) => setTimeout(resolve, exports.PAGINATION_DELAY_MS));
                }
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
                        labels: item.content.labels?.nodes?.map((l) => l.name) || [],
                        assignees: item.content.assignees?.nodes?.map((a) => a.login) || [],
                        createdAt: item.content.createdAt || new Date().toISOString(),
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
                const pageInfo = data.node.items.pageInfo;
                hasNextPage = pageInfo.hasNextPage;
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
            const response = await ky_1.default
                .post('https://api.github.com/graphql', {
                json: graphqlQuery,
                headers: {
                    Authorization: `Bearer ${this.ghToken}`,
                },
            })
                .json();
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
      createdAt
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
            const data = response.data;
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
                labels: data.repository.issue.labels?.nodes?.map((l) => l.name) || [],
                assignees: data.repository.issue.assignees?.nodes?.map((a) => a.login) || [],
                createdAt: data.repository.issue.createdAt || new Date().toISOString(),
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
    }
}
exports.GraphqlProjectItemRepository = GraphqlProjectItemRepository;
//# sourceMappingURL=GraphqlProjectItemRepository.js.map