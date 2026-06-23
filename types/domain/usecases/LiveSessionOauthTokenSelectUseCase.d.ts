import { ClaudeLiveSession } from './adapter-interfaces/ClaudeLiveSessionRepository';
import { OauthTokenCandidate, OauthTokenSelectUseCase } from './OauthTokenSelectUseCase';
export type LiveSessionOauthTokenCandidateMetrics = {
    name: string;
    fiveHourFreeRatio: number;
    sevenDayFreeRatio: number;
    sevenDayEndEpoch: number;
    liveSessionCount: number;
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