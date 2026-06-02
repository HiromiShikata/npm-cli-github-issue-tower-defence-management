export interface TokenRateLimitCache {
    token: string;
    unifiedReset: number;
    lastProbeEpoch: number;
}
export interface RateLimitCacheRepository {
    getTokenRateLimitCaches: () => TokenRateLimitCache[];
    probeToken: (token: string) => Promise<void>;
}
//# sourceMappingURL=RateLimitCacheRepository.d.ts.map