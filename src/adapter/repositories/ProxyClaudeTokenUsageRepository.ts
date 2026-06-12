import * as fs from 'fs';
import * as path from 'path';
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
          sevenDayUtilization: 0,
          blocked: false,
          rejected: false,
          modelWeeklyLimits: {},
          blockedUntilEpoch: 0,
        };
      }
      const fiveHourExpired = nowEpochSeconds > snapshot.fiveHourReset;
      const sevenDayExpired = nowEpochSeconds > snapshot.sevenDayReset;
      const fiveHourUtilization = fiveHourExpired
        ? 0
        : snapshot.fiveHourUtilization;
      const sevenDayUtilization = sevenDayExpired
        ? 0
        : snapshot.sevenDayUtilization;
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
      const hasAnySevenDayWeeklyLimit =
        modelWeeklyLimits['seven_day'] !== undefined ||
        modelWeeklyLimits['seven_day_opus'] !== undefined ||
        modelWeeklyLimits['seven_day_sonnet'] !== undefined;
      if (
        snapshot.sevenDayReset > 0 &&
        !sevenDayExpired &&
        !hasAnySevenDayWeeklyLimit
      ) {
        modelWeeklyLimits['seven_day'] = {
          rejected: sevenDayRejectionActive,
          resetsAt: snapshot.sevenDayReset,
        };
      }
      const cooldownActive = snapshot.blockedUntilEpoch > nowEpochSeconds;
      return {
        name,
        token,
        fiveHourUtilization,
        sevenDayUtilization,
        blocked: snapshot.blocked,
        rejected,
        modelWeeklyLimits,
        blockedUntilEpoch: cooldownActive ? snapshot.blockedUntilEpoch : 0,
      };
    });
  };

  getTokenInFlightCounts = async (): Promise<Record<string, number>> => {
    const counts: Record<string, number> = {};
    let procEntries: string[];
    try {
      procEntries = fs.readdirSync('/proc');
    } catch {
      return counts;
    }
    const tokenByPid = new Map<number, string>();
    for (const entry of procEntries) {
      if (!/^\d+$/.test(entry)) continue;
      const environPath = path.join('/proc', entry, 'environ');
      let environ: string;
      try {
        environ = fs.readFileSync(environPath, 'utf8');
      } catch {
        continue;
      }
      const vars = environ.split('\0');
      const tokenEntry = vars.find((v) =>
        v.startsWith('CLAUDE_CODE_OAUTH_TOKEN='),
      );
      if (tokenEntry === undefined) continue;
      const token = tokenEntry.slice('CLAUDE_CODE_OAUTH_TOKEN='.length);
      if (token.length === 0) continue;
      tokenByPid.set(Number(entry), token);
    }
    for (const [pid, token] of tokenByPid) {
      const parentPid = this.readParentPid(pid);
      if (parentPid !== null && tokenByPid.has(parentPid)) continue;
      counts[token] = (counts[token] ?? 0) + 1;
    }
    return counts;
  };

  private readParentPid = (pid: number): number | null => {
    let stat: string;
    try {
      stat = fs.readFileSync(path.join('/proc', String(pid), 'stat'), 'utf8');
    } catch {
      return null;
    }
    const afterComm = stat.slice(stat.lastIndexOf(') ') + 2);
    const fields = afterComm.trim().split(/\s+/);
    const parentPid = Number(fields[1]);
    if (!Number.isInteger(parentPid)) return null;
    return parentPid;
  };

  proxyBaseUrl = (): string => `http://127.0.0.1:${this.port}`;
}
