"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OauthTokenSelectUseCase = exports.selectWeightedCandidate = exports.sevenDayUrgencyFactor = exports.MIN_HOURS_TO_RESET = exports.SEVEN_DAY_WINDOW_HOURS = exports.CL_SCRIPT_OAUTH_TOKEN_SELECTION_THRESHOLDS = exports.DEFAULT_OAUTH_TOKEN_SELECTION_THRESHOLDS = exports.SEVEN_DAY_MIN_FREE_RATIO = exports.FIVE_HOUR_MIN_FREE_RATIO = exports.selectionWeightOf = exports.DEFAULT_SELECTION_WEIGHT = void 0;
exports.DEFAULT_SELECTION_WEIGHT = 1;
const selectionWeightOf = (candidate) => {
    const weight = candidate.selectionWeight ?? exports.DEFAULT_SELECTION_WEIGHT;
    return weight > 0 ? weight : 0;
};
exports.selectionWeightOf = selectionWeightOf;
const SECONDS_PER_DAY = 86400;
const SEVEN_DAYS_IN_SECONDS = 7 * SECONDS_PER_DAY;
exports.FIVE_HOUR_MIN_FREE_RATIO = 0.25;
exports.SEVEN_DAY_MIN_FREE_RATIO = 0.01;
exports.DEFAULT_OAUTH_TOKEN_SELECTION_THRESHOLDS = {
    fiveHourMinFreeRatio: exports.FIVE_HOUR_MIN_FREE_RATIO,
    sevenDayMinFreeRatio: exports.SEVEN_DAY_MIN_FREE_RATIO,
};
exports.CL_SCRIPT_OAUTH_TOKEN_SELECTION_THRESHOLDS = {
    fiveHourMinFreeRatio: 0.6,
    sevenDayMinFreeRatio: 0.14,
};
exports.SEVEN_DAY_WINDOW_HOURS = 168;
exports.MIN_HOURS_TO_RESET = 1;
const SECONDS_PER_HOUR = 3600;
const sevenDayUrgencyFactor = (sevenDayFreeRatio, sevenDayEndEpoch, nowEpochSeconds) => {
    const hoursToReset = Math.max((sevenDayEndEpoch - nowEpochSeconds) / SECONDS_PER_HOUR, exports.MIN_HOURS_TO_RESET);
    return sevenDayFreeRatio * (exports.SEVEN_DAY_WINDOW_HOURS / hoursToReset);
};
exports.sevenDayUrgencyFactor = sevenDayUrgencyFactor;
const selectWeightedCandidate = (eligible, weightOf, deterministicBest, random) => {
    if (eligible.length <= 1) {
        return deterministicBest;
    }
    const weights = eligible.map((entry) => Math.max(weightOf(entry), 0));
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    const uniform = weights.every((weight) => weight === weights[0]);
    if (uniform || totalWeight <= 0) {
        return deterministicBest;
    }
    let threshold = random() * totalWeight;
    for (let index = 0; index < eligible.length; index += 1) {
        threshold -= weights[index];
        if (threshold < 0) {
            return eligible[index];
        }
    }
    return eligible[eligible.length - 1];
};
exports.selectWeightedCandidate = selectWeightedCandidate;
class OauthTokenSelectUseCase {
    constructor() {
        this.run = (candidates, nowEpochSeconds, random = Math.random, thresholds = exports.DEFAULT_OAUTH_TOKEN_SELECTION_THRESHOLDS) => {
            const evaluated = candidates.map((candidate) => {
                const evaluatedMetric = this.evaluate(candidate, nowEpochSeconds, thresholds);
                return {
                    candidate,
                    metric: {
                        ...evaluatedMetric,
                        drawWeight: evaluatedMetric.eligible
                            ? (0, exports.selectionWeightOf)(candidate) *
                                (0, exports.sevenDayUrgencyFactor)(evaluatedMetric.sevenDayFreeRatio, evaluatedMetric.sevenDayEndEpoch, nowEpochSeconds)
                            : 0,
                    },
                };
            });
            const eligible = evaluated.filter((entry) => entry.metric.eligible);
            const metrics = evaluated.map((entry) => entry.metric);
            if (eligible.length === 0) {
                return { selected: null, metrics };
            }
            const deterministicBest = eligible.reduce((bestEntry, currentEntry) => currentEntry.metric.sevenDayEndEpoch < bestEntry.metric.sevenDayEndEpoch
                ? currentEntry
                : bestEntry);
            const selected = (0, exports.selectWeightedCandidate)(eligible, (entry) => entry.metric.drawWeight, deterministicBest, random);
            return { selected: selected.candidate, metrics };
        };
        this.evaluate = (candidate, nowEpochSeconds, thresholds) => {
            const fiveHourFreeRatio = this.fiveHourFreeRatio(candidate.snapshot, nowEpochSeconds);
            const sevenDayFreeRatio = this.sevenDayFreeRatio(candidate.snapshot, nowEpochSeconds);
            const sevenDayEndEpoch = this.sevenDayEndEpoch(candidate.snapshot, nowEpochSeconds);
            const exclusionReason = this.exclusionReason(candidate.subscriptionDisabled, candidate.unifiedRejected, candidate.fableRejected, fiveHourFreeRatio, sevenDayFreeRatio, thresholds);
            return {
                name: candidate.name,
                fiveHourFreeRatio,
                sevenDayFreeRatio,
                sevenDayEndEpoch,
                eligible: exclusionReason === null,
                exclusionReason,
            };
        };
        this.exclusionReason = (subscriptionDisabled, unifiedRejected, fableRejected, fiveHourFreeRatio, sevenDayFreeRatio, thresholds) => {
            if (subscriptionDisabled) {
                return 'organization has disabled Claude subscription access for Claude Code';
            }
            if (unifiedRejected) {
                return 'token request was rejected (anthropic-ratelimit-unified-status: rejected)';
            }
            if (fableRejected) {
                return 'fable weekly limit exhausted (a fable request was rejected with HTTP 429)';
            }
            if (fiveHourFreeRatio < thresholds.fiveHourMinFreeRatio) {
                return `5h window only ${this.toPercent(fiveHourFreeRatio)}% free (requires >= ${this.toPercent(thresholds.fiveHourMinFreeRatio)}%)`;
            }
            if (sevenDayFreeRatio < thresholds.sevenDayMinFreeRatio) {
                return `7d window only ${this.toPercent(sevenDayFreeRatio)}% free (requires >= ${this.toPercent(thresholds.sevenDayMinFreeRatio)}%)`;
            }
            return null;
        };
        this.fiveHourFreeRatio = (snapshot, nowEpochSeconds) => {
            if (snapshot === null) {
                return 1;
            }
            if (this.windowExpired(snapshot.fiveHourReset, nowEpochSeconds)) {
                return 1;
            }
            return this.freeRatioFromUtilization(snapshot.fiveHourUtilization);
        };
        this.sevenDayFreeRatio = (snapshot, nowEpochSeconds) => {
            if (snapshot === null) {
                return 1;
            }
            if (this.windowExpired(snapshot.sevenDayReset, nowEpochSeconds)) {
                return 1;
            }
            return this.freeRatioFromUtilization(snapshot.sevenDayUtilization);
        };
        this.sevenDayEndEpoch = (snapshot, nowEpochSeconds) => {
            if (snapshot === null) {
                return nowEpochSeconds + SEVEN_DAYS_IN_SECONDS;
            }
            if (snapshot.sevenDayReset <= 0) {
                return nowEpochSeconds + SEVEN_DAYS_IN_SECONDS;
            }
            if (this.windowExpired(snapshot.sevenDayReset, nowEpochSeconds)) {
                return nowEpochSeconds + SEVEN_DAYS_IN_SECONDS;
            }
            return snapshot.sevenDayReset;
        };
        this.windowExpired = (resetEpoch, nowEpochSeconds) => resetEpoch > 0 && nowEpochSeconds > resetEpoch;
        this.freeRatioFromUtilization = (utilization) => {
            const bounded = Math.min(Math.max(utilization, 0), 1);
            return 1 - bounded;
        };
        this.toPercent = (ratio) => Math.round(ratio * 100);
    }
}
exports.OauthTokenSelectUseCase = OauthTokenSelectUseCase;
//# sourceMappingURL=OauthTokenSelectUseCase.js.map