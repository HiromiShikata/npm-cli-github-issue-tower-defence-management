import { Issue } from '../entities/Issue';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { Project } from '../entities/Project';
import { Member } from '../entities/Member';
import { DateRepository } from './adapter-interfaces/DateRepository';
import { StoryObject, StoryObjectMap } from './HandleScheduledEventUseCase';
export declare class AnalyzeProblemByIssueUseCase {
    readonly issueRepository: Pick<IssueRepository, 'createNewIssue' | 'createComment'>;
    readonly dateRepository: Pick<DateRepository, 'formatDurationToHHMM' | 'formatDateTimeWithDayOfWeek' | 'formatStartEnd' | 'formatDateWithDayOfWeek'>;
    constructor(issueRepository: Pick<IssueRepository, 'createNewIssue' | 'createComment'>, dateRepository: Pick<DateRepository, 'formatDurationToHHMM' | 'formatDateTimeWithDayOfWeek' | 'formatStartEnd' | 'formatDateWithDayOfWeek'>);
    run: (input: {
        targetDates: Date[];
        project: Project;
        issues: Issue[];
        cacheUsed: boolean;
        manager: Member["name"];
        members: Member["name"][];
        org: string;
        repo: string;
        storyObjectMap: StoryObjectMap;
        disabledStatus: string;
    }) => Promise<void>;
    checkInProgress: (input: Parameters<AnalyzeProblemByIssueUseCase["run"]>[0] & {
        targetDate: Date;
    }) => Promise<void>;
    createSummaryCommentBody: (storyObject: StoryObject & {
        storyIssue: NonNullable<StoryObject["storyIssue"]>;
    }) => string;
    createQuestionIssueBody: (issue: Issue, totalWorkingTime: number, totalWorkingTimeByAssignee: Map<string, number>) => string;
}
//# sourceMappingURL=AnalyzeProblemByIssueUseCase.d.ts.map