import axios from 'axios';
import { BaseGitHubRepository } from './BaseGitHubRepository';
import { ProjectRepository } from '../../domain/usecases/adapter-interfaces/ProjectRepository';
import { Project } from '../../domain/entities/Project';

export class GraphqlProjectRepository
  extends BaseGitHubRepository
  implements ProjectRepository
{
  extractProjectFromUrl = (
    projectUrl: string,
  ): {
    owner: string;
    repo: string;
    projectNumber: number;
  } => {
    const url = new URL(projectUrl);
    const path = url.pathname.split('/');
    const owner = path[1];
    const repo = path[2];
    const projectNumber = parseInt(path[4], 10);
    return { owner, repo, projectNumber };
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
            }
          }
          ... on ProjectV2NumberField {
            id
            name
            dataType
          }
          ... on ProjectV2DateField {
            id
            name
            dataType
          }
          ... on ProjectV2TextField {
            id
            name
            dataType
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
    return {
      id: project.id,
      name: project.title,
    };
  };
}
