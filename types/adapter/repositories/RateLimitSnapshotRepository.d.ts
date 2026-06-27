import { TokenRateLimitSnapshotRepository } from '../../domain/usecases/adapter-interfaces/TokenRateLimitSnapshotRepository';
import { TokenRateLimitSnapshot } from '../../domain/usecases/adapter-interfaces/TokenRateLimitSnapshotRepository';
export declare class RateLimitSnapshotRepository implements TokenRateLimitSnapshotRepository {
    private readonly baseDir;
    constructor(baseDir?: string);
    getSnapshot: (token: string) => TokenRateLimitSnapshot | null;
}
//# sourceMappingURL=RateLimitSnapshotRepository.d.ts.map