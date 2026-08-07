import { ClaudeLiveSession } from './adapter-interfaces/ClaudeLiveSessionRepository';
import { OauthTokenCandidate, OauthTokenSelectUseCase } from './OauthTokenSelectUseCase';
export declare const LIVE_SESSION_MAX_CONCURRENT_LIMIT = 4;
export declare const LIVE_SESSION_THROTTLE_START_FREE_RATIO = 0.6;
export declare const liveSessionConcurrentLimitOf: (fiveHourFreeRatio: number, sevenDayFreeRatio: number, selectionWeight: number) => number;
export type LiveSessionOauthTokenCandidateMetrics = {
    name: string;
    fiveHourFreeRatio: number;
    sevenDayFreeRatio: number;
    sevenDayEndEpoch: number;
    liveSessionCount: number;
    concurrentSessionLimit: number;
    hasConcurrencyHeadroom: boolean;
    eligible: boolean;
    exclusionReason: string | null;
};
export type LiveSessionOauthTokenSelectResult = {
    selected: OauthTokenCandidate | null;
    metrics: LiveSessionOauthTokenCandidateMetrics[];
};
export declare class LiveSessionOauthTokenSelectUseCase {
    private readonly rateLimitSelectUseCase;
    constructor(rateLimitSelectUseCase?: OauthTokenSelectUseCase);
    run: (candidates: OauthTokenCandidate[], liveSessions: ClaudeLiveSession[], nowEpochSeconds: number) => LiveSessionOauthTokenSelectResult;
    private preferred;
    private liveSessionCountByToken;
}
//# sourceMappingURL=LiveSessionOauthTokenSelectUseCase.d.ts.map