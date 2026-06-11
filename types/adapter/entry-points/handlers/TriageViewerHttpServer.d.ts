import { TriageViewerUseCaseInterface } from '../../../domain/usecases/TriageViewerServerStartUseCase';
export declare class TriageViewerHttpServer {
    private readonly useCase;
    private readonly accessKey;
    private server;
    constructor(useCase: TriageViewerUseCaseInterface, accessKey: string);
    start: (host: string, port: number) => Promise<void>;
    stop: () => Promise<void>;
    private handleRequest;
    private handleGetTriageData;
    private handleSetStory;
    private handleCloseIssue;
    private handleImageProxy;
    private handleTriagePage;
}
//# sourceMappingURL=TriageViewerHttpServer.d.ts.map