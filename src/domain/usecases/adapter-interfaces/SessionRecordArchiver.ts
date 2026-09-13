export interface SessionRecordArchiver {
  readLogLines: (logFilePath: string) => string[];
  sessionRecordPath: (sessionDir: string, sessionId: string) => string;
  sessionRecordExists: (sessionDir: string, sessionId: string) => boolean;
  archiveSessionRecord: (
    sessionDir: string,
    archiveDir: string,
    sessionId: string,
  ) => string;
}
