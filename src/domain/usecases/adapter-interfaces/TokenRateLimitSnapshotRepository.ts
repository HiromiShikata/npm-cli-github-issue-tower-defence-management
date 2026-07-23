export type TokenRateLimitSnapshot = {
  token: string;
  name: string;
  fiveHourUtilization: number;
  sevenDayUtilization: number;
  blocked: boolean;
  rejected: boolean;
  blockedUntilEpoch: number;
  lastUpdatedEpoch: number;
};

export interface TokenRateLimitSnapshotRepository {
  listSnapshots: () => TokenRateLimitSnapshot[];
}
