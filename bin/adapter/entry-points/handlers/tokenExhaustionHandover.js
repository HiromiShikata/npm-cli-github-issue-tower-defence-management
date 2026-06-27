"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_HANDLE_TOKEN_EXHAUSTION_HANDOVER_PARAMS = exports.handleTokenExhaustionHandover = void 0;
const TokenExhaustionHandoverUseCase_1 = require("../../../domain/usecases/intmux/TokenExhaustionHandoverUseCase");
const NodeTmuxSessionRepository_1 = require("../../repositories/NodeTmuxSessionRepository");
const ProcClaudeInteractiveSessionRepository_1 = require("../../repositories/ProcClaudeInteractiveSessionRepository");
const RateLimitSnapshotRepository_1 = require("../../repositories/RateLimitSnapshotRepository");
const sentHandoverTimestamps = new Map();
const handleTokenExhaustionHandover = async (params) => {
    const { enabled, localCommandRunner, handoverMessageText, gracePeriodSeconds, rateLimitStaleThresholdSeconds, tokenRateLimitSnapshotBaseDir, nowEpochSeconds, } = params;
    const useCase = new TokenExhaustionHandoverUseCase_1.TokenExhaustionHandoverUseCase(new ProcClaudeInteractiveSessionRepository_1.ProcClaudeInteractiveSessionRepository(), tokenRateLimitSnapshotBaseDir !== null
        ? new RateLimitSnapshotRepository_1.RateLimitSnapshotRepository(tokenRateLimitSnapshotBaseDir)
        : new RateLimitSnapshotRepository_1.RateLimitSnapshotRepository(), new NodeTmuxSessionRepository_1.NodeTmuxSessionRepository(localCommandRunner));
    const result = await useCase.run({
        nowEpochSeconds,
        handoverMessageText,
        gracePeriodSeconds,
        rateLimitStaleThresholdSeconds,
        dryRun: !enabled,
        sentHandoverTimestamps,
    });
    if (result.handoverInitiatedIssueUrls.length > 0) {
        console.log(`Token exhaustion handover initiated for: ${result.handoverInitiatedIssueUrls.join(', ')}`);
    }
    if (result.killedIssueUrls.length > 0) {
        console.log(`Token exhaustion: killed sessions after grace period: ${result.killedIssueUrls.join(', ')}`);
    }
};
exports.handleTokenExhaustionHandover = handleTokenExhaustionHandover;
exports.DEFAULT_HANDLE_TOKEN_EXHAUSTION_HANDOVER_PARAMS = {
    handoverMessageText: TokenExhaustionHandoverUseCase_1.DEFAULT_HANDOVER_MESSAGE,
    gracePeriodSeconds: TokenExhaustionHandoverUseCase_1.DEFAULT_GRACE_PERIOD_SECONDS,
    rateLimitStaleThresholdSeconds: TokenExhaustionHandoverUseCase_1.DEFAULT_RATE_LIMIT_STALE_THRESHOLD_SECONDS,
};
//# sourceMappingURL=tokenExhaustionHandover.js.map