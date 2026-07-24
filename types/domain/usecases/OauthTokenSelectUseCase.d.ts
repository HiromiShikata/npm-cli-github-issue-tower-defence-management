export type OauthTokenWindowSnapshot = {
    fiveHourUtilization: number;
    fiveHourReset: number;
    sevenDayUtilization: number;
    sevenDayReset: number;
};
export type OauthTokenCandidate = {
    name: string;
    token: string;
    snapshot: OauthTokenWindowSnapshot | null;
    subscriptionDisabled: boolean;
    unifiedRejected: boolean;
    fableRejected: boolean;
};
export type OauthTokenCandidateMetrics = {
    name: string;
    fiveHourFreeRatio: number;
    sevenDayFreeRatio: number;
    sevenDayEndEpoch: number;
    eligible: boolean;
    exclusionReason: string | null;
};
export type OauthTokenSelectResult = {
    selected: OauthTokenCandidate | null;
    metrics: OauthTokenCandidateMetrics[];
};
export declare const FIVE_HOUR_MIN_FREE_RATIO = 0.6;
export declare const SEVEN_DAY_MIN_FREE_RATIO = 0.07;
export declare class OauthTokenSelectUseCase {
    run: (candidates: OauthTokenCandidate[], nowEpochSeconds: number) => OauthTokenSelectResult;
    private evaluate;
    private exclusionReason;
    private fiveHourFreeRatio;
    private sevenDayFreeRatio;
    private sevenDayEndEpoch;
    private windowExpired;
    private freeRatioFromUtilization;
    private toPercent;
}
//# sourceMappingURL=OauthTokenSelectUseCase.d.ts.map