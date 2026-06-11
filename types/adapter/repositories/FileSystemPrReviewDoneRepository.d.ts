import { PrReviewDoneRepository } from '../../domain/usecases/adapter-interfaces/PrReviewViewerRepository';
export declare class FileSystemPrReviewDoneRepository implements PrReviewDoneRepository {
    private readonly filePath;
    constructor(dataDir: string);
    private isDoneRecord;
    private readRecords;
    private writeRecords;
    markDone: (owner: string, repo: string, prNumber: number) => Promise<void>;
    isDone: (owner: string, repo: string, prNumber: number) => Promise<boolean>;
    getAllDone: () => Promise<{
        owner: string;
        repo: string;
        prNumber: number;
    }[]>;
}
//# sourceMappingURL=FileSystemPrReviewDoneRepository.d.ts.map