import { UnresumableSessionArchiveUseCase } from '../../../domain/usecases/UnresumableSessionArchiveUseCase';
import { FileSystemSessionRecordArchiver } from '../../repositories/FileSystemSessionRecordArchiver';

export type UnresumableSessionArchiveOutput = {
  stdout: string | null;
  stderr: string | null;
  exitCode: number;
};

export const unresumableSessionArchive = (input: {
  logFilePath: string;
  sessionDir: string;
  archiveDir: string;
}): UnresumableSessionArchiveOutput => {
  const result = new UnresumableSessionArchiveUseCase(
    new FileSystemSessionRecordArchiver(),
  ).run(input);
  switch (result.type) {
    case 'no-op':
      return { stdout: 'no-op', stderr: null, exitCode: 0 };
    case 'archived':
      return {
        stdout: `archived ${result.destinationPath}`,
        stderr: null,
        exitCode: 0,
      };
    case 'sourceMissing':
      return {
        stdout: null,
        stderr: `Session record not found at ${result.expectedSourcePath}`,
        exitCode: 1,
      };
  }
};
