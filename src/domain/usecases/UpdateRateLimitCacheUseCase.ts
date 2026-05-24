import { RateLimitCacheRepository } from './adapter-interfaces/RateLimitCacheRepository';

export class UpdateRateLimitCacheUseCase {
  constructor(
    private readonly rateLimitCacheRepository: RateLimitCacheRepository,
  ) {}

  run = async (params: { nowEpochSeconds: number }): Promise<void> => {
    const caches =
      this.rateLimitCacheRepository.getTokenRateLimitCaches();
    for (const cache of caches) {
      if (cache.unifiedReset < params.nowEpochSeconds) {
        await this.rateLimitCacheRepository.probeToken(cache.token);
      }
    }
  };
}
