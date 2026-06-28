export interface SessionRecordReader {
  readCurrentSessionId: (configDir: string, pid: number) => string | null;
}
