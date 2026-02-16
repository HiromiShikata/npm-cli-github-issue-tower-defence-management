import axios from 'axios';
import { BaseGitHubRepository } from './BaseGitHubRepository';
import { ProjectRepository } from '../../domain/usecases/adapter-interfaces/ProjectRepository';
import { FieldOption, Project } from '../../domain/entities/Project';
import { normalizeFieldName } from './utils';

export class GraphqlProjectRepository
  extends BaseGitHubRepository
  implements
    Pick<ProjectRepository, 'getProject' | 'findProjectIdByUrl' | 'getByUrl'>
{
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
      databaseId
    }
  }
  user(login: $login){
    projectV2(number: $number){
      id
      databaseId
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
            databaseId: number;
          };
        };
        user: {
          projectV2: {
            id: string;
            databaseId: number;
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
      databaseId
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
            databaseId
            name
            dataType
          }
          ... on ProjectV2IterationField {
            id
            databaseId
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
            databaseId
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
          databaseId: number;
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
              databaseId: number;
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
    const status = project.fields.nodes.find(
      (field) => normalizeFieldName(field.name) === 'status',
    );
    if (!status) {
      throw new Error('status field is not found');
    }
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
    const convertToFieldOptionColor = (color: string): FieldOption['color'] => {
      switch (color) {
        case 'RED':
        case 'YELLOW':
        case 'GREEN':
        case 'BLUE':
        case 'PURPLE':
        case 'GRAY':
          return color;
        default:
          return 'GRAY';
      }
    };
    return {
      id: project.id,
      url: project.url,
      databaseId: project.databaseId,
      name: project.title,
      status: {
        name: status.name,
        fieldId: status.id,
        statuses: status.options.map((option) => ({
          id: option.id,
          name: option.name,
          color: convertToFieldOptionColor(option.color),
          description: option.description,
        })),
      },
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
              databaseId: story.databaseId,
              stories: story.options.map((option) => ({
                id: option.id,
                name: option.name,
                color: convertToFieldOptionColor(option.color),
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
  getByUrl = async (url: string): Promise<Project> => {
    const projectId = await this.findProjectIdByUrl(url);
    if (!projectId) {
      throw new Error(`Project not found for URL: ${url}`);
    }
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error(`Project not found for ID: ${projectId}`);
    }
    return project;
  };
}
