import { Issue } from '../entities/Issue';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { Project, StoryOption } from '../entities/Project';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
export declare class ProjectNotFoundError extends Error {
    constructor(message: string);
}
export type StoryObject = {
    story: StoryOption;
    storyIssue: Issue | null;
    issues: Issue[];
};
export type StoryObjectMap = Map<NonNullable<Project['story']>['stories'][0]['name'], StoryObject>;
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