import {
  TokenModelWeeklyLimit,
  TokenRateLimitSnapshot,
  TokenRateLimitSnapshotRepository,
} from '../../domain/usecases/adapter-interfaces/TokenRateLimitSnapshotRepository';
import { loadTokenEntries } from '../proxy/TokenListLoader';
import { readRateLimit, cacheDir } from '../proxy/RateLimitCache';

export class RateLimitSnapshotRepository implements TokenRateLimitSnapshotRepository {
  constructor(
    private readonly tokenListJsonPath: string,
    private readonly baseDir: string = cacheDir(),
  ) {}

  listSnapshots = (): TokenRateLimitSnapshot[] => {
    const entries = loadTokenEntries(this.tokenListJsonPath);
    if (entries === null) {
      return [];
    }
    const snapshots: TokenRateLimitSnapshot[] = [];
    for (const { name, token } of entries) {
      const snapshot = readRateLimit(token, this.baseDir);
      if (snapshot === null) {
        continue;
      }
      snapshots.push({
        token,
        name,
        fiveHourUtilization: snapshot.fiveHourUtilization,
        fiveHourReset: snapshot.fiveHourReset,
        sevenDayUtilization: snapshot.sevenDayUtilization,
        sevenDayReset: snapshot.sevenDayReset,
        blocked: snapshot.blocked,
        rejected: snapshot.rejected,
        blockedUntilEpoch: snapshot.blockedUntilEpoch,
        modelWeeklyLimits: this.toModelWeeklyLimits(snapshot.modelWeeklyLimits),
        lastUpdatedEpoch: snapshot.lastUpdatedEpoch,
      });
    }
    return snapshots;
  };

  private toModelWeeklyLimits = (
    modelWeeklyLimits: Record<string, { rejected: boolean; resetsAt: number }>,
  ): TokenModelWeeklyLimit[] =>
    Object.values(modelWeeklyLimits).map((limit) => ({
      rejected: limit.rejected,
      resetsAt: limit.resetsAt,
    }));
}
