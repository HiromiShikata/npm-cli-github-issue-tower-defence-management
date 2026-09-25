export interface TokenRateLimitCache {
  token: string;
  unifiedReset: number;
  sevenDayReset: number;
  lastProbeEpoch: number;
}

export interface RateLimitCacheRepository {
  getTokenRateLimitCaches: () => TokenRateLimitCache[];
  probeToken: (token: string) => Promise<void>;
}
