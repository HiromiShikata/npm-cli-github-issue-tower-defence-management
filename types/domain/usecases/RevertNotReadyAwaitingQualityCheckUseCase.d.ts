import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { IssueCommentRepository } from './adapter-interfaces/IssueCommentRepository';
export declare class RevertNotReadyAwaitingQualityCheckUseCase {
    private readonly projectRepository;
    private readonly issueRepository;
    private readonly issueCommentRepository;
    private readonly issueRejectionEvaluator;
    constructor(projectRepository: Pick<ProjectRepository, 'findProjectIdByUrl' | 'getProject'>, issueRepository: Pick<IssueRepository, 'getAllIssues' | 'updateStatus' | 'findRelatedOpenPRs' | 'getOpenPullRequest'>, issueCommentRepository: Pick<IssueCommentRepository, 'createComment'>);
    run: (params: {
        projectUrl: string;
        allowIssueCacheMinutes: number;
    }) => Promise<void>;
}
//# sourceMappingURL=RevertNotReadyAwaitingQualityCheckUseCase.d.ts.map