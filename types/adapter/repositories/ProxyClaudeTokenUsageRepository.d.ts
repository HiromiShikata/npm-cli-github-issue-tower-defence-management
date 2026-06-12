import { ClaudeTokenUsage } from '../../domain/entities/ClaudeTokenUsage';
import { ClaudeTokenUsageRepository } from '../../domain/usecases/adapter-interfaces/ClaudeTokenUsageRepository';
export declare class ProxyClaudeTokenUsageRepository implements ClaudeTokenUsageRepository {
    private readonly tokenListJsonPath;
    private readonly port;
    constructor(tokenListJsonPath: string | null, port?: number);
    ensureObservable: () => Promise<void>;
    getAvailableTokenUsages: () => Promise<ClaudeTokenUsage[]>;
    getTokenInFlightCounts: () => Promise<Record<string, number>>;
    proxyBaseUrl: () => string;
}
//# sourceMappingURL=ProxyClaudeTokenUsageRepository.d.ts.map