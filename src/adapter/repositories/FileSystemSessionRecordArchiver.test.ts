import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { FileSystemSessionRecordArchiver } from './FileSystemSessionRecordArchiver';

describe('FileSystemSessionRecordArchiver', () => {
  let workingDirectory: string;
  let sessionDir: string;
  let archiveDir: string;

  beforeEach(() => {
    workingDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'session-archiver-'),
    );
    sessionDir = path.join(workingDirectory, 'sessions');
    archiveDir = path.join(workingDirectory, 'archived');
    fs.mkdirSync(sessionDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(workingDirectory, { force: true, recursive: true });
  });

  const writeSessionRecord = (sessionId: string, content: string): string => {
    const recordPath = path.join(sessionDir, `${sessionId}.jsonl`);
    fs.writeFileSync(recordPath, content, 'utf8');
    return recordPath;
  };

  it('reads every line of the log file', () => {
    const logFilePath = path.join(workingDirectory, 'run.jsonl');
    fs.writeFileSync(logFilePath, 'first\nsecond\nthird\n', 'utf8');

    expect(
      new FileSystemSessionRecordArchiver().readLogLines(logFilePath),
    ).toEqual(['first', 'second', 'third', '']);
  });

  it('returns no lines when the log file is absent', () => {
    expect(
      new FileSystemSessionRecordArchiver().readLogLines(
        path.join(workingDirectory, 'absent.jsonl'),
      ),
    ).toEqual([]);
  });

  it('builds the session record path from the session directory and id', () => {
    expect(
      new FileSystemSessionRecordArchiver().sessionRecordPath(
        sessionDir,
        'session-a',
      ),
    ).toBe(path.join(sessionDir, 'session-a.jsonl'));
  });

  it('reports whether the session record is present', () => {
    writeSessionRecord('session-a', 'conversation');
    const archiver = new FileSystemSessionRecordArchiver();

    expect(archiver.sessionRecordExists(sessionDir, 'session-a')).toBe(true);
    expect(archiver.sessionRecordExists(sessionDir, 'session-b')).toBe(false);
  });

  it('moves the session record into the archive directory', () => {
    const sourcePath = writeSessionRecord('session-a', 'conversation body');

    const destinationPath =
      new FileSystemSessionRecordArchiver().archiveSessionRecord(
        sessionDir,
        archiveDir,
        'session-a',
      );

    expect(destinationPath).toBe(path.join(archiveDir, 'session-a.jsonl'));
    expect(fs.existsSync(sourcePath)).toBe(false);
    expect(fs.existsSync(destinationPath)).toBe(true);
    expect(fs.readFileSync(destinationPath, 'utf8')).toBe('conversation body');
  });

  it('creates the archive directory when it does not exist', () => {
    writeSessionRecord('session-a', 'conversation body');
    expect(fs.existsSync(archiveDir)).toBe(false);

    const destinationPath =
      new FileSystemSessionRecordArchiver().archiveSessionRecord(
        sessionDir,
        archiveDir,
        'session-a',
      );

    expect(fs.existsSync(archiveDir)).toBe(true);
    expect(fs.readFileSync(destinationPath, 'utf8')).toBe('conversation body');
  });

  it('leaves other session records untouched', () => {
    const keptPath = writeSessionRecord('session-b', 'kept');
    writeSessionRecord('session-a', 'moved');

    new FileSystemSessionRecordArchiver().archiveSessionRecord(
      sessionDir,
      archiveDir,
      'session-a',
    );

    expect(fs.existsSync(keptPath)).toBe(true);
    expect(fs.readFileSync(keptPath, 'utf8')).toBe('kept');
  });
});
