import {
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
        sevenDayUtilization: snapshot.sevenDayUtilization,
        blocked: snapshot.blocked,
        rejected: snapshot.rejected,
        blockedUntilEpoch: snapshot.blockedUntilEpoch,
        lastUpdatedEpoch: snapshot.lastUpdatedEpoch,
      });
    }
    return snapshots;
  };
}
