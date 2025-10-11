"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GraphqlProjectRepository = void 0;
const axios_1 = __importDefault(require("axios"));
const BaseGitHubRepository_1 = require("./BaseGitHubRepository");
const utils_1 = require("./utils");
class GraphqlProjectRepository extends BaseGitHubRepository_1.BaseGitHubRepository {
    constructor() {
        super(...arguments);
        this.extractProjectFromUrl = (projectUrl) => {
            const url = new URL(projectUrl);
            const path = url.pathname.split('/');
            const owner = path[2];
            const projectNumber = parseInt(path[4], 10);
            return { owner, projectNumber };
        };
        this.fetchProjectId = async (login, projectNumber) => {
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
            const response = await (0, axios_1.default)({
                url: 'https://api.github.com/graphql',
                method: 'post',
                headers: {
                    Authorization: `Bearer ${this.ghToken}`,
                    'Content-Type': 'application/json',
                },
                data: JSON.stringify(graphqlQuery),
            });
            const projectId = response.data.data.organization?.projectV2?.id ||
                response.data.data.user?.projectV2?.id;
            if (!projectId) {
                throw new Error('projectId is not found');
            }
            return projectId;
        };
        this.findProjectIdByUrl = async (projectUrl) => {
            const { owner, projectNumber } = this.extractProjectFromUrl(projectUrl);
            return await this.fetchProjectId(owner, projectNumber);
        };
        this.getProject = async (projectId) => {
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
            const response = await axios_1.default.post('https://api.github.com/graphql', {
                query,
                variables,
            }, {
                headers: {
                    Authorization: `Bearer ${this.ghToken}`,
                    'Content-Type': 'application/json',
                },
            });
            const project = response.data.data.node;
            if (!project) {
                return null;
            }
            const nextActionDate = project.fields.nodes.find((field) => (0, utils_1.normalizeFieldName)(field.name) === 'nextactiondate');
            const nextActionHour = project.fields.nodes.find((field) => (0, utils_1.normalizeFieldName)(field.name) === 'nextactionhour');
            const status = project.fields.nodes.find((field) => (0, utils_1.normalizeFieldName)(field.name) === 'status');
            if (!status) {
                throw new Error('status field is not found');
            }
            const story = project.fields.nodes.find((field) => (0, utils_1.normalizeFieldName)(field.name) === 'story');
            const workflowManagementStory = story?.options.find((option) => (0, utils_1.normalizeFieldName)(option.name).includes('workflowmanagement'));
            const remainignEstimationMinutes = project.fields.nodes.find((field) => (0, utils_1.normalizeFieldName)(field.name) === 'remainingestimationminutes');
            const dependedIssueUrlSeparatedByComma = project.fields.nodes.find((field) => (0, utils_1.normalizeFieldName)(field.name).startsWith('dependedissueurlseparatedbycomma'));
            const completionDate50PercentConfidence = project.fields.nodes.find((field) => (0, utils_1.normalizeFieldName)(field.name).startsWith('completiondate'));
            const convertToFieldOptionColor = (color) => {
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
                story: story && workflowManagementStory
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
        this.addNewStory = async (project, storyOptions) => {
            if (!project.story) {
                throw new Error('Project does not have a story field');
            }
            const convertToFieldOptionColor = (color) => {
                switch (color) {
                    case 'RED':
                    case 'YELLOW':
                    case 'GREEN':
                    case 'BLUE':
                    case 'PURPLE':
                    case 'PINK':
                    case 'ORANGE':
                    case 'GRAY':
                        return color;
                    default:
                        return 'GRAY';
                }
            };
            // For new stories (id: null), we need to create them first
            const optionIds = [];
            for (const option of storyOptions) {
                if (option.id) {
                    optionIds.push(option.id);
                }
                else {
                    // Create new story option
                    const createMutation = `mutation AddProjectV2SingleSelectOption($fieldId: ID!, $name: String!, $description: String!, $color: ProjectV2SingleSelectFieldOptionColor!) {
  addProjectV2FieldOption(input: {
    fieldId: $fieldId
    name: $name
    description: $description
    color: $color
  }) {
    projectV2FieldOption {
      id
      name
      description
      color
    }
  }
}`;
                    const createResponse = await axios_1.default.post('https://api.github.com/graphql', {
                        query: createMutation,
                        variables: {
                            fieldId: project.story.fieldId,
                            name: option.name,
                            description: option.description,
                            color: option.color,
                        },
                    }, {
                        headers: {
                            Authorization: `Bearer ${this.ghToken}`,
                            'Content-Type': 'application/json',
                        },
                    });
                    const newOption = createResponse.data.data.addProjectV2FieldOption.projectV2FieldOption;
                    optionIds.push(newOption.id);
                }
            }
            // Update the field with the new order
            const mutation = `mutation UpdateProjectV2Field($fieldId: ID!, $optionIds: [String!]!) {
  updateProjectV2Field(input: {
    fieldId: $fieldId
    singleSelectOptions: {
      ids: $optionIds
    }
  }) {
    projectV2Field {
      ... on ProjectV2SingleSelectField {
        id
        options {
          id
          name
          description
          color
        }
      }
    }
  }
}`;
            const response = await axios_1.default.post('https://api.github.com/graphql', {
                query: mutation,
                variables: {
                    fieldId: project.story.fieldId,
                    optionIds: optionIds,
                },
            }, {
                headers: {
                    Authorization: `Bearer ${this.ghToken}`,
                    'Content-Type': 'application/json',
                },
            });
            const updatedOptions = response.data.data.updateProjectV2Field.projectV2Field.options;
            return updatedOptions.map((option) => ({
                id: option.id,
                name: option.name,
                description: option.description,
                color: convertToFieldOptionColor(option.color),
            }));
        };
    }
}
exports.GraphqlProjectRepository = GraphqlProjectRepository;
//# sourceMappingURL=GraphqlProjectRepository.js.map