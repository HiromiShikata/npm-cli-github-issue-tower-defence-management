import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { FieldOption, Project } from '../entities/Project';
import { StoryObjectMap } from '../entities/StoryObjectMap';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { Issue } from '../entities/Issue';
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
    createNewStoryList: (projectStory: NonNullable<Project["story"]>, storyObjectMap: StoryObjectMap, issues: Issue[]) => (Omit<FieldOption, "id"> & {
        id: FieldOption["id"] | null;
    })[];
}
//# sourceMappingURL=CreateNewStoryByLabelUseCase.d.ts.map