import { ClaudeRepository } from '../../domain/usecases/adapter-interfaces/ClaudeRepository';
import { ClaudeWindowUsage } from '../../domain/entities/ClaudeWindowUsage';

export class StubClaudeRepository implements ClaudeRepository {
  async getUsage(): Promise<ClaudeWindowUsage[]> {
    return [];
  }

  async isClaudeAvailable(_threshold: number): Promise<boolean> {
    return true;
  }
}
