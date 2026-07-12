import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  DEFAULT_STATE_RETENTION_WINDOW_SECONDS,
  ANNOUNCED_RUNNING_RETENTION_WINDOW_SECONDS,
  FileSystemSilentSessionCandidateStateRepository,
} from './FileSystemSilentSessionCandidateStateRepository';

describe('FileSystemSilentSessionCandidateStateRepository', () => {
  let rootDirectory: string;
  let stateFilePath: string;

  beforeEach(() => {
    rootDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'silent-session-candidate-state-'),
    );
    stateFilePath = path.join(rootDirectory, 'silent-session-candidates.json');
  });

  afterEach(() => {
    fs.rmSync(rootDirectory, { force: true, recursive: true });
  });

  const sessionAlpha = 'https://github.com/HiromiShikata/repo/issues/100';
  const sessionBravo = 'https://github.com/HiromiShikata/repo/issues/200';

  it('round-trips a saved candidate set so the next cycle reads it back', async () => {
    const repository = new FileSystemSilentSessionCandidateStateRepository(
      stateFilePath,
    );
    const now = new Date('2026-06-26T00:00:00Z');

    await repository.saveCandidateSessionNames({
      sessionNames: [sessionAlpha, sessionBravo],
      now,
    });
    const loaded = await repository.loadRecentCandidateSessionNames({
      now: new Date('2026-06-26T00:01:00Z'),
      recencyWindowSeconds: 15 * 60,
    });

    expect(loaded).toEqual(new Set([sessionAlpha, sessionBravo]));
  });

  it('returns an empty set when no state file exists yet', async () => {
    const repository = new FileSystemSilentSessionCandidateStateRepository(
      stateFilePath,
    );

    const loaded = await repository.loadRecentCandidateSessionNames({
      now: new Date('2026-06-26T00:00:00Z'),
      recencyWindowSeconds: 15 * 60,
    });

    expect(loaded).toEqual(new Set<string>());
  });

  it('excludes an entry older than the recency window when loading', async () => {
    const repository = new FileSystemSilentSessionCandidateStateRepository(
      stateFilePath,
    );
    const savedAt = new Date('2026-06-26T00:00:00Z');

    await repository.saveCandidateSessionNames({
      sessionNames: [sessionAlpha],
      now: savedAt,
    });
    const loaded = await repository.loadRecentCandidateSessionNames({
      now: new Date('2026-06-26T00:16:00Z'),
      recencyWindowSeconds: 15 * 60,
    });

    expect(loaded).toEqual(new Set<string>());
  });

  it('includes an entry recorded exactly at the recency-window boundary', async () => {
    const repository = new FileSystemSilentSessionCandidateStateRepository(
      stateFilePath,
    );
    const savedAt = new Date('2026-06-26T00:00:00Z');

    await repository.saveCandidateSessionNames({
      sessionNames: [sessionAlpha],
      now: savedAt,
    });
    const loaded = await repository.loadRecentCandidateSessionNames({
      now: new Date('2026-06-26T00:15:00Z'),
      recencyWindowSeconds: 15 * 60,
    });

    expect(loaded).toEqual(new Set([sessionAlpha]));
  });

  it('preserves another recent session recorded by a concurrent run when saving a disjoint set', async () => {
    const repository = new FileSystemSilentSessionCandidateStateRepository(
      stateFilePath,
    );
    const firstSaveAt = new Date('2026-06-26T00:00:00Z');
    const secondSaveAt = new Date('2026-06-26T00:00:30Z');

    await repository.saveCandidateSessionNames({
      sessionNames: [sessionAlpha],
      now: firstSaveAt,
    });
    await repository.saveCandidateSessionNames({
      sessionNames: [sessionBravo],
      now: secondSaveAt,
    });
    const loaded = await repository.loadRecentCandidateSessionNames({
      now: new Date('2026-06-26T00:01:00Z'),
      recencyWindowSeconds: 15 * 60,
    });

    expect(loaded).toEqual(new Set([sessionAlpha, sessionBravo]));
  });

  it('drops a stored entry that has aged beyond the retention window on the next save', async () => {
    const repository = new FileSystemSilentSessionCandidateStateRepository(
      stateFilePath,
      60 * 60,
    );
    const firstSaveAt = new Date('2026-06-26T00:00:00Z');
    const secondSaveAt = new Date('2026-06-26T01:30:00Z');

    await repository.saveCandidateSessionNames({
      sessionNames: [sessionAlpha],
      now: firstSaveAt,
    });
    await repository.saveCandidateSessionNames({
      sessionNames: [sessionBravo],
      now: secondSaveAt,
    });

    const persisted: unknown = JSON.parse(
      fs.readFileSync(stateFilePath, 'utf8'),
    );
    expect(persisted).toEqual({
      candidates: [
        {
          sessionName: sessionBravo,
          recordedEpochSeconds: Math.floor(secondSaveAt.getTime() / 1000),
        },
      ],
      announcedRunningSubAgents: [],
    });
  });

  it('refreshes the timestamp of a session that is a candidate again', async () => {
    const repository = new FileSystemSilentSessionCandidateStateRepository(
      stateFilePath,
    );
    const firstSaveAt = new Date('2026-06-26T00:00:00Z');
    const secondSaveAt = new Date('2026-06-26T00:14:00Z');

    await repository.saveCandidateSessionNames({
      sessionNames: [sessionAlpha],
      now: firstSaveAt,
    });
    await repository.saveCandidateSessionNames({
      sessionNames: [sessionAlpha],
      now: secondSaveAt,
    });
    const loaded = await repository.loadRecentCandidateSessionNames({
      now: new Date('2026-06-26T00:20:00Z'),
      recencyWindowSeconds: 15 * 60,
    });

    expect(loaded).toEqual(new Set([sessionAlpha]));
  });

  it('treats a corrupt state file as no previous candidates', async () => {
    fs.writeFileSync(stateFilePath, 'not valid json');
    const repository = new FileSystemSilentSessionCandidateStateRepository(
      stateFilePath,
    );

    const loaded = await repository.loadRecentCandidateSessionNames({
      now: new Date('2026-06-26T00:00:00Z'),
      recencyWindowSeconds: 15 * 60,
    });

    expect(loaded).toEqual(new Set<string>());
  });

  it('creates the parent directory when the configured path does not exist yet', async () => {
    const nestedPath = path.join(rootDirectory, 'nested', 'dir', 'state.json');
    const repository = new FileSystemSilentSessionCandidateStateRepository(
      nestedPath,
    );

    await repository.saveCandidateSessionNames({
      sessionNames: [sessionAlpha],
      now: new Date('2026-06-26T00:00:00Z'),
    });

    expect(fs.existsSync(nestedPath)).toBe(true);
  });

  it('exposes the default retention window as a named constant', () => {
    expect(DEFAULT_STATE_RETENTION_WINDOW_SECONDS).toBe(60 * 60);
  });

  describe('announced running sub-agent labels', () => {
    it('round-trips saved announced labels so the next cycle reads them back', async () => {
      const repository = new FileSystemSilentSessionCandidateStateRepository(
        stateFilePath,
      );

      await repository.saveAnnouncedRunningSubAgentLabels({
        sessionName: sessionAlpha,
        labels: ['sub-process-1', 'sub-process-2'],
        now: new Date('2026-06-26T00:00:00Z'),
      });
      const loaded = await repository.loadAnnouncedRunningSubAgentLabels({
        sessionName: sessionAlpha,
      });

      expect(loaded).toEqual(new Set(['sub-process-1', 'sub-process-2']));
    });

    it('returns an empty set when no announcement has been recorded for the session', async () => {
      const repository = new FileSystemSilentSessionCandidateStateRepository(
        stateFilePath,
      );

      const loaded = await repository.loadAnnouncedRunningSubAgentLabels({
        sessionName: sessionAlpha,
      });

      expect(loaded).toEqual(new Set<string>());
    });

    it('replaces the previous announced labels of the same session', async () => {
      const repository = new FileSystemSilentSessionCandidateStateRepository(
        stateFilePath,
      );

      await repository.saveAnnouncedRunningSubAgentLabels({
        sessionName: sessionAlpha,
        labels: ['sub-process-1'],
        now: new Date('2026-06-26T00:00:00Z'),
      });
      await repository.saveAnnouncedRunningSubAgentLabels({
        sessionName: sessionAlpha,
        labels: ['sub-process-2'],
        now: new Date('2026-06-26T00:01:00Z'),
      });
      const loaded = await repository.loadAnnouncedRunningSubAgentLabels({
        sessionName: sessionAlpha,
      });

      expect(loaded).toEqual(new Set(['sub-process-2']));
    });

    it('removes the stored entry when saving an empty label set', async () => {
      const repository = new FileSystemSilentSessionCandidateStateRepository(
        stateFilePath,
      );

      await repository.saveAnnouncedRunningSubAgentLabels({
        sessionName: sessionAlpha,
        labels: ['sub-process-1'],
        now: new Date('2026-06-26T00:00:00Z'),
      });
      await repository.saveAnnouncedRunningSubAgentLabels({
        sessionName: sessionAlpha,
        labels: [],
        now: new Date('2026-06-26T00:01:00Z'),
      });

      expect(
        await repository.loadAnnouncedRunningSubAgentLabels({
          sessionName: sessionAlpha,
        }),
      ).toEqual(new Set<string>());
      const persisted: unknown = JSON.parse(
        fs.readFileSync(stateFilePath, 'utf8'),
      );
      expect(persisted).toEqual({
        candidates: [],
        announcedRunningSubAgents: [],
      });
    });

    it('keeps the announced labels of another session when saving', async () => {
      const repository = new FileSystemSilentSessionCandidateStateRepository(
        stateFilePath,
      );
      const at = new Date('2026-06-26T00:00:00Z');

      await repository.saveAnnouncedRunningSubAgentLabels({
        sessionName: sessionAlpha,
        labels: ['sub-process-1'],
        now: at,
      });
      await repository.saveAnnouncedRunningSubAgentLabels({
        sessionName: sessionBravo,
        labels: ['sub-process-2'],
        now: at,
      });

      expect(
        await repository.loadAnnouncedRunningSubAgentLabels({
          sessionName: sessionAlpha,
        }),
      ).toEqual(new Set(['sub-process-1']));
      expect(
        await repository.loadAnnouncedRunningSubAgentLabels({
          sessionName: sessionBravo,
        }),
      ).toEqual(new Set(['sub-process-2']));
    });

    it('drops an announced entry that has aged beyond the retention window on the next save', async () => {
      const repository = new FileSystemSilentSessionCandidateStateRepository(
        stateFilePath,
      );
      const firstSaveAt = new Date('2026-06-26T00:00:00Z');
      const secondSaveAt = new Date(
        firstSaveAt.getTime() +
          (ANNOUNCED_RUNNING_RETENTION_WINDOW_SECONDS + 1) * 1000,
      );

      await repository.saveAnnouncedRunningSubAgentLabels({
        sessionName: sessionAlpha,
        labels: ['sub-process-1'],
        now: firstSaveAt,
      });
      await repository.saveAnnouncedRunningSubAgentLabels({
        sessionName: sessionBravo,
        labels: ['sub-process-2'],
        now: secondSaveAt,
      });

      expect(
        await repository.loadAnnouncedRunningSubAgentLabels({
          sessionName: sessionAlpha,
        }),
      ).toEqual(new Set<string>());
      expect(
        await repository.loadAnnouncedRunningSubAgentLabels({
          sessionName: sessionBravo,
        }),
      ).toEqual(new Set(['sub-process-2']));
    });

    it('preserves the candidate set when saving announced labels and preserves announced labels when saving candidates', async () => {
      const repository = new FileSystemSilentSessionCandidateStateRepository(
        stateFilePath,
      );
      const at = new Date('2026-06-26T00:00:00Z');

      await repository.saveCandidateSessionNames({
        sessionNames: [sessionAlpha],
        now: at,
      });
      await repository.saveAnnouncedRunningSubAgentLabels({
        sessionName: sessionBravo,
        labels: ['sub-process-1'],
        now: at,
      });
      await repository.saveCandidateSessionNames({
        sessionNames: [sessionAlpha],
        now: new Date('2026-06-26T00:01:00Z'),
      });

      const loadedCandidates = await repository.loadRecentCandidateSessionNames(
        {
          now: new Date('2026-06-26T00:02:00Z'),
          recencyWindowSeconds: 15 * 60,
        },
      );
      expect(loadedCandidates).toEqual(new Set([sessionAlpha]));
      expect(
        await repository.loadAnnouncedRunningSubAgentLabels({
          sessionName: sessionBravo,
        }),
      ).toEqual(new Set(['sub-process-1']));
    });

    it('treats a corrupt state file as no recorded announcements', async () => {
      fs.writeFileSync(stateFilePath, 'not valid json');
      const repository = new FileSystemSilentSessionCandidateStateRepository(
        stateFilePath,
      );

      const loaded = await repository.loadAnnouncedRunningSubAgentLabels({
        sessionName: sessionAlpha,
      });

      expect(loaded).toEqual(new Set<string>());
    });

    it('ignores a stored announced entry whose labels are malformed', async () => {
      fs.writeFileSync(
        stateFilePath,
        JSON.stringify({
          candidates: [],
          announcedRunningSubAgents: [
            {
              sessionName: sessionAlpha,
              labels: ['sub-process-1', 42],
              recordedEpochSeconds: 1782000000,
            },
          ],
        }),
      );
      const repository = new FileSystemSilentSessionCandidateStateRepository(
        stateFilePath,
      );

      const loaded = await repository.loadAnnouncedRunningSubAgentLabels({
        sessionName: sessionAlpha,
      });

      expect(loaded).toEqual(new Set<string>());
    });

    it('exposes the announced-label retention window as a named constant', () => {
      expect(ANNOUNCED_RUNNING_RETENTION_WINDOW_SECONDS).toBe(24 * 60 * 60);
    });
  });
});
