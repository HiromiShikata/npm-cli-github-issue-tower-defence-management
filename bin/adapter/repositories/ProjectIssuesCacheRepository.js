"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectIssuesCacheRepository = exports.isIssueArray = exports.isProject = void 0;
const isProject = (value) => {
    if (typeof value !== 'object' || value === null)
        return false;
    if (!('id' in value) || typeof value.id !== 'string')
        return false;
    if (!('url' in value) || typeof value.url !== 'string')
        return false;
    if (!('databaseId' in value) || typeof value.databaseId !== 'number')
        return false;
    if (!('name' in value) || typeof value.name !== 'string')
        return false;
    if (!('status' in value) ||
        typeof value.status !== 'object' ||
        value.status === null)
        return false;
    return true;
};
exports.isProject = isProject;
const isIssueArray = (value) => Array.isArray(value) &&
    value.every((item) => typeof item === 'object' &&
        item !== null &&
        'nameWithOwner' in item &&
        typeof item.nameWithOwner === 'string' &&
        'number' in item &&
        typeof item.number === 'number' &&
        'title' in item &&
        typeof item.title === 'string' &&
        'url' in item &&
        typeof item.url === 'string');
exports.isIssueArray = isIssueArray;
class ProjectIssuesCacheRepository {
    constructor(localStorageCacheRepository) {
        this.localStorageCacheRepository = localStorageCacheRepository;
        this.cacheKey = (projectId) => `allIssues-${projectId}`;
        this.readRaw = async (projectId) => this.localStorageCacheRepository.getSingle(this.cacheKey(projectId));
        this.read = async (projectId) => {
            const raw = await this.readRaw(projectId);
            if (typeof raw !== 'object' || raw === null) {
                return null;
            }
            if (!('lastFetchedAt' in raw) ||
                typeof raw.lastFetchedAt !== 'string' ||
                !('lastFullFetchAt' in raw) ||
                typeof raw.lastFullFetchAt !== 'string' ||
                !('project' in raw) ||
                !('issues' in raw)) {
                return null;
            }
            if (!(0, exports.isProject)(raw.project) || !(0, exports.isIssueArray)(raw.issues)) {
                return null;
            }
            return {
                lastFetchedAt: raw.lastFetchedAt,
                lastFullFetchAt: raw.lastFullFetchAt,
                project: raw.project,
                issues: raw.issues,
            };
        };
        this.readProject = async (projectId) => {
            const raw = await this.readRaw(projectId);
            if (typeof raw !== 'object' || raw === null || !('project' in raw)) {
                return null;
            }
            if (!(0, exports.isProject)(raw.project)) {
                return null;
            }
            return raw.project;
        };
        this.write = async (projectId, cached) => {
            await this.localStorageCacheRepository.setSingle(this.cacheKey(projectId), cached);
        };
        this.updateFieldOptions = async (projectId, fieldId, options) => {
            const raw = await this.readRaw(projectId);
            if (typeof raw !== 'object' || raw === null || !('project' in raw)) {
                return;
            }
            if (!(0, exports.isProject)(raw.project)) {
                return;
            }
            const project = this.projectWithFieldOptions(raw.project, fieldId, options);
            if (project === null) {
                return;
            }
            await this.localStorageCacheRepository.setSingle(this.cacheKey(projectId), {
                ...raw,
                project,
            });
        };
        this.projectWithFieldOptions = (project, fieldId, options) => {
            if (project.story !== null && project.story.fieldId === fieldId) {
                return { ...project, story: { ...project.story, stories: options } };
            }
            if (project.status.fieldId === fieldId) {
                return { ...project, status: { ...project.status, statuses: options } };
            }
            return null;
        };
    }
}
exports.ProjectIssuesCacheRepository = ProjectIssuesCacheRepository;
//# sourceMappingURL=ProjectIssuesCacheRepository.js.map