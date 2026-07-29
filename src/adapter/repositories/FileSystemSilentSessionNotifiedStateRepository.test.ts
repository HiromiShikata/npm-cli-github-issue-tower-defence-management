import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { FileSystemSilentSessionNotifiedStateRepository } from './FileSystemSilentSessionNotifiedStateRepository';

describe('FileSystemSilentSessionNotifiedStateRepository', () => {
  let rootDirectory: string;
  let stateFilePath: string;

  beforeEach(() => {
    rootDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'silent-session-notified-state-'),
    );
    stateFilePath = path.join(rootDirectory, 'silent-session-notified.json');
  });

  afterEach(() => {
    fs.rmSync(rootDirectory, { force: true, recursive: true });
  });

  const sessionAlpha = 'https://github.com/HiromiShikata/repo/issues/100';
  const sessionBravo = 'https://github.com/HiromiShikata/repo/issues/200';
  const alphaMainStalledKey = `${sessionAlpha}\nmain-stalled`;
  const alphaUnconsumedResultKey = `${sessionAlpha}\nsub-agent-result-unconsumed:agent-aaabbbbcccc40001`;
  const bravoMainStalledKey = `${sessionBravo}\nmain-stalled`;

  it('round-trips a saved notified set so the next cycle reads it back', async () => {
    const repository = new FileSystemSilentSessionNotifiedStateRepository(
      stateFilePath,
    );
    const now = new Date('2026-06-26T00:00:00Z');

    await repository.saveNotifiedSectionKeys({
      sectionKeys: [alphaMainStalledKey, bravoMainStalledKey],
      now,
    });
    const loaded = await repository.loadRecentNotifiedSectionKeys({
      now: new Date('2026-06-26T00:01:00Z'),
      recencyWindowSeconds: 15 * 60,
    });

    expect(loaded).toEqual(new Set([alphaMainStalledKey, bravoMainStalledKey]));
  });

  it('keeps two sections of the same session as distinct latch entries', async () => {
    const repository = new FileSystemSilentSessionNotifiedStateRepository(
      stateFilePath,
    );

    await repository.saveNotifiedSectionKeys({
      sectionKeys: [alphaMainStalledKey, alphaUnconsumedResultKey],
      now: new Date('2026-06-26T00:00:00Z'),
    });
    const loaded = await repository.loadRecentNotifiedSectionKeys({
      now: new Date('2026-06-26T00:01:00Z'),
      recencyWindowSeconds: 15 * 60,
    });

    expect(loaded).toEqual(
      new Set([alphaMainStalledKey, alphaUnconsumedResultKey]),
    );
  });

  it('returns an empty set when no state file exists yet', async () => {
    const repository = new FileSystemSilentSessionNotifiedStateRepository(
      stateFilePath,
    );

    const loaded = await repository.loadRecentNotifiedSectionKeys({
      now: new Date('2026-06-26T00:00:00Z'),
      recencyWindowSeconds: 15 * 60,
    });

    expect(loaded).toEqual(new Set<string>());
  });

  it('excludes an entry older than the recency window when loading', async () => {
    const repository = new FileSystemSilentSessionNotifiedStateRepository(
      stateFilePath,
    );

    await repository.saveNotifiedSectionKeys({
      sectionKeys: [alphaMainStalledKey],
      now: new Date('2026-06-26T00:00:00Z'),
    });
    const loaded = await repository.loadRecentNotifiedSectionKeys({
      now: new Date('2026-06-26T00:20:00Z'),
      recencyWindowSeconds: 15 * 60,
    });

    expect(loaded).toEqual(new Set<string>());
  });

  it('overwrites the latch on save so a pruned section no longer lingers', async () => {
    const repository = new FileSystemSilentSessionNotifiedStateRepository(
      stateFilePath,
    );

    await repository.saveNotifiedSectionKeys({
      sectionKeys: [alphaMainStalledKey, bravoMainStalledKey],
      now: new Date('2026-06-26T00:00:00Z'),
    });
    await repository.saveNotifiedSectionKeys({
      sectionKeys: [alphaMainStalledKey],
      now: new Date('2026-06-26T00:01:30Z'),
    });
    const loaded = await repository.loadRecentNotifiedSectionKeys({
      now: new Date('2026-06-26T00:02:00Z'),
      recencyWindowSeconds: 15 * 60,
    });

    expect(loaded).toEqual(new Set([alphaMainStalledKey]));
  });

  it('refreshes the recorded timestamp on each save so a continuously latched section stays within the window', async () => {
    const repository = new FileSystemSilentSessionNotifiedStateRepository(
      stateFilePath,
    );

    await repository.saveNotifiedSectionKeys({
      sectionKeys: [alphaMainStalledKey],
      now: new Date('2026-06-26T00:00:00Z'),
    });
    await repository.saveNotifiedSectionKeys({
      sectionKeys: [alphaMainStalledKey],
      now: new Date('2026-06-26T00:14:00Z'),
    });
    const loaded = await repository.loadRecentNotifiedSectionKeys({
      now: new Date('2026-06-26T00:20:00Z'),
      recencyWindowSeconds: 15 * 60,
    });

    expect(loaded).toEqual(new Set([alphaMainStalledKey]));
  });

  it('ignores an entry left by the previous state file format so it can neither suppress nor resurrect a reminder', async () => {
    fs.writeFileSync(
      stateFilePath,
      JSON.stringify({
        notified: [
          {
            sessionName: sessionAlpha,
            recordedEpochSeconds: Math.floor(
              new Date('2026-06-26T00:00:00Z').getTime() / 1000,
            ),
          },
        ],
      }),
    );
    const repository = new FileSystemSilentSessionNotifiedStateRepository(
      stateFilePath,
    );

    const loaded = await repository.loadRecentNotifiedSectionKeys({
      now: new Date('2026-06-26T00:01:00Z'),
      recencyWindowSeconds: 15 * 60,
    });

    expect(loaded).toEqual(new Set<string>());
  });

  it('returns an empty set when the state file is not valid JSON', async () => {
    fs.writeFileSync(stateFilePath, 'not json');
    const repository = new FileSystemSilentSessionNotifiedStateRepository(
      stateFilePath,
    );

    const loaded = await repository.loadRecentNotifiedSectionKeys({
      now: new Date('2026-06-26T00:00:00Z'),
      recencyWindowSeconds: 15 * 60,
    });

    expect(loaded).toEqual(new Set<string>());
  });
});
