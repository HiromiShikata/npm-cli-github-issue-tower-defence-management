import { PrReviewViewerListRepository, PrReviewViewerDetailRepository, PrReviewRepository, PrReviewDoneRepository, IssueTitleCacheRepository } from './adapter-interfaces/PrReviewViewerRepository';
import { PrReviewAction } from '../entities/PrReviewViewerItem';
export type PrReviewViewerServerConfig = {
    accessKey: string;
    host: string;
    port: number;
    staticFilesDir: string;
    dataDir: string;
};
export type ReviewActionRequest = {
    action: PrReviewAction;
    repo: string;
    prNumber: number;
    projectItemId: string;
    projectId: string;
    statusFieldId: string;
    awaitingWorkspaceStatusOptionId: string;
    body?: string;
    comments?: {
        path: string;
        position: number;
        body: string;
    }[];
};
export type ReviewActionResult = {
    ok: true;
} | {
    ok: false;
    error: string;
};
export interface PrReviewViewerUseCaseInterface {
    getList: (projectCode: string) => Promise<import('../entities/PrReviewViewerItem').PrReviewViewerItem[]>;
    getDetail: (projectCode: string, repo: string, prNumber: number) => Promise<object | null>;
    executeReview: (projectCode: string, request: ReviewActionRequest) => Promise<ReviewActionResult>;
    getFileContent: (owner: string, repo: string, filePath: string, ref: string, prHeadSha: string) => Promise<{
        content: Buffer;
        contentType: string;
    }>;
    getIssueTitleInfo: (owner: string, repo: string, number: number) => Promise<import('../entities/PrReviewViewerItem').IssueTitleInfo>;
}
export declare class PrReviewViewerServerStartUseCase {
    private readonly prReviewViewerListRepository;
    private readonly prReviewViewerDetailRepository;
    private readonly prReviewRepository;
    private readonly prReviewDoneRepository;
    private readonly issueTitleCacheRepository;
    constructor(prReviewViewerListRepository: PrReviewViewerListRepository, prReviewViewerDetailRepository: PrReviewViewerDetailRepository, prReviewRepository: PrReviewRepository, prReviewDoneRepository: PrReviewDoneRepository, issueTitleCacheRepository: IssueTitleCacheRepository);
    getList: (projectCode: string) => Promise<import("../entities/PrReviewViewerItem").PrReviewViewerItem[]>;
    getDetail: (projectCode: string, repo: string, prNumber: number) => Promise<object | null>;
    executeReview: (projectCode: string, request: ReviewActionRequest) => Promise<ReviewActionResult>;
    getFileContent: (owner: string, repo: string, filePath: string, ref: string, prHeadSha: string) => Promise<{
        content: Buffer;
        contentType: string;
    }>;
    getIssueTitleInfo: (owner: string, repo: string, number: number) => Promise<import("../entities/PrReviewViewerItem").IssueTitleInfo>;
    private safeMarkDone;
    private parseIssueUrl;
}
//# sourceMappingURL=PrReviewViewerServerStartUseCase.d.ts.map