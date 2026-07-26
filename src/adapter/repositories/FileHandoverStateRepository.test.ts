import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  FileHandoverStateRepository,
  defaultHandoverStateFilePath,
} from './FileHandoverStateRepository';

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

describe('defaultHandoverStateFilePath', () => {
  const originalXdgCacheHome = process.env.XDG_CACHE_HOME;

  afterEach(() => {
    if (originalXdgCacheHome === undefined) {
      delete process.env.XDG_CACHE_HOME;
    } else {
      process.env.XDG_CACHE_HOME = originalXdgCacheHome;
    }
  });

  it('uses a TDPM-native filename distinct from the standalone monitor state file', () => {
    process.env.XDG_CACHE_HOME = '/custom/cache';

    expect(defaultHandoverStateFilePath()).toBe(
      '/custom/cache/tdpm/token-exhaustion-handover-state-tdpm-native.json',
    );
    expect(defaultHandoverStateFilePath()).not.toBe(
      '/custom/cache/tdpm/token-exhaustion-handover-state.json',
    );
  });

  it('falls back to ~/.cache when XDG_CACHE_HOME is unset', () => {
    delete process.env.XDG_CACHE_HOME;

    expect(defaultHandoverStateFilePath()).toBe(
      path.join(
        os.homedir(),
        '.cache',
        'tdpm',
        'token-exhaustion-handover-state-tdpm-native.json',
      ),
    );
  });
});
