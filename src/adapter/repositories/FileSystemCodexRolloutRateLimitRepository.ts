import * as fs from 'fs';
import * as path from 'path';
import {
  CodexRolloutRateLimitReadResult,
  CodexRolloutRateLimitRepository,
} from '../../domain/usecases/adapter-interfaces/CodexRolloutRateLimitRepository';
import { findLatestCodexSevenDayRateLimit } from '../../domain/usecases/dashboard/CodexSevenDayWindowUseCase';

const ROLLOUT_DIRECTORY_NAMES = ['sessions', 'sessions-archive'];
const ROLLOUT_FILE_SUFFIX = '.jsonl';

export type FileSystemCodexRolloutRateLimitRepositoryOptions = {
  maxFilesToRead: number;
  tailBytes: number;
};

const DEFAULT_OPTIONS: FileSystemCodexRolloutRateLimitRepositoryOptions = {
  maxFilesToRead: 20,
  tailBytes: 1024 * 1024,
};

type RolloutFile = {
  filePath: string;
  mtimeMs: number;
};

const errorMessageOf = (error: unknown): string =>
  typeof error === 'object' &&
  error !== null &&
  'message' in error &&
  typeof error.message === 'string'
    ? error.message
    : String(error);

const isNotFound = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  error.code === 'ENOENT';

export class FileSystemCodexRolloutRateLimitRepository implements CodexRolloutRateLimitRepository {
  private readonly options: FileSystemCodexRolloutRateLimitRepositoryOptions;

  constructor(
    options: Partial<FileSystemCodexRolloutRateLimitRepositoryOptions> = {},
  ) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  readLatestSevenDayRateLimit = (
    codexHomeDirectory: string,
  ): CodexRolloutRateLimitReadResult => {
    const errorMessages: string[] = [];
    const files = this.listRolloutFilesNewestFirst(
      codexHomeDirectory,
      errorMessages,
    );
    for (const file of files.slice(0, this.options.maxFilesToRead)) {
      try {
        const observation = findLatestCodexSevenDayRateLimit(
          this.readTailLines(file.filePath),
        );
        if (observation !== null) {
          return { observation, errorMessages };
        }
      } catch (error) {
        errorMessages.push(`${file.filePath}: ${errorMessageOf(error)}`);
      }
    }
    return { observation: null, errorMessages };
  };

  private listRolloutFilesNewestFirst = (
    codexHomeDirectory: string,
    errorMessages: string[],
  ): RolloutFile[] => {
    const files: RolloutFile[] = [];
    for (const name of ROLLOUT_DIRECTORY_NAMES) {
      this.collectRolloutFiles(
        path.join(codexHomeDirectory, name),
        files,
        errorMessages,
      );
    }
    return files.sort((left, right) => right.mtimeMs - left.mtimeMs);
  };

  private collectRolloutFiles = (
    directory: string,
    files: RolloutFile[],
    errorMessages: string[],
  ): void => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch (error) {
      if (!isNotFound(error)) {
        errorMessages.push(`${directory}: ${errorMessageOf(error)}`);
      }
      return;
    }
    for (const entry of entries) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        this.collectRolloutFiles(entryPath, files, errorMessages);
      } else if (entry.isFile() && entry.name.endsWith(ROLLOUT_FILE_SUFFIX)) {
        try {
          files.push({
            filePath: entryPath,
            mtimeMs: fs.statSync(entryPath).mtimeMs,
          });
        } catch (error) {
          errorMessages.push(`${entryPath}: ${errorMessageOf(error)}`);
        }
      }
    }
  };

  private readTailLines = (filePath: string): string[] => {
    const fd = fs.openSync(filePath, 'r');
    try {
      const size = fs.fstatSync(fd).size;
      const length = Math.min(size, this.options.tailBytes);
      const start = size - length;
      const buffer = Buffer.alloc(length);
      let filled = 0;
      while (filled < length) {
        const bytesRead = fs.readSync(
          fd,
          buffer,
          filled,
          length - filled,
          start + filled,
        );
        if (bytesRead === 0) {
          break;
        }
        filled += bytesRead;
      }
      const lines = buffer.toString('utf8', 0, filled).split('\n');
      if (start > 0) {
        lines.shift();
      }
      return lines;
    } finally {
      fs.closeSync(fd);
    }
  };
}
