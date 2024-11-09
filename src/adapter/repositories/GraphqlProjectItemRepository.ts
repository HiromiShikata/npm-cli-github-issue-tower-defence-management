import axios from 'axios';
import { BaseGitHubRepository } from './BaseGitHubRepository';

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
  fetchProjectItems = async (
    projectId: string,
  ): Promise<
    {
      nameWithOwner: string;
      number: number;
      title: string;
      state: 'OPEN' | 'CLOSED' | 'MERGED';
      url: string;
    }[]
  > => {
    const graphqlQueryString = `
    query GetProjectItems($after: String, $projectId: ID!) {
  node(id: $projectId) {
    ... on ProjectV2 {
      items(first: 100, after: $after) {
        totalCount
        pageInfo {
          endCursor
          startCursor
        }
        nodes {
          content {
            ... on Issue {
              number
              title
              state
              number
              url
              repository {
                nameWithOwner
              }
            }
            ... on PullRequest {
              number
              title
              state
              number
              url
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
            content: {
              repository: { nameWithOwner: string };
              number: number;
              title: string;
              state: string;
              url: string;
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
                content: {
                  repository: { nameWithOwner: string };
                  number: number;
                  title: string;
                  state: string;
                  url: string;
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
      return response.data.data;
    };
    const issues: {
      nameWithOwner: string;
      number: number;
      title: string;
      state: 'OPEN' | 'CLOSED' | 'MERGED';
      url: string;
    }[] = [];
    let after: string | null = null;
    let totalCount = 1;

    while (issues.length < totalCount) {
      const data = await callGraphql(projectId, after);
      const projectItems: {
        content: {
          repository: { nameWithOwner: string };
          number: number;
          title: string;
          state: string;
          url: string;
        };
      }[] = data.node.items.nodes;
      projectItems
        // .filter(item => item.content.repository !== undefined)
        .forEach((item) => {
          if (!item || !item.content || !item.content.repository) {
            return;
          }
          issues.push({
            nameWithOwner: item.content.repository.nameWithOwner,
            number: item.content.number,
            title: item.content.title,
            state:
              item.content.state === 'MERGED'
                ? 'MERGED'
                : item.content.state === 'CLOSED'
                  ? 'CLOSED'
                  : item.content.state === 'OPEN'
                    ? 'OPEN'
                    : 'OPEN',
            url: item.content.url,
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
}
