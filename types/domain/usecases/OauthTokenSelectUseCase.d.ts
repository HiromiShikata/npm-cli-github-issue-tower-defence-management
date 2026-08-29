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
    selectionWeight?: number;
};
export type SelectionRandom = () => number;
export declare const DEFAULT_SELECTION_WEIGHT = 1;
export declare const selectionWeightOf: (candidate: OauthTokenCandidate) => number;
export type OauthTokenCandidateMetrics = {
    name: string;
    fiveHourFreeRatio: number;
    sevenDayFreeRatio: number;
    sevenDayEndEpoch: number;
    eligible: boolean;
    exclusionReason: string | null;
    drawWeight: number;
};
export type OauthTokenSelectResult = {
    selected: OauthTokenCandidate | null;
    metrics: OauthTokenCandidateMetrics[];
};
export type OauthTokenSelectionThresholds = {
    fiveHourMinFreeRatio: number;
    sevenDayMinFreeRatio: number;
};
export declare const FIVE_HOUR_MIN_FREE_RATIO = 0.25;
export declare const SEVEN_DAY_MIN_FREE_RATIO = 0.03;
export declare const DEFAULT_OAUTH_TOKEN_SELECTION_THRESHOLDS: OauthTokenSelectionThresholds;
export declare const CL_SCRIPT_OAUTH_TOKEN_SELECTION_THRESHOLDS: OauthTokenSelectionThresholds;
export declare const SEVEN_DAY_WINDOW_HOURS = 168;
export declare const MIN_HOURS_TO_RESET = 1;
export declare const sevenDayUrgencyFactor: (sevenDayFreeRatio: number, sevenDayEndEpoch: number, nowEpochSeconds: number) => number;
export declare const selectWeightedCandidate: <Entry>(eligible: Entry[], weightOf: (entry: Entry) => number, deterministicBest: Entry, random: SelectionRandom) => Entry;
export declare class OauthTokenSelectUseCase {
    run: (candidates: OauthTokenCandidate[], nowEpochSeconds: number, random?: SelectionRandom, thresholds?: OauthTokenSelectionThresholds) => OauthTokenSelectResult;
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