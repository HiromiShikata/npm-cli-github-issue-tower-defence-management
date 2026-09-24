import { isRecord } from './isRecord';
import { SessionRecordArchiver } from './adapter-interfaces/SessionRecordArchiver';

export type UnresumableSessionArchiveResult =
  | { type: 'no-op' }
  | { type: 'archived'; destinationPath: string }
  | { type: 'sourceMissing'; expectedSourcePath: string };

export type UnresumableSessionArchiveInput = {
  logFilePath: string;
  sessionDir: string;
  archiveDir: string;
};

const PROMPT_TOO_LONG_RESULT = 'Prompt is too long';

const unresumableSessionIdInLine = (line: string): string | null => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) {
    return null;
  }
  if (
    parsed.type !== 'result' ||
    parsed.is_error !== true ||
    parsed.result !== PROMPT_TOO_LONG_RESULT
  ) {
    return null;
  }
  const sessionId = parsed.session_id;
  return typeof sessionId === 'string' && sessionId.length > 0
    ? sessionId
    : null;
};

export class UnresumableSessionArchiveUseCase {
  constructor(private readonly sessionRecordArchiver: SessionRecordArchiver) {}

  run = (
    input: UnresumableSessionArchiveInput,
  ): UnresumableSessionArchiveResult => {
    const sessionId = this.unresumableSessionId(input.logFilePath);
    if (sessionId === null) {
      return { type: 'no-op' };
    }
    if (
      !this.sessionRecordArchiver.sessionRecordExists(
        input.sessionDir,
        sessionId,
      )
    ) {
      return {
        type: 'sourceMissing',
        expectedSourcePath: this.sessionRecordArchiver.sessionRecordPath(
          input.sessionDir,
          sessionId,
        ),
      };
    }
    return {
      type: 'archived',
      destinationPath: this.sessionRecordArchiver.archiveSessionRecord(
        input.sessionDir,
        input.archiveDir,
        sessionId,
      ),
    };
  };

  private unresumableSessionId = (logFilePath: string): string | null => {
    for (const line of this.sessionRecordArchiver.readLogLines(logFilePath)) {
      const sessionId = unresumableSessionIdInLine(line);
      if (sessionId !== null) {
        return sessionId;
      }
    }
    return null;
  };
}
