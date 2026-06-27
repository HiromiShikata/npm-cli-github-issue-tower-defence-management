export interface ModelWeeklyLimit {
    rejected: boolean;
    resetsAt: number;
}
export interface RateLimitSnapshot {
    fiveHourUtilization: number;
    fiveHourReset: number;
    sevenDayUtilization: number;
    sevenDayReset: number;
    blocked: boolean;
    rejected: boolean;
    unifiedRejected: boolean;
    fiveHourRejected: boolean;
    sevenDayRejected: boolean;
    unifiedStatus: string | null;
    overageDisabledReason: string | null;
    modelWeeklyLimits: Record<string, ModelWeeklyLimit>;
    lastUpdatedEpoch: number;
    blockedUntilEpoch: number;
    subscriptionDisabled: boolean;
}
export declare const PROXY_PORT = 8787;
export declare const HEADERLESS_429_DEFAULT_COOLDOWN_SECONDS = 90;
export declare const HEADERLESS_429_MAX_COOLDOWN_SECONDS = 600;
export declare const PERMISSION_DISABLED_COOLDOWN_SECONDS = 3600;
export declare const cacheDir: () => string;
export declare const hashToken: (token: string) => string;
export declare const cachePathForToken: (token: string, baseDir?: string) => string;
export declare const writeRateLimit: (token: string, headers: Record<string, string | string[] | undefined>, statusCode?: number | null) => void;
export declare const writeModelRateLimit: (token: string, limits: Record<string, ModelWeeklyLimit>) => void;
export declare const writeSubscriptionDisabled: (token: string, baseDir?: string) => void;
export declare const parseModelRateLimitsFromBody: (body: string) => Record<string, ModelWeeklyLimit>;
export declare const parseModelRateLimitsFromHeaders: (headers: Record<string, string>) => Record<string, ModelWeeklyLimit>;
export declare const readRateLimit: (token: string, baseDir?: string) => RateLimitSnapshot | null;
//# sourceMappingURL=RateLimitCache.d.ts.map