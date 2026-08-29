import type { IssueRepository } from '../../../domain/usecases/adapter-interfaces/IssueRepository';
import { IssueTitleStateCache, PullRequestStatusCache } from './consoleReadApi';
export type AirplaneFilesItem = {
    path: string;
    additions: number;
    deletions: number;
    status: string;
    patch: string | null;
    rawUrl: string | null;
};
export type AirplaneCommitItem = {
    sha: string;
    message: string;
    author: string;
    authoredAt: string;
};
export type AirplaneCommentItem = {
    author: string;
    body: string;
    createdAt: string;
};
export type AirplanePrStatusItem = {
    found: boolean;
    isConflicted: boolean;
    mergeableStatus: string;
    isPassedAllCiJob: boolean;
    isCiStateSuccess: boolean;
    isBranchOutOfDate: boolean;
    missingRequiredCheckNames: string[];
};
export type AirplaneStateItem = {
    state: string;
    merged: boolean;
    isPullRequest: boolean;
    title: string;
};
export type AirplaneRelatedPrItem = {
    url: string;
    branchName: string | null;
    createdAt: string;
    isDraft: boolean;
    isConflicted: boolean;
    mergeableStatus: string;
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
export type AirplaneItemData = {
    body: string;
    comments: AirplaneCommentItem[];
    state: AirplaneStateItem;
    files: AirplaneFilesItem[] | null;
    commits: AirplaneCommitItem[] | null;
    prStatus: AirplanePrStatusItem | null;
    relatedPrs: AirplaneRelatedPrItem[] | null;
};
export type AirplaneTabData = Record<string, unknown>;
export type AirplaneSnapshotPayload = {
    capturedAt: string;
    tabs: Record<string, AirplaneTabData>;
    items: Record<string, AirplaneItemData>;
    failures: string[];
};
export type AirplaneSyncEvent = {
    type: 'progress';
    fetched: number;
    total: number;
} | {
    type: 'done';
    snapshot: AirplaneSnapshotPayload;
} | {
    type: 'error';
    message: string;
};
export type AirplaneSyncResponseWriter = {
    writeHead(statusCode: number, headers: Record<string, string>): void;
    write(data: string): void;
    end(): void;
};
export declare const handleAirplaneSync: (response: AirplaneSyncResponseWriter, consoleDataOutputDir: string, issueRepository: IssueRepository, issueTitleStateCache: IssueTitleStateCache, pullRequestStatusCache: PullRequestStatusCache, ghToken?: string | null) => Promise<void>;
//# sourceMappingURL=consoleAirplaneSnapshotApi.d.ts.map