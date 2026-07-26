export type TokenModelWeeklyLimit = {
    rejected: boolean;
    resetsAt: number;
};
export type TokenRateLimitSnapshot = {
    token: string;
    name: string;
    fiveHourUtilization: number;
    fiveHourReset: number;
    sevenDayUtilization: number;
    sevenDayReset: number;
    blocked: boolean;
    rejected: boolean;
    blockedUntilEpoch: number;
    modelWeeklyLimits: TokenModelWeeklyLimit[];
    lastUpdatedEpoch: number;
};
export interface TokenRateLimitSnapshotRepository {
    listSnapshots: () => TokenRateLimitSnapshot[];
}
//# sourceMappingURL=TokenRateLimitSnapshotRepository.d.ts.map