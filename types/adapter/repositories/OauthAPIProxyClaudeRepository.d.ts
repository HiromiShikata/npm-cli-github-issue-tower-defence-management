import { ClaudeRepository } from '../../domain/usecases/adapter-interfaces/ClaudeRepository';
import { ClaudeWindowUsage } from '../../domain/entities/ClaudeWindowUsage';
export declare class OauthAPIProxyClaudeRepository implements ClaudeRepository {
    private readonly proxyRepository;
    private readonly apiRepository;
    constructor(proxyRepository?: Pick<ClaudeRepository, 'getUsage'>, apiRepository?: ClaudeRepository);
    getUsage(): Promise<ClaudeWindowUsage[]>;
    isClaudeAvailable(threshold: number): Promise<boolean>;
    getSelectedToken(): string | null;
}
//# sourceMappingURL=OauthAPIProxyClaudeRepository.d.ts.map