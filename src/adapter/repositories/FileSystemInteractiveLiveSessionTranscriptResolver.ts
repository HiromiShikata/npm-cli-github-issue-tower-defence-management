import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { InteractiveLiveSession } from '../../domain/entities/InteractiveLiveSession';
import { InteractiveLiveSessionTranscriptResolver } from '../../domain/usecases/adapter-interfaces/InteractiveLiveSessionTranscriptResolver';

const modifiedEpochMs = (filePath: string): number | null => {
  try {
    const stats = fs.statSync(filePath);
    return stats.isFile() ? stats.mtimeMs : null;
  } catch {
    return null;
  }
};

const defaultSharedProjectsDirectory = (): string =>
  path.join(os.homedir(), '.claude', 'projects');

export class FileSystemInteractiveLiveSessionTranscriptResolver implements InteractiveLiveSessionTranscriptResolver {
  constructor(
    private readonly sharedProjectsDirectory: string = defaultSharedProjectsDirectory(),
  ) {}

  resolveTranscriptPaths = (
    sessions: InteractiveLiveSession[],
  ): Map<string, string> => {
    const resolved = new Map<string, string>();
    for (const session of sessions) {
      const transcriptPath = this.resolveTranscriptPath(session);
      if (transcriptPath !== null) {
        resolved.set(session.sessionName, transcriptPath);
      }
    }
    return resolved;
  };

  private resolveTranscriptPath = (
    session: InteractiveLiveSession,
  ): string | null => {
    const projectsDirectories = this.listProjectsDirectories(session.configDir);
    for (const candidateSessionId of session.candidateSessionIds) {
      const transcriptPath = this.resolveCandidateTranscriptPath(
        candidateSessionId,
        projectsDirectories,
      );
      if (transcriptPath !== null) {
        return transcriptPath;
      }
    }
    return null;
  };

  private resolveCandidateTranscriptPath = (
    candidateSessionId: string,
    projectsDirectories: string[],
  ): string | null => {
    const fileName = `${candidateSessionId}.jsonl`;
    let latestPath: string | null = null;
    let latestEpochMs = -Infinity;
    for (const projectsDirectory of projectsDirectories) {
      for (const candidate of this.listCandidatePaths(
        projectsDirectory,
        fileName,
      )) {
        const epochMs = modifiedEpochMs(candidate);
        if (epochMs === null) {
          continue;
        }
        if (epochMs > latestEpochMs) {
          latestEpochMs = epochMs;
          latestPath = candidate;
        }
      }
    }
    return latestPath;
  };

  private listProjectsDirectories = (configDir: string): string[] => {
    const perSessionProjectsDirectory = path.join(configDir, 'projects');
    if (perSessionProjectsDirectory === this.sharedProjectsDirectory) {
      return [perSessionProjectsDirectory];
    }
    return [perSessionProjectsDirectory, this.sharedProjectsDirectory];
  };

  private listCandidatePaths = (
    projectsDirectory: string,
    fileName: string,
  ): string[] => {
    let projectEntries: fs.Dirent[];
    try {
      projectEntries = fs.readdirSync(projectsDirectory, {
        withFileTypes: true,
      });
    } catch {
      return [];
    }
    const candidatePaths: string[] = [];
    for (const projectEntry of projectEntries) {
      if (!projectEntry.isDirectory()) {
        continue;
      }
      candidatePaths.push(
        path.join(projectsDirectory, projectEntry.name, fileName),
      );
    }
    return candidatePaths;
  };
}
