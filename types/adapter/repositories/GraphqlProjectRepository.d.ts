import { BaseGitHubRepository } from './BaseGitHubRepository';
import { LocalStorageCacheRepository } from './LocalStorageCacheRepository';
import { LocalStorageRepository } from './LocalStorageRepository';
import { ProjectRepository } from '../../domain/usecases/adapter-interfaces/ProjectRepository';
import { FieldOption, Project } from '../../domain/entities/Project';
export declare const convertToFieldOptionColor: (color: string) => FieldOption["color"];
export declare class GraphqlProjectRepository extends BaseGitHubRepository implements Pick<ProjectRepository, 'getProject' | 'findProjectIdByUrl' | 'getByUrl' | 'updateStoryList' | 'updateStatusList'> {
    private readonly projectIdCache;
    private readonly fetchProjectIdFailedAt;
    private readonly projectCache?;
    constructor(localStorageRepository: LocalStorageRepository, ghToken?: string, projectCache?: Pick<LocalStorageCacheRepository, 'getLatest' | 'set'>);
    private readProjectIdFromDiskCache;
    private writeProjectIdToDiskCache;
    extractProjectFromUrl: (projectUrl: string) => {
        owner: string;
        projectNumber: number;
    };
    fetchProjectId: (login: string, projectNumber: number) => Promise<string>;
    findProjectIdByUrl: (projectUrl: string) => Promise<Project["id"] | null>;
    getProject: (projectId: Project["id"]) => Promise<Project | null>;
    getByUrl: (url: string) => Promise<Project>;
    updateStoryList: (project: Project, newStoryList: (Omit<FieldOption, "id"> & {
        id: FieldOption["id"] | null;
    })[]) => Promise<FieldOption[]>;
    updateStatusList: (project: Project, newStatusList: (Omit<FieldOption, "id"> & {
        id: FieldOption["id"] | null;
    })[]) => Promise<FieldOption[]>;
}
//# sourceMappingURL=GraphqlProjectRepository.d.ts.map