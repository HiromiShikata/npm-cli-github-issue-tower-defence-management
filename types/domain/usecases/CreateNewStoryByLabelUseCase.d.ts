import type { Issue } from '../entities/Issue';
import { type Project, type StoryListEntry } from '../entities/Project';
import type { StoryObjectMap } from '../entities/StoryObjectMap';
import type { IssueRepository } from './adapter-interfaces/IssueRepository';
import type { ProjectRepository } from './adapter-interfaces/ProjectRepository';
export declare class CreateNewStoryByLabelUseCase {
    readonly projectRepository: Pick<ProjectRepository, 'updateStoryList'>;
    readonly issueRepository: Pick<IssueRepository, 'updateLabels' | 'updateStory'>;
    constructor(projectRepository: Pick<ProjectRepository, 'updateStoryList'>, issueRepository: Pick<IssueRepository, 'updateLabels' | 'updateStory'>);
    run: (input: {
        project: Project;
        cacheUsed: boolean;
        org: string;
        repo: string;
        storyObjectMap: StoryObjectMap;
        issues: Issue[];
    }) => Promise<void>;
    hasNewStoryLabel: (issue: Issue) => boolean;
    findNewStoryIssues: (storyObjectMap: StoryObjectMap, issues: Issue[]) => Issue[];
    createNewStoryList: (projectStory: NonNullable<Project["story"]>, storyObjectMap: StoryObjectMap, issues: Issue[]) => StoryListEntry[];
}
//# sourceMappingURL=CreateNewStoryByLabelUseCase.d.ts.map