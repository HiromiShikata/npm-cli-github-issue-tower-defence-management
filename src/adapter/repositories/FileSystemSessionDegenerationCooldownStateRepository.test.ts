import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  defaultSessionDegenerationCooldownStateFilePath,
  FileSystemSessionDegenerationCooldownStateRepository,
} from './FileSystemSessionDegenerationCooldownStateRepository';

describe('FileSystemSessionDegenerationCooldownStateRepository', () => {
  let temporaryDirectory: string;
  let stateFilePath: string;

  beforeEach(() => {
    temporaryDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'degeneration-cooldown-'),
    );
    stateFilePath = path.join(temporaryDirectory, 'cooldown.json');
  });

  afterEach(() => {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  });

  it('returns an empty map when no state file exists', async () => {
    const repository = new FileSystemSessionDegenerationCooldownStateRepository(
      stateFilePath,
    );
    expect(await repository.loadLastResetEpochSecondsBySessionName()).toEqual(
      new Map(),
    );
  });

  it('persists and reloads a per-session reset time', async () => {
    const repository = new FileSystemSessionDegenerationCooldownStateRepository(
      stateFilePath,
    );
    const now = new Date('2026-07-26T00:00:00Z');
    await repository.recordReset({ sessionName: 'session-a', now });

    const reloaded = await repository.loadLastResetEpochSecondsBySessionName();
    expect(reloaded.get('session-a')).toBe(Math.floor(now.getTime() / 1000));
  });

  it('keeps distinct sessions separate and overwrites the same session', async () => {
    const repository = new FileSystemSessionDegenerationCooldownStateRepository(
      stateFilePath,
    );
    await repository.recordReset({
      sessionName: 'session-a',
      now: new Date('2026-07-26T00:00:00Z'),
    });
    await repository.recordReset({
      sessionName: 'session-b',
      now: new Date('2026-07-26T00:01:00Z'),
    });
    await repository.recordReset({
      sessionName: 'session-a',
      now: new Date('2026-07-26T00:02:00Z'),
    });

    const reloaded = await repository.loadLastResetEpochSecondsBySessionName();
    expect(reloaded.get('session-a')).toBe(
      Math.floor(new Date('2026-07-26T00:02:00Z').getTime() / 1000),
    );
    expect(reloaded.get('session-b')).toBe(
      Math.floor(new Date('2026-07-26T00:01:00Z').getTime() / 1000),
    );
  });

  it('drops entries older than the retention window on the next write', async () => {
    const repository = new FileSystemSessionDegenerationCooldownStateRepository(
      stateFilePath,
      60,
    );
    await repository.recordReset({
      sessionName: 'stale-session',
      now: new Date('2026-07-26T00:00:00Z'),
    });
    await repository.recordReset({
      sessionName: 'fresh-session',
      now: new Date('2026-07-26T00:05:00Z'),
    });

    const reloaded = await repository.loadLastResetEpochSecondsBySessionName();
    expect(reloaded.has('stale-session')).toBe(false);
    expect(reloaded.has('fresh-session')).toBe(true);
  });
});

describe('defaultSessionDegenerationCooldownStateFilePath', () => {
  const originalXdgCacheHome = process.env.XDG_CACHE_HOME;

  afterEach(() => {
    if (originalXdgCacheHome === undefined) {
      delete process.env.XDG_CACHE_HOME;
    } else {
      process.env.XDG_CACHE_HOME = originalXdgCacheHome;
    }
  });

  it('places the state file at tdpm/output-degeneration-cooldown.json below XDG_CACHE_HOME when set', () => {
    process.env.XDG_CACHE_HOME = '/custom/cache';

    expect(defaultSessionDegenerationCooldownStateFilePath()).toBe(
      '/custom/cache/tdpm/output-degeneration-cooldown.json',
    );
  });

  it('places the state file at tdpm/output-degeneration-cooldown.json below the home cache directory when XDG_CACHE_HOME is absent', () => {
    delete process.env.XDG_CACHE_HOME;

    expect(defaultSessionDegenerationCooldownStateFilePath()).toBe(
      path.join(
        os.homedir(),
        '.cache',
        'tdpm',
        'output-degeneration-cooldown.json',
      ),
    );
  });
});
