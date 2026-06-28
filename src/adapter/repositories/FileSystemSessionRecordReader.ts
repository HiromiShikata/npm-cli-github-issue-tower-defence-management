import * as fs from 'fs';
import * as path from 'path';
import { SessionRecordReader } from '../../domain/usecases/adapter-interfaces/SessionRecordReader';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export class FileSystemSessionRecordReader implements SessionRecordReader {
  readCurrentSessionId = (configDir: string, pid: number): string | null => {
    const recordPath = path.join(configDir, 'sessions', `${pid}.json`);
    let content: string;
    try {
      content = fs.readFileSync(recordPath, 'utf8');
    } catch {
      return null;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      return null;
    }
    if (!isRecord(parsed)) {
      return null;
    }
    const sessionId = parsed.sessionId;
    return typeof sessionId === 'string' && sessionId.length > 0
      ? sessionId
      : null;
  };
}
