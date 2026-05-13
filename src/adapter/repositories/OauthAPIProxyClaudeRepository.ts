import { ClaudeRepository } from '../../domain/usecases/adapter-interfaces/ClaudeRepository';
import { ClaudeWindowUsage } from '../../domain/entities/ClaudeWindowUsage';
import { OauthProxyClaudeRepository } from './OauthProxyClaudeRepository';
import { OauthAPIClaudeRepository } from './OauthAPIClaudeRepository';
import * as os from 'os';
import * as path from 'path';

export class OauthAPIProxyClaudeRepository implements ClaudeRepository {
  constructor(
    private readonly proxyRepository: Pick<
      ClaudeRepository,
      'getUsage'
    > = new OauthProxyClaudeRepository(),
    private readonly apiRepository: ClaudeRepository = new OauthAPIClaudeRepository(
      path.join(os.homedir(), '.claude'),
    ),
  ) {}

  async getUsage(): Promise<ClaudeWindowUsage[]> {
    const proxyUsages = await this.proxyRepository.getUsage();
    if (proxyUsages.length > 0) {
      return proxyUsages;
    }
    return this.apiRepository.getUsage();
  }

  async isClaudeAvailable(threshold: number): Promise<boolean> {
    const proxyUsages = await this.proxyRepository.getUsage();
    if (proxyUsages.length > 0) {
      return proxyUsages.every(
        (usage) => usage.utilizationPercentage < threshold,
      );
    }
    return this.apiRepository.isClaudeAvailable(threshold);
  }
}
