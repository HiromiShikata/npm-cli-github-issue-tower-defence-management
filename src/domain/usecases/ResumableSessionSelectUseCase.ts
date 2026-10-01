import {
  CopyOutcome,
  ResumableSessionTranscriptRepository,
  SessionTranscriptFile,
} from './adapter-interfaces/ResumableSessionTranscriptRepository';

export type ResumableSessionSelectInput = {
  sessionName: string;
  sessionDir: string;
  otherSessionDirs: string[];
  archiveRoot: string;
};

export type SessionIdDirectoryCopyOutcome =
  'copied' | 'copyFailed' | 'sourceAbsent' | 'destinationPresent';

export type ResumableSessionSelectResult =
  | { type: 'noResumableSessionTranscriptFile' }
  | { type: 'entryTimeMissing'; sessionId: string }
  | { type: 'resumedInSessionDir'; sessionId: string }
  | {
      type: 'resumedAfterCopy';
      sessionTranscriptFile: SessionTranscriptFile;
      sessionIdDirectoryCopyOutcome: SessionIdDirectoryCopyOutcome;
    }
  | {
      type: 'sessionTranscriptFileCopyFailed';
      sessionTranscriptFile: SessionTranscriptFile;
    };

type ResumableSessionTranscript = {
  sessionTranscriptFile: SessionTranscriptFile;
  lines: string[];
};

const PROMPT_TOO_LONG_ERROR_TEXT = 'Prompt is too long';

const transcriptEntryParse = (line: string): object | null => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return null;
  }
  return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
    ? parsed
    : null;
};

const messageContentText = (message: unknown): string => {
  if (
    typeof message !== 'object' ||
    message === null ||
    !('content' in message) ||
    !Array.isArray(message.content)
  ) {
    return '';
  }
  return message.content
    .map((contentItem: unknown) =>
      typeof contentItem === 'object' &&
      contentItem !== null &&
      'text' in contentItem &&
      typeof contentItem.text === 'string'
        ? contentItem.text
        : '',
    )
    .join('');
};

const mainChainAssistantErrorText = (line: string): string | null => {
  const entry = transcriptEntryParse(line);
  if (
    entry === null ||
    !('type' in entry) ||
    entry.type !== 'assistant' ||
    ('isSidechain' in entry && entry.isSidechain === true)
  ) {
    return null;
  }
  return 'isApiErrorMessage' in entry &&
    entry.isApiErrorMessage === true &&
    'message' in entry
    ? messageContentText(entry.message)
    : '';
};

const lastMainChainAssistantErrorText = (lines: string[]): string | null =>
  lines.reduce<string | null>(
    (lastErrorText, line) => mainChainAssistantErrorText(line) ?? lastErrorText,
    null,
  );

const hasParseableEntryTime = (lines: string[]): boolean => {
  for (const line of lines) {
    const entry = transcriptEntryParse(line);
    if (
      entry !== null &&
      'timestamp' in entry &&
      typeof entry.timestamp === 'string'
    ) {
      return !Number.isNaN(Date.parse(entry.timestamp));
    }
  }
  return false;
};

const newestThenFirstGivenDirectoryThenAscendingFileNameOrder =
  (givenSessionDirectoryPaths: string[]) =>
  (left: SessionTranscriptFile, right: SessionTranscriptFile): number => {
    if (
      left.modificationTimeNanoseconds !== right.modificationTimeNanoseconds
    ) {
      return left.modificationTimeNanoseconds >
        right.modificationTimeNanoseconds
        ? -1
        : 1;
    }
    const givenDirectoryOrderDifference =
      givenSessionDirectoryPaths.indexOf(left.sessionDirectoryPath) -
      givenSessionDirectoryPaths.indexOf(right.sessionDirectoryPath);
    if (givenDirectoryOrderDifference !== 0) {
      return givenDirectoryOrderDifference;
    }
    if (left.fileName === right.fileName) {
      return 0;
    }
    return left.fileName < right.fileName ? -1 : 1;
  };

export class ResumableSessionSelectUseCase {
  constructor(
    private readonly resumableSessionTranscriptRepository: ResumableSessionTranscriptRepository,
  ) {}

