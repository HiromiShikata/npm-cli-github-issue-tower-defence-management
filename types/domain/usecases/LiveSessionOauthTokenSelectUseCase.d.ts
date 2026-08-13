import type { ClaudeLiveSession } from './adapter-interfaces/ClaudeLiveSessionRepository';
import { type OauthTokenCandidate, OauthTokenSelectUseCase } from './OauthTokenSelectUseCase';
export type LiveSessionOauthTokenSelectionSettings = {
    maxConcurrentSessionCount: number;
    fullSpeedFiveHourFreeRatio: number;
};
export declare const DEFAULT_LIVE_SESSION_OAUTH_TOKEN_SELECTION_SETTINGS: LiveSessionOauthTokenSelectionSettings;
export declare const liveSessionConcurrentLimitOf: (fiveHourFreeRatio: number, selectionWeight: number, settings: LiveSessionOauthTokenSelectionSettings) => number;
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
    selectionWeight: number;
};
export type LiveSessionOauthTokenSelectResult = {
    selected: OauthTokenCandidate | null;
    metrics: LiveSessionOauthTokenCandidateMetrics[];
};
export declare class LiveSessionOauthTokenSelectUseCase {
    private readonly rateLimitSelectUseCase;
    constructor(rateLimitSelectUseCase?: OauthTokenSelectUseCase);
    run: (candidates: OauthTokenCandidate[], liveSessions: ClaudeLiveSession[], nowEpochSeconds: number, settings: LiveSessionOauthTokenSelectionSettings) => LiveSessionOauthTokenSelectResult;
    private preferred;
    private liveSessionCountByToken;
}
//# sourceMappingURL=LiveSessionOauthTokenSelectUseCase.d.ts.map