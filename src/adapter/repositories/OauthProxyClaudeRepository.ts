import { ClaudeRepository } from '../../domain/usecases/adapter-interfaces/ClaudeRepository';
import { ClaudeWindowUsage } from '../../domain/entities/ClaudeWindowUsage';
import fs from 'fs';

type ProxyFileHeaders = {
  'anthropic-ratelimit-unified-5h-utilization'?: string;
  'anthropic-ratelimit-unified-7d-utilization'?: string;
  'anthropic-ratelimit-unified-5h-reset'?: string;
  'anthropic-ratelimit-unified-7d-reset'?: string;
};

type ProxyFile = {
  headers?: ProxyFileHeaders;
};

const isProxyFile = (value: unknown): value is ProxyFile => {
  if (typeof value !== 'object' || value === null) return false;
  return true;
};

export class OauthProxyClaudeRepository implements ClaudeRepository {
  private readonly filePath: string;

  constructor(
    filePath: string = process.env['CLAUDE_RATELIMIT_FILE'] ??
      '/tmp/claude-ratelimit.json',
  ) {
    this.filePath = filePath;
  }

  async getUsage(): Promise<ClaudeWindowUsage[]> {
    if (!fs.existsSync(this.filePath)) {
      return [];
    }

    let parsed: unknown;
    try {
      const content = fs.readFileSync(this.filePath, 'utf-8');
      parsed = JSON.parse(content);
    } catch {
      return [];
    }

    if (!isProxyFile(parsed)) {
      return [];
    }

    const headers = parsed.headers;
    if (!headers) {
      return [];
    }

    const usages: ClaudeWindowUsage[] = [];

    const fiveHourUtilization =
      headers['anthropic-ratelimit-unified-5h-utilization'];
    const fiveHourReset = headers['anthropic-ratelimit-unified-5h-reset'];
    if (fiveHourUtilization !== undefined) {
      const utilizationPercentage = parseFloat(fiveHourUtilization) * 100;
      if (!isNaN(utilizationPercentage)) {
        usages.push({
          hour: 5,
          utilizationPercentage,
          resetsAt: fiveHourReset
            ? new Date(parseInt(fiveHourReset, 10) * 1000)
            : new Date(),
        });
      }
    }

    const sevenDayUtilization =
      headers['anthropic-ratelimit-unified-7d-utilization'];
    const sevenDayReset = headers['anthropic-ratelimit-unified-7d-reset'];
    if (sevenDayUtilization !== undefined) {
      const utilizationPercentage = parseFloat(sevenDayUtilization) * 100;
      if (!isNaN(utilizationPercentage)) {
        usages.push({
          hour: 168,
          utilizationPercentage,
          resetsAt: sevenDayReset
            ? new Date(parseInt(sevenDayReset, 10) * 1000)
            : new Date(),
        });
      }
    }

    return usages;
  }

  async isClaudeAvailable(threshold: number): Promise<boolean> {
    const usages = await this.getUsage();
    if (usages.length === 0) {
      return false;
    }
    return usages.every((usage) => usage.utilizationPercentage < threshold);
  }
}
