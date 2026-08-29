import { TokenExhaustionHandoverState } from '../entities/TokenExhaustionHandoverState';
import { ClaudeHandoverSessionRepository } from './adapter-interfaces/ClaudeHandoverSessionRepository';
import { IssueCheckpointRepository } from './adapter-interfaces/IssueCheckpointRepository';
import { ProcessSignalRepository } from './adapter-interfaces/ProcessSignalRepository';
import { TmuxSessionRepository } from './adapter-interfaces/TmuxSessionRepository';
import { TokenRateLimitSnapshotRepository } from './adapter-interfaces/TokenRateLimitSnapshotRepository';
export declare const DEFAULT_TOKEN_EXHAUSTION_HANDOVER_MESSAGE = "TOKEN NEAR EXHAUSTION. Within 2 minutes, write a CHECKPOINT to your assigned task issue: the in-flight subagents and what each is doing, their durable refs (branch and pull request URLs), the working directory and branch, the single concrete next action to resume, and the reason (token near exhaustion). Do this WITHOUT waiting for long-running or CI-watching subagents. Then self-kill your own tmux session with `tmux kill-session`.";
export declare const DEFAULT_TOKEN_EXHAUSTION_HANDOVER_MESSAGE_BARE_NAME_LEADER = "TOKEN NEAR EXHAUSTION. You are a resident leader with no assigned task issue. Within 2 minutes, write a CHECKPOINT for every in-flight subagent (what each is doing and its durable refs = branch and pull request URLs, plus the single concrete next action to resume and the working directory and branch) into the GitHub issue that each subagent is working on, WITHOUT waiting for long-running or CI-watching subagents. Then stop and stay idle; do NOT self-kill. This session will be terminated and relaunched on a token that still has quota so its work is preserved.";
export declare const DEFAULT_TOKEN_EXHAUSTION_GRACE_PERIOD_SECONDS = 180;
export declare const TOKEN_EXHAUSTION_SNAPSHOT_STALE_THRESHOLD_SECONDS = 900;
export declare const TOKEN_EXHAUSTION_SNAPSHOT_HARD_STALE_THRESHOLD_SECONDS = 3600;
export declare const TOKEN_EXHAUSTION_FIVE_HOUR_FREE_THRESHOLD = 0.1;
export declare const TOKEN_EXHAUSTION_SEVEN_DAY_FREE_THRESHOLD = 0.05;
export declare const TOKEN_EXHAUSTION_FIVE_HOUR_WARNING_FREE_THRESHOLD = 0.25;
export declare const TOKEN_EXHAUSTION_SEVEN_DAY_WARNING_FREE_THRESHOLD = 0.15;
export type TokenExhaustionHandoverInput = {
    enabled: boolean;
    issueUrlLeaderMessage: string;
    bareNameLeaderMessage: string;
    gracePeriodSeconds: number;
    state: TokenExhaustionHandoverState;
    now: Date;
};
export type TokenExhaustionHandoverResult = {
    newlyHandoverSentSessionNames: string[];
    killedSessionNames: string[];
    terminatedPids: number[];
    relaunchedLeaderNames: string[];
    leftAliveSessionNames: string[];
    skippedWorkspacePreparationSessionNames: string[];
    state: TokenExhaustionHandoverState;
};
export declare class TokenExhaustionHandoverUseCase {
    private readonly handoverSessionRepository;
    private readonly snapshotRepository;
    private readonly tmuxSessionRepository;
    private readonly processSignalRepository;
    private readonly issueCheckpointRepository;
    constructor(handoverSessionRepository: Pick<ClaudeHandoverSessionRepository, 'listHandoverSessions'>, snapshotRepository: Pick<TokenRateLimitSnapshotRepository, 'listSnapshots'>, tmuxSessionRepository: Pick<TmuxSessionRepository, 'sendKeys' | 'killSession' | 'listLiveSessionNames' | 'launchBareNameLeaderSession'>, processSignalRepository: ProcessSignalRepository, issueCheckpointRepository: Pick<IssueCheckpointRepository, 'postCheckpoint'>);
    run: (input: TokenExhaustionHandoverInput) => Promise<TokenExhaustionHandoverResult>;
    private needsRelaunch;
    private relaunchBareNameLeader;
    private sendHandover;
    private forceKill;
    private stateKeyFor;
    private displayName;
    private isFresherTokenAvailable;
    private evaluateSnapshot;
    private freeRatio;
    private clamp01;
    private isWeeklyCapped;
}
//# sourceMappingURL=TokenExhaustionHandoverUseCase.d.ts.map