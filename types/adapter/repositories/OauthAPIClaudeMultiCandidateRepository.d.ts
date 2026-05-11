import { ClaudeRepository } from '../../domain/usecases/adapter-interfaces/ClaudeRepository';
import { ClaudeWindowUsage } from '../../domain/entities/ClaudeWindowUsage';
export declare class OauthAPIClaudeMultiCandidateRepository implements ClaudeRepository {
    private readonly candidates;
    private readonly homeDir;
    private readonly mainDir;
    private readonly mainRepository;
    private readonly weeklyWindowHours;
    constructor(candidates: string[], homeDir: string);
    isClaudeAvailable(threshold: number): Promise<boolean>;
    getUsage(): Promise<ClaudeWindowUsage[]>;
    private isNonWeeklyUnderThreshold;
    private isCandidateUnavailable;
}
//# sourceMappingURL=OauthAPIClaudeMultiCandidateRepository.d.ts.map