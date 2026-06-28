import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { FileSystemSessionRecordReader } from './FileSystemSessionRecordReader';

describe('FileSystemSessionRecordReader', () => {
  let configDir: string;

  beforeEach(() => {
    configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'session-record-'));
  });

  afterEach(() => {
    fs.rmSync(configDir, { force: true, recursive: true });
  });

  const writeRecord = (pid: number, record: object): void => {
    const sessionsDirectory = path.join(configDir, 'sessions');
    fs.mkdirSync(sessionsDirectory, { recursive: true });
    fs.writeFileSync(
      path.join(sessionsDirectory, `${pid}.json`),
      JSON.stringify(record),
      'utf8',
    );
  };

  it('returns the current session id recorded for the pid', () => {
    writeRecord(201, { pid: 201, sessionId: 'rotated-uuid', status: 'busy' });
    const reader = new FileSystemSessionRecordReader();

    expect(reader.readCurrentSessionId(configDir, 201)).toBe('rotated-uuid');
  });

  it('returns null when the session record file is absent', () => {
    const reader = new FileSystemSessionRecordReader();

    expect(reader.readCurrentSessionId(configDir, 999)).toBeNull();
  });

  it('returns null when the session record is not valid json', () => {
    const sessionsDirectory = path.join(configDir, 'sessions');
    fs.mkdirSync(sessionsDirectory, { recursive: true });
    fs.writeFileSync(
      path.join(sessionsDirectory, '201.json'),
      'not json',
      'utf8',
    );
    const reader = new FileSystemSessionRecordReader();

    expect(reader.readCurrentSessionId(configDir, 201)).toBeNull();
  });

  it('returns null when the record has no string session id', () => {
    writeRecord(201, { pid: 201, sessionId: 42 });
    const reader = new FileSystemSessionRecordReader();

    expect(reader.readCurrentSessionId(configDir, 201)).toBeNull();
  });
});
