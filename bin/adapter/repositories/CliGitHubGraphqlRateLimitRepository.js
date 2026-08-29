"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CliGitHubGraphqlRateLimitRepository = void 0;
class CliGitHubGraphqlRateLimitRepository {
    constructor(localCommandRunner) {
        this.localCommandRunner = localCommandRunner;
        this.getRemainingRequestCount = async () => {
            const result = await this.localCommandRunner.runCommand('gh', [
                'api',
                'rate_limit',
                '--jq',
                '.resources.graphql.remaining',
            ]);
            if (result.exitCode !== 0) {
                return null;
            }
            const trimmed = result.stdout.trim();
            const parsed = Number(trimmed);
            return trimmed !== '' && Number.isInteger(parsed) ? parsed : null;
        };
    }
}
exports.CliGitHubGraphqlRateLimitRepository = CliGitHubGraphqlRateLimitRepository;
//# sourceMappingURL=CliGitHubGraphqlRateLimitRepository.js.map