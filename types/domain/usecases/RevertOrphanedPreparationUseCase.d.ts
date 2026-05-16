import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { IssueCommentRepository } from './adapter-interfaces/IssueCommentRepository';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { LocalCommandRunner } from './adapter-interfaces/LocalCommandRunner';
export declare class RevertOrphanedPreparationUseCase {
    readonly projectRepository: Pick<ProjectRepository, 'findProjectIdByUrl' | 'getProject'>;
    readonly issueRepository: Pick<IssueRepository, 'getAllIssues' | 'updateStatus' | 'findRelatedOpenPRs' | 'getOpenPullRequest'>;
    readonly issueCommentRepository: Pick<IssueCommentRepository, 'getCommentsFromIssue'>;
    readonly localCommandRunner: LocalCommandRunner;
    constructor(projectRepository: Pick<ProjectRepository, 'findProjectIdByUrl' | 'getProject'>, issueRepository: Pick<IssueRepository, 'getAllIssues' | 'updateStatus' | 'findRelatedOpenPRs' | 'getOpenPullRequest'>, issueCommentRepository: Pick<IssueCommentRepository, 'getCommentsFromIssue'>, localCommandRunner: LocalCommandRunner);
    run: (params: {
        projectUrl: string;
        allowIssueCacheMinutes: number;
        preparationProcessCheckCommand: string;
        awLogDirectoryPath?: string;
        awLogStaleThresholdMinutes?: number;
        awaitingQualityCheckStatus?: string | null;
    }) => Promise<void>;
    private evaluateHasRejections;
    private resolveOpenPrsForPrItem;
    private reportBodyHasNextStep;
    private isOrphanedIssue;
    private isAwLogStale;
}
//# sourceMappingURL=RevertOrphanedPreparationUseCase.d.ts.map