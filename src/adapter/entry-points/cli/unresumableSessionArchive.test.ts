import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { unresumableSessionArchive } from './unresumableSessionArchive';

const sessionId = 'a2f3c1d4-0000-4000-8000-000000000001';

const promptTooLongLine = JSON.stringify({
  type: 'result',
  subtype: 'success',
  is_error: true,
  terminal_reason: 'blocking_limit',
  result: 'Prompt is too long',
  session_id: sessionId,
  num_turns: 1,
});

const compactFailedLine = JSON.stringify({
  type: 'system',
  subtype: 'status',
  status: null,
  compact_result: 'failed',
  compact_error: 'exhausted',
  session_id: sessionId,
});

const usageLimitLine = JSON.stringify({
  type: 'result',
  is_error: true,
  terminal_reason: 'api_error',
  api_error_status: 429,
  result: "You've hit your session limit",
});

describe('unresumableSessionArchive', () => {
  let workingDirectory: string;
  let sessionDir: string;
  let archiveDir: string;
  let logFilePath: string;

  beforeEach(() => {
    workingDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'unresumable-session-'),
    );
    sessionDir = path.join(workingDirectory, 'sessions');
    archiveDir = path.join(workingDirectory, 'archived');
    logFilePath = path.join(workingDirectory, 'run.jsonl');
    fs.mkdirSync(sessionDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(workingDirectory, { force: true, recursive: true });
  });

  const writeLog = (lines: string[]): void => {
    fs.writeFileSync(logFilePath, `${lines.join('\n')}\n`, 'utf8');
  };

  const writeSessionRecord = (): string => {
    const recordPath = path.join(sessionDir, `${sessionId}.jsonl`);
    fs.writeFileSync(recordPath, 'stored conversation', 'utf8');
    return recordPath;
  };

  it('moves the session record out of the session directory', () => {
    writeLog([compactFailedLine, promptTooLongLine]);
    const sourcePath = writeSessionRecord();

    const output = unresumableSessionArchive({
      logFilePath,
      sessionDir,
      archiveDir,
    });

    const destinationPath = path.join(archiveDir, `${sessionId}.jsonl`);
    expect(output).toEqual({
      stdout: `archived ${destinationPath}`,
      stderr: null,
      exitCode: 0,
    });
    expect(fs.existsSync(sourcePath)).toBe(false);
    expect(fs.existsSync(destinationPath)).toBe(true);
    expect(fs.readFileSync(destinationPath, 'utf8')).toBe(
      'stored conversation',
    );
  });

  it('keeps the session record when the log holds only the usage limit record', () => {
    writeLog([usageLimitLine]);
    const sourcePath = writeSessionRecord();

    const output = unresumableSessionArchive({
      logFilePath,
      sessionDir,
      archiveDir,
    });

    expect(output).toEqual({ stdout: 'no-op', stderr: null, exitCode: 0 });
    expect(fs.existsSync(sourcePath)).toBe(true);
    expect(fs.existsSync(archiveDir)).toBe(false);
  });

  it('keeps the session record when the log holds neither record', () => {
    writeLog([
      JSON.stringify({ type: 'assistant', message: { content: [] } }),
      'not json',
    ]);
    const sourcePath = writeSessionRecord();

    const output = unresumableSessionArchive({
      logFilePath,
      sessionDir,
      archiveDir,
    });

    expect(output).toEqual({ stdout: 'no-op', stderr: null, exitCode: 0 });
    expect(fs.existsSync(sourcePath)).toBe(true);
  });

  it('fails naming the expected source path when the session record is absent', () => {
    writeLog([promptTooLongLine]);

    const output = unresumableSessionArchive({
      logFilePath,
      sessionDir,
      archiveDir,
    });

    const expectedSourcePath = path.join(sessionDir, `${sessionId}.jsonl`);
    expect(output.stdout).toBeNull();
    expect(output.exitCode).toBe(1);
    expect(output.stderr).toContain(expectedSourcePath);
  });
});
