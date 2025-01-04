import axios from 'axios';
import { BaseGitHubRepository } from './BaseGitHubRepository';
import { ProjectRepository } from '../../domain/usecases/adapter-interfaces/ProjectRepository';
import { Project } from '../../domain/entities/Project';
import { normalizeFieldName } from './utils';

export class GraphqlProjectRepository
  extends BaseGitHubRepository
  implements ProjectRepository
{
  removeItemFromProject = async (
    projectId: string,
    itemId: string,
  ): Promise<void> => {
    const mutation = {
      query: `mutation DeleteProjectItem($input: DeleteProjectV2ItemInput!) {
        deleteProjectV2Item(input: $input) {
          deletedItemId
        }
      }`,
      variables: {
        input: {
          projectId,
          itemId,
        },
      },
    };

    await axios.post('https://api.github.com/graphql', mutation, {
      headers: {
        Authorization: `Bearer ${this.ghToken}`,
        'Content-Type': 'application/json',
      },
    });
  };

  removeItemFromProjectByIssueUrl = async (
    projectUrl: string,
    issueUrl: string,
  ): Promise<void> => {
    const { owner, projectNumber } = this.extractProjectFromUrl(projectUrl);
    const projectId = await this.fetchProjectId(owner, projectNumber);

    const query = {
      query: `query GetProjectItems($projectId: ID!, $query: String!) {
        node(id: $projectId) {
          ... on ProjectV2 {
            items(first: 100, query: $query) {
              nodes {
                id
                content {
                  ... on Issue {
                    url
                  }
                }
              }
            }
          }
        }
      }`,
      variables: {
        projectId,
        query: `is:issue ${issueUrl}`,
      },
    };

    const response = await axios.post<{
      data: {
        node: {
          items: {
            nodes: {
              id: string;
              content: {
                url: string;
              };
            }[];
          };
        };
      };
    }>('https://api.github.com/graphql', query, {
      headers: {
        Authorization: `Bearer ${this.ghToken}`,
        'Content-Type': 'application/json',
      },
    });

    const item = response.data.data.node.items.nodes.find(
      (node) => node.content.url === issueUrl,
    );
    if (!item) {
      throw new Error('Item not found in project');
    }

    await this.removeItemFromProject(projectId, item.id);
  };
  extractProjectFromUrl = (
    projectUrl: string,
  ): {
    owner: string;
    projectNumber: number;
  } => {
    const url = new URL(projectUrl);
    const path = url.pathname.split('/');
    const owner = path[2];
    const projectNumber = parseInt(path[4], 10);
    return { owner, projectNumber };
  };
  fetchProjectId = async (
    login: string,
    projectNumber: number,
  ): Promise<string> => {
    const graphqlQuery = {
      query: `query GetProjectID($login: String!, $number: Int!) {
  organization(login: $login) {
    projectV2(number: $number) {
      id
    }
  }
  user(login: $login){
    projectV2(number: $number){
      id
    }
  }
}`,
      variables: {
        login: login,
        number: projectNumber,
      },
    };

    const response = await axios<{
      data: {
        organization: {
          projectV2: {
            id: string;
          };
        };
        user: {
          projectV2: {
            id: string;
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

    const projectId =
      response.data.data.organization?.projectV2?.id ||
      response.data.data.user?.projectV2?.id;
    if (!projectId) {
      throw new Error('projectId is not found');
    }
    return projectId;
  };
  findProjectIdByUrl = async (
    projectUrl: string,
  ): Promise<Project['id'] | null> => {
    const { owner, projectNumber } = this.extractProjectFromUrl(projectUrl);
    return await this.fetchProjectId(owner, projectNumber);
  };
  getProject = async (projectId: Project['id']): Promise<Project | null> => {
    const query = `query GetProjectV2($projectId: ID!) {
  node(id: $projectId) {
    ... on ProjectV2 {
      id
      title
      shortDescription
      public
      closed
      createdAt
      updatedAt
      number
      url
      fields(first: 100) {
        nodes {
          ... on ProjectV2Field {
            id
            name
            dataType
          }
          ... on ProjectV2IterationField {
            id
            name
            dataType
            configuration {
              iterations {
                startDate
                duration
                title
              }
            }
          }
          ... on ProjectV2SingleSelectField {
            id
            name
            dataType
            options {
              id
              name
              description
              color
            }
          }
        }
      }
    }
  }
}

`;
    const variables = {
      projectId: projectId,
    };
    const response = await axios.post<{
      data: {
        node: {
          id: string;
          title: string;
          shortDescription: string;
          public: boolean;
          closed: boolean;
          createdAt: string;
          updatedAt: string;
          number: number;
          url: string;
          fields: {
            nodes: {
              id: string;
              name: string;
              dataType: string;
              configuration: {
                iterations: {
                  startDate: string;
                  duration: string;
                  title: string;
                }[];
              };
              options: {
                id: string;
                name: string;
                description: string;
                color: string;
              }[];
            }[];
          };
        };
      };
    }>(
      'https://api.github.com/graphql',
      {
        query,
        variables,
      },
      {
        headers: {
          Authorization: `Bearer ${this.ghToken}`,
          'Content-Type': 'application/json',
        },
      },
    );
    const project = response.data.data.node;
    if (!project) {
      return null;
    }
    const nextActionDate = project.fields.nodes.find(
      (field) => normalizeFieldName(field.name) === 'nextactiondate',
    );
    const nextActionHour = project.fields.nodes.find(
      (field) => normalizeFieldName(field.name) === 'nextactionhour',
    );
    const story = project.fields.nodes.find(
      (field) => normalizeFieldName(field.name) === 'story',
    );
    const workflowManagementStory = story?.options.find((option) =>
      normalizeFieldName(option.name).includes('workflowmanagement'),
    );
    const remainignEstimationMinutes = project.fields.nodes.find(
      (field) =>
        normalizeFieldName(field.name) === 'remainingestimationminutes',
    );
    const dependedIssueUrlSeparatedByComma = project.fields.nodes.find(
      (field) =>
        normalizeFieldName(field.name).startsWith(
          'dependedissueurlseparatedbycomma',
        ),
    );
    const completionDate50PercentConfidence = project.fields.nodes.find(
      (field) => normalizeFieldName(field.name).startsWith('completiondate'),
    );
    return {
      id: project.id,
      name: project.title,
      nextActionDate: nextActionDate
        ? {
            name: nextActionDate.name,
            fieldId: nextActionDate.id,
          }
        : null,
      nextActionHour: nextActionHour
        ? {
            name: nextActionHour.name,
            fieldId: nextActionHour.id,
          }
        : null,
      story:
        story && workflowManagementStory
          ? {
              name: story.name,
              fieldId: story.id,
              stories: story.options.map((option) => ({
                id: option.id,
                name: option.name,
                color: option.color,
                description: option.description,
              })),
              workflowManagementStory,
            }
          : null,
      remainingEstimationMinutes: remainignEstimationMinutes
        ? {
            name: remainignEstimationMinutes.name,
            fieldId: remainignEstimationMinutes.id,
          }
        : null,
      dependedIssueUrlSeparatedByComma: dependedIssueUrlSeparatedByComma
        ? {
            name: dependedIssueUrlSeparatedByComma.name,
            fieldId: dependedIssueUrlSeparatedByComma.id,
          }
        : null,
      completionDate50PercentConfidence: completionDate50PercentConfidence
        ? {
            name: completionDate50PercentConfidence.name,
            fieldId: completionDate50PercentConfidence.id,
          }
        : null,
    };
  };
}
