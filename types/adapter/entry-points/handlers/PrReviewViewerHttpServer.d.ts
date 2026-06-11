import { PrReviewViewerServerStartUseCase } from '../../../domain/usecases/PrReviewViewerServerStartUseCase';
import { GitHubPrReviewRepository } from '../../repositories/GitHubPrReviewRepository';
export declare class PrReviewViewerHttpServer {
    private readonly useCase;
    private readonly gitHubPrReviewRepository;
    private readonly accessKey;
    private readonly staticFilesDir;
    private server;
    constructor(useCase: PrReviewViewerServerStartUseCase, gitHubPrReviewRepository: GitHubPrReviewRepository, accessKey: string, staticFilesDir: string);
    start: (host: string, port: number) => Promise<void>;
    stop: () => Promise<void>;
    private handleRequest;
    private handleGetList;
    private handleGetDetail;
    private handleReview;
    private handleImageProxy;
    private handleBlob;
    private handleIssueTitle;
    private serveStaticFile;
}
//# sourceMappingURL=PrReviewViewerHttpServer.d.ts.map