  run = (input: ResumableSessionSelectInput): ResumableSessionSelectResult => {
    const sessionDirTranscript = this.newestResumableSessionTranscript(
      [input.sessionDir],
      this.resumableSessionTranscriptRepository.listSessionTranscriptFiles(
        input.sessionDir,
      ),
      input,
    );
    if (sessionDirTranscript !== null) {
      const sessionId = sessionDirTranscript.sessionTranscriptFile.sessionId;
      return hasParseableEntryTime(sessionDirTranscript.lines)
        ? { type: 'resumedInSessionDir', sessionId }
        : { type: 'entryTimeMissing', sessionId };
    }
    const otherSessionDirs = input.otherSessionDirs.filter(
      (otherSessionDir) => otherSessionDir !== input.sessionDir,
    );
    const otherSessionDirTranscript = this.newestResumableSessionTranscript(
      otherSessionDirs,
      this.otherSessionDirTranscriptFilesAbsentFromSessionDir(
        otherSessionDirs,
        input.sessionDir,
      ),
      input,
    );
    if (otherSessionDirTranscript === null) {
      return { type: 'noResumableSessionTranscriptFile' };
    }
    if (!hasParseableEntryTime(otherSessionDirTranscript.lines)) {
      return {
        type: 'entryTimeMissing',
        sessionId: otherSessionDirTranscript.sessionTranscriptFile.sessionId,
      };
    }
    return this.copyIntoSessionDir(
      otherSessionDirTranscript.sessionTranscriptFile,
      input.sessionDir,
    );
  };

  private otherSessionDirTranscriptFilesAbsentFromSessionDir = (
    otherSessionDirs: string[],
    sessionDir: string,
  ): SessionTranscriptFile[] =>
    otherSessionDirs
      .flatMap((otherSessionDir) =>
        this.resumableSessionTranscriptRepository.listSessionTranscriptFiles(
          otherSessionDir,
        ),
      )
      .filter(
        (sessionTranscriptFile) =>
          !this.resumableSessionTranscriptRepository.doesEntryExist(
            sessionDir,
            sessionTranscriptFile.fileName,
          ),
      );

  private newestResumableSessionTranscript = (
    givenSessionDirectoryPaths: string[],
    sessionTranscriptFiles: SessionTranscriptFile[],
    input: ResumableSessionSelectInput,
  ): ResumableSessionTranscript | null => {
    const sessionNameTitleField = `"customTitle":"${input.sessionName}"`;
    const candidates = sessionTranscriptFiles
      .filter((sessionTranscriptFile) =>
        this.resumableSessionTranscriptRepository
          .readFirstLine(sessionTranscriptFile)
          .includes(sessionNameTitleField),
      )
      .sort(
        newestThenFirstGivenDirectoryThenAscendingFileNameOrder(
          givenSessionDirectoryPaths,
        ),
      );
    for (const candidate of candidates) {
      if (
        this.resumableSessionTranscriptRepository.isSessionTranscriptFileArchived(
          input.archiveRoot,
          candidate.sessionId,
        )
      ) {
        continue;
      }
      const lines =
        this.resumableSessionTranscriptRepository.readLines(candidate);
      if (
        lastMainChainAssistantErrorText(lines) !== PROMPT_TOO_LONG_ERROR_TEXT
      ) {
        return { sessionTranscriptFile: candidate, lines };
      }
    }
    return null;
  };

  private copyIntoSessionDir = (
    sessionTranscriptFile: SessionTranscriptFile,
    sessionDir: string,
  ): ResumableSessionSelectResult => {
    if (
      this.sessionTranscriptFileCopyOutcome(
        sessionTranscriptFile,
        sessionDir,
      ) === 'copyFailed'
    ) {
      return { type: 'sessionTranscriptFileCopyFailed', sessionTranscriptFile };
    }
    return {
      type: 'resumedAfterCopy',
      sessionTranscriptFile,
      sessionIdDirectoryCopyOutcome: this.sessionIdDirectoryCopyOutcome(
        sessionTranscriptFile,
        sessionDir,
      ),
    };
  };

  private sessionTranscriptFileCopyOutcome = (
    sessionTranscriptFile: SessionTranscriptFile,
    sessionDir: string,
  ): CopyOutcome => {
    if (
      this.resumableSessionTranscriptRepository.doesEntryExist(
        sessionDir,
        sessionTranscriptFile.fileName,
      )
    ) {
      return 'copyFailed';
    }
    if (
      !this.resumableSessionTranscriptRepository.isDirectory(sessionDir) &&
      this.resumableSessionTranscriptRepository.createOwnerOnlyDirectory(
        sessionDir,
      ) === 'createFailed'
    ) {
      return 'copyFailed';
    }
    return this.resumableSessionTranscriptRepository.copySessionTranscriptFile(
      sessionTranscriptFile,
      sessionDir,
    );
  };

  private sessionIdDirectoryCopyOutcome = (
    sessionTranscriptFile: SessionTranscriptFile,
    sessionDir: string,
  ): SessionIdDirectoryCopyOutcome => {
    if (
      !this.resumableSessionTranscriptRepository.isDirectory(
        sessionTranscriptFile.sessionIdDirectoryPath,
      )
    ) {
      return 'sourceAbsent';
    }
    if (
      this.resumableSessionTranscriptRepository.doesEntryExist(
        sessionDir,
        sessionTranscriptFile.sessionId,
      )
    ) {
      return 'destinationPresent';
    }
    return this.resumableSessionTranscriptRepository.copySessionIdDirectory(
      sessionTranscriptFile,
      sessionDir,
    );
  };
}
