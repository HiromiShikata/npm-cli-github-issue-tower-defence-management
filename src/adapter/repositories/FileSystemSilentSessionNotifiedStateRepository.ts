import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { SilentSessionNotifiedStateRepository } from '../../domain/usecases/adapter-interfaces/SilentSessionNotifiedStateRepository';

type StoredNotifiedEntry = {
  sectionKey: string;
  recordedEpochSeconds: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const defaultStateFilePath = (): string => {
  const base = process.env.XDG_CACHE_HOME ?? path.join(os.homedir(), '.cache');
  return path.join(base, 'tdpm', 'silent-session-notified.json');
};

export class FileSystemSilentSessionNotifiedStateRepository implements SilentSessionNotifiedStateRepository {
  constructor(
    private readonly stateFilePath: string = defaultStateFilePath(),
  ) {}

  loadRecentNotifiedSectionKeys = async (params: {
    now: Date;
    recencyWindowSeconds: number;
  }): Promise<Set<string>> => {
    const nowEpochSeconds = Math.floor(params.now.getTime() / 1000);
    const oldestAllowedEpochSeconds =
      nowEpochSeconds - params.recencyWindowSeconds;
    const recentSectionKeys = new Set<string>();
    for (const entry of this.readNotifiedEntries()) {
      if (entry.recordedEpochSeconds >= oldestAllowedEpochSeconds) {
        recentSectionKeys.add(entry.sectionKey);
      }
    }
    return recentSectionKeys;
  };

  saveNotifiedSectionKeys = async (params: {
    sectionKeys: string[];
    now: Date;
  }): Promise<void> => {
    const recordedEpochSeconds = Math.floor(params.now.getTime() / 1000);
    const notifiedBySectionKey = new Map<string, StoredNotifiedEntry>();
    for (const sectionKey of params.sectionKeys) {
      notifiedBySectionKey.set(sectionKey, {
        sectionKey,
        recordedEpochSeconds,
      });
    }
    this.writeState(Array.from(notifiedBySectionKey.values()));
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
      const sectionKey = storedEntry.sectionKey;
      const recordedEpochSeconds = storedEntry.recordedEpochSeconds;
      if (
        typeof sectionKey === 'string' &&
        typeof recordedEpochSeconds === 'number' &&
        Number.isFinite(recordedEpochSeconds)
      ) {
        entries.push({ sectionKey, recordedEpochSeconds });
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
