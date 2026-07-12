import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  DEFAULT_STATE_RETENTION_WINDOW_SECONDS,
  SUBAGENT_REMINDER_SEND_RETENTION_WINDOW_SECONDS,
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
      subAgentReminderSends: [],
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

  describe('sub-agent reminder send state', () => {
    const subAgentSnapshot = {
      label: 'sub-process-1',
      lastOutputEpochSeconds: 1782000000,
    };

    it('round-trips a saved sub-agent reminder send so the next cycle reads it back', async () => {
      const repository = new FileSystemSilentSessionCandidateStateRepository(
        stateFilePath,
      );
      const sentAt = new Date('2026-06-26T00:00:00Z');

      await repository.saveSubAgentReminderSend({
        sessionName: sessionAlpha,
        subAgents: [subAgentSnapshot],
        now: sentAt,
      });
      const loaded = await repository.loadSubAgentReminderSend({
        sessionName: sessionAlpha,
      });

      expect(loaded).toEqual({
        sessionName: sessionAlpha,
        sentEpochSeconds: Math.floor(sentAt.getTime() / 1000),
        subAgents: [subAgentSnapshot],
      });
    });

    it('returns null when no reminder send has been recorded for the session', async () => {
      const repository = new FileSystemSilentSessionCandidateStateRepository(
        stateFilePath,
      );

      const loaded = await repository.loadSubAgentReminderSend({
        sessionName: sessionAlpha,
      });

      expect(loaded).toBeNull();
    });

    it('replaces the previous reminder send entry for the same session', async () => {
      const repository = new FileSystemSilentSessionCandidateStateRepository(
        stateFilePath,
      );
      const firstSentAt = new Date('2026-06-26T00:00:00Z');
      const secondSentAt = new Date('2026-06-26T00:30:00Z');

      await repository.saveSubAgentReminderSend({
        sessionName: sessionAlpha,
        subAgents: [subAgentSnapshot],
        now: firstSentAt,
      });
      await repository.saveSubAgentReminderSend({
        sessionName: sessionAlpha,
        subAgents: [
          { label: 'sub-process-2', lastOutputEpochSeconds: 1782000600 },
        ],
        now: secondSentAt,
      });
      const loaded = await repository.loadSubAgentReminderSend({
        sessionName: sessionAlpha,
      });

      expect(loaded).toEqual({
        sessionName: sessionAlpha,
        sentEpochSeconds: Math.floor(secondSentAt.getTime() / 1000),
        subAgents: [
          { label: 'sub-process-2', lastOutputEpochSeconds: 1782000600 },
        ],
      });
    });

    it('keeps the reminder send entry of another session when saving', async () => {
      const repository = new FileSystemSilentSessionCandidateStateRepository(
        stateFilePath,
      );
      const sentAt = new Date('2026-06-26T00:00:00Z');

      await repository.saveSubAgentReminderSend({
        sessionName: sessionAlpha,
        subAgents: [subAgentSnapshot],
        now: sentAt,
      });
      await repository.saveSubAgentReminderSend({
        sessionName: sessionBravo,
        subAgents: [subAgentSnapshot],
        now: sentAt,
      });

      expect(
        await repository.loadSubAgentReminderSend({
          sessionName: sessionAlpha,
        }),
      ).not.toBeNull();
      expect(
        await repository.loadSubAgentReminderSend({
          sessionName: sessionBravo,
        }),
      ).not.toBeNull();
    });

    it('drops a reminder send entry that has aged beyond the retention window on the next save', async () => {
      const repository = new FileSystemSilentSessionCandidateStateRepository(
        stateFilePath,
      );
      const firstSentAt = new Date('2026-06-26T00:00:00Z');
      const secondSentAt = new Date(
        firstSentAt.getTime() +
          (SUBAGENT_REMINDER_SEND_RETENTION_WINDOW_SECONDS + 1) * 1000,
      );

      await repository.saveSubAgentReminderSend({
        sessionName: sessionAlpha,
        subAgents: [subAgentSnapshot],
        now: firstSentAt,
      });
      await repository.saveSubAgentReminderSend({
        sessionName: sessionBravo,
        subAgents: [subAgentSnapshot],
        now: secondSentAt,
      });

      expect(
        await repository.loadSubAgentReminderSend({
          sessionName: sessionAlpha,
        }),
      ).toBeNull();
      expect(
        await repository.loadSubAgentReminderSend({
          sessionName: sessionBravo,
        }),
      ).not.toBeNull();
    });

    it('preserves the candidate set when saving a reminder send and preserves reminder sends when saving candidates', async () => {
      const repository = new FileSystemSilentSessionCandidateStateRepository(
        stateFilePath,
      );
      const at = new Date('2026-06-26T00:00:00Z');

      await repository.saveCandidateSessionNames({
        sessionNames: [sessionAlpha],
        now: at,
      });
      await repository.saveSubAgentReminderSend({
        sessionName: sessionBravo,
        subAgents: [subAgentSnapshot],
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
        await repository.loadSubAgentReminderSend({
          sessionName: sessionBravo,
        }),
      ).toEqual({
        sessionName: sessionBravo,
        sentEpochSeconds: Math.floor(at.getTime() / 1000),
        subAgents: [subAgentSnapshot],
      });
    });

    it('treats a corrupt state file as no recorded reminder send', async () => {
      fs.writeFileSync(stateFilePath, 'not valid json');
      const repository = new FileSystemSilentSessionCandidateStateRepository(
        stateFilePath,
      );

      const loaded = await repository.loadSubAgentReminderSend({
        sessionName: sessionAlpha,
      });

      expect(loaded).toBeNull();
    });

    it('ignores a stored reminder send entry whose sub-agent snapshot is malformed', async () => {
      fs.writeFileSync(
        stateFilePath,
        JSON.stringify({
          candidates: [],
          subAgentReminderSends: [
            {
              sessionName: sessionAlpha,
              sentEpochSeconds: 1782000000,
              subAgents: [{ label: 'sub-process-1' }],
            },
          ],
        }),
      );
      const repository = new FileSystemSilentSessionCandidateStateRepository(
        stateFilePath,
      );

      const loaded = await repository.loadSubAgentReminderSend({
        sessionName: sessionAlpha,
      });

      expect(loaded).toBeNull();
    });

    it('exposes the reminder send retention window as a named constant', () => {
      expect(SUBAGENT_REMINDER_SEND_RETENTION_WINDOW_SECONDS).toBe(
        24 * 60 * 60,
      );
    });
  });
});
