import { ClaudeTokenUsage } from '../../entities/ClaudeTokenUsage';

export interface ClaudeTokenUsageRepository {
  ensureObservable(): Promise<void>;
  getAvailableTokenUsages(): Promise<ClaudeTokenUsage[]>;
  proxyBaseUrl(): string;
}
