import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Issue } from '../../domain/entities/Issue';
import {
  SilentSessionHubTaskStatusCacheEntry,
  SilentSessionHubTaskStatusCacheRepository,
} from '../../domain/usecases/adapter-interfaces/SilentSessionHubTaskStatusCacheRepository';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isIssueState = (value: unknown): value is Issue['state'] =>
  value === 'OPEN' || value === 'CLOSED' || value === 'MERGED';

export const DEFAULT_HUB_TASK_STATUS_RETENTION_WINDOW_SECONDS = 60 * 60;

const defaultStateFilePath = (): string => {
  const base = process.env.XDG_CACHE_HOME ?? path.join(os.homedir(), '.cache');
  return path.join(base, 'tdpm', 'silent-session-hub-task-status.json');
};

export class FileSystemSilentSessionHubTaskStatusCacheRepository implements SilentSessionHubTaskStatusCacheRepository {
  constructor(
    private readonly stateFilePath: string = defaultStateFilePath(),
    private readonly retentionWindowSeconds: number = DEFAULT_HUB_TASK_STATUS_RETENTION_WINDOW_SECONDS,
  ) {}

  loadHubTaskStatus = async (params: {
    url: string;
  }): Promise<SilentSessionHubTaskStatusCacheEntry | null> => {
    for (const entry of this.readEntries()) {
      if (entry.url === params.url) {
        return entry;
      }
    }
    return null;
  };

  saveHubTaskStatus = async (params: {
    url: string;
    state: Issue['state'];
    status: string | null;
    now: Date;
  }): Promise<void> => {
    const recordedEpochSeconds = Math.floor(params.now.getTime() / 1000);
    const oldestRetainedEpochSeconds =
      recordedEpochSeconds - this.retentionWindowSeconds;
    const mergedByUrl = new Map<string, SilentSessionHubTaskStatusCacheEntry>();
    for (const entry of this.readEntries()) {
      if (
        entry.recordedEpochSeconds >= oldestRetainedEpochSeconds &&
        entry.url !== params.url
      ) {
        mergedByUrl.set(entry.url, entry);
      }
    }
    mergedByUrl.set(params.url, {
      url: params.url,
      state: params.state,
      status: params.status,
      recordedEpochSeconds,
    });
    this.writeEntries(Array.from(mergedByUrl.values()));
  };

  private readEntries = (): SilentSessionHubTaskStatusCacheEntry[] => {
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
    const storedEntries = parsed.hubTaskStatuses;
    if (!Array.isArray(storedEntries)) {
      return [];
    }
    const entries: SilentSessionHubTaskStatusCacheEntry[] = [];
    for (const storedEntry of storedEntries) {
      if (!isRecord(storedEntry)) {
        continue;
      }
      const url = storedEntry.url;
      const state = storedEntry.state;
      const status = storedEntry.status;
      const recordedEpochSeconds = storedEntry.recordedEpochSeconds;
      if (
        typeof url === 'string' &&
        isIssueState(state) &&
        (typeof status === 'string' || status === null) &&
        typeof recordedEpochSeconds === 'number' &&
        Number.isFinite(recordedEpochSeconds)
      ) {
        entries.push({ url, state, status, recordedEpochSeconds });
      }
    }
    return entries;
  };

  private writeEntries = (
    entries: SilentSessionHubTaskStatusCacheEntry[],
  ): void => {
    const directory = path.dirname(this.stateFilePath);
    fs.mkdirSync(directory, { recursive: true });
    const temporaryPath = `${this.stateFilePath}.${process.pid}.tmp`;
    fs.writeFileSync(
      temporaryPath,
      JSON.stringify({ hubTaskStatuses: entries }),
    );
    fs.renameSync(temporaryPath, this.stateFilePath);
  };
}
