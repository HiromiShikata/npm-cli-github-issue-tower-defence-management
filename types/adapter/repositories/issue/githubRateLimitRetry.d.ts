export declare const RATE_LIMIT_MAX_RETRIES = 3;
export declare const RATE_LIMIT_TOTAL_BACKOFF_CAP_MS = 5000;
export declare const RATE_LIMIT_BASE_BACKOFF_MS = 250;
export type Sleep = (milliseconds: number) => Promise<void>;
export declare const realSleep: Sleep;
export declare const hasRateLimitSignals: (status: number, headers: Headers, bodyText: string) => boolean;
export declare const computeRateLimitResetIso: (headers: Headers) => string | null;
export declare const computeBoundedBackoffMs: (headers: Headers, attempt: number, elapsedMs: number) => number;
export declare const fetchWithGitHubRateLimitRetry: (request: () => Promise<Response>, sleep?: Sleep, now?: () => number) => Promise<Response>;
//# sourceMappingURL=githubRateLimitRetry.d.ts.map