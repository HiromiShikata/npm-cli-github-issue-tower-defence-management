import * as fs from 'fs';
import * as path from 'path';
import { LiveSessionOutputActivity } from '../../domain/entities/LiveSessionOutputActivity';
import { SessionOutputActivityRepository } from '../../domain/usecases/adapter-interfaces/SessionOutputActivityRepository';

export class FileSystemSessionOutputActivityRepository implements SessionOutputActivityRepository {
  constructor(private readonly rootDirectory: string | null) {}

  listSessionOutputActivities = async (
    sessionNames: string[],
  ): Promise<LiveSessionOutputActivity[]> => {
    if (this.rootDirectory === null) {
      return [];
    }
    const activities: LiveSessionOutputActivity[] = [];
    for (const sessionName of sessionNames) {
      const lastOutputEpochSeconds =
        this.readLastOutputEpochSeconds(sessionName);
      if (lastOutputEpochSeconds !== null) {
        activities.push({ sessionName, lastOutputEpochSeconds });
      }
    }
    return activities;
  };

  private readLastOutputEpochSeconds = (sessionName: string): number | null => {
    if (this.rootDirectory === null) {
      return null;
    }
    const filePath = path.join(
      this.rootDirectory,
      this.toOutputFileName(sessionName),
    );
    let stats: fs.Stats;
    try {
      stats = fs.statSync(filePath);
    } catch {
      return null;
    }
    if (!stats.isFile()) {
      return null;
    }
    return Math.floor(stats.mtimeMs / 1000);
  };

  private toOutputFileName = (sessionName: string): string =>
    sessionName.replace(/\//g, '_');
}
