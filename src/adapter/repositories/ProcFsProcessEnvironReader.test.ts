import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ProcFsProcessEnvironReader } from './ProcFsProcessEnvironReader';

describe('ProcFsProcessEnvironReader', () => {
  let procDirectory: string;

  beforeEach(() => {
    procDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'proc-environ-'));
  });

  afterEach(() => {
    fs.rmSync(procDirectory, { force: true, recursive: true });
  });

  const writeEnviron = (pid: number, entries: string[]): void => {
    const pidDirectory = path.join(procDirectory, String(pid));
    fs.mkdirSync(pidDirectory, { recursive: true });
    fs.writeFileSync(
      path.join(pidDirectory, 'environ'),
      entries.join('\0') + '\0',
      'utf8',
    );
  };

  it('parses NUL-separated KEY=value pairs from procfs', () => {
    writeEnviron(123, [
      'PATH=/usr/bin',
      'CLAUDE_CODE_SESSION_ID=abc-123',
      'CLAUDE_CONFIG_DIR=/config/workbench',
    ]);
    const reader = new ProcFsProcessEnvironReader(procDirectory);

    const result = reader.readEnviron(123);

    expect(result).toEqual({
      PATH: '/usr/bin',
      CLAUDE_CODE_SESSION_ID: 'abc-123',
      CLAUDE_CONFIG_DIR: '/config/workbench',
    });
  });

  it('keeps values that themselves contain an equals sign', () => {
    writeEnviron(124, ['QUERY=a=b=c']);
    const reader = new ProcFsProcessEnvironReader(procDirectory);

    const result = reader.readEnviron(124);

    expect(result).toEqual({ QUERY: 'a=b=c' });
  });

  it('returns null when the process environ cannot be read', () => {
    const reader = new ProcFsProcessEnvironReader(procDirectory);

    const result = reader.readEnviron(999);

    expect(result).toBeNull();
  });
});
