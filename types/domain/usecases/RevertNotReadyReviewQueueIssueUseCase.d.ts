import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { IssueCommentRepository } from './adapter-interfaces/IssueCommentRepository';
export declare class RevertNotReadyReviewQueueIssueUseCase {
    private readonly projectRepository;
    private readonly issueRepository;
    private readonly issueCommentRepository;
    private readonly issueRejectionEvaluator;
    private readonly changeTargetPullRequestApprover;
    constructor(projectRepository: Pick<ProjectRepository, 'findProjectIdByUrl' | 'getProject'>, issueRepository: Pick<IssueRepository, 'getAllIssues' | 'updateStatus' | 'updateStory' | 'findRelatedOpenPRs' | 'getOpenPullRequest' | 'getPullRequestChangedFilePaths' | 'approvePullRequest' | 'requestChangesWithInlineComment'>, issueCommentRepository: Pick<IssueCommentRepository, 'createComment'>);
    run: (params: {
        projectUrl: string;
        allowIssueCacheMinutes: number;
        labelsAsLlmAgentName?: string[] | null;
        changeTargetPathAliases?: Record<string, string> | null;
    }) => Promise<void>;
}
//# sourceMappingURL=RevertNotReadyReviewQueueIssueUseCase.d.ts.map