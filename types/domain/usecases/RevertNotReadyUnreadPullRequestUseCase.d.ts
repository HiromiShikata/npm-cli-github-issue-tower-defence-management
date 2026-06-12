import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { IssueCommentRepository } from './adapter-interfaces/IssueCommentRepository';
export declare class RevertNotReadyUnreadPullRequestUseCase {
    private readonly projectRepository;
    private readonly issueRepository;
    private readonly issueCommentRepository;
    private readonly issueRejectionEvaluator;
    constructor(projectRepository: Pick<ProjectRepository, 'findProjectIdByUrl' | 'getProject'>, issueRepository: Pick<IssueRepository, 'getAllIssues' | 'updateStatus' | 'updateStory' | 'findRelatedOpenPRs' | 'getOpenPullRequest' | 'getPullRequestChangedFilePaths' | 'requestChangesWithInlineComment'>, issueCommentRepository: Pick<IssueCommentRepository, 'createComment'>);
    run: (params: {
        projectUrl: string;
        allowIssueCacheMinutes: number;
        labelsAsLlmAgentName?: string[] | null;
    }) => Promise<void>;
}
//# sourceMappingURL=RevertNotReadyUnreadPullRequestUseCase.d.ts.map