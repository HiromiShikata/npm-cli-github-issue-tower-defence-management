import { GitHubGraphqlRateLimitRepository } from '../../domain/usecases/adapter-interfaces/GitHubGraphqlRateLimitRepository';
import { LocalCommandRunner } from '../../domain/usecases/adapter-interfaces/LocalCommandRunner';

export class CliGitHubGraphqlRateLimitRepository implements GitHubGraphqlRateLimitRepository {
  constructor(private readonly localCommandRunner: LocalCommandRunner) {}

  getRemainingRequestCount = async (): Promise<number | null> => {
    const result = await this.localCommandRunner.runCommand('gh', [
      'api',
      'rate_limit',
      '--jq',
      '.resources.graphql.remaining',
    ]);
    if (result.exitCode !== 0) {
      return null;
    }
    const parsed = parseInt(result.stdout.trim(), 10);
    return Number.isNaN(parsed) ? null : parsed;
  };
}
