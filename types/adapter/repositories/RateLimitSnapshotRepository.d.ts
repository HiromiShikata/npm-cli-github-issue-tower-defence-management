import { TokenRateLimitSnapshot, TokenRateLimitSnapshotRepository } from '../../domain/usecases/adapter-interfaces/TokenRateLimitSnapshotRepository';
export declare class RateLimitSnapshotRepository implements TokenRateLimitSnapshotRepository {
    private readonly tokenListJsonPath;
    private readonly baseDir;
    constructor(tokenListJsonPath: string, baseDir?: string);
    listSnapshots: () => TokenRateLimitSnapshot[];
    private toModelWeeklyLimits;
}
//# sourceMappingURL=RateLimitSnapshotRepository.d.ts.map