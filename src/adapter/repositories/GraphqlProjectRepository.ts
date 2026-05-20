import ky from 'ky';
import { BaseGitHubRepository } from './BaseGitHubRepository';
import { ProjectRepository } from '../../domain/usecases/adapter-interfaces/ProjectRepository';
import { FieldOption, Project } from '../../domain/entities/Project';
import { normalizeFieldName } from './utils';

const ONE_HOUR_MS = 60 * 60 * 1000;

export class GraphqlProjectRepository
  extends BaseGitHubRepository
  implements
    Pick<
      ProjectRepository,
      | 'getProject'
      | 'findProjectIdByUrl'
      | 'getByUrl'
      | 'updateStoryList'
      | 'updateStatusList'
    >
{
  private readonly projectIdCache = new Map<string, string>();
  private readonly fetchProjectIdFailedAt = new Map<string, number>();

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
    const cacheKey = `${login}:${projectNumber}`;
    const cached = this.projectIdCache.get(cacheKey);
    if (cached) {
      return cached;
    }
    const failedAt = this.fetchProjectIdFailedAt.get(cacheKey);
    if (failedAt !== undefined && Date.now() - failedAt < ONE_HOUR_MS) {
      throw new Error(
        `fetchProjectId for ${login}/${projectNumber} is in backoff after a recent failure`,
      );
    }
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

    let response: {
      data?: {
        organization?: {
          projectV2?: {
            id: string;
            databaseId: number;
          } | null;
        } | null;
        user?: {
          projectV2?: {
            id: string;
            databaseId: number;
          } | null;
        } | null;
      } | null;
      errors?: { message: string }[];
    };
    try {
      response = await ky
        .post('https://api.github.com/graphql', {
          json: graphqlQuery,
          headers: {
            Authorization: `Bearer ${this.ghToken}`,
          },
        })
        .json();
    } catch (error) {
      this.fetchProjectIdFailedAt.set(cacheKey, Date.now());
      throw new Error(
        `fetchProjectId network error for ${login}/${projectNumber}: ${String(error)}`,
      );
    }

    if (!response.data) {
      this.fetchProjectIdFailedAt.set(cacheKey, Date.now());
      const errorMessages = response.errors
        ? response.errors.map((e) => e.message).join('; ')
        : 'no data field in response';
      throw new Error(
        `GitHub GraphQL API returned no data for fetchProjectId: ${errorMessages}`,
      );
    }
    const projectId =
      response.data.organization?.projectV2?.id ||
      response.data.user?.projectV2?.id;
    if (!projectId) {
      this.fetchProjectIdFailedAt.set(cacheKey, Date.now());
      throw new Error(
        `fetchProjectId: project not found for ${login}/${projectNumber}`,
      );
    }
    this.projectIdCache.set(cacheKey, projectId);
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
    const response = await ky
      .post('https://api.github.com/graphql', {
        json: { query, variables },
        headers: {
          Authorization: `Bearer ${this.ghToken}`,
        },
      })
      .json<{
        data?: {
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
        errors?: { message: string }[];
      }>();
    if (!response.data) {
      const errorMessages = response.errors
        ? response.errors.map((e) => e.message).join('; ')
        : 'no data field in response';
      throw new Error(
        `GitHub GraphQL API returned no data for getProject: ${errorMessages}`,
      );
    }
    const project = response.data.node;
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
  updateStoryList = async (
    project: Project,
    newStoryList: (Omit<FieldOption, 'id'> & {
      id: FieldOption['id'] | null;
    })[],
  ): Promise<FieldOption[]> => {
    if (!project.story) {
      throw new Error('Project has no story field');
    }
    const mutation = `mutation UpdateStoryOptions($fieldId: ID!, $options: [ProjectV2SingleSelectFieldOptionInput!]!) {
  updateProjectV2Field(input: {
    fieldId: $fieldId
    singleSelectOptions: $options
  }) {
    projectV2Field {
      ... on ProjectV2SingleSelectField {
        options {
          id
          name
          color
          description
        }
      }
    }
  }
}`;
    const variables = {
      fieldId: project.story.fieldId,
      options: newStoryList.map(({ id, name, color, description }) => ({
        ...(id !== null ? { id } : {}),
        name,
        color,
        description,
      })),
    };
    const response = await ky
      .post('https://api.github.com/graphql', {
        json: { query: mutation, variables },
        headers: {
          Authorization: `Bearer ${this.ghToken}`,
        },
      })
      .json<{
        data: {
          updateProjectV2Field: {
            projectV2Field: {
              options: FieldOption[];
            };
          };
        };
      }>();
    return response.data.updateProjectV2Field.projectV2Field.options;
  };
  updateStatusList = async (
    project: Project,
    newStatusList: (Omit<FieldOption, 'id'> & {
      id: FieldOption['id'] | null;
    })[],
  ): Promise<FieldOption[]> => {
    const mutation = `mutation UpdateStatusOptions($fieldId: ID!, $options: [ProjectV2SingleSelectFieldOptionInput!]!) {
  updateProjectV2Field(input: {
    fieldId: $fieldId
    singleSelectOptions: $options
  }) {
    projectV2Field {
      ... on ProjectV2SingleSelectField {
        options {
          id
          name
          color
          description
        }
      }
    }
  }
}`;
    const variables = {
      fieldId: project.status.fieldId,
      options: newStatusList.map(({ id, name, color, description }) => ({
        ...(id !== null ? { id } : {}),
        name,
        color,
        description,
      })),
    };
    const response = await ky
      .post('https://api.github.com/graphql', {
        json: { query: mutation, variables },
        headers: {
          Authorization: `Bearer ${this.ghToken}`,
        },
      })
      .json<{
        data: {
          updateProjectV2Field: {
            projectV2Field: {
              options: FieldOption[];
            };
          };
        };
      }>();
    return response.data.updateProjectV2Field.projectV2Field.options;
  };
}
