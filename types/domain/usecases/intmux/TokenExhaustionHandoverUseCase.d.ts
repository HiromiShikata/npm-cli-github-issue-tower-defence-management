import { ClaudeInteractiveSessionRepository } from '../adapter-interfaces/ClaudeInteractiveSessionRepository';
import { TokenRateLimitSnapshotRepository } from '../adapter-interfaces/TokenRateLimitSnapshotRepository';
import { TmuxSessionRepository } from '../adapter-interfaces/TmuxSessionRepository';
export declare const DEFAULT_HANDOVER_MESSAGE = "Your API token quota is exhausted. Please initiate the handover protocol to transfer to a fresh token.";
export declare const DEFAULT_GRACE_PERIOD_SECONDS = 180;
export declare const DEFAULT_RATE_LIMIT_STALE_THRESHOLD_SECONDS = 900;
export declare const FIVE_HOUR_EXHAUSTION_THRESHOLD = 0.9;
export declare const SEVEN_DAY_EXHAUSTION_THRESHOLD = 0.95;
export type TokenExhaustionHandoverInput = {
    nowEpochSeconds: number;
    handoverMessageText: string;
    gracePeriodSeconds: number;
    rateLimitStaleThresholdSeconds: number;
    dryRun: boolean;
    sentHandoverTimestamps: Map<string, number>;
};
export type TokenExhaustionHandoverResult = {
    handoverInitiatedIssueUrls: string[];
    killedIssueUrls: string[];
};
export declare class TokenExhaustionHandoverUseCase {
    private readonly claudeInteractiveSessionRepository;
    private readonly tokenRateLimitSnapshotRepository;
    private readonly tmuxSessionRepository;
    constructor(claudeInteractiveSessionRepository: ClaudeInteractiveSessionRepository, tokenRateLimitSnapshotRepository: TokenRateLimitSnapshotRepository, tmuxSessionRepository: TmuxSessionRepository);
    run: (input: TokenExhaustionHandoverInput) => Promise<TokenExhaustionHandoverResult>;
    private isExhausted;
}
//# sourceMappingURL=TokenExhaustionHandoverUseCase.d.ts.map