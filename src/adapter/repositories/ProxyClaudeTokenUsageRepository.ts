import { ClaudeTokenUsage } from '../../domain/entities/ClaudeTokenUsage';
import { ClaudeTokenUsageRepository } from '../../domain/usecases/adapter-interfaces/ClaudeTokenUsageRepository';
import { ensureProxyRunning } from '../proxy/ensureProxyRunning';
import { PROXY_PORT, readRateLimit } from '../proxy/RateLimitCache';
import { loadTokens } from '../proxy/TokenListLoader';

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
    const tokens = loadTokens(this.tokenListJsonPath);
    if (tokens === null) {
      return [];
    }
    return tokens.map((token) => {
      const snapshot = readRateLimit(token);
      return {
        token,
        fiveHourUtilization: snapshot ? snapshot.fiveHourUtilization : 0,
        blocked: snapshot?.blocked ?? false,
        rejected: snapshot?.rejected ?? false,
      };
    });
  };

  proxyBaseUrl = (): string => `http://127.0.0.1:${this.port}`;
}
