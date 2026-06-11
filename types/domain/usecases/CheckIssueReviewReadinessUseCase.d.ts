import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { IssueCommentRepository } from './adapter-interfaces/IssueCommentRepository';
import { PrRejectedReasonType } from './IssueRejectionEvaluator';
type RejectedReasonType = 'ISSUE_NOT_FOUND' | 'NO_REPORT_FROM_AGENT_BOT' | 'REPORT_HAS_NEXT_STEP' | PrRejectedReasonType;
export type IssueReviewReadinessResult = {
    reviewReady: boolean;
    rejections: {
        type: RejectedReasonType;
        detail: string;
    }[];
};
export declare class CheckIssueReviewReadinessUseCase {
    private readonly issueRepository;
    private readonly issueCommentRepository;
    private readonly issueRejectionEvaluator;
    constructor(issueRepository: Pick<IssueRepository, 'getIssueByUrl' | 'findRelatedOpenPRs' | 'getOpenPullRequest' | 'getPullRequestChangedFilePaths' | 'requestChangesWithInlineComment'>, issueCommentRepository: Pick<IssueCommentRepository, 'getCommentsFromIssue'>);
    run: (params: {
        issueUrl: string;
        allowedIssueAuthors?: string[] | null;
        labelsAsLlmAgentName?: string[] | null;
    }) => Promise<IssueReviewReadinessResult>;
    private isAuthorTrusted;
    private reportBodyHasNextStep;
}
export {};
//# sourceMappingURL=CheckIssueReviewReadinessUseCase.d.ts.map