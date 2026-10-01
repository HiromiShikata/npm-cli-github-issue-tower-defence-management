export type WorkerSessionLogReadResult =
  | { outcome: 'read'; lines: string[] }
  | { outcome: 'unreadable'; errorMessage: string };

export interface WorkerSessionLogRepository {
  readLines: (
    sessionLogFilePath: string,
  ) => Promise<WorkerSessionLogReadResult>;
}
