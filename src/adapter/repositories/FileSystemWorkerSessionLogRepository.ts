import * as fs from 'fs';
import {
  WorkerSessionLogReadResult,
  WorkerSessionLogRepository,
} from '../../domain/usecases/adapter-interfaces/WorkerSessionLogRepository';

export class FileSystemWorkerSessionLogRepository implements WorkerSessionLogRepository {
  readLines = async (
    sessionLogFilePath: string,
  ): Promise<WorkerSessionLogReadResult> => {
    try {
      return {
        outcome: 'read',
        lines: fs.readFileSync(sessionLogFilePath, 'utf8').split('\n'),
      };
    } catch (error) {
      return {
        outcome: 'unreadable',
        errorMessage: error instanceof Error ? error.message : String(error),
      };
    }
  };
}
