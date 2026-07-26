import * as fs from 'fs';
import * as path from 'path';
import { SubAgentSilentSecondsResolver } from '../../domain/usecases/adapter-interfaces/SubAgentSilentSecondsResolver';

export class FileSystemSubAgentSilentSecondsResolver implements SubAgentSilentSecondsResolver {
  constructor(
    private readonly rootDirectory: string | null,
    private readonly now: Date,
  ) {}

  resolveSilentSeconds = (label: string): number => {
    if (this.rootDirectory === null) {
      return 0;
    }
    const filePath = path.join(this.rootDirectory, this.toFileName(label));
    let stats: fs.Stats;
    try {
      stats = fs.statSync(filePath);
    } catch {
      return 0;
    }
    if (!stats.isFile()) {
      return 0;
    }
    const lastOutputEpochSeconds = Math.floor(stats.mtimeMs / 1000);
    const nowEpochSeconds = Math.floor(this.now.getTime() / 1000);
    const silentSeconds = nowEpochSeconds - lastOutputEpochSeconds;
    return silentSeconds > 0 ? silentSeconds : 0;
  };

  private toFileName = (label: string): string => label.replace(/\//g, '_');
}
