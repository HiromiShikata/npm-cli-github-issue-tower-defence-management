import { PrReviewViewerUseCaseInterface } from '../../../domain/usecases/PrReviewViewerServerStartUseCase';
export interface ImageProxyRepository {
    fetchImageProxy: (targetUrl: string) => Promise<{
        content: Buffer;
        contentType: string;
    }>;
}
export declare class PrReviewViewerHttpServer {
    private readonly useCase;
    private readonly gitHubPrReviewRepository;
    private readonly accessKey;
    private readonly staticFilesDir;
    private server;
    constructor(useCase: PrReviewViewerUseCaseInterface, gitHubPrReviewRepository: ImageProxyRepository, accessKey: string, staticFilesDir: string);
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