import { BaseGitHubRepository } from './BaseGitHubRepository';
import { ProjectRepository } from '../../domain/usecases/adapter-interfaces/ProjectRepository';
import { Project } from '../../domain/entities/Project';
export declare class GraphqlProjectRepository extends BaseGitHubRepository implements Pick<ProjectRepository, 'getProject' | 'findProjectIdByUrl' | 'getByUrl'> {
    extractProjectFromUrl: (projectUrl: string) => {
        owner: string;
        projectNumber: number;
    };
    fetchProjectId: (login: string, projectNumber: number) => Promise<string>;
    findProjectIdByUrl: (projectUrl: string) => Promise<Project["id"] | null>;
    getProject: (projectId: Project["id"]) => Promise<Project | null>;
    getByUrl: (url: string) => Promise<Project>;
}
//# sourceMappingURL=GraphqlProjectRepository.d.ts.map