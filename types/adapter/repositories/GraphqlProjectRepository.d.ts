import { BaseGitHubRepository } from './BaseGitHubRepository';
import { ProjectRepository } from '../../domain/usecases/adapter-interfaces/ProjectRepository';
import { FieldOption, Project } from '../../domain/entities/Project';
export declare class GraphqlProjectRepository extends BaseGitHubRepository implements ProjectRepository {
    extractProjectFromUrl: (projectUrl: string) => {
        owner: string;
        projectNumber: number;
    };
    fetchProjectId: (login: string, projectNumber: number) => Promise<string>;
    findProjectIdByUrl: (projectUrl: string) => Promise<Project["id"] | null>;
    getProject: (projectId: Project["id"]) => Promise<Project | null>;
    addNewStory: (project: Project, storyOptions: (Omit<FieldOption, "id"> & {
        id: FieldOption["id"] | null;
    })[]) => Promise<FieldOption[]>;
}
//# sourceMappingURL=GraphqlProjectRepository.d.ts.map