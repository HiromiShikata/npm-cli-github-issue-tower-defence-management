import { ResumableSessionSelectUseCase } from '../../../domain/usecases/ResumableSessionSelectUseCase';
import { FileSystemResumableSessionTranscriptRepository } from '../../repositories/FileSystemResumableSessionTranscriptRepository';

export type ResumableSessionSelectOutput = {
  stdout: string | null;
  stderrLines: string[];
  exitCode: number;
};

export const resumableSessionSelect = (input: {
  sessionName: string;
  sessionDir: string;
  otherSessionDirs: string[];
  archiveRoot: string;
}): ResumableSessionSelectOutput => {
  const result = new ResumableSessionSelectUseCase(
    new FileSystemResumableSessionTranscriptRepository(),
  ).run(input);
  switch (result.type) {
    case 'noResumableSessionTranscriptFile':
      return { stdout: null, stderrLines: [], exitCode: 0 };
    case 'entryTimeMissing':
      return {
        stdout: null,
        stderrLines: [
          `Session resumption: ${result.sessionId} has no entry time to compare with the definitions; starting a new session`,
        ],
        exitCode: 0,
      };
    case 'resumedInSessionDir':
      return { stdout: result.sessionId, stderrLines: [], exitCode: 0 };
    case 'resumedAfterCopy':
      return {
        stdout: result.sessionTranscriptFile.sessionId,
        stderrLines: [
          ...(result.sessionIdDirectoryCopyOutcome === 'copyFailed'
            ? [
                `Session resumption: warning: could not copy session directory ${result.sessionTranscriptFile.sessionIdDirectoryPath} into ${input.sessionDir}`,
              ]
            : []),
          `Session resumption: copied ${result.sessionTranscriptFile.filePath} into ${input.sessionDir} (original kept)`,
        ],
        exitCode: 0,
      };
    case 'sessionTranscriptFileCopyFailed':
      return {
        stdout: null,
        stderrLines: [
          `Session resumption: could not copy ${result.sessionTranscriptFile.filePath} into ${input.sessionDir}; starting a new session`,
        ],
        exitCode: 0,
      };
  }
};
