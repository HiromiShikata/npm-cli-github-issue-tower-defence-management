import { IssueTitleCacheRepository } from '../../domain/usecases/adapter-interfaces/PrReviewViewerRepository';
import { IssueTitleInfo } from '../../domain/entities/PrReviewViewerItem';
export declare class FileSystemIssueTitleCacheRepository implements IssueTitleCacheRepository {
    private readonly filePath;
    private readonly inMemoryCache;
    constructor(dataDir: string);
    private cacheKey;
    private loadFromDisk;
    private saveToDisk;
    get: (owner: string, repo: string, number: number) => Promise<IssueTitleInfo | null>;
    set: (owner: string, repo: string, number: number, info: IssueTitleInfo) => Promise<void>;
}
//# sourceMappingURL=FileSystemIssueTitleCacheRepository.d.ts.map