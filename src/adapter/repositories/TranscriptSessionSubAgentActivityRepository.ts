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
  lastEntryIndicatesCompletion: boolean;
};

const readContentBlocks = (
  message: Record<string, unknown>,
): Record<string, unknown>[] => {
  const content = message.content;
  if (!Array.isArray(content)) {
    return [];
  }
  return content.filter(isRecord);
};

const entryIndicatesCompletion = (entry: Record<string, unknown>): boolean => {
  const type = readString(entry, 'type');
  const message = entry.message;
  if (!isRecord(message)) {
    return false;
  }
  if (type === 'assistant') {
    const stopReason = readString(message, 'stop_reason');
    if (stopReason === 'end_turn' || stopReason === 'stop_sequence') {
      return true;
    }
    const blocks = readContentBlocks(message);
    const lastBlock = blocks[blocks.length - 1];
    return lastBlock !== undefined && readString(lastBlock, 'type') === 'text';
  }
  if (type === 'user') {
    return readContentBlocks(message).some(
      (block) => readString(block, 'type') === 'text',
    );
  }
  return false;
};

const parseTranscript = (content: string): ParsedTranscript => {
  let firstEntryEpochSeconds: number | null = null;
  let lastEntryIndicatesCompletion = false;
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
    if (isRecord(parsed.message)) {
      lastEntryIndicatesCompletion = entryIndicatesCompletion(parsed);
    }
  }
  return { firstEntryEpochSeconds, lastEntryIndicatesCompletion };
};

const clampToZero = (value: number): number => (value > 0 ? value : 0);

const parseKilledOrFailedAgentIds = (content: string): Set<string> => {
  const result = new Set<string>();
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
    if (readString(parsed, 'type') !== 'queue-operation') {
      continue;
    }
    if (readString(parsed, 'operation') !== 'enqueue') {
      continue;
    }
    const notifContent = readString(parsed, 'content');
    if (notifContent === null) {
      continue;
    }
    const taskIdMatch = notifContent.match(/<task-id>(a[0-9a-f]+)<\/task-id>/);
    const statusMatch = notifContent.match(/<status>([^<]+)<\/status>/);
    if (!taskIdMatch || !statusMatch) {
      continue;
    }
    const status = statusMatch[1];
    if (status === 'killed' || status === 'failed') {
      result.add(taskIdMatch[1]);
    }
  }
  return result;
};

export class TranscriptSessionSubAgentActivityRepository implements SessionSubAgentActivityRepository {
  constructor(
    private readonly directoryResolver: SubAgentTranscriptDirectoryResolver,
    private readonly now: Date,
    private readonly silentCeilingSeconds: number,
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
      const killedOrFailedAgentIds = this.loadKilledOrFailedAgentIds(mainTranscriptPath);
      const activities = this.collectActivities(directory, nowEpochSeconds, killedOrFailedAgentIds);
      if (activities.length > 0) {
        result.set(sessionName, activities);
      }
    }
    return result;
  };

  private loadKilledOrFailedAgentIds = (mainTranscriptPath: string | null): Set<string> => {
    if (mainTranscriptPath === null) {
      return new Set();
    }
    let content: string;
    try {
      content = fs.readFileSync(mainTranscriptPath, 'utf8');
    } catch {
      return new Set();
    }
    return parseKilledOrFailedAgentIds(content);
  };

  private collectActivities = (
    directory: string,
    nowEpochSeconds: number,
    killedOrFailedAgentIds: Set<string>,
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
      const agentId = fileName.slice('agent-'.length, -'.jsonl'.length);
      if (killedOrFailedAgentIds.has(agentId)) {
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
    if (transcript.lastEntryIndicatesCompletion) {
      return null;
    }
    const silentSeconds = clampToZero(
      nowEpochSeconds - Math.floor(stats.mtimeMs / 1000),
    );
    if (silentSeconds > this.silentCeilingSeconds) {
      return null;
    }
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
