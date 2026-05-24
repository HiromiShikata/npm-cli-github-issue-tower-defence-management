import { ClaudeTokenUsage } from '../../domain/entities/ClaudeTokenUsage';
import { ClaudeTokenUsageRepository } from '../../domain/usecases/adapter-interfaces/ClaudeTokenUsageRepository';
import { ensureProxyRunning } from '../proxy/ensureProxyRunning';
import { PROXY_PORT, readRateLimit } from '../proxy/RateLimitCache';
import { loadTokenEntries } from '../proxy/TokenListLoader';

export class ProxyClaudeTokenUsageRepository implements ClaudeTokenUsageRepository {
  constructor(
    private readonly tokenListJsonPath: string | null,
    private readonly port: number = PROXY_PORT,
  ) {}

  ensureObservable = async (): Promise<void> => {
    await ensureProxyRunning(this.port);
  };

  getAvailableTokenUsages = async (): Promise<ClaudeTokenUsage[]> => {
    if (this.tokenListJsonPath === null) {
      return [];
    }
    const entries = loadTokenEntries(this.tokenListJsonPath);
    if (entries === null) {
      return [];
    }
    const nowEpochSeconds = Date.now() / 1000;
    return entries.map(({ name, token }) => {
      const snapshot = readRateLimit(token);
      if (snapshot === null) {
        return {
          name,
          token,
          fiveHourUtilization: 0,
          blocked: false,
          rejected: false,
          modelWeeklyLimits: {},
        };
      }
      const fiveHourExpired = nowEpochSeconds > snapshot.fiveHourReset;
      const sevenDayExpired = nowEpochSeconds > snapshot.sevenDayReset;
      const fiveHourUtilization = fiveHourExpired
        ? 0
        : snapshot.fiveHourUtilization;
      const fiveHourRejectionActive =
        snapshot.fiveHourRejected && !fiveHourExpired;
      const sevenDayRejectionActive =
        snapshot.sevenDayRejected && !sevenDayExpired;
      const unifiedRejectionActive =
        snapshot.unifiedRejected && !fiveHourExpired;
      const rejected =
        unifiedRejectionActive ||
        fiveHourRejectionActive ||
        sevenDayRejectionActive;
      const modelWeeklyLimits: Record<
        string,
        { rejected: boolean; resetsAt: number }
      > = {};
      for (const [limitType, limit] of Object.entries(
        snapshot.modelWeeklyLimits,
      )) {
        const expired = nowEpochSeconds > limit.resetsAt;
        modelWeeklyLimits[limitType] = {
          rejected: limit.rejected && !expired,
          resetsAt: limit.resetsAt,
        };
      }
      return {
        name,
        token,
        fiveHourUtilization,
        blocked: snapshot.blocked,
        rejected,
        modelWeeklyLimits,
      };
    });
  };

  proxyBaseUrl = (): string => `http://127.0.0.1:${this.port}`;
}
