import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  SilentSessionCandidateStateRepository,
  SubAgentReminderSend,
  SubAgentReminderSubAgentSnapshot,
} from '../../domain/usecases/adapter-interfaces/SilentSessionCandidateStateRepository';

type StoredCandidateEntry = {
  sessionName: string;
  recordedEpochSeconds: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const DEFAULT_STATE_RETENTION_WINDOW_SECONDS = 60 * 60;
export const SUBAGENT_REMINDER_SEND_RETENTION_WINDOW_SECONDS = 24 * 60 * 60;

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
      this.readSubAgentReminderSendEntries(),
    );
  };

  loadSubAgentReminderSend = async (params: {
    sessionName: string;
  }): Promise<SubAgentReminderSend | null> => {
    const entries = this.readSubAgentReminderSendEntries();
    return (
      entries.find((entry) => entry.sessionName === params.sessionName) ?? null
    );
  };

  saveSubAgentReminderSend = async (params: {
    sessionName: string;
    subAgents: SubAgentReminderSubAgentSnapshot[];
    now: Date;
  }): Promise<void> => {
    const sentEpochSeconds = Math.floor(params.now.getTime() / 1000);
    const oldestRetainedEpochSeconds =
      sentEpochSeconds - SUBAGENT_REMINDER_SEND_RETENTION_WINDOW_SECONDS;
    const retainedEntries = this.readSubAgentReminderSendEntries().filter(
      (entry) =>
        entry.sessionName !== params.sessionName &&
        entry.sentEpochSeconds >= oldestRetainedEpochSeconds,
    );
    retainedEntries.push({
      sessionName: params.sessionName,
      sentEpochSeconds,
      subAgents: params.subAgents,
    });
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

  private readSubAgentReminderSendEntries = (): SubAgentReminderSend[] => {
    const storedEntries = this.readState().subAgentReminderSends;
    if (!Array.isArray(storedEntries)) {
      return [];
    }
    const entries: SubAgentReminderSend[] = [];
    for (const storedEntry of storedEntries) {
      if (!isRecord(storedEntry)) {
        continue;
      }
      const sessionName = storedEntry.sessionName;
      const sentEpochSeconds = storedEntry.sentEpochSeconds;
      if (
        typeof sessionName !== 'string' ||
        typeof sentEpochSeconds !== 'number' ||
        !Number.isFinite(sentEpochSeconds) ||
        !Array.isArray(storedEntry.subAgents)
      ) {
        continue;
      }
      const subAgents: SubAgentReminderSubAgentSnapshot[] = [];
      let subAgentsValid = true;
      for (const storedSubAgent of storedEntry.subAgents) {
        if (!isRecord(storedSubAgent)) {
          subAgentsValid = false;
          break;
        }
        const label = storedSubAgent.label;
        const lastOutputEpochSeconds = storedSubAgent.lastOutputEpochSeconds;
        if (
          typeof label !== 'string' ||
          typeof lastOutputEpochSeconds !== 'number' ||
          !Number.isFinite(lastOutputEpochSeconds)
        ) {
          subAgentsValid = false;
          break;
        }
        subAgents.push({ label, lastOutputEpochSeconds });
      }
      if (!subAgentsValid) {
        continue;
      }
      entries.push({ sessionName, sentEpochSeconds, subAgents });
    }
    return entries;
  };

  private writeState = (
    candidates: StoredCandidateEntry[],
    subAgentReminderSends: SubAgentReminderSend[],
  ): void => {
    const directory = path.dirname(this.stateFilePath);
    fs.mkdirSync(directory, { recursive: true });
    const temporaryPath = `${this.stateFilePath}.${process.pid}.tmp`;
    fs.writeFileSync(
      temporaryPath,
      JSON.stringify({ candidates, subAgentReminderSends }),
    );
    fs.renameSync(temporaryPath, this.stateFilePath);
  };
}
