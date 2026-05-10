import { ClaudeRepository } from '../../domain/usecases/adapter-interfaces/ClaudeRepository';
import { ClaudeWindowUsage } from '../../domain/entities/ClaudeWindowUsage';
export declare class OauthProxyClaudeRepository implements ClaudeRepository {
    private readonly filePath;
    constructor(filePath?: string);
    getUsage(): Promise<ClaudeWindowUsage[]>;
    isClaudeAvailable(threshold: number): Promise<boolean>;
}
//# sourceMappingURL=OauthProxyClaudeRepository.d.ts.map