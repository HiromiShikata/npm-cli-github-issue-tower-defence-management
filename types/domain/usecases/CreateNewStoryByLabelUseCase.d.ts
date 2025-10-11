import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { FieldOption, Project } from '../entities/Project';
import { StoryObjectMap } from './HandleScheduledEventUseCase';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { Issue } from '../entities/Issue';
export declare class CreateNewStoryByLabelUseCase {
    readonly projectRepository: Pick<ProjectRepository, 'addNewStory'>;
    readonly issueRepository: Pick<IssueRepository, 'updateLabels' | 'updateStory'>;
    constructor(projectRepository: Pick<ProjectRepository, 'addNewStory'>, issueRepository: Pick<IssueRepository, 'updateLabels' | 'updateStory'>);
    run: (input: {
        project: Project;
        cacheUsed: boolean;
        org: string;
        repo: string;
        disabledStatus: string;
        storyObjectMap: StoryObjectMap;
    }) => Promise<void>;
    findNewStoryIssues: (storyObjectMap: StoryObjectMap) => Issue[];
    createNewStoryList: (projectStory: NonNullable<Project["story"]>, storyObjectMap: StoryObjectMap) => (Omit<FieldOption, "id"> & {
        id: FieldOption["id"] | null;
    })[];
}
//# sourceMappingURL=CreateNewStoryByLabelUseCase.d.ts.map