import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { FileHandoverStateRepository } from './FileHandoverStateRepository';

describe('FileHandoverStateRepository', () => {
  let directory: string;
  let filePath: string;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'handover-state-'));
    filePath = path.join(directory, 'nested', 'state.json');
  });

  afterEach(() => {
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it('returns an empty state when the file does not exist', () => {
    const repository = new FileHandoverStateRepository(filePath);

    expect(repository.load()).toEqual({ entries: {} });
  });

  it('saves and reloads state, creating parent directories', () => {
    const repository = new FileHandoverStateRepository(filePath);
    const state = {
      entries: {
        'session-a': { signaledAtEpoch: 1700000000, pid: 4242 },
      },
    };

    repository.save(state);

    expect(fs.existsSync(filePath)).toBe(true);
    expect(new FileHandoverStateRepository(filePath).load()).toEqual(state);
  });

  it('writes atomically via a temporary file and leaves no temp file behind', () => {
    const repository = new FileHandoverStateRepository(filePath);

    repository.save({
      entries: { 'session-a': { signaledAtEpoch: 1, pid: 2 } },
    });

    expect(fs.existsSync(`${filePath}.tmp`)).toBe(false);
  });

  it('returns an empty state when the file contains invalid JSON', () => {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, 'not json');
    const repository = new FileHandoverStateRepository(filePath);

    expect(repository.load()).toEqual({ entries: {} });
  });

  it('drops entries with malformed values while keeping valid ones', () => {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(
      filePath,
      JSON.stringify({
        entries: {
          valid: { signaledAtEpoch: 5, pid: 6 },
          missingPid: { signaledAtEpoch: 5 },
          notAnObject: 7,
        },
      }),
    );
    const repository = new FileHandoverStateRepository(filePath);

    expect(repository.load()).toEqual({
      entries: { valid: { signaledAtEpoch: 5, pid: 6 } },
    });
  });
});
