import { RateLimitCacheRepository } from './adapter-interfaces/RateLimitCacheRepository';

const HOURLY_PROBE_INTERVAL_SECONDS = 3600;

export class UpdateRateLimitCacheUseCase {
  constructor(
    private readonly rateLimitCacheRepository: RateLimitCacheRepository,
  ) {}

  run = async (params: { nowEpochSeconds: number }): Promise<void> => {
    const caches = this.rateLimitCacheRepository.getTokenRateLimitCaches();
    for (const cache of caches) {
      const unifiedResetExpired = cache.unifiedReset < params.nowEpochSeconds;
      const hourlyProbeDue =
        params.nowEpochSeconds - cache.lastProbeEpoch >=
        HOURLY_PROBE_INTERVAL_SECONDS;
      if (unifiedResetExpired || hourlyProbeDue) {
        await this.rateLimitCacheRepository.probeToken(cache.token);
      }
    }
  };
}
