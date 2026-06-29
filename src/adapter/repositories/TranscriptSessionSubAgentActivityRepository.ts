import * as fs from 'fs';
import * as path from 'path';
import { SubAgentActivity } from '../../domain/entities/LiveSessionActivitySnapshot';
import { SessionSubAgentActivityRepository } from '../../domain/usecases/adapter-interfaces/SessionSubAgentActivityRepository';
import { SubAgentTranscriptDirectoryResolver } from '../../domain/usecases/adapter-interfaces/SubAgentTranscriptDirectoryResolver';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const readString = (
  value: Record<string, unknown>,
  key: string,
): string | null => {
  const candidate = value[key];
  return typeof candidate === 'string' ? candidate : null;
};

const parseEpochSeconds = (timestamp: string | null): number | null => {
  if (timestamp === null) {
    return null;
  }
  const parsed = Date.parse(timestamp);
  return Number.isNaN(parsed) ? null : Math.floor(parsed / 1000);
};

type ParsedTranscript = {
  firstEntryEpochSeconds: number | null;
  lastStopReason: string | null;
};

const parseTranscript = (content: string): ParsedTranscript => {
  let firstEntryEpochSeconds: number | null = null;
  let lastStopReason: string | null = null;
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      continue;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      continue;
    }
    if (!isRecord(parsed)) {
      continue;
    }
    const epochSeconds = parseEpochSeconds(readString(parsed, 'timestamp'));
    if (firstEntryEpochSeconds === null && epochSeconds !== null) {
      firstEntryEpochSeconds = epochSeconds;
    }
    const message = parsed.message;
    if (isRecord(message)) {
      const stopReason = readString(message, 'stop_reason');
      if (stopReason !== null) {
        lastStopReason = stopReason;
      }
    }
  }
  return { firstEntryEpochSeconds, lastStopReason };
};

const clampToZero = (value: number): number => (value > 0 ? value : 0);

export class TranscriptSessionSubAgentActivityRepository implements SessionSubAgentActivityRepository {
  constructor(
    private readonly directoryResolver: SubAgentTranscriptDirectoryResolver,
    private readonly now: Date,
  ) {}

  listSubAgentActivitiesBySessionName = async (
    sessionNames: string[],
    transcriptPathBySessionName: Map<string, string>,
  ): Promise<Map<string, SubAgentActivity[]>> => {
    const result = new Map<string, SubAgentActivity[]>();
    const nowEpochSeconds = Math.floor(this.now.getTime() / 1000);
    for (const sessionName of sessionNames) {
      const mainTranscriptPath =
        transcriptPathBySessionName.get(sessionName) ?? null;
      const directory = this.directoryResolver.resolveSubAgentsDirectory(
        sessionName,
        mainTranscriptPath,
      );
      if (directory === null) {
        continue;
      }
      const activities = this.collectActivities(directory, nowEpochSeconds);
      if (activities.length > 0) {
        result.set(sessionName, activities);
      }
    }
    return result;
  };

  private collectActivities = (
    directory: string,
    nowEpochSeconds: number,
  ): SubAgentActivity[] => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch {
      return [];
    }
    const activities: SubAgentActivity[] = [];
    for (const entry of entries) {
      const fileName = entry.name;
      if (!fileName.startsWith('agent-') || !fileName.endsWith('.jsonl')) {
        continue;
      }
      const filePath = path.join(directory, fileName);
      const activity = this.toActivity(filePath, fileName, nowEpochSeconds);
      if (activity !== null) {
        activities.push(activity);
      }
    }
    return activities;
  };

  private toActivity = (
    filePath: string,
    fileName: string,
    nowEpochSeconds: number,
  ): SubAgentActivity | null => {
    let content: string;
    let stats: fs.Stats;
    try {
      content = fs.readFileSync(filePath, 'utf8');
      stats = fs.statSync(filePath);
    } catch {
      return null;
    }
    const transcript = parseTranscript(content);
    if (
      transcript.lastStopReason === 'end_turn' ||
      transcript.lastStopReason === 'stop_sequence'
    ) {
      return null;
    }
    const silentSeconds = clampToZero(
      nowEpochSeconds - Math.floor(stats.mtimeMs / 1000),
    );
    const runningSeconds =
      transcript.firstEntryEpochSeconds === null
        ? 0
        : clampToZero(nowEpochSeconds - transcript.firstEntryEpochSeconds);
    return {
      label: fileName.replace(/\.jsonl$/, ''),
      silentSeconds,
      runningSeconds,
    };
  };
}
