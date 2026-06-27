"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenExhaustionHandoverUseCase = exports.SEVEN_DAY_EXHAUSTION_THRESHOLD = exports.FIVE_HOUR_EXHAUSTION_THRESHOLD = exports.DEFAULT_RATE_LIMIT_STALE_THRESHOLD_SECONDS = exports.DEFAULT_GRACE_PERIOD_SECONDS = exports.DEFAULT_HANDOVER_MESSAGE = void 0;
const InTmuxByHumanSessionReconcileUseCase_1 = require("./InTmuxByHumanSessionReconcileUseCase");
exports.DEFAULT_HANDOVER_MESSAGE = 'Your API token quota is exhausted. Please initiate the handover protocol to transfer to a fresh token.';
exports.DEFAULT_GRACE_PERIOD_SECONDS = 180;
exports.DEFAULT_RATE_LIMIT_STALE_THRESHOLD_SECONDS = 900;
exports.FIVE_HOUR_EXHAUSTION_THRESHOLD = 0.9;
exports.SEVEN_DAY_EXHAUSTION_THRESHOLD = 0.95;
class TokenExhaustionHandoverUseCase {
    constructor(claudeInteractiveSessionRepository, tokenRateLimitSnapshotRepository, tmuxSessionRepository) {
        this.claudeInteractiveSessionRepository = claudeInteractiveSessionRepository;
        this.tokenRateLimitSnapshotRepository = tokenRateLimitSnapshotRepository;
        this.tmuxSessionRepository = tmuxSessionRepository;
        this.run = async (input) => {
            const { nowEpochSeconds, handoverMessageText, gracePeriodSeconds, rateLimitStaleThresholdSeconds, dryRun, sentHandoverTimestamps, } = input;
            const sessions = this.claudeInteractiveSessionRepository.listInteractiveSessions();
            const handoverInitiatedIssueUrls = [];
            const killedIssueUrls = [];
            for (const session of sessions) {
                const snapshot = this.tokenRateLimitSnapshotRepository.getSnapshot(session.token);
                if (snapshot === null) {
                    continue;
                }
                if (nowEpochSeconds - snapshot.lastUpdatedEpoch >
                    rateLimitStaleThresholdSeconds) {
                    continue;
                }
                if (!this.isExhausted(snapshot, nowEpochSeconds)) {
                    continue;
                }
                const sessionName = (0, InTmuxByHumanSessionReconcileUseCase_1.toTmuxSessionName)(session.issueUrl);
                const previousSendTime = sentHandoverTimestamps.get(session.issueUrl);
                if (previousSendTime === undefined) {
                    if (!dryRun) {
                        await this.tmuxSessionRepository.sendKeys(sessionName, handoverMessageText);
                    }
                    sentHandoverTimestamps.set(session.issueUrl, nowEpochSeconds);
                    handoverInitiatedIssueUrls.push(session.issueUrl);
                    continue;
                }
                const elapsedSinceHandover = nowEpochSeconds - previousSendTime;
                if (elapsedSinceHandover >= gracePeriodSeconds) {
                    if (!dryRun) {
                        try {
                            await this.tmuxSessionRepository.killSession(sessionName);
                        }
                        catch (error) {
                            console.warn(`Token exhaustion handover: killSession failed for "${sessionName}" (session may have already exited): ${error instanceof Error ? error.message : String(error)}`);
                        }
                    }
                    sentHandoverTimestamps.delete(session.issueUrl);
                    killedIssueUrls.push(session.issueUrl);
                }
            }
            return { handoverInitiatedIssueUrls, killedIssueUrls };
        };
        this.isExhausted = (snapshot, nowEpochSeconds) => snapshot.fiveHourUtilization >= exports.FIVE_HOUR_EXHAUSTION_THRESHOLD ||
            snapshot.sevenDayUtilization >= exports.SEVEN_DAY_EXHAUSTION_THRESHOLD ||
            snapshot.blocked ||
            snapshot.rejected ||
            snapshot.blockedUntilEpoch > nowEpochSeconds;
    }
}
exports.TokenExhaustionHandoverUseCase = TokenExhaustionHandoverUseCase;
//# sourceMappingURL=TokenExhaustionHandoverUseCase.js.map