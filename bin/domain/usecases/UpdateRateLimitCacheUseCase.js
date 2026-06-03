"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateRateLimitCacheUseCase = void 0;
const HOURLY_PROBE_INTERVAL_SECONDS = 3600;
class UpdateRateLimitCacheUseCase {
    constructor(rateLimitCacheRepository) {
        this.rateLimitCacheRepository = rateLimitCacheRepository;
        this.run = async (params) => {
            const caches = this.rateLimitCacheRepository.getTokenRateLimitCaches();
            for (const cache of caches) {
                const unifiedResetExpired = cache.unifiedReset < params.nowEpochSeconds;
                const hourlyProbeDue = params.nowEpochSeconds - cache.lastProbeEpoch >=
                    HOURLY_PROBE_INTERVAL_SECONDS;
                if (unifiedResetExpired || hourlyProbeDue) {
                    await this.rateLimitCacheRepository.probeToken(cache.token);
                }
            }
        };
    }
}
exports.UpdateRateLimitCacheUseCase = UpdateRateLimitCacheUseCase;
//# sourceMappingURL=UpdateRateLimitCacheUseCase.js.map