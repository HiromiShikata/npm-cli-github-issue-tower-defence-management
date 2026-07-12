import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { SilentSessionCandidateStateRepository } from '../../domain/usecases/adapter-interfaces/SilentSessionCandidateStateRepository';

type StoredCandidateEntry = {
  sessionName: string;
  recordedEpochSeconds: number;
};

type StoredAnnouncedRunningEntry = {
  sessionName: string;
  labels: string[];
  recordedEpochSeconds: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const DEFAULT_STATE_RETENTION_WINDOW_SECONDS = 60 * 60;
export const ANNOUNCED_RUNNING_RETENTION_WINDOW_SECONDS = 24 * 60 * 60;

const defaultStateFilePath = (): string => {
  const base = process.env.XDG_CACHE_HOME ?? path.join(os.homedir(), '.cache');
  return path.join(base, 'tdpm', 'silent-session-candidates.json');
};

export class FileSystemSilentSessionCandidateStateRepository implements SilentSessionCandidateStateRepository {
  constructor(
    private readonly stateFilePath: string = defaultStateFilePath(),
    private readonly retentionWindowSeconds: number = DEFAULT_STATE_RETENTION_WINDOW_SECONDS,
  ) {}

  loadRecentCandidateSessionNames = async (params: {
    now: Date;
    recencyWindowSeconds: number;
  }): Promise<Set<string>> => {
    const nowEpochSeconds = Math.floor(params.now.getTime() / 1000);
    const oldestAllowedEpochSeconds =
      nowEpochSeconds - params.recencyWindowSeconds;
    const entries = this.readCandidateEntries();
    const recentSessionNames = new Set<string>();
    for (const entry of entries) {
      if (entry.recordedEpochSeconds >= oldestAllowedEpochSeconds) {
        recentSessionNames.add(entry.sessionName);
      }
    }
    return recentSessionNames;
  };

  saveCandidateSessionNames = async (params: {
    sessionNames: string[];
    now: Date;
  }): Promise<void> => {
    const recordedEpochSeconds = Math.floor(params.now.getTime() / 1000);
    const oldestRetainedEpochSeconds =
      recordedEpochSeconds - this.retentionWindowSeconds;
    const currentSessionNames = new Set(params.sessionNames);
    const mergedBySessionName = new Map<string, StoredCandidateEntry>();
    for (const entry of this.readCandidateEntries()) {
      if (
        entry.recordedEpochSeconds >= oldestRetainedEpochSeconds &&
        !currentSessionNames.has(entry.sessionName)
      ) {
        mergedBySessionName.set(entry.sessionName, entry);
      }
    }
    for (const sessionName of currentSessionNames) {
      mergedBySessionName.set(sessionName, {
        sessionName,
        recordedEpochSeconds,
      });
    }
    this.writeState(
      Array.from(mergedBySessionName.values()),
      this.readAnnouncedRunningEntries(),
    );
  };

  loadAnnouncedRunningSubAgentLabels = async (params: {
    sessionName: string;
  }): Promise<Set<string>> => {
    const entry = this.readAnnouncedRunningEntries().find(
      (candidate) => candidate.sessionName === params.sessionName,
    );
    return new Set(entry?.labels ?? []);
  };

  saveAnnouncedRunningSubAgentLabels = async (params: {
    sessionName: string;
    labels: string[];
    now: Date;
  }): Promise<void> => {
    const recordedEpochSeconds = Math.floor(params.now.getTime() / 1000);
    const oldestRetainedEpochSeconds =
      recordedEpochSeconds - ANNOUNCED_RUNNING_RETENTION_WINDOW_SECONDS;
    const retainedEntries = this.readAnnouncedRunningEntries().filter(
      (entry) =>
        entry.sessionName !== params.sessionName &&
        entry.recordedEpochSeconds >= oldestRetainedEpochSeconds,
    );
    if (params.labels.length > 0) {
      retainedEntries.push({
        sessionName: params.sessionName,
        labels: params.labels,
        recordedEpochSeconds,
      });
    }
    this.writeState(this.readCandidateEntries(), retainedEntries);
  };

  private readState = (): Record<string, unknown> => {
    let raw: string;
    try {
      raw = fs.readFileSync(this.stateFilePath, 'utf8');
    } catch {
      return {};
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return {};
    }
    if (!isRecord(parsed)) {
      return {};
    }
    return parsed;
  };

  private readCandidateEntries = (): StoredCandidateEntry[] => {
    const storedEntries = this.readState().candidates;
    if (!Array.isArray(storedEntries)) {
      return [];
    }
    const entries: StoredCandidateEntry[] = [];
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

  private readAnnouncedRunningEntries = (): StoredAnnouncedRunningEntry[] => {
    const storedEntries = this.readState().announcedRunningSubAgents;
    if (!Array.isArray(storedEntries)) {
      return [];
    }
    const entries: StoredAnnouncedRunningEntry[] = [];
    for (const storedEntry of storedEntries) {
      if (!isRecord(storedEntry)) {
        continue;
      }
      const sessionName = storedEntry.sessionName;
      const recordedEpochSeconds = storedEntry.recordedEpochSeconds;
      const storedLabels = storedEntry.labels;
      if (
        typeof sessionName !== 'string' ||
        typeof recordedEpochSeconds !== 'number' ||
        !Number.isFinite(recordedEpochSeconds) ||
        !Array.isArray(storedLabels)
      ) {
        continue;
      }
      const labels = storedLabels.filter(
        (label): label is string => typeof label === 'string',
      );
      if (labels.length !== storedLabels.length) {
        continue;
      }
      entries.push({ sessionName, labels, recordedEpochSeconds });
    }
    return entries;
  };

  private writeState = (
    candidates: StoredCandidateEntry[],
    announcedRunningSubAgents: StoredAnnouncedRunningEntry[],
  ): void => {
    const directory = path.dirname(this.stateFilePath);
    fs.mkdirSync(directory, { recursive: true });
    const temporaryPath = `${this.stateFilePath}.${process.pid}.tmp`;
    fs.writeFileSync(
      temporaryPath,
      JSON.stringify({ candidates, announcedRunningSubAgents }),
    );
    fs.renameSync(temporaryPath, this.stateFilePath);
  };
}
