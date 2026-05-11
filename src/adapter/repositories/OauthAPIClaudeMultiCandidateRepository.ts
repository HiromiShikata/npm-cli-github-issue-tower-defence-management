import { ClaudeRepository } from '../../domain/usecases/adapter-interfaces/ClaudeRepository';
import { ClaudeWindowUsage } from '../../domain/entities/ClaudeWindowUsage';
import { OauthAPIClaudeRepository } from './OauthAPIClaudeRepository';
import * as fs from 'fs';
import * as path from 'path';

export class OauthAPIClaudeMultiCandidateRepository implements ClaudeRepository {
  private readonly mainDir: string;
  private readonly mainRepository: OauthAPIClaudeRepository;
  private readonly weeklyWindowHours = 168;

  constructor(
    private readonly candidates: string[],
    private readonly homeDir: string,
  ) {
    this.mainDir = path.join(homeDir, '.claude');
    this.mainRepository = new OauthAPIClaudeRepository(this.mainDir);
  }

  async isClaudeAvailable(threshold: number): Promise<boolean> {
    if (this.candidates.length === 0) {
      const usages = await this.mainRepository.getUsage();
      return this.isNonWeeklyUnderThreshold(usages, threshold);
    }

    for (const candidate of this.candidates) {
      const candidateDir = path.join(this.homeDir, candidate);
      const repo = new OauthAPIClaudeRepository(candidateDir);
      let usages: ClaudeWindowUsage[];
      try {
        usages = await repo.getUsage();
      } catch (error) {
        if (this.isCandidateUnavailable(error)) {
          continue;
        }
        throw error;
      }
      if (this.isNonWeeklyUnderThreshold(usages, threshold)) {
        fs.copyFileSync(
          path.join(candidateDir, '.credentials.json'),
          path.join(this.mainDir, '.credentials.json'),
        );
        return true;
      }
    }
    return false;
  }

  async getUsage(): Promise<ClaudeWindowUsage[]> {
    return this.mainRepository.getUsage();
  }

  private isNonWeeklyUnderThreshold(
    usages: ClaudeWindowUsage[],
    threshold: number,
  ): boolean {
    const nonWeekly = usages.filter(
      (usage) => usage.hour !== this.weeklyWindowHours,
    );
    const maxUtil =
      nonWeekly.length > 0
        ? Math.max(...nonWeekly.map((u) => u.utilizationPercentage))
        : 0;
    return maxUtil <= threshold;
  }

  private isCandidateUnavailable(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    return (
      error.message.includes('credentials file not found') ||
      error.message.startsWith('Claude API error:')
    );
  }
}
