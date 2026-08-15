import * as fs from 'fs';
import * as path from 'path';
import { SessionDegenerationCooldownStateRepository } from '../../domain/usecases/adapter-interfaces/SessionDegenerationCooldownStateRepository';
import { tdpmCacheDirectory } from './localStorageCacheDirectory';

type StoredResetEntry = {
  sessionName: string;
  resetEpochSeconds: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const DEFAULT_RESET_RETENTION_WINDOW_SECONDS = 60 * 60;

export const defaultSessionDegenerationCooldownStateFilePath = (): string =>
  path.join(tdpmCacheDirectory(), 'output-degeneration-cooldown.json');

export class FileSystemSessionDegenerationCooldownStateRepository implements SessionDegenerationCooldownStateRepository {
  constructor(
    private readonly stateFilePath: string = defaultSessionDegenerationCooldownStateFilePath(),
    private readonly retentionWindowSeconds: number = DEFAULT_RESET_RETENTION_WINDOW_SECONDS,
  ) {}

  loadLastResetEpochSecondsBySessionName = async (): Promise<
    Map<string, number>
  > => {
    const lastResetBySessionName = new Map<string, number>();
    for (const entry of this.readResetEntries()) {
      lastResetBySessionName.set(entry.sessionName, entry.resetEpochSeconds);
    }
    return lastResetBySessionName;
  };

  recordReset = async (params: {
    sessionName: string;
    now: Date;
  }): Promise<void> => {
    const resetEpochSeconds = Math.floor(params.now.getTime() / 1000);
    const oldestRetainedEpochSeconds =
      resetEpochSeconds - this.retentionWindowSeconds;
    const mergedBySessionName = new Map<string, StoredResetEntry>();
    for (const entry of this.readResetEntries()) {
      if (
        entry.resetEpochSeconds >= oldestRetainedEpochSeconds &&
        entry.sessionName !== params.sessionName
      ) {
        mergedBySessionName.set(entry.sessionName, entry);
      }
    }
    mergedBySessionName.set(params.sessionName, {
      sessionName: params.sessionName,
      resetEpochSeconds,
    });
    this.writeState(Array.from(mergedBySessionName.values()));
  };

  private readResetEntries = (): StoredResetEntry[] => {
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
    const storedEntries = parsed.resets;
    if (!Array.isArray(storedEntries)) {
      return [];
    }
    const entries: StoredResetEntry[] = [];
    for (const storedEntry of storedEntries) {
      if (!isRecord(storedEntry)) {
        continue;
      }
      const sessionName = storedEntry.sessionName;
      const resetEpochSeconds = storedEntry.resetEpochSeconds;
      if (
        typeof sessionName === 'string' &&
        typeof resetEpochSeconds === 'number' &&
        Number.isFinite(resetEpochSeconds)
      ) {
        entries.push({ sessionName, resetEpochSeconds });
      }
    }
    return entries;
  };

  private writeState = (resets: StoredResetEntry[]): void => {
    const directory = path.dirname(this.stateFilePath);
    fs.mkdirSync(directory, { recursive: true });
    const temporaryPath = `${this.stateFilePath}.${process.pid}.tmp`;
    fs.writeFileSync(temporaryPath, JSON.stringify({ resets }));
    fs.renameSync(temporaryPath, this.stateFilePath);
  };
}
