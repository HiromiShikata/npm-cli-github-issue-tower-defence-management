"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateRateLimitCacheUseCase = void 0;
class UpdateRateLimitCacheUseCase {
    constructor(rateLimitCacheRepository) {
        this.rateLimitCacheRepository = rateLimitCacheRepository;
        this.run = async (params) => {
            const caches = this.rateLimitCacheRepository.getTokenRateLimitCaches();
            for (const cache of caches) {
                if (cache.unifiedReset < params.nowEpochSeconds) {
                    await this.rateLimitCacheRepository.probeToken(cache.token);
                }
            }
        };
    }
}
exports.UpdateRateLimitCacheUseCase = UpdateRateLimitCacheUseCase;
//# sourceMappingURL=UpdateRateLimitCacheUseCase.js.map