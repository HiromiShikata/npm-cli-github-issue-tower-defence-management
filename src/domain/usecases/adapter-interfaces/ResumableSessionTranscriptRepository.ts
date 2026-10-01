export type SessionTranscriptFile = {
  sessionId: string;
  fileName: string;
  filePath: string;
  sessionDirectoryPath: string;
  sessionIdDirectoryPath: string;
  modificationTimeNanoseconds: bigint;
};

export type OwnerOnlyDirectoryCreateOutcome = 'created' | 'createFailed';

export type CopyOutcome = 'copied' | 'copyFailed';

export interface ResumableSessionTranscriptRepository {
  listSessionTranscriptFiles: (
    sessionDirectoryPath: string,
  ) => SessionTranscriptFile[];
  readFirstLine: (sessionTranscriptFile: SessionTranscriptFile) => string;
  readLines: (sessionTranscriptFile: SessionTranscriptFile) => string[];
  isSessionTranscriptFileArchived: (
    archiveRootPath: string,
    sessionId: string,
  ) => boolean;
  doesEntryExist: (directoryPath: string, entryName: string) => boolean;
  isDirectory: (entryPath: string) => boolean;
  createOwnerOnlyDirectory: (
    directoryPath: string,
  ) => OwnerOnlyDirectoryCreateOutcome;
  copySessionTranscriptFile: (
    sessionTranscriptFile: SessionTranscriptFile,
    destinationSessionDirectoryPath: string,
  ) => CopyOutcome;
  copySessionIdDirectory: (
    sessionTranscriptFile: SessionTranscriptFile,
    destinationSessionDirectoryPath: string,
  ) => CopyOutcome;
}
