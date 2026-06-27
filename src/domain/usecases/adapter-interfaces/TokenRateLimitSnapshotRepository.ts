export interface TokenRateLimitSnapshot {
  fiveHourUtilization: number;
  sevenDayUtilization: number;
  blocked: boolean;
  rejected: boolean;
  blockedUntilEpoch: number;
  lastUpdatedEpoch: number;
}

export interface TokenRateLimitSnapshotRepository {
  getSnapshot: (token: string) => TokenRateLimitSnapshot | null;
}
