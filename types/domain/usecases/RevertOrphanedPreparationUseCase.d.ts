import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { IssueCommentRepository } from './adapter-interfaces/IssueCommentRepository';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { LocalCommandRunner } from './adapter-interfaces/LocalCommandRunner';
export declare class RevertOrphanedPreparationUseCase {
    readonly projectRepository: Pick<ProjectRepository, 'findProjectIdByUrl' | 'getProject' | 'createField' | 'getByUrl' | 'updateAgentList'>;
    readonly issueRepository: Pick<IssueRepository, 'getAllIssues' | 'updateStatus' | 'findRelatedOpenPRs' | 'getOpenPullRequest' | 'get' | 'setIssueAgentField'>;
    readonly issueCommentRepository: Pick<IssueCommentRepository, 'getCommentsFromIssue' | 'createComment'>;
    readonly localCommandRunner: LocalCommandRunner;
    constructor(projectRepository: Pick<ProjectRepository, 'findProjectIdByUrl' | 'getProject' | 'createField' | 'getByUrl' | 'updateAgentList'>, issueRepository: Pick<IssueRepository, 'getAllIssues' | 'updateStatus' | 'findRelatedOpenPRs' | 'getOpenPullRequest' | 'get' | 'setIssueAgentField'>, issueCommentRepository: Pick<IssueCommentRepository, 'getCommentsFromIssue' | 'createComment'>, localCommandRunner: LocalCommandRunner);
    run: (params: {
        projectUrl: string;
        preparationProcessCheckCommand: string;
        thresholdForAutoReject: number;
        awLogDirectoryPath?: string;
        awLogStaleThresholdMinutes?: number;
        awaitingQualityCheckStatus?: string | null;
        labelsAsLlmAgentName?: string[] | null;
        labelsNotRequiringPullRequest?: string[] | null;
        allowedIssueAuthors?: string[] | null;
    }) => Promise<void>;
    private isStillInPreparation;
    private evaluateOutcome;
    private resolveOpenPrsForPrItem;
    private resolveNextStepAgent;
    private reportBodyHasNextStep;
    private isOrphanedIssue;
    private isAwLogStale;
}
//# sourceMappingURL=RevertOrphanedPreparationUseCase.d.ts.map