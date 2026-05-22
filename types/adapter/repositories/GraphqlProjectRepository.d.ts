import { BaseGitHubRepository } from './BaseGitHubRepository';
import { ProjectRepository } from '../../domain/usecases/adapter-interfaces/ProjectRepository';
import { FieldOption, Project } from '../../domain/entities/Project';
export declare class GraphqlProjectRepository extends BaseGitHubRepository implements Pick<ProjectRepository, 'getProject' | 'findProjectIdByUrl' | 'getByUrl' | 'updateStoryList' | 'updateStatusList'> {
    private readonly projectIdCache;
    private readonly fetchProjectIdFailedAt;
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