"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LiveSessionOauthTokenSelectUseCase = void 0;
const OauthTokenSelectUseCase_1 = require("./OauthTokenSelectUseCase");
class LiveSessionOauthTokenSelectUseCase {
    constructor(rateLimitSelectUseCase = new OauthTokenSelectUseCase_1.OauthTokenSelectUseCase()) {
        this.rateLimitSelectUseCase = rateLimitSelectUseCase;
        this.run = (candidates, liveSessions, nowEpochSeconds) => {
            const rateLimitResult = this.rateLimitSelectUseCase.run(candidates, nowEpochSeconds);
            const liveSessionCountByToken = this.liveSessionCountByToken(liveSessions);
            const evaluated = candidates.map((candidate, index) => {
                const rateLimitMetric = rateLimitResult.metrics[index];
                const liveSessionCount = liveSessionCountByToken.get(candidate.token) ?? 0;
                return {
                    candidate,
                    metric: {
                        name: rateLimitMetric.name,
                        fiveHourFreeRatio: rateLimitMetric.fiveHourFreeRatio,
                        sevenDayFreeRatio: rateLimitMetric.sevenDayFreeRatio,
                        sevenDayEndEpoch: rateLimitMetric.sevenDayEndEpoch,
                        liveSessionCount,
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
            const best = eligible.reduce((bestEntry, currentEntry) => this.preferred(currentEntry.metric, bestEntry.metric)
                ? currentEntry
                : bestEntry);
            return { selected: best.candidate, metrics };
        };
        this.preferred = (candidateMetric, incumbentMetric) => {
            if (candidateMetric.liveSessionCount !== incumbentMetric.liveSessionCount) {
                return (candidateMetric.liveSessionCount < incumbentMetric.liveSessionCount);
            }
            return candidateMetric.sevenDayEndEpoch < incumbentMetric.sevenDayEndEpoch;
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