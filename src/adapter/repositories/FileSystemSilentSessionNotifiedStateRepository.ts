import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { SilentSessionNotifiedStateRepository } from '../../domain/usecases/adapter-interfaces/SilentSessionNotifiedStateRepository';

type StoredNotifiedEntry = {
  sessionName: string;
  recordedEpochSeconds: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const defaultStateFilePath = (): string => {
  const base = process.env.XDG_CACHE_HOME ?? path.join(os.homedir(), '.cache');
  return path.join(base, 'tdpm', 'silent-session-notified.json');
};

// Persists the fire-once latch: the set of session names that have already
// received the current silent-episode reminder. The use case re-writes the
// full latch each cycle with the current timestamp, keeping a session latched
// for as long as it stays a reminder candidate (a continuous silent episode
// produces exactly one reminder), and prunes a session the moment it stops
// being a candidate so a later re-qualification fires again. The save
// intentionally OVERWRITES rather than merges: the use case supplies the
// complete latch to persist, so a pruned session must not linger.
export class FileSystemSilentSessionNotifiedStateRepository implements SilentSessionNotifiedStateRepository {
  constructor(
    private readonly stateFilePath: string = defaultStateFilePath(),
  ) {}

  loadRecentNotifiedSessionNames = async (params: {
    now: Date;
    recencyWindowSeconds: number;
  }): Promise<Set<string>> => {
    const nowEpochSeconds = Math.floor(params.now.getTime() / 1000);
    const oldestAllowedEpochSeconds =
      nowEpochSeconds - params.recencyWindowSeconds;
    const recentSessionNames = new Set<string>();
    for (const entry of this.readNotifiedEntries()) {
      if (entry.recordedEpochSeconds >= oldestAllowedEpochSeconds) {
        recentSessionNames.add(entry.sessionName);
      }
    }
    return recentSessionNames;
  };

  saveNotifiedSessionNames = async (params: {
    sessionNames: string[];
    now: Date;
  }): Promise<void> => {
    const recordedEpochSeconds = Math.floor(params.now.getTime() / 1000);
    const notifiedBySessionName = new Map<string, StoredNotifiedEntry>();
    for (const sessionName of params.sessionNames) {
      notifiedBySessionName.set(sessionName, {
        sessionName,
        recordedEpochSeconds,
      });
    }
    this.writeState(Array.from(notifiedBySessionName.values()));
  };

  private readNotifiedEntries = (): StoredNotifiedEntry[] => {
    let raw: string;
    try {
      raw = fs.readFileSync(this.stateFilePath, 'utf8');
    } catch {
      return [];
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return [];
    }
    if (!isRecord(parsed)) {
      return [];
    }
    const storedEntries = parsed.notified;
    if (!Array.isArray(storedEntries)) {
      return [];
    }
    const entries: StoredNotifiedEntry[] = [];
    for (const storedEntry of storedEntries) {
      if (!isRecord(storedEntry)) {
        continue;
      }
      const sessionName = storedEntry.sessionName;
      const recordedEpochSeconds = storedEntry.recordedEpochSeconds;
      if (
        typeof sessionName === 'string' &&
        typeof recordedEpochSeconds === 'number' &&
        Number.isFinite(recordedEpochSeconds)
      ) {
        entries.push({ sessionName, recordedEpochSeconds });
      }
    }
    return entries;
  };

  private writeState = (notified: StoredNotifiedEntry[]): void => {
    const directory = path.dirname(this.stateFilePath);
    fs.mkdirSync(directory, { recursive: true });
    const temporaryPath = `${this.stateFilePath}.${process.pid}.tmp`;
    fs.writeFileSync(temporaryPath, JSON.stringify({ notified }));
    fs.renameSync(temporaryPath, this.stateFilePath);
  };
}
