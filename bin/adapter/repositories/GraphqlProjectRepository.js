"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GraphqlProjectRepository = exports.convertToFieldOptionColor = exports.resolveProjectCacheTtlMs = void 0;
const ky_1 = __importDefault(require("ky"));
const typia_1 = __importDefault(require("typia"));
const BaseGitHubRepository_1 = require("./BaseGitHubRepository");
const utils_1 = require("./utils");
const ONE_HOUR_MS = 60 * 60 * 1000;
const DEFAULT_PROJECT_CACHE_TTL_MS = 30 * 60 * 1000;
const resolveProjectCacheTtlMs = (rawValue) => {
    if (rawValue === undefined) {
        return DEFAULT_PROJECT_CACHE_TTL_MS;
    }
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed) || parsed < 0) {
        return DEFAULT_PROJECT_CACHE_TTL_MS;
    }
    return parsed;
};
exports.resolveProjectCacheTtlMs = resolveProjectCacheTtlMs;
const PROJECT_ID_DISK_CACHE_KEY_PREFIX = 'projectId';
const PROJECT_DISK_CACHE_KEY_PREFIX = 'project';
const convertToFieldOptionColor = (color) => {
    switch (color) {
        case 'RED':
        case 'YELLOW':
        case 'GREEN':
        case 'BLUE':
        case 'PURPLE':
        case 'ORANGE':
        case 'PINK':
        case 'GRAY':
            return color;
        default:
            return 'GRAY';
    }
};
exports.convertToFieldOptionColor = convertToFieldOptionColor;
class GraphqlProjectRepository extends BaseGitHubRepository_1.BaseGitHubRepository {
    constructor(localStorageRepository, ghToken = process.env.GH_TOKEN || 'dummy', projectCache, projectCacheTtlMs = (0, exports.resolveProjectCacheTtlMs)(process.env.TDPM_PROJECT_CACHE_TTL_MS)) {
        super(localStorageRepository, ghToken);
        this.projectIdCache = new Map();
        this.fetchProjectIdFailedAt = new Map();
        this.readProjectIdFromDiskCache = async (cacheKey) => {
            if (!this.projectCache) {
                return null;
            }
            let cache;
            try {
                cache = await this.projectCache.getLatest(`${PROJECT_ID_DISK_CACHE_KEY_PREFIX}-${cacheKey}`);
            }
            catch (error) {
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
            catch (error) {
                return;
            }
        };
        this.readProjectFromDiskCache = async (projectId) => {
            if (!this.projectCache) {
                return null;
            }
            let cache;
            try {
                cache = await this.projectCache.getLatest(`${PROJECT_DISK_CACHE_KEY_PREFIX}-${projectId}`);
            }
            catch (error) {
                return null;
            }
            if (!cache) {
                return null;
            }
            const age = Date.now() - cache.timestamp.getTime();
            if (age >= this.projectCacheTtlMs) {
                return null;
            }
            if (!(() => { const _io0 = input => "string" === typeof input.id && "string" === typeof input.url && "number" === typeof input.databaseId && "string" === typeof input.name && ("object" === typeof input.status && null !== input.status && _io1(input.status)) && (null === input.nextActionDate || "object" === typeof input.nextActionDate && null !== input.nextActionDate && _io3(input.nextActionDate)) && (null === input.nextActionHour || "object" === typeof input.nextActionHour && null !== input.nextActionHour && _io4(input.nextActionHour)) && (null === input.story || "object" === typeof input.story && null !== input.story && _io5(input.story)) && (null === input.remainingEstimationMinutes || "object" === typeof input.remainingEstimationMinutes && null !== input.remainingEstimationMinutes && _io7(input.remainingEstimationMinutes)) && (null === input.dependedIssueUrlSeparatedByComma || "object" === typeof input.dependedIssueUrlSeparatedByComma && null !== input.dependedIssueUrlSeparatedByComma && _io8(input.dependedIssueUrlSeparatedByComma)) && (null === input.completionDate50PercentConfidence || "object" === typeof input.completionDate50PercentConfidence && null !== input.completionDate50PercentConfidence && _io9(input.completionDate50PercentConfidence)); const _io1 = input => "string" === typeof input.name && "string" === typeof input.fieldId && (Array.isArray(input.statuses) && input.statuses.every(elem => "object" === typeof elem && null !== elem && _io2(elem))); const _io2 = input => "string" === typeof input.id && "string" === typeof input.name && ("GRAY" === input.color || "BLUE" === input.color || "GREEN" === input.color || "YELLOW" === input.color || "ORANGE" === input.color || "RED" === input.color || "PINK" === input.color || "PURPLE" === input.color) && "string" === typeof input.description; const _io3 = input => "string" === typeof input.name && "string" === typeof input.fieldId; const _io4 = input => "string" === typeof input.name && "string" === typeof input.fieldId; const _io5 = input => "string" === typeof input.name && "string" === typeof input.fieldId && "number" === typeof input.databaseId && (Array.isArray(input.stories) && input.stories.every(elem => "object" === typeof elem && null !== elem && _io2(elem))) && ("object" === typeof input.workflowManagementStory && null !== input.workflowManagementStory && _io6(input.workflowManagementStory)); const _io6 = input => "string" === typeof input.id && "string" === typeof input.name; const _io7 = input => "string" === typeof input.name && "string" === typeof input.fieldId; const _io8 = input => "string" === typeof input.name && "string" === typeof input.fieldId; const _io9 = input => "string" === typeof input.name && "string" === typeof input.fieldId; return input => "object" === typeof input && null !== input && _io0(input); })()(cache.value)) {
                return null;
            }
            return cache.value;
        };
        this.writeProjectToDiskCache = async (projectId, project) => {
            if (!this.projectCache) {
                return;
            }
            try {
                await this.projectCache.set(`${PROJECT_DISK_CACHE_KEY_PREFIX}-${projectId}`, project);
            }
            catch (error) {
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
                response = await ky_1.default
                    .post('https://api.github.com/graphql', {
                    json: graphqlQuery,
                    headers: {
                        Authorization: `Bearer ${this.ghToken}`,
                    },
                })
                    .json();
            }
            catch (error) {
                this.fetchProjectIdFailedAt.set(cacheKey, Date.now());
                throw new Error(`fetchProjectId network error for ${login}/${projectNumber}: ${String(error)}`);
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
            return projectId;
        };
        this.findProjectIdByUrl = async (projectUrl) => {
            const { owner, projectNumber } = this.extractProjectFromUrl(projectUrl);
            return await this.fetchProjectId(owner, projectNumber);
        };
        this.getProject = async (projectId) => {
            const diskCached = await this.readProjectFromDiskCache(projectId);
            if (diskCached) {
                return diskCached;
            }
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
            const response = await ky_1.default
                .post('https://api.github.com/graphql', {
                json: { query, variables },
                headers: {
                    Authorization: `Bearer ${this.ghToken}`,
                },
            })
                .json();
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
            const result = {
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
                        color: (0, exports.convertToFieldOptionColor)(option.color),
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
                            color: (0, exports.convertToFieldOptionColor)(option.color),
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
            await this.writeProjectToDiskCache(projectId, result);
            return result;
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
            const response = await ky_1.default
                .post('https://api.github.com/graphql', {
                json: { query: mutation, variables },
                headers: {
                    Authorization: `Bearer ${this.ghToken}`,
                },
            })
                .json();
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
            const response = await ky_1.default
                .post('https://api.github.com/graphql', {
                json: { query: mutation, variables },
                headers: {
                    Authorization: `Bearer ${this.ghToken}`,
                },
            })
                .json();
            return response.data.updateProjectV2Field.projectV2Field.options;
        };
        this.projectCache = projectCache;
        this.projectCacheTtlMs = projectCacheTtlMs;
    }
}
exports.GraphqlProjectRepository = GraphqlProjectRepository;
//# sourceMappingURL=GraphqlProjectRepository.js.map