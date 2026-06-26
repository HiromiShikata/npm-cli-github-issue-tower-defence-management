"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GenerateTokenStatusUseCase = exports.judgeTokenColor = void 0;
const HIGH_UTILIZATION_THRESHOLD = 0.7;
const ALLOWED_WARNING_STATUS = 'allowed_warning';
const judgeTokenColor = (decision) => {
    if (decision === null || decision.partial) {
        return 'Y';
    }
    const fiveHourUtilization = decision.fiveHourUtilization ?? 0;
    const sevenDayUtilization = decision.sevenDayUtilization ?? 0;
    const fiveHourExhausted = fiveHourUtilization >= 1.0 || decision.fiveHourRejected;
    const generalSevenDayRejected = decision.sevenDayRejected;
    const bothModelsSevenDayRejected = decision.sevenDaySonnetRejected && decision.sevenDayOpusRejected;
    const noModelUsable = decision.blocked ||
        fiveHourExhausted ||
        generalSevenDayRejected ||
        bothModelsSevenDayRejected;
    if (noModelUsable) {
        return 'K';
    }
    if (decision.unifiedStatus === ALLOWED_WARNING_STATUS) {
        return 'Y';
    }
    if (fiveHourUtilization >= HIGH_UTILIZATION_THRESHOLD ||
        sevenDayUtilization >= HIGH_UTILIZATION_THRESHOLD) {
        return 'Y';
    }
    return 'G';
};
exports.judgeTokenColor = judgeTokenColor;
class GenerateTokenStatusUseCase {
    constructor() {
        this.run = (input) => {
            const { tokens, prepCountByToken, humCountByToken, nowEpochSeconds } = input;
            return tokens.map((tokenInput) => {
                const decision = this.toDecision(tokenInput.snapshot, nowEpochSeconds);
                const normalized = this.normalizeWindows(tokenInput.snapshot, nowEpochSeconds);
                return {
                    name: tokenInput.name,
                    fiveHourUtilizationPercent: normalized.fiveHourUtilizationPercent,
                    fiveHourResetSeconds: normalized.fiveHourResetSeconds,
                    sevenDayUtilizationPercent: normalized.sevenDayUtilizationPercent,
                    sevenDayResetSeconds: normalized.sevenDayResetSeconds,
                    color: (0, exports.judgeTokenColor)(decision),
                    prep: prepCountByToken.get(tokenInput.token) ?? 0,
                    hum: humCountByToken.get(tokenInput.token) ?? 0,
                };
            });
        };
        this.normalizeWindows = (snapshot, nowEpochSeconds) => {
            if (snapshot === null || !snapshot.hasWindowData) {
                return {
                    fiveHourUtilizationPercent: null,
                    fiveHourResetSeconds: null,
                    sevenDayUtilizationPercent: null,
                    sevenDayResetSeconds: null,
                };
            }
            const fiveHourReset = snapshot.fiveHourReset > 0 ? snapshot.fiveHourReset : null;
            const sevenDayReset = snapshot.sevenDayReset > 0 ? snapshot.sevenDayReset : null;
            const fiveHourExpired = fiveHourReset !== null && fiveHourReset < nowEpochSeconds;
            const sevenDayExpired = sevenDayReset !== null && sevenDayReset < nowEpochSeconds;
            return {
                fiveHourUtilizationPercent: fiveHourExpired
                    ? 0
                    : Math.trunc(snapshot.fiveHourUtilization * 100),
                fiveHourResetSeconds: fiveHourReset === null
                    ? null
                    : Math.max(0, fiveHourReset - nowEpochSeconds),
                sevenDayUtilizationPercent: sevenDayExpired
                    ? 0
                    : Math.trunc(snapshot.sevenDayUtilization * 100),
                sevenDayResetSeconds: sevenDayReset === null
                    ? null
                    : Math.max(0, sevenDayReset - nowEpochSeconds),
            };
        };
        this.toDecision = (snapshot, nowEpochSeconds) => {
            if (snapshot === null) {
                return null;
            }
            if (!snapshot.hasWindowData) {
                return {
                    fiveHourUtilization: null,
                    sevenDayUtilization: null,
                    fiveHourRejected: snapshot.fiveHourRejected,
                    sevenDayRejected: snapshot.sevenDayRejected,
                    blocked: snapshot.blocked,
                    unifiedStatus: snapshot.unifiedStatus,
                    sevenDaySonnetRejected: snapshot.sevenDaySonnetRejected,
                    sevenDayOpusRejected: snapshot.sevenDayOpusRejected,
                    partial: true,
                };
            }
            const fiveHourExpired = snapshot.fiveHourReset > 0 && snapshot.fiveHourReset < nowEpochSeconds;
            const sevenDayExpired = snapshot.sevenDayReset > 0 && snapshot.sevenDayReset < nowEpochSeconds;
            return {
                fiveHourUtilization: fiveHourExpired ? 0 : snapshot.fiveHourUtilization,
                sevenDayUtilization: sevenDayExpired ? 0 : snapshot.sevenDayUtilization,
                fiveHourRejected: fiveHourExpired ? false : snapshot.fiveHourRejected,
                sevenDayRejected: sevenDayExpired ? false : snapshot.sevenDayRejected,
                blocked: snapshot.blocked,
                unifiedStatus: snapshot.unifiedStatus,
                sevenDaySonnetRejected: snapshot.sevenDaySonnetRejected ||
                    (sevenDayExpired ? false : snapshot.sevenDayRejected),
                sevenDayOpusRejected: snapshot.sevenDayOpusRejected ||
                    (sevenDayExpired ? false : snapshot.sevenDayRejected),
                partial: false,
            };
        };
    }
}
exports.GenerateTokenStatusUseCase = GenerateTokenStatusUseCase;
//# sourceMappingURL=GenerateTokenStatusUseCase.js.map