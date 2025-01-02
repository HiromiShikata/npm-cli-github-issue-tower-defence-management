import { Issue } from '../entities/Issue';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { Project } from '../entities/Project';
import { Member } from '../entities/Member';
import { DateRepository } from './adapter-interfaces/DateRepository';
import { StoryObjectMap } from './HandleScheduledEventUseCase';
export declare class AnalyzeStoriesUseCase {
    readonly issueRepository: Pick<IssueRepository, 'createNewIssue'>;
    readonly dateRepository: Pick<DateRepository, 'formatDurationToHHMM'>;
    constructor(issueRepository: Pick<IssueRepository, 'createNewIssue'>, dateRepository: Pick<DateRepository, 'formatDurationToHHMM'>);
    run: (input: {
        targetDates: Date[];
        project: Project;
        issues: Issue[];
        cacheUsed: boolean;
        manager: Member["name"];
        org: string;
        repo: string;
        urlOfStoryView: string;
        disabledStatus: string;
        storyObjectMap: StoryObjectMap;
    }) => Promise<void>;
    createSummaryIssueBody: (summaryStoryIssue: Map<string, (Issue & {
        name: string;
        color: string;
        description: string;
    })[]>, urlOfStoryView: string) => string;
}
//# sourceMappingURL=AnalyzeStoriesUseCase.d.ts.map