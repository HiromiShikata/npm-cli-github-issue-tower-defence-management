import { PrReviewViewerDetailRepository } from '../../domain/usecases/adapter-interfaces/PrReviewViewerRepository';
export declare class FileSystemPrReviewViewerDetailRepository implements PrReviewViewerDetailRepository {
    private readonly dataDir;
    constructor(dataDir: string);
    getDetail: (projectCode: string, repo: string, prNumber: number) => Promise<object | null>;
}
//# sourceMappingURL=FileSystemPrReviewViewerDetailRepository.d.ts.map