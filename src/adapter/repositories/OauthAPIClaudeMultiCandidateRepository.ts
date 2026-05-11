import { ClaudeRepository } from '../../domain/usecases/adapter-interfaces/ClaudeRepository';
import { ClaudeWindowUsage } from '../../domain/entities/ClaudeWindowUsage';
import {
  ClaudeConfigDirCandidateUnavailableError,
  OauthAPIClaudeRepository,
} from './OauthAPIClaudeRepository';
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
        if (error instanceof ClaudeConfigDirCandidateUnavailableError) {
          continue;
        }
        throw error;
      }
      if (this.isNonWeeklyUnderThreshold(usages, threshold)) {
        this.copyCandidate(candidateDir, this.mainDir);
        return true;
      }
    }
    return false;
  }

  async getUsage(): Promise<ClaudeWindowUsage[]> {
    return this.mainRepository.getUsage();
  }

  private copyCandidate(candidateDir: string, mainDir: string): void {
    const credentialsSrc = path.join(candidateDir, '.credentials.json');
    const credentialsDst = path.join(mainDir, '.credentials.json');
    const credentialsTmp = `${credentialsDst}.tmp`;
    fs.copyFileSync(credentialsSrc, credentialsTmp);
    fs.renameSync(credentialsTmp, credentialsDst);

    const claudeJsonSrc = path.join(candidateDir, '.claude.json');
    if (fs.existsSync(claudeJsonSrc)) {
      const claudeJsonDst = path.join(mainDir, '.claude.json');
      const claudeJsonTmp = `${claudeJsonDst}.tmp`;
      fs.copyFileSync(claudeJsonSrc, claudeJsonTmp);
      fs.renameSync(claudeJsonTmp, claudeJsonDst);
    }
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
}
