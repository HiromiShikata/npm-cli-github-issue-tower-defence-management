import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  DEFAULT_HUB_TASK_STATUS_RETENTION_WINDOW_SECONDS,
  FileSystemSilentSessionHubTaskStatusCacheRepository,
} from './FileSystemSilentSessionHubTaskStatusCacheRepository';

describe('FileSystemSilentSessionHubTaskStatusCacheRepository', () => {
  let rootDirectory: string;
  let stateFilePath: string;

  beforeEach(() => {
    rootDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'silent-session-hub-task-status-'),
    );
    stateFilePath = path.join(
      rootDirectory,
      'silent-session-hub-task-status.json',
    );
  });

  afterEach(() => {
    fs.rmSync(rootDirectory, { force: true, recursive: true });
  });

  const issueAlpha = 'https://github.com/HiromiShikata/repo/issues/100';
  const issueBravo = 'https://github.com/HiromiShikata/repo/issues/200';

  it('round-trips a saved status so the next cycle reads it back', async () => {
    const repository = new FileSystemSilentSessionHubTaskStatusCacheRepository(
      stateFilePath,
    );
    const now = new Date('2026-06-26T00:00:00Z');

    await repository.saveHubTaskStatus({
      url: issueAlpha,
      state: 'OPEN',
      status: 'In tmux',
      now,
    });
    const loaded = await repository.loadHubTaskStatus({ url: issueAlpha });

    expect(loaded).toEqual({
      url: issueAlpha,
      state: 'OPEN',
      status: 'In tmux',
      recordedEpochSeconds: Math.floor(now.getTime() / 1000),
    });
  });

  it('preserves a null project status across a round-trip', async () => {
    const repository = new FileSystemSilentSessionHubTaskStatusCacheRepository(
      stateFilePath,
    );
    const now = new Date('2026-06-26T00:00:00Z');

    await repository.saveHubTaskStatus({
      url: issueAlpha,
      state: 'CLOSED',
      status: null,
      now,
    });
    const loaded = await repository.loadHubTaskStatus({ url: issueAlpha });

    expect(loaded).toEqual({
      url: issueAlpha,
      state: 'CLOSED',
      status: null,
      recordedEpochSeconds: Math.floor(now.getTime() / 1000),
    });
  });

  it('returns null when no status has been recorded for the url', async () => {
    const repository = new FileSystemSilentSessionHubTaskStatusCacheRepository(
      stateFilePath,
    );

    const loaded = await repository.loadHubTaskStatus({ url: issueAlpha });

    expect(loaded).toBeNull();
  });

  it('returns null when no state file exists yet', async () => {
    const repository = new FileSystemSilentSessionHubTaskStatusCacheRepository(
      path.join(rootDirectory, 'missing.json'),
    );

    const loaded = await repository.loadHubTaskStatus({ url: issueAlpha });

    expect(loaded).toBeNull();
  });

  it('returns the most recently recorded status when a url is saved again', async () => {
    const repository = new FileSystemSilentSessionHubTaskStatusCacheRepository(
      stateFilePath,
    );

    await repository.saveHubTaskStatus({
      url: issueAlpha,
      state: 'OPEN',
      status: 'In tmux',
      now: new Date('2026-06-26T00:00:00Z'),
    });
    await repository.saveHubTaskStatus({
      url: issueAlpha,
      state: 'CLOSED',
      status: 'Done',
      now: new Date('2026-06-26T00:01:00Z'),
    });
    const loaded = await repository.loadHubTaskStatus({ url: issueAlpha });

    expect(loaded?.state).toBe('CLOSED');
    expect(loaded?.status).toBe('Done');
  });

  it('preserves another url recorded by a concurrent run when saving a different url', async () => {
    const repository = new FileSystemSilentSessionHubTaskStatusCacheRepository(
      stateFilePath,
    );

    await repository.saveHubTaskStatus({
      url: issueAlpha,
      state: 'OPEN',
      status: 'In tmux',
      now: new Date('2026-06-26T00:00:00Z'),
    });
    await repository.saveHubTaskStatus({
      url: issueBravo,
      state: 'CLOSED',
      status: 'Done',
      now: new Date('2026-06-26T00:00:30Z'),
    });

    expect(
      (await repository.loadHubTaskStatus({ url: issueAlpha }))?.state,
    ).toBe('OPEN');
    expect(
      (await repository.loadHubTaskStatus({ url: issueBravo }))?.state,
    ).toBe('CLOSED');
  });

  it('drops a stored entry that has aged beyond the retention window on the next save', async () => {
    const repository = new FileSystemSilentSessionHubTaskStatusCacheRepository(
      stateFilePath,
      60 * 60,
    );

    await repository.saveHubTaskStatus({
      url: issueAlpha,
      state: 'OPEN',
      status: 'In tmux',
      now: new Date('2026-06-26T00:00:00Z'),
    });
    await repository.saveHubTaskStatus({
      url: issueBravo,
      state: 'OPEN',
      status: 'In tmux',
      now: new Date('2026-06-26T01:30:00Z'),
    });

    const persisted: unknown = JSON.parse(
      fs.readFileSync(stateFilePath, 'utf8'),
    );
    expect(persisted).toEqual({
      hubTaskStatuses: [
        {
          url: issueBravo,
          state: 'OPEN',
          status: 'In tmux',
          recordedEpochSeconds: Math.floor(
            new Date('2026-06-26T01:30:00Z').getTime() / 1000,
          ),
        },
      ],
    });
  });

  it('treats a corrupt state file as no recorded status', async () => {
    fs.writeFileSync(stateFilePath, 'not valid json');
    const repository = new FileSystemSilentSessionHubTaskStatusCacheRepository(
      stateFilePath,
    );

    const loaded = await repository.loadHubTaskStatus({ url: issueAlpha });

    expect(loaded).toBeNull();
  });

  it('ignores a malformed stored entry that lacks a valid state', async () => {
    fs.writeFileSync(
      stateFilePath,
      JSON.stringify({
        hubTaskStatuses: [
          {
            url: issueAlpha,
            state: 'UNKNOWN',
            status: 'In tmux',
            recordedEpochSeconds: 1,
          },
        ],
      }),
    );
    const repository = new FileSystemSilentSessionHubTaskStatusCacheRepository(
      stateFilePath,
    );

    const loaded = await repository.loadHubTaskStatus({ url: issueAlpha });

    expect(loaded).toBeNull();
  });

  it('creates the parent directory when the configured path does not exist yet', async () => {
    const nestedPath = path.join(rootDirectory, 'nested', 'dir', 'state.json');
    const repository = new FileSystemSilentSessionHubTaskStatusCacheRepository(
      nestedPath,
    );

    await repository.saveHubTaskStatus({
      url: issueAlpha,
      state: 'OPEN',
      status: 'In tmux',
      now: new Date('2026-06-26T00:00:00Z'),
    });

    expect(fs.existsSync(nestedPath)).toBe(true);
  });

  it('writes atomically by renaming a temp file into place leaving no temp file behind', async () => {
    const repository = new FileSystemSilentSessionHubTaskStatusCacheRepository(
      stateFilePath,
    );

    await repository.saveHubTaskStatus({
      url: issueAlpha,
      state: 'OPEN',
      status: 'In tmux',
      now: new Date('2026-06-26T00:00:00Z'),
    });

    const leftoverTempFiles = fs
      .readdirSync(rootDirectory)
      .filter((name) => name.includes('.tmp'));
    expect(leftoverTempFiles).toEqual([]);
    expect(fs.existsSync(stateFilePath)).toBe(true);
  });

  it('exposes the default retention window as a named constant', () => {
    expect(DEFAULT_HUB_TASK_STATUS_RETENTION_WINDOW_SECONDS).toBe(60 * 60);
  });
});
