import * as fs from 'fs';
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

/**
 * Resolves the real transcript path of an interactive Claude Code session from
 * the session id and config directory taken from the session's process
 * environment. The transcript lives at
 * `<configDir>/projects/<cwd-slug>/<sessionId>.jsonl`; this resolver scans the
 * `projects` subdirectories for a file named `<sessionId>.jsonl` and returns the
 * most recently modified match. Because resolution is keyed on the process
 * session id rather than on a session name or issue URL, a plain-named session
 * (for example one named `workbench`) resolves just as well as an issue-url
 * named one.
 */
export class FileSystemInteractiveLiveSessionTranscriptResolver implements InteractiveLiveSessionTranscriptResolver {
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
    const projectsDirectory = path.join(session.configDir, 'projects');
    let projectEntries: fs.Dirent[];
    try {
      projectEntries = fs.readdirSync(projectsDirectory, {
        withFileTypes: true,
      });
    } catch {
      return null;
    }
    const fileName = `${session.sessionId}.jsonl`;
    let latestPath: string | null = null;
    let latestEpochMs = -Infinity;
    for (const projectEntry of projectEntries) {
      if (!projectEntry.isDirectory()) {
        continue;
      }
      const candidate = path.join(
        projectsDirectory,
        projectEntry.name,
        fileName,
      );
      const epochMs = modifiedEpochMs(candidate);
      if (epochMs === null) {
        continue;
      }
      if (epochMs > latestEpochMs) {
        latestEpochMs = epochMs;
        latestPath = candidate;
      }
    }
    return latestPath;
  };
}
