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
    modelWeeklyLimits: Record<string, ModelWeeklyLimit>;
}
export declare const PROXY_PORT = 8787;
export declare const cacheDir: () => string;
export declare const hashToken: (token: string) => string;
export declare const cachePathForToken: (token: string) => string;
export declare const writeRateLimit: (token: string, headers: Record<string, string | string[] | undefined>) => void;
export declare const writeModelRateLimit: (token: string, limits: Record<string, ModelWeeklyLimit>) => void;
export declare const parseModelRateLimitsFromBody: (body: string) => Record<string, ModelWeeklyLimit>;
export declare const readRateLimit: (token: string) => RateLimitSnapshot | null;
//# sourceMappingURL=RateLimitCache.d.ts.map