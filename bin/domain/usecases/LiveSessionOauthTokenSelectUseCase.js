"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LiveSessionOauthTokenSelectUseCase = exports.liveSessionConcurrentLimitOf = exports.DEFAULT_LIVE_SESSION_OAUTH_TOKEN_SELECTION_SETTINGS = void 0;
const OauthTokenSelectUseCase_1 = require("./OauthTokenSelectUseCase");
exports.DEFAULT_LIVE_SESSION_OAUTH_TOKEN_SELECTION_SETTINGS = {
    maxConcurrentSessionCount: 10,
    fullSpeedFiveHourFreeRatio: 0.5,
};
const liveSessionConcurrentLimitOf = (fiveHourFreeRatio, selectionWeight, settings) => {
    const fiveHourThrottleFactor = Math.min(fiveHourFreeRatio / settings.fullSpeedFiveHourFreeRatio, 1);
    return Math.max(Math.floor(settings.maxConcurrentSessionCount *
        selectionWeight *
        fiveHourThrottleFactor), 1);
};
exports.liveSessionConcurrentLimitOf = liveSessionConcurrentLimitOf;
class LiveSessionOauthTokenSelectUseCase {
    constructor(rateLimitSelectUseCase = new OauthTokenSelectUseCase_1.OauthTokenSelectUseCase()) {
        this.rateLimitSelectUseCase = rateLimitSelectUseCase;
        this.run = (candidates, liveSessions, nowEpochSeconds, settings) => {
            const rateLimitResult = this.rateLimitSelectUseCase.run(candidates, nowEpochSeconds, () => 0);
            const liveSessionCountByToken = this.liveSessionCountByToken(liveSessions);
            const evaluated = candidates.map((candidate, index) => {
                const rateLimitMetric = rateLimitResult.metrics[index];
                const liveSessionCount = liveSessionCountByToken.get(candidate.token) ?? 0;
                const concurrentSessionLimit = (0, exports.liveSessionConcurrentLimitOf)(rateLimitMetric.fiveHourFreeRatio, (0, OauthTokenSelectUseCase_1.selectionWeightOf)(candidate), settings);
                return {
                    candidate,
                    metric: {
                        name: rateLimitMetric.name,
                        fiveHourFreeRatio: rateLimitMetric.fiveHourFreeRatio,
                        sevenDayFreeRatio: rateLimitMetric.sevenDayFreeRatio,
                        sevenDayEndEpoch: rateLimitMetric.sevenDayEndEpoch,
                        liveSessionCount,
                        concurrentSessionLimit,
                        hasConcurrencyHeadroom: liveSessionCount < concurrentSessionLimit,
                        eligible: rateLimitMetric.eligible,
                        exclusionReason: rateLimitMetric.exclusionReason,
                    },
                };
            });
            const metrics = evaluated.map((entry) => entry.metric);
            const eligible = evaluated.filter((entry) => entry.metric.eligible);
            if (eligible.length === 0) {
                return { selected: null, metrics };
            }
            const selected = eligible.reduce((bestEntry, currentEntry) => this.preferred(currentEntry.metric, bestEntry.metric)
                ? currentEntry
                : bestEntry);
            return { selected: selected.candidate, metrics };
        };
        this.preferred = (candidateMetric, incumbentMetric) => {
            if (candidateMetric.hasConcurrencyHeadroom !==
                incumbentMetric.hasConcurrencyHeadroom) {
                return candidateMetric.hasConcurrencyHeadroom;
            }
            if (candidateMetric.sevenDayEndEpoch !== incumbentMetric.sevenDayEndEpoch) {
                return (candidateMetric.sevenDayEndEpoch < incumbentMetric.sevenDayEndEpoch);
            }
            return candidateMetric.liveSessionCount < incumbentMetric.liveSessionCount;
        };
        this.liveSessionCountByToken = (liveSessions) => {
            const sessionKeysByToken = new Map();
            for (const liveSession of liveSessions) {
                const sessionKeys = sessionKeysByToken.get(liveSession.token) ?? new Set();
                sessionKeys.add(liveSession.sessionKey);
                sessionKeysByToken.set(liveSession.token, sessionKeys);
            }
            const countByToken = new Map();
            for (const [token, sessionKeys] of sessionKeysByToken.entries()) {
                countByToken.set(token, sessionKeys.size);
            }
            return countByToken;
        };
    }
}
exports.LiveSessionOauthTokenSelectUseCase = LiveSessionOauthTokenSelectUseCase;
//# sourceMappingURL=LiveSessionOauthTokenSelectUseCase.js.map