import { IssueRepository } from '../../../domain/usecases/adapter-interfaces/IssueRepository';
export declare const ISSUE_TITLE_CACHE_TTL_MS: number;
export declare const PULL_REQUEST_STATUS_CACHE_TTL_MS: number;
export type IssueOrPullRequestState = {
    state: string;
    merged: boolean;
    isPullRequest: boolean;
};
export type PullRequestStatus = {
    isConflicted: boolean;
    isPassedAllCiJob: boolean;
    isCiStateSuccess: boolean;
    isBranchOutOfDate: boolean;
    missingRequiredCheckNames: string[];
};
export type PullRequestStatusResponse = {
    found: boolean;
    status: PullRequestStatus | null;
};
export declare class IssueTitleStateCache {
    private readonly nowMs;
    private readonly entries;
    constructor(nowMs?: () => number);
    get: (url: string) => IssueOrPullRequestState | null;
    set: (url: string, state: IssueOrPullRequestState) => void;
}
export declare class PullRequestStatusCache {
    private readonly nowMs;
    private readonly entries;
    constructor(nowMs?: () => number);
    get: (url: string) => PullRequestStatusResponse | null;
    set: (url: string, status: PullRequestStatusResponse) => void;
}
export type ConsoleReadApiResponse = {
    statusCode: number;
    body: unknown;
};
export type RelatedPullRequestWithSummary = {
    url: string;
    branchName: string | null;
    createdAt: string;
    isDraft: boolean;
    isConflicted: boolean;
    isPassedAllCiJob: boolean;
    isCiStateSuccess: boolean;
    isResolvedAllReviewComments: boolean;
    isBranchOutOfDate: boolean;
    missingRequiredCheckNames: string[];
    summary: {
        title: string;
        body: string;
        additions: number;
        deletions: number;
        changedFiles: number;
    } | null;
};
export declare const handleItemBody: (issueRepository: IssueRepository, url: string | null) => Promise<ConsoleReadApiResponse>;
export declare const handleComments: (issueRepository: IssueRepository, url: string | null) => Promise<ConsoleReadApiResponse>;
export declare const handlePrFiles: (issueRepository: IssueRepository, url: string | null) => Promise<ConsoleReadApiResponse>;
export declare const handlePrCommits: (issueRepository: IssueRepository, url: string | null) => Promise<ConsoleReadApiResponse>;
export declare const handleRelatedPrs: (issueRepository: IssueRepository, url: string | null) => Promise<ConsoleReadApiResponse>;
export declare const handleIssueTitle: (issueRepository: IssueRepository, cache: IssueTitleStateCache, url: string | null) => Promise<ConsoleReadApiResponse>;
export declare const handlePullRequestStatus: (issueRepository: IssueRepository, cache: PullRequestStatusCache, url: string | null) => Promise<ConsoleReadApiResponse>;
//# sourceMappingURL=consoleReadApi.d.ts.map