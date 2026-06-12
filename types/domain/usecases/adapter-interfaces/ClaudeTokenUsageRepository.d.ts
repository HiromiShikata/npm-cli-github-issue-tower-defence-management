import { ClaudeTokenUsage } from '../../entities/ClaudeTokenUsage';
export interface ClaudeTokenUsageRepository {
    ensureObservable(): Promise<void>;
    getAvailableTokenUsages(): Promise<ClaudeTokenUsage[]>;
    getTokenInFlightCounts(): Promise<Record<string, number>>;
    proxyBaseUrl(): string;
}
//# sourceMappingURL=ClaudeTokenUsageRepository.d.ts.map