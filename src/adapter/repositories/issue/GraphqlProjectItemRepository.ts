import axios from 'axios';
import { BaseGitHubRepository } from '../BaseGitHubRepository';
export type ProjectItem = {
  id: string;
  nameWithOwner: string;
  number: number;
  title: string;
  state: 'OPEN' | 'CLOSED' | 'MERGED';
  url: string;
  body: string;
  customFields: {
    name: string;
    value: string | null;
  }[];
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
      const response = await axios<{
        data: {
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
      }>({
        url: 'https://api.github.com/graphql',
        method: 'post',
        headers: {
          Authorization: `Bearer ${this.ghToken}`,
          'Content-Type': 'application/json',
        },
        data: JSON.stringify(graphqlQuery),
      });

      const projectItems: {
        id: string;
        project: { id: string };
      }[] = response.data.data.repository.issue.projectItems.nodes;
      const projectItemId = projectItems.find(
        (item) => item.project.id === projectId,
      )?.id;
      return projectItemId;
    } catch (error) {
      console.error('Error fetching GitHub Project V2 ID:', error);
      return undefined;
    }
  };
  fetchProjectItems = async (projectId: string): Promise<ProjectItem[]> => {
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
    const callGraphql = async (
      projectId: string,
      after: string | null,
    ): Promise<{
      node: {
        items: {
          totalCount: number;
          pageInfo: {
            endCursor: string;
            startCursor: string;
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
              body: string;
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
        },
      };
      const response = await axios<{
        data: {
          node: {
            items: {
              totalCount: number;
              pageInfo: {
                endCursor: string;
                startCursor: string;
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
                  body: string;
                };
              }[];
            };
          };
        };
      }>({
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
    const issues: {
      id: string;
      nameWithOwner: string;
      number: number;
      title: string;
      state: 'OPEN' | 'CLOSED' | 'MERGED';
      url: string;
      body: string;
      customFields: {
        name: string;
        value: string | null;
      }[];
    }[] = [];
    let after: string | null = null;
    let totalCount = 1;

    while (issues.length < totalCount) {
      const data = await callGraphql(projectId, after);
      const projectItems: {
        id: string;
        fieldValues: {
          nodes: {
            text?: string;
            number?: number;
            date?: string;
            name?: string;
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
          body: string;
        };
      }[] = data.node.items.nodes;
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
                  value:
                    field.name ??
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
    const response = await axios<{
      data: {
        repository: {
          issue: {
            projectItems: {
              nodes: {
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
    }>({
      url: 'https://api.github.com/graphql',
      method: 'post',
      headers: {
        Authorization: `Bearer ${this.ghToken}`,
        'Content-Type': 'application/json',
      },
      data: JSON.stringify(graphqlQuery),
    });

    const data = response.data.data;
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
  ): Promise<ProjectItem | null> => {
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
    const response = await axios<{
      data: {
        repository: {
          issue: {
            number: number;
            title: string;
            state: string;
            url: string;
            body: string;
            repository: { nameWithOwner: string };
            projectItems: {
              nodes: {
                id: string;
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
        };
      };
    }>({
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
    const projectItems: {
      id: string;
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
    }[] = data.repository.issue.projectItems.nodes;
    const item = projectItems[0];
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
        value: ${JSON.stringify(value)}
      }) {
        clientMutationId
      }
    }`,
    };

    return axios({
      url: 'https://api.github.com/graphql',
      method: 'post',
      headers: {
        Authorization: `Bearer ${this.ghToken}`,
        'Content-Type': 'application/json',
      },
      data: JSON.stringify(graphqlQuery),
    });
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

    return axios({
      url: 'https://api.github.com/graphql',
      method: 'post',
      headers: {
        Authorization: `Bearer ${this.ghToken}`,
        'Content-Type': 'application/json',
      },
      data: JSON.stringify(graphqlQuery),
    });
  };
}
