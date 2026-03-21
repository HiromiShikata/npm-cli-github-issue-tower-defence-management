import { ClaudeRepository } from '../../domain/usecases/adapter-interfaces/ClaudeRepository';
import { ClaudeWindowUsage } from '../../domain/entities/ClaudeWindowUsage';
export declare class StubClaudeRepository implements ClaudeRepository {
    getUsage(): Promise<ClaudeWindowUsage[]>;
    isClaudeAvailable(_threshold: number): Promise<boolean>;
}
//# sourceMappingURL=StubClaudeRepository.d.ts.map