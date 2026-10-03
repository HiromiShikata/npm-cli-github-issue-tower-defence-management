import { ClaudeTokenUsage } from '../../entities/ClaudeTokenUsage';

export interface ClaudeTokenUsageRepository {
  ensureObservable(): Promise<void>;
  getAvailableTokenUsages(): Promise<ClaudeTokenUsage[]>;
  getTokenInFlightCounts(): Promise<Record<string, number>>;
  getPendingTokenLaunchReservationCounts(
    tokens: string[],
  ): Promise<Record<string, number>>;
  reserveTokenLaunchSlot(params: {
    token: string;
    concurrentLimit: number;
    issueUrl: string;
  }): Promise<boolean>;
  proxyBaseUrl(): string;
}
