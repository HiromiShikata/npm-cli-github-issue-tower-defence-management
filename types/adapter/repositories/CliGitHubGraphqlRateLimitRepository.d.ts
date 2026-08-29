import { GitHubGraphqlRateLimitRepository } from '../../domain/usecases/adapter-interfaces/GitHubGraphqlRateLimitRepository';
import { LocalCommandRunner } from '../../domain/usecases/adapter-interfaces/LocalCommandRunner';
export declare class CliGitHubGraphqlRateLimitRepository implements GitHubGraphqlRateLimitRepository {
    private readonly localCommandRunner;
    constructor(localCommandRunner: LocalCommandRunner);
    getRemainingRequestCount: () => Promise<number | null>;
}
//# sourceMappingURL=CliGitHubGraphqlRateLimitRepository.d.ts.map