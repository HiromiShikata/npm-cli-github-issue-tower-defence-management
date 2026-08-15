import { BaseGitHubRepository } from './BaseGitHubRepository';
import { LocalStorageCacheRepository } from './LocalStorageCacheRepository';
import { LocalStorageRepository } from './LocalStorageRepository';
import { ProjectRepository } from '../../domain/usecases/adapter-interfaces/ProjectRepository';
import { FieldOption, Project } from '../../domain/entities/Project';
import { RequiredProjectFieldDefinition } from '../../domain/entities/RequiredProjectField';
export declare class GraphqlProjectRepository extends BaseGitHubRepository implements Pick<ProjectRepository, 'getProject' | 'findProjectIdByUrl' | 'getByUrl' | 'updateStoryList' | 'updateStatusList' | 'listFieldNames' | 'createField'> {
    private readonly projectIdCache;
    private readonly fetchProjectIdFailedAt;
    private readonly projectLocationCache;
    private readonly projectCache?;
    private readonly projectIssuesCacheRepository;
    private readonly restProjectRepository;
    constructor(localStorageRepository: LocalStorageRepository, ghToken?: string, projectCache?: Pick<LocalStorageCacheRepository, 'getLatest' | 'set' | 'getSingle' | 'setSingle'>);
    private readProjectLocationFromDiskCache;
    private rememberProjectLocation;
    private findProjectLocation;
    private readProjectIdFromDiskCache;
    private writeProjectIdToDiskCache;
    extractProjectFromUrl: (projectUrl: string) => {
        owner: string;
        projectNumber: number;
    };
    fetchProjectId: (login: string, projectNumber: number) => Promise<string>;
    findProjectIdByUrl: (projectUrl: string) => Promise<Project["id"] | null>;
    getProject: (projectId: Project["id"]) => Promise<Project | null>;
    private fetchProjectByGraphql;
    getByUrl: (url: string) => Promise<Project>;
    listFieldNames: (project: Project) => Promise<string[]>;
    createField: (project: Project, field: RequiredProjectFieldDefinition) => Promise<void>;
    updateStoryList: (project: Project, newStoryList: (Omit<FieldOption, "id"> & {
        id: FieldOption["id"] | null;
    })[]) => Promise<FieldOption[]>;
    updateStatusList: (project: Project, newStatusList: (Omit<FieldOption, "id"> & {
        id: FieldOption["id"] | null;
    })[]) => Promise<FieldOption[]>;
}
//# sourceMappingURL=GraphqlProjectRepository.d.ts.map