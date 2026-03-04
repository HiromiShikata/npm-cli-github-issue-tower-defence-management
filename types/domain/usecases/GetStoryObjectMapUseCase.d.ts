import { Issue } from '../entities/Issue';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { Project } from '../entities/Project';
import { StoryObjectMap } from '../entities/StoryObjectMap';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
export declare class ProjectNotFoundError extends Error {
    constructor(message: string);
}
export declare class GetStoryObjectMapUseCase {
    readonly projectRepository: Pick<ProjectRepository, 'findProjectIdByUrl' | 'getProject'>;
    readonly issueRepository: Pick<IssueRepository, 'getAllIssues'>;
    constructor(projectRepository: Pick<ProjectRepository, 'findProjectIdByUrl' | 'getProject'>, issueRepository: Pick<IssueRepository, 'getAllIssues'>);
    run: (input: {
        projectUrl: string;
        allowIssueCacheMinutes: number;
    }) => Promise<{
        project: Project;
        issues: Issue[];
        cacheUsed: boolean;
        storyObjectMap: StoryObjectMap;
    }>;
    createStoryObjectMap: (input: {
        project: Project;
        issues: Issue[];
    }) => StoryObjectMap;
}
//# sourceMappingURL=GetStoryObjectMapUseCase.d.ts.map