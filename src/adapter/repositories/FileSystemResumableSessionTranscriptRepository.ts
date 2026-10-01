import * as fs from 'fs';
import * as path from 'path';
import {
  CopyOutcome,
  OwnerOnlyDirectoryCreateOutcome,
  ResumableSessionTranscriptRepository,
  SessionTranscriptFile,
} from '../../domain/usecases/adapter-interfaces/ResumableSessionTranscriptRepository';

const SESSION_TRANSCRIPT_FILE_EXTENSION = '.jsonl';
const COPY_IN_PROGRESS_FILE_SUFFIX = '.copying';
const OWNER_ONLY_DIRECTORY_MODE = 0o700;
const PERMISSION_BITS_MASK = 0o7777;
const FIRST_LINE_READ_CHUNK_BYTE_LENGTH = 65536;
const LINE_FEED_BYTE = 0x0a;

const isDirectoryMissingError = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error.code === 'ENOENT' || error.code === 'ENOTDIR');

const directoryEntryNames = (directoryPath: string): string[] => {
  try {
    return fs.readdirSync(directoryPath);
  } catch (error) {
    if (isDirectoryMissingError(error)) {
      return [];
    }
    throw error;
  }
};

const isSessionTranscriptFileName = (entryName: string): boolean =>
  entryName.endsWith(SESSION_TRANSCRIPT_FILE_EXTENSION) &&
  !entryName.startsWith('.');

const firstLineBytes = (fileDescriptor: number): Buffer => {
  const chunk = Buffer.alloc(FIRST_LINE_READ_CHUNK_BYTE_LENGTH);
  const readChunks: Buffer[] = [];
  let readByteLength = fs.readSync(
    fileDescriptor,
    chunk,
    0,
    chunk.length,
    null,
  );
  while (readByteLength > 0) {
    const readBytes = chunk.subarray(0, readByteLength);
    const lineFeedIndex = readBytes.indexOf(LINE_FEED_BYTE);
    if (lineFeedIndex !== -1) {
      readChunks.push(Buffer.from(readBytes.subarray(0, lineFeedIndex)));
      return Buffer.concat(readChunks);
    }
    readChunks.push(Buffer.from(readBytes));
    readByteLength = fs.readSync(fileDescriptor, chunk, 0, chunk.length, null);
  }
  return Buffer.concat(readChunks);
};

export class FileSystemResumableSessionTranscriptRepository implements ResumableSessionTranscriptRepository {
  listSessionTranscriptFiles = (
    sessionDirectoryPath: string,
  ): SessionTranscriptFile[] =>
    directoryEntryNames(sessionDirectoryPath)
      .filter(isSessionTranscriptFileName)
      .flatMap((fileName) => {
        const filePath = path.join(sessionDirectoryPath, fileName);
        const fileStats = fs.statSync(filePath, {
          bigint: true,
          throwIfNoEntry: false,
        });
        if (fileStats === undefined || !fileStats.isFile()) {
          return [];
        }
        const sessionId = fileName.slice(
          0,
          -SESSION_TRANSCRIPT_FILE_EXTENSION.length,
        );
        return [
          {
            sessionId,
            fileName,
            filePath,
            sessionDirectoryPath,
            sessionIdDirectoryPath: path.join(sessionDirectoryPath, sessionId),
            modificationTimeNanoseconds: fileStats.mtimeNs,
          },
        ];
      });

  readFirstLine = (sessionTranscriptFile: SessionTranscriptFile): string => {
    const fileDescriptor = fs.openSync(sessionTranscriptFile.filePath, 'r');
    try {
      return firstLineBytes(fileDescriptor).toString('utf8');
    } finally {
      fs.closeSync(fileDescriptor);
    }
  };

  readLines = (sessionTranscriptFile: SessionTranscriptFile): string[] =>
    fs.readFileSync(sessionTranscriptFile.filePath, 'utf8').split('\n');

  isSessionTranscriptFileArchived = (
    archiveRootPath: string,
    sessionId: string,
  ): boolean => {
    const archivedFileName = `${sessionId}${SESSION_TRANSCRIPT_FILE_EXTENSION}`;
    return (
      fs.existsSync(path.join(archiveRootPath, archivedFileName)) ||
      directoryEntryNames(archiveRootPath).some((archiveDirectoryName) =>
        fs.existsSync(
          path.join(archiveRootPath, archiveDirectoryName, archivedFileName),
        ),
      )
    );
  };

  doesEntryExist = (directoryPath: string, entryName: string): boolean =>
    fs.existsSync(path.join(directoryPath, entryName));

  isDirectory = (entryPath: string): boolean =>
    fs.statSync(entryPath, { throwIfNoEntry: false })?.isDirectory() === true;

  createOwnerOnlyDirectory = (
    directoryPath: string,
  ): OwnerOnlyDirectoryCreateOutcome => {
    try {
      fs.mkdirSync(directoryPath, { mode: OWNER_ONLY_DIRECTORY_MODE });
      return 'created';
    } catch {
      return 'createFailed';
    }
  };

  copySessionTranscriptFile = (
    sessionTranscriptFile: SessionTranscriptFile,
    destinationSessionDirectoryPath: string,
  ): CopyOutcome => {
    const destinationFilePath = path.join(
      destinationSessionDirectoryPath,
      sessionTranscriptFile.fileName,
    );
    const copyInProgressFilePath = `${destinationFilePath}${COPY_IN_PROGRESS_FILE_SUFFIX}`;
    try {
      const sourceStats = fs.statSync(sessionTranscriptFile.filePath);
      fs.copyFileSync(sessionTranscriptFile.filePath, copyInProgressFilePath);
      fs.chmodSync(
        copyInProgressFilePath,
        sourceStats.mode & PERMISSION_BITS_MASK,
      );
      fs.utimesSync(
        copyInProgressFilePath,
        sourceStats.atime,
        sourceStats.mtime,
      );
      fs.renameSync(copyInProgressFilePath, destinationFilePath);
      return 'copied';
    } catch {
      return 'copyFailed';
    }
  };

  copySessionIdDirectory = (
    sessionTranscriptFile: SessionTranscriptFile,
    destinationSessionDirectoryPath: string,
  ): CopyOutcome => {
    try {
      fs.cpSync(
        sessionTranscriptFile.sessionIdDirectoryPath,
        path.join(
          destinationSessionDirectoryPath,
          sessionTranscriptFile.sessionId,
        ),
        {
          recursive: true,
          preserveTimestamps: true,
          errorOnExist: true,
          force: false,
          verbatimSymlinks: true,
        },
      );
      return 'copied';
    } catch {
      return 'copyFailed';
    }
  };
}
