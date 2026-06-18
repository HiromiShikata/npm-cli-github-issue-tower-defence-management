"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OauthTokenSelectUseCase = void 0;
const SECONDS_PER_DAY = 86400;
const SEVEN_DAYS_IN_SECONDS = 7 * SECONDS_PER_DAY;
const FIVE_HOUR_MIN_FREE_RATIO = 0.6;
const SEVEN_DAY_MIN_FREE_RATIO = 0.3;
class OauthTokenSelectUseCase {
    constructor() {
        this.run = (candidates, nowEpochSeconds) => {
            const evaluated = candidates.map((candidate) => ({
                candidate,
                metric: this.evaluate(candidate, nowEpochSeconds),
            }));
            const metrics = evaluated.map((entry) => entry.metric);
            const eligible = evaluated.filter((entry) => entry.metric.eligible);
            if (eligible.length === 0) {
                return { selected: null, metrics };
            }
            const best = eligible.reduce((bestEntry, currentEntry) => currentEntry.metric.sevenDayEndEpoch < bestEntry.metric.sevenDayEndEpoch
                ? currentEntry
                : bestEntry);
            return { selected: best.candidate, metrics };
        };
        this.evaluate = (candidate, nowEpochSeconds) => {
            const fiveHourFreeRatio = this.fiveHourFreeRatio(candidate.snapshot, nowEpochSeconds);
            const sevenDayFreeRatio = this.sevenDayFreeRatio(candidate.snapshot, nowEpochSeconds);
            const sevenDayEndEpoch = this.sevenDayEndEpoch(candidate.snapshot, nowEpochSeconds);
            const exclusionReason = this.exclusionReason(fiveHourFreeRatio, sevenDayFreeRatio);
            return {
                name: candidate.name,
                fiveHourFreeRatio,
                sevenDayFreeRatio,
                sevenDayEndEpoch,
                eligible: exclusionReason === null,
                exclusionReason,
            };
        };
        this.exclusionReason = (fiveHourFreeRatio, sevenDayFreeRatio) => {
            if (fiveHourFreeRatio < FIVE_HOUR_MIN_FREE_RATIO) {
                return `5h window only ${this.toPercent(fiveHourFreeRatio)}% free (requires >= ${this.toPercent(FIVE_HOUR_MIN_FREE_RATIO)}%)`;
            }
            if (sevenDayFreeRatio < SEVEN_DAY_MIN_FREE_RATIO) {
                return `7d window only ${this.toPercent(sevenDayFreeRatio)}% free (requires >= ${this.toPercent(SEVEN_DAY_MIN_FREE_RATIO)}%)`;
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