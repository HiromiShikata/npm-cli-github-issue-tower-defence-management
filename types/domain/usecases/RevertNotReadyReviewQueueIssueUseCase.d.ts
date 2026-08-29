import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { IssueCommentRepository } from './adapter-interfaces/IssueCommentRepository';
export declare class RevertNotReadyReviewQueueIssueUseCase {
    private readonly projectRepository;
    private readonly issueRepository;
    private readonly issueCommentRepository;
    private readonly issueRejectionEvaluator;
    private readonly changeTargetPullRequestApprover;
    constructor(projectRepository: Pick<ProjectRepository, 'findProjectIdByUrl' | 'getProject'>, issueRepository: Pick<IssueRepository, 'getAllIssues' | 'updateStatus' | 'updateStory' | 'findRelatedOpenPRs' | 'getOpenPullRequest' | 'getOpenPullRequests' | 'getPullRequestChangedFilePaths' | 'approvePullRequest' | 'requestChangesWithInlineComment'>, issueCommentRepository: Pick<IssueCommentRepository, 'createComment' | 'getCommentsFromIssue'>);
    run: (params: {
        projectUrl: string;
        manager: string;
        labelsAsLlmAgentName?: string[] | null;
        labelsNotRequiringPullRequest?: string[] | null;
        changeTargetPathAliases?: Record<string, string> | null;
        allowedIssueAuthors?: string[] | null;
        developerAgentNames?: string[] | null;
    }) => Promise<void>;
    private buildRelatedOpenPrUrlsByIssueUrl;
}
//# sourceMappingURL=RevertNotReadyReviewQueueIssueUseCase.d.ts.map