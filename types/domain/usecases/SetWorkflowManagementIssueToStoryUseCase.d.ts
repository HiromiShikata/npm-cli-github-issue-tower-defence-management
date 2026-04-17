import { Issue } from '../entities/Issue';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { Project } from '../entities/Project';
export declare class SetWorkflowManagementIssueToStoryUseCase {
    readonly issueRepository: Pick<IssueRepository, 'updateStory' | 'removeLabel'>;
    constructor(issueRepository: Pick<IssueRepository, 'updateStory' | 'removeLabel'>);
    static readonly STORY_LABEL_PREFIX = "story:";
    static readonly WORKFLOW_MANAGEMENT_LABEL = "story:workflow-management";
    static readonly DAILY_ROUTINE_LABEL = "daily-routine";
    static readonly REGULAR_STORY_PREFIX = "regular / ";
    static normalizeCandidate: (candidate: string) => string;
    run: (input: {
        targetDates: Date[];
        project: Project;
        issues: Issue[];
        cacheUsed: boolean;
    }) => Promise<void>;
    private isEligibleIssue;
}
//# sourceMappingURL=SetWorkflowManagementIssueToStoryUseCase.d.ts.map