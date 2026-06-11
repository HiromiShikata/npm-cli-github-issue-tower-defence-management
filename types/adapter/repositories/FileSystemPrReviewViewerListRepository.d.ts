import { PrReviewViewerListRepository } from '../../domain/usecases/adapter-interfaces/PrReviewViewerRepository';
import { PrReviewViewerItem } from '../../domain/entities/PrReviewViewerItem';
export declare class FileSystemPrReviewViewerListRepository implements PrReviewViewerListRepository {
    private readonly dataDir;
    constructor(dataDir: string);
    getList: (projectCode: string) => Promise<PrReviewViewerItem[]>;
}
//# sourceMappingURL=FileSystemPrReviewViewerListRepository.d.ts.map