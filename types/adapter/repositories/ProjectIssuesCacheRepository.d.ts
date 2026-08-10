import { Issue } from '../../domain/entities/Issue';
import { FieldOption, Project } from '../../domain/entities/Project';
import { LocalStorageCacheRepository } from './LocalStorageCacheRepository';
export type CachedProjectIssues = {
    lastFetchedAt: string;
    lastFullFetchAt: string;
    project: Project;
    issues: Issue[];
};
export declare const isProject: (value: unknown) => value is Project;
export declare const isIssueArray: (value: unknown) => value is Issue[];
export declare class ProjectIssuesCacheRepository {
    readonly localStorageCacheRepository: Pick<LocalStorageCacheRepository, 'getSingle' | 'setSingle'>;
    constructor(localStorageCacheRepository: Pick<LocalStorageCacheRepository, 'getSingle' | 'setSingle'>);
    cacheKey: (projectId: Project["id"]) => string;
    readRaw: (projectId: Project["id"]) => Promise<unknown>;
    read: (projectId: Project["id"]) => Promise<CachedProjectIssues | null>;
    readProject: (projectId: Project["id"]) => Promise<Project | null>;
    write: (projectId: Project["id"], cached: CachedProjectIssues) => Promise<void>;
    updateFieldOptions: (projectId: Project["id"], fieldId: string, options: FieldOption[]) => Promise<void>;
    private projectWithFieldOptions;
}
//# sourceMappingURL=ProjectIssuesCacheRepository.d.ts.map