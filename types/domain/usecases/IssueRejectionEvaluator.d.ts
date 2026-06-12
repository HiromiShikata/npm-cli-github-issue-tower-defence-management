import { IssueRepository } from './adapter-interfaces/IssueRepository';
export type PrRejectedReasonType = 'PULL_REQUEST_NOT_FOUND' | 'MULTIPLE_PULL_REQUESTS_FOUND' | 'PULL_REQUEST_IS_DRAFT' | 'PULL_REQUEST_CONFLICTED' | 'ANY_CI_JOB_FAILED_OR_IN_PROGRESS' | 'REQUIRED_CI_JOB_NEVER_STARTED' | 'ANY_REVIEW_COMMENT_NOT_RESOLVED' | 'CHANGE_TARGET_MUST_PATH_NOT_CHANGED';
export type PrRejectionResult = {
    rejections: {
        type: PrRejectedReasonType;
        detail: string;
    }[];
    approvedPrUrl: string | null;
};
export declare class IssueRejectionEvaluator {
    private readonly issueRepository;
    constructor(issueRepository: Pick<IssueRepository, 'findRelatedOpenPRs' | 'getOpenPullRequest' | 'getPullRequestChangedFilePaths' | 'requestChangesWithInlineComment'>);
    evaluate: (issue: {
        url: string;
        labels: string[];
        isPr: boolean;
    }, labelsAsLlmAgentName?: string[]) => Promise<PrRejectionResult>;
    private resolveOpenPrsForPrItem;
    private extractChangeTargetMustPaths;
    private isFilePathUnderPath;
}
//# sourceMappingURL=IssueRejectionEvaluator.d.ts.map