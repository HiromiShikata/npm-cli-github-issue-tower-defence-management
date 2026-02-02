import { Issue } from '../entities/Issue';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { Project } from '../entities/Project';
import { StoryObjectMap } from './HandleScheduledEventUseCase';
export declare class ConvertCheckboxToIssueInStoryIssueUseCase {
    readonly issueRepository: Pick<IssueRepository, 'createNewIssue' | 'updateIssue' | 'updateStory' | 'getIssueByUrl'>;
    constructor(issueRepository: Pick<IssueRepository, 'createNewIssue' | 'updateIssue' | 'updateStory' | 'getIssueByUrl'>);
    run: (input: {
        project: Project;
        issues: Issue[];
        cacheUsed: boolean;
        urlOfStoryView: string;
        disabledStatus: string;
        storyObjectMap: StoryObjectMap;
    }) => Promise<void>;
    findCheckboxTextsNotCreatedIssue: (storyIssueBody: string) => string[];
}
//# sourceMappingURL=ConvertCheckboxToIssueInStoryIssueUseCase.d.ts.map