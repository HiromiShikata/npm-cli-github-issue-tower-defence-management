import { ClaudeTokenUsage } from '../../entities/ClaudeTokenUsage';

export interface ClaudeTokenUsageRepository {
  ensureObservable(): Promise<void>;
  getAvailableTokenUsages(): Promise<ClaudeTokenUsage[]>;
  getTokenInFlightCounts(): Promise<Record<string, number>>;
  reserveTokenLaunchSlot(params: {
    token: string;
    concurrentLimit: number;
  }): Promise<boolean>;
  proxyBaseUrl(): string;
}
