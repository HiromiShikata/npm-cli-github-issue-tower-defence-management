export interface RateLimitSnapshot {
    fiveHourUtilization: number;
    fiveHourReset: number;
    sevenDayUtilization: number;
    sevenDayReset: number;
    blocked: boolean;
    rejected: boolean;
}
export declare const PROXY_PORT = 8787;
export declare const cacheDir: () => string;
export declare const hashToken: (token: string) => string;
export declare const cachePathForToken: (token: string) => string;
export declare const writeRateLimit: (token: string, headers: Record<string, string | string[] | undefined>) => void;
export declare const readRateLimit: (token: string) => RateLimitSnapshot | null;
//# sourceMappingURL=RateLimitCache.d.ts.map