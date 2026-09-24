import * as fs from 'fs';
import * as path from 'path';
import { SessionRecordArchiver } from '../../domain/usecases/adapter-interfaces/SessionRecordArchiver';

export class FileSystemSessionRecordArchiver implements SessionRecordArchiver {
  readLogLines = (logFilePath: string): string[] => {
    let content: string;
    try {
      content = fs.readFileSync(logFilePath, 'utf8');
    } catch {
      return [];
    }
    return content.split('\n');
  };

  sessionRecordPath = (sessionDir: string, sessionId: string): string =>
    path.join(sessionDir, `${sessionId}.jsonl`);

  sessionRecordExists = (sessionDir: string, sessionId: string): boolean =>
    fs.existsSync(this.sessionRecordPath(sessionDir, sessionId));

  archiveSessionRecord = (
    sessionDir: string,
    archiveDir: string,
    sessionId: string,
  ): string => {
    const destinationPath = path.join(archiveDir, `${sessionId}.jsonl`);
    fs.mkdirSync(archiveDir, { recursive: true });
    fs.renameSync(
      this.sessionRecordPath(sessionDir, sessionId),
      destinationPath,
    );
    return destinationPath;
  };
}
