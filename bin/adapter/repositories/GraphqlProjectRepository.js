"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GraphqlProjectRepository = void 0;
const BaseGitHubRepository_1 = require("./BaseGitHubRepository");
const githubGraphqlClient_1 = require("./githubGraphqlClient");
const ProjectIssuesCacheRepository_1 = require("./ProjectIssuesCacheRepository");
const projectFieldDefinition_1 = require("./projectFieldDefinition");
const RestProjectRepository_1 = require("./RestProjectRepository");
const ONE_HOUR_MS = 60 * 60 * 1000;
const PROJECT_ID_DISK_CACHE_KEY_PREFIX = 'projectId';
const PROJECT_LOCATION_DISK_CACHE_KEY_PREFIX = 'projectLocation';
class GraphqlProjectRepository extends BaseGitHubRepository_1.BaseGitHubRepository {
    constructor(localStorageRepository, ghToken = process.env.GH_TOKEN || 'dummy', projectCache) {
        super(localStorageRepository, ghToken);
        this.projectIdCache = new Map();
        this.fetchProjectIdFailedAt = new Map();
        this.projectLocationCache = new Map();
        this.readProjectLocationFromDiskCache = async (projectId) => {
            if (!this.projectCache) {
                return null;
            }
            let cache;
            try {
                cache = await this.projectCache.getLatest(`${PROJECT_LOCATION_DISK_CACHE_KEY_PREFIX}-${projectId}`);
            }
            catch (error) {
                console.warn(`GraphqlProjectRepository: reading the project location disk cache failed, falling back to the GraphQL project query. projectId: ${projectId}, error: ${String(error)}`);
                return null;
            }
            if (!cache) {
                return null;
            }
            const value = cache.value;
            if (typeof value !== 'object' ||
                value === null ||
                !('owner' in value) ||
                !('ownerType' in value) ||
                !('projectNumber' in value) ||
                typeof value.owner !== 'string' ||
                typeof value.projectNumber !== 'number' ||
                (value.ownerType !== 'users' && value.ownerType !== 'orgs')) {
                return null;
            }
            return {
                owner: value.owner,
                ownerType: value.ownerType,
                projectNumber: value.projectNumber,
            };
        };
        this.rememberProjectLocation = async (projectId, location) => {
            this.projectLocationCache.set(projectId, location);
            if (!this.projectCache) {
                return;
            }
            try {
                await this.projectCache.set(`${PROJECT_LOCATION_DISK_CACHE_KEY_PREFIX}-${projectId}`, location);
            }
            catch (error) {
                console.warn(`GraphqlProjectRepository: writing the project location disk cache failed, every later process will fall back to the GraphQL project query. projectId: ${projectId}, error: ${String(error)}`);
            }
        };
        this.findProjectLocation = async (projectId) => {
            const cached = this.projectLocationCache.get(projectId);
            if (cached) {
                return cached;
            }
            const diskCached = await this.readProjectLocationFromDiskCache(projectId);
            if (diskCached) {
                this.projectLocationCache.set(projectId, diskCached);
                return diskCached;
            }
            return null;
        };
        this.readProjectIdFromDiskCache = async (cacheKey) => {
            if (!this.projectCache) {
                return null;
            }
            let cache;
            try {
                cache = await this.projectCache.getLatest(`${PROJECT_ID_DISK_CACHE_KEY_PREFIX}-${cacheKey}`);
            }
            catch {
                return null;
            }
            if (!cache) {
                return null;
            }
            if ('projectId' in cache.value &&
                typeof cache.value.projectId === 'string') {
                return cache.value.projectId;
            }
            return null;
        };
        this.writeProjectIdToDiskCache = async (cacheKey, projectId) => {
            if (!this.projectCache) {
                return;
            }
            try {
                await this.projectCache.set(`${PROJECT_ID_DISK_CACHE_KEY_PREFIX}-${cacheKey}`, { projectId });
            }
            catch {
                return;
            }
        };
        this.extractProjectFromUrl = (projectUrl) => {
            const url = new URL(projectUrl);
            const path = url.pathname.split('/');
            const owner = path[2];
            const projectNumber = parseInt(path[4], 10);
            return { owner, projectNumber };
        };
        this.fetchProjectId = async (login, projectNumber) => {
            const cacheKey = `${login}:${projectNumber}`;
            const cached = this.projectIdCache.get(cacheKey);
            if (cached) {
                return cached;
            }
            const diskCached = await this.readProjectIdFromDiskCache(cacheKey);
            if (diskCached) {
                this.projectIdCache.set(cacheKey, diskCached);
                return diskCached;
            }
            const failedAt = this.fetchProjectIdFailedAt.get(cacheKey);
            if (failedAt !== undefined && Date.now() - failedAt < ONE_HOUR_MS) {
                throw new Error(`fetchProjectId for ${login}/${projectNumber} is in backoff after a recent failure`);
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
            let response;
            try {
                response = await (0, githubGraphqlClient_1.postGithubGraphqlJson)({
                    ghToken: this.ghToken,
                    query: graphqlQuery.query,
                    variables: graphqlQuery.variables,
                });
            }
            catch (error) {
                this.fetchProjectIdFailedAt.set(cacheKey, Date.now());
                throw new Error(`fetchProjectId network error for ${login}/${projectNumber}: ${String(error)}`, { cause: error });
            }
            if (!response.data) {
                this.fetchProjectIdFailedAt.set(cacheKey, Date.now());
                const errorMessages = response.errors
                    ? response.errors.map((e) => e.message).join('; ')
                    : 'no data field in response';
                throw new Error(`GitHub GraphQL API returned no data for fetchProjectId: ${errorMessages}`);
            }
            const projectId = response.data.organization?.projectV2?.id ||
                response.data.user?.projectV2?.id;
            if (!projectId) {
                this.fetchProjectIdFailedAt.set(cacheKey, Date.now());
                throw new Error(`fetchProjectId: project not found for ${login}/${projectNumber}`);
            }
            this.projectIdCache.set(cacheKey, projectId);
            await this.writeProjectIdToDiskCache(cacheKey, projectId);
            await this.rememberProjectLocation(projectId, {
                owner: login,
                ownerType: response.data.organization?.projectV2?.id ? 'orgs' : 'users',
                projectNumber,
            });
            return projectId;
        };
        this.findProjectIdByUrl = async (projectUrl) => {
            const { owner, projectNumber } = this.extractProjectFromUrl(projectUrl);
            return await this.fetchProjectId(owner, projectNumber);
        };
        this.getProject = async (projectId) => {
            const location = await this.findProjectLocation(projectId);
            if (location) {
                const project = await this.restProjectRepository.getProject(location);
                if (project) {
                    return project;
                }
                console.warn(`GraphqlProjectRepository: the recorded project location no longer resolves over REST, re-reading the project over GraphQL. projectId: ${projectId}, owner: ${location.owner}, projectNumber: ${location.projectNumber}`);
                this.projectLocationCache.delete(projectId);
            }
            return await this.fetchProjectByGraphql(projectId);
        };
        this.fetchProjectByGraphql = async (projectId) => {
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
            const response = await (0, githubGraphqlClient_1.postGithubGraphqlJson)({
                ghToken: this.ghToken,
                query,
                variables,
            });
            if (!response.data) {
                const errorMessages = response.errors
                    ? response.errors.map((e) => e.message).join('; ')
                    : 'no data field in response';
                throw new Error(`GitHub GraphQL API returned no data for getProject: ${errorMessages}`);
            }
            const project = response.data.node;
            if (!project) {
                return null;
            }
            const fields = project.fields.nodes.map((field) => ({
                fieldId: field.id,
                databaseId: field.databaseId,
                name: field.name,
                options: (field.options ?? []).map((option) => ({
                    id: option.id,
                    name: option.name,
                    color: (0, projectFieldDefinition_1.convertToFieldOptionColor)(option.color),
                    description: option.description,
                })),
            }));
            const location = (0, RestProjectRepository_1.projectLocationFromUrl)(project.url);
            if (location) {
                await this.rememberProjectLocation(project.id, location);
            }
            return (0, projectFieldDefinition_1.projectFromDefinition)({
                id: project.id,
                url: project.url,
                databaseId: project.databaseId,
                name: project.title,
                fields,
            });
        };
        this.getByUrl = async (url) => {
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
        this.listFieldNames = async (project) => {
            const location = (0, RestProjectRepository_1.projectLocationFromUrl)(project.url) ??
                (await this.findProjectLocation(project.id));
            if (!location) {
                throw new Error(`listFieldNames: project location is unknown for ${project.id}`);
            }
            return await this.restProjectRepository.listFieldNames(location);
        };
        this.createField = async (project, field) => {
            const mutation = `mutation CreateProjectV2Field($projectId: ID!, $dataType: ProjectV2CustomFieldType!, $name: String!, $singleSelectOptions: [ProjectV2SingleSelectFieldOptionInput!]) {
  createProjectV2Field(input: {
    projectId: $projectId
    dataType: $dataType
    name: $name
    singleSelectOptions: $singleSelectOptions
  }) {
    projectV2Field {
      ... on ProjectV2FieldCommon {
        id
        name
      }
    }
  }
}`;
            const response = await (0, githubGraphqlClient_1.postGithubGraphqlJson)({
                ghToken: this.ghToken,
                query: mutation,
                variables: {
                    projectId: project.id,
                    dataType: field.dataType,
                    name: field.name,
                    singleSelectOptions: field.dataType === 'SINGLE_SELECT'
                        ? field.options.map(({ name, color, description }) => ({
                            name,
                            color,
                            description,
                        }))
                        : null,
                },
            });
            if (!response.data) {
                const errorMessages = response.errors
                    ? response.errors.map((e) => e.message).join('; ')
                    : 'no data field in response';
                throw new Error(`GitHub GraphQL API returned no data for createField ${field.name}: ${errorMessages}`);
            }
        };
        this.updateStoryList = async (project, newStoryList) => {
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
            const response = await (0, githubGraphqlClient_1.postGithubGraphqlJson)({
                ghToken: this.ghToken,
                query: mutation,
                variables,
            });
            const options = response.data.updateProjectV2Field.projectV2Field.options;
            await this.projectIssuesCacheRepository?.updateFieldOptions(project.id, project.story.fieldId, options);
            return options;
        };
        this.updateAgentList = async (project, newAgentList) => {
            if (!project.agent) {
                throw new Error('Project has no agent field');
            }
            const mutation = `mutation UpdateAgentOptions($fieldId: ID!, $options: [ProjectV2SingleSelectFieldOptionInput!]!) {
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
                fieldId: project.agent.fieldId,
                options: newAgentList.map(({ id, name, color, description }) => ({
                    ...(id !== null ? { id } : {}),
                    name,
                    color,
                    description,
                })),
            };
            const response = await (0, githubGraphqlClient_1.postGithubGraphqlJson)({
                ghToken: this.ghToken,
                query: mutation,
                variables,
            });
            return response.data.updateProjectV2Field.projectV2Field.options;
        };
        this.updateStatusList = async (project, newStatusList) => {
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
            const response = await (0, githubGraphqlClient_1.postGithubGraphqlJson)({
                ghToken: this.ghToken,
                query: mutation,
                variables,
            });
            const options = response.data.updateProjectV2Field.projectV2Field.options;
            await this.projectIssuesCacheRepository?.updateFieldOptions(project.id, project.status.fieldId, options);
            return options;
        };
        this.projectCache = projectCache;
        this.projectIssuesCacheRepository =
            projectCache === undefined
                ? null
                : new ProjectIssuesCacheRepository_1.ProjectIssuesCacheRepository(projectCache);
        this.restProjectRepository = new RestProjectRepository_1.RestProjectRepository(localStorageRepository, ghToken);
    }
}
exports.GraphqlProjectRepository = GraphqlProjectRepository;
//# sourceMappingURL=GraphqlProjectRepository.js.map