import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { Project } from '../entities/Project';
import { DateRepository } from './adapter-interfaces/DateRepository';
import { StoryObject, StoryObjectMap } from '../entities/StoryObjectMap';
export declare class AnalyzeProblemByIssueUseCase {
    readonly issueRepository: Pick<IssueRepository, 'createComment'>;
    readonly dateRepository: Pick<DateRepository, 'formatDurationToHHMM' | 'formatDateWithDayOfWeek'>;
    constructor(issueRepository: Pick<IssueRepository, 'createComment'>, dateRepository: Pick<DateRepository, 'formatDurationToHHMM' | 'formatDateWithDayOfWeek'>);
    run: (input: {
        targetDates: Date[];
        project: Project;
        storyObjectMap: StoryObjectMap;
    }) => Promise<void>;
    createSummaryCommentBody: (storyObject: StoryObject & {
        storyIssue: NonNullable<StoryObject["storyIssue"]>;
    }) => string;
}
//# sourceMappingURL=AnalyzeProblemByIssueUseCase.d.ts.map