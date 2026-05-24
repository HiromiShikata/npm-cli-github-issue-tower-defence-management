import { RateLimitCacheRepository } from './adapter-interfaces/RateLimitCacheRepository';
export declare class UpdateRateLimitCacheUseCase {
    private readonly rateLimitCacheRepository;
    constructor(rateLimitCacheRepository: RateLimitCacheRepository);
    run: (params: {
        nowEpochSeconds: number;
    }) => Promise<void>;
}
//# sourceMappingURL=UpdateRateLimitCacheUseCase.d.ts.map