import { Issue } from '../entities/Issue';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { Project } from '../entities/Project';
import { StoryObjectMap } from '../entities/StoryObjectMap';
import { Member } from '../entities/Member';
export declare class ConvertCheckboxToIssueInStoryIssueUseCase {
    readonly issueRepository: Pick<IssueRepository, 'createNewIssue' | 'updateIssue' | 'updateStory' | 'getIssueByUrl' | 'addIssueToProject'>;
    constructor(issueRepository: Pick<IssueRepository, 'createNewIssue' | 'updateIssue' | 'updateStory' | 'getIssueByUrl' | 'addIssueToProject'>);
    run: (input: {
        project: Project;
        issues: Issue[];
        cacheUsed: boolean;
        urlOfStoryView: string;
        storyObjectMap: StoryObjectMap;
        manager: Member["name"];
    }) => Promise<void>;
    buildStoryViewLink: (urlOfStoryView: string, storyName: string) => string;
    findCheckboxTextsNotCreatedIssue: (storyIssueBody: string) => string[];
}
//# sourceMappingURL=ConvertCheckboxToIssueInStoryIssueUseCase.d.ts.map