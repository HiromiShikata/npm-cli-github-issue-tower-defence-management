import { BaseGitHubRepository } from './BaseGitHubRepository';
import { ProjectFieldDefinition } from './projectFieldDefinition';
import { Project } from '../../domain/entities/Project';
export type ProjectLocation = {
    owner: string;
    ownerType: 'users' | 'orgs';
    projectNumber: number;
};
export declare const projectUrlFromLocation: (location: ProjectLocation) => string;
export declare const projectLocationFromUrl: (projectUrl: string) => ProjectLocation | null;
export declare class RestProjectRepository extends BaseGitHubRepository {
    private projectApiUrl;
    private requestHeaders;
    listFieldDefinitions: (location: ProjectLocation) => Promise<ProjectFieldDefinition[]>;
    listFieldNames: (location: ProjectLocation) => Promise<string[]>;
    getProject: (location: ProjectLocation) => Promise<Project | null>;
}
//# sourceMappingURL=RestProjectRepository.d.ts.map