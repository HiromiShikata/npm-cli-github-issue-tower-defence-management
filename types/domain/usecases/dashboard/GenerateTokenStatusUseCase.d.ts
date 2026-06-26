export type TokenStatusColor = 'G' | 'Y' | 'K';
export type TokenRateLimitSnapshot = {
    fiveHourUtilization: number;
    fiveHourReset: number;
    sevenDayUtilization: number;
    sevenDayReset: number;
    blocked: boolean;
    fiveHourRejected: boolean;
    sevenDayRejected: boolean;
    unifiedStatus: string | null;
    sevenDaySonnetRejected: boolean;
    sevenDayOpusRejected: boolean;
    hasWindowData: boolean;
};
export type TokenRateLimitDecision = {
    fiveHourUtilization: number | null;
    sevenDayUtilization: number | null;
    fiveHourRejected: boolean;
    sevenDayRejected: boolean;
    blocked: boolean;
    unifiedStatus: string | null;
    sevenDaySonnetRejected: boolean;
    sevenDayOpusRejected: boolean;
    partial: boolean;
};
export type TokenStatus = {
    name: string;
    fiveHourUtilizationPercent: number | null;
    fiveHourResetSeconds: number | null;
    sevenDayUtilizationPercent: number | null;
    sevenDayResetSeconds: number | null;
    color: TokenStatusColor;
    prep: number;
    hum: number;
};
export type TokenStatusInput = {
    name: string;
    token: string;
    snapshot: TokenRateLimitSnapshot | null;
};
export type GenerateTokenStatusInput = {
    tokens: TokenStatusInput[];
    prepCountByToken: Map<string, number>;
    humCountByToken: Map<string, number>;
    nowEpochSeconds: number;
};
export declare const judgeTokenColor: (decision: TokenRateLimitDecision | null) => TokenStatusColor;
export declare class GenerateTokenStatusUseCase {
    run: (input: GenerateTokenStatusInput) => TokenStatus[];
    private normalizeWindows;
    private toDecision;
}
//# sourceMappingURL=GenerateTokenStatusUseCase.d.ts.map