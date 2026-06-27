import { TokenRateLimitSnapshotRepository } from '../../domain/usecases/adapter-interfaces/TokenRateLimitSnapshotRepository';
import { TokenRateLimitSnapshot } from '../../domain/usecases/adapter-interfaces/TokenRateLimitSnapshotRepository';
import { cacheDir, readRateLimit } from '../proxy/RateLimitCache';

export class RateLimitSnapshotRepository
  implements TokenRateLimitSnapshotRepository
{
  constructor(private readonly baseDir: string = cacheDir()) {}

  getSnapshot = (token: string): TokenRateLimitSnapshot | null => {
    const snapshot = readRateLimit(token, this.baseDir);
    if (snapshot === null) {
      return null;
    }
    return {
      fiveHourUtilization: snapshot.fiveHourUtilization,
      sevenDayUtilization: snapshot.sevenDayUtilization,
      blocked: snapshot.blocked,
      rejected: snapshot.rejected,
      blockedUntilEpoch: snapshot.blockedUntilEpoch,
      lastUpdatedEpoch: snapshot.lastUpdatedEpoch,
    };
  };
}
