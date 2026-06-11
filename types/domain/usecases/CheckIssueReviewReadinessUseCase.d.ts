import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { PrRejectedReasonType } from './IssueRejectionEvaluator';
export type IssueReviewReadinessResult = {
    reviewReady: boolean;
    rejections: {
        type: PrRejectedReasonType;
        detail: string;
    }[];
};
export declare class CheckIssueReviewReadinessUseCase {
    private readonly projectRepository;
    private readonly issueRepository;
    private readonly issueRejectionEvaluator;
    constructor(projectRepository: Pick<ProjectRepository, 'getByUrl'>, issueRepository: Pick<IssueRepository, 'get' | 'findRelatedOpenPRs' | 'getOpenPullRequest' | 'getPullRequestChangedFilePaths' | 'requestChangesWithInlineComment' | 'createCommentByUrl'>);
    run: (params: {
        projectUrl: string;
        issueUrl: string;
        labelsAsLlmAgentName?: string[] | null;
    }) => Promise<IssueReviewReadinessResult>;
}
//# sourceMappingURL=CheckIssueReviewReadinessUseCase.d.ts.map