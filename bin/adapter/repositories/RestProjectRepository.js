"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RestProjectRepository = exports.projectLocationFromUrl = exports.projectUrlFromLocation = void 0;
const ky_1 = __importDefault(require("ky"));
const BaseGitHubRepository_1 = require("./BaseGitHubRepository");
const projectFieldDefinition_1 = require("./projectFieldDefinition");
const isNotFoundResponse = (error) => {
    if (typeof error !== 'object' || error === null || !('response' in error)) {
        return false;
    }
    const response = error.response;
    return (typeof response === 'object' &&
        response !== null &&
        'status' in response &&
        response.status === 404);
};
const projectUrlFromLocation = (location) => `https://github.com/${location.ownerType}/${location.owner}/projects/${location.projectNumber}`;
exports.projectUrlFromLocation = projectUrlFromLocation;
const projectLocationFromUrl = (projectUrl) => {
    const match = projectUrl.match(/https:\/\/github\.com\/(users|orgs)\/([^/]+)\/projects\/(\d+)/);
    if (!match) {
        return null;
    }
    const [, ownerType, owner, projectNumberText] = match;
    return {
        owner,
        ownerType: ownerType === 'orgs' ? 'orgs' : 'users',
        projectNumber: parseInt(projectNumberText, 10),
    };
};
exports.projectLocationFromUrl = projectLocationFromUrl;
class RestProjectRepository extends BaseGitHubRepository_1.BaseGitHubRepository {
    constructor() {
        super(...arguments);
        this.projectApiUrl = (location) => `https://api.github.com/${location.ownerType}/${location.owner}/projectsV2/${location.projectNumber}`;
        this.requestHeaders = () => ({
            Authorization: `token ${this.ghToken}`,
            Accept: 'application/vnd.github+json',
        });
        this.listFieldDefinitions = async (location) => {
            const fields = await ky_1.default
                .get(`${this.projectApiUrl(location)}/fields`, {
                searchParams: { per_page: 100 },
                headers: this.requestHeaders(),
            })
                .json();
            return fields.map((field) => ({
                fieldId: field.node_id,
                databaseId: field.id,
                name: field.name,
                options: (field.options ?? []).map((option) => ({
                    id: option.id,
                    name: option.name.raw,
                    color: (0, projectFieldDefinition_1.convertToFieldOptionColor)(option.color),
                    description: option.description.raw,
                })),
            }));
        };
        this.listFieldNames = async (location) => {
            const fields = await this.listFieldDefinitions(location);
            return fields.map((field) => field.name);
        };
        this.getProject = async (location) => {
            let project;
            let fields;
            try {
                [project, fields] = await Promise.all([
                    ky_1.default
                        .get(this.projectApiUrl(location), { headers: this.requestHeaders() })
                        .json(),
                    this.listFieldDefinitions(location),
                ]);
            }
            catch (error) {
                if (isNotFoundResponse(error)) {
                    return null;
                }
                throw error;
            }
            const definition = {
                id: project.node_id,
                url: (0, exports.projectUrlFromLocation)(location),
                databaseId: project.id,
                name: project.title,
                fields,
            };
            return (0, projectFieldDefinition_1.projectFromDefinition)(definition);
        };
    }
}
exports.RestProjectRepository = RestProjectRepository;
//# sourceMappingURL=RestProjectRepository.js.map