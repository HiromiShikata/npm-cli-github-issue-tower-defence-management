import { SessionRecordArchiver } from './adapter-interfaces/SessionRecordArchiver';
import { UnresumableSessionArchiveUseCase } from './UnresumableSessionArchiveUseCase';

const promptTooLongLine = JSON.stringify({
  type: 'result',
  subtype: 'success',
  is_error: true,
  terminal_reason: 'blocking_limit',
  result: 'Prompt is too long',
  session_id: 'a2f3c1d4-0000-4000-8000-000000000001',
  num_turns: 1,
});

const compactFailedLine = JSON.stringify({
  type: 'system',
  subtype: 'status',
  status: null,
  compact_result: 'failed',
  compact_error: 'exhausted',
  session_id: 'a2f3c1d4-0000-4000-8000-000000000001',
});

const usageLimitLine = JSON.stringify({
  type: 'result',
  is_error: true,
  terminal_reason: 'api_error',
  api_error_status: 429,
  result: "You've hit your session limit",
});

const successLine = JSON.stringify({
  type: 'result',
  subtype: 'success',
  is_error: false,
  result: 'done',
  session_id: 'a2f3c1d4-0000-4000-8000-000000000002',
});

class StubSessionRecordArchiver implements SessionRecordArchiver {
  archiveSessionRecordCalls: {
    sessionDir: string;
    archiveDir: string;
    sessionId: string;
  }[] = [];

  constructor(
    private readonly logLines: string[],
    private readonly presentSessionIds: string[],
  ) {}

  readLogLines = (_logFilePath: string): string[] => this.logLines;

  sessionRecordPath = (sessionDir: string, sessionId: string): string =>
    `${sessionDir}/${sessionId}.jsonl`;

  sessionRecordExists = (_sessionDir: string, sessionId: string): boolean =>
    this.presentSessionIds.includes(sessionId);

  archiveSessionRecord = (
    sessionDir: string,
    archiveDir: string,
    sessionId: string,
  ): string => {
    this.archiveSessionRecordCalls.push({ sessionDir, archiveDir, sessionId });
    return `${archiveDir}/${sessionId}.jsonl`;
  };
}

describe('UnresumableSessionArchiveUseCase', () => {
  const input = {
    logFilePath: '/logs/run.jsonl',
    sessionDir: '/sessions',
    archiveDir: '/sessions/archived',
  };

  it('archives the session record named by the prompt-too-long result record', () => {
    const archiver = new StubSessionRecordArchiver(
      [compactFailedLine, promptTooLongLine],
      ['a2f3c1d4-0000-4000-8000-000000000001'],
    );
    const useCase = new UnresumableSessionArchiveUseCase(archiver);

    expect(useCase.run(input)).toEqual({
      type: 'archived',
      destinationPath:
        '/sessions/archived/a2f3c1d4-0000-4000-8000-000000000001.jsonl',
    });
    expect(archiver.archiveSessionRecordCalls).toEqual([
      {
        sessionDir: '/sessions',
        archiveDir: '/sessions/archived',
        sessionId: 'a2f3c1d4-0000-4000-8000-000000000001',
      },
    ]);
  });

  it('returns no-op for a log holding only the usage limit record', () => {
    const archiver = new StubSessionRecordArchiver([usageLimitLine], []);
    const useCase = new UnresumableSessionArchiveUseCase(archiver);

    expect(useCase.run(input)).toEqual({ type: 'no-op' });
    expect(archiver.archiveSessionRecordCalls).toEqual([]);
  });

  it('returns no-op for a log holding neither record', () => {
    const archiver = new StubSessionRecordArchiver([successLine], []);
    const useCase = new UnresumableSessionArchiveUseCase(archiver);

    expect(useCase.run(input)).toEqual({ type: 'no-op' });
    expect(archiver.archiveSessionRecordCalls).toEqual([]);
  });

  it('returns no-op for an empty log', () => {
    const archiver = new StubSessionRecordArchiver([], []);
    const useCase = new UnresumableSessionArchiveUseCase(archiver);

    expect(useCase.run(input)).toEqual({ type: 'no-op' });
  });

  it('ignores lines that are not JSON objects', () => {
    const archiver = new StubSessionRecordArchiver(
      ['', 'not json at all', '[1,2,3]', '"a string"', promptTooLongLine],
      ['a2f3c1d4-0000-4000-8000-000000000001'],
    );
    const useCase = new UnresumableSessionArchiveUseCase(archiver);

    expect(useCase.run(input)).toEqual({
      type: 'archived',
      destinationPath:
        '/sessions/archived/a2f3c1d4-0000-4000-8000-000000000001.jsonl',
    });
  });

  it('reports the expected source path when the session record is absent', () => {
    const archiver = new StubSessionRecordArchiver([promptTooLongLine], []);
    const useCase = new UnresumableSessionArchiveUseCase(archiver);

    expect(useCase.run(input)).toEqual({
      type: 'sourceMissing',
      expectedSourcePath:
        '/sessions/a2f3c1d4-0000-4000-8000-000000000001.jsonl',
    });
    expect(archiver.archiveSessionRecordCalls).toEqual([]);
  });

  it('does not match a result record whose is_error is false', () => {
    const archiver = new StubSessionRecordArchiver(
      [
        JSON.stringify({
          type: 'result',
          is_error: false,
          result: 'Prompt is too long',
          session_id: 'a2f3c1d4-0000-4000-8000-000000000001',
        }),
      ],
      ['a2f3c1d4-0000-4000-8000-000000000001'],
    );
    const useCase = new UnresumableSessionArchiveUseCase(archiver);

    expect(useCase.run(input)).toEqual({ type: 'no-op' });
  });

  it('does not match a non-result record carrying the prompt-too-long text', () => {
    const archiver = new StubSessionRecordArchiver(
      [
        JSON.stringify({
          type: 'assistant',
          is_error: true,
          result: 'Prompt is too long',
          session_id: 'a2f3c1d4-0000-4000-8000-000000000001',
        }),
      ],
      ['a2f3c1d4-0000-4000-8000-000000000001'],
    );
    const useCase = new UnresumableSessionArchiveUseCase(archiver);

    expect(useCase.run(input)).toEqual({ type: 'no-op' });
  });

  it('does not match a result record without a usable session id', () => {
    const archiver = new StubSessionRecordArchiver(
      [
        JSON.stringify({
          type: 'result',
          is_error: true,
          result: 'Prompt is too long',
        }),
      ],
      [],
    );
    const useCase = new UnresumableSessionArchiveUseCase(archiver);

    expect(useCase.run(input)).toEqual({ type: 'no-op' });
  });
});
