import * as fs from 'fs';
import { LiveSessionOutputActivity } from '../../domain/entities/LiveSessionOutputActivity';
import { SessionOutputActivityRepository } from '../../domain/usecases/adapter-interfaces/SessionOutputActivityRepository';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const readString = (
  value: Record<string, unknown>,
  key: string,
): string | null => {
  const candidate = value[key];
  return typeof candidate === 'string' ? candidate : null;
};

const parseEpochMilliseconds = (timestamp: string | null): number | null => {
  if (timestamp === null) {
    return null;
  }
  const parsed = Date.parse(timestamp);
  return Number.isNaN(parsed) ? null : parsed;
};

/**
 * Reads the last main-session output time for each live session from its
 * already-resolved transcript path. Idle time is computed from the timestamp of
 * the latest `assistant` entry rather than from the transcript file modification
 * time, so a transcript touched only by tool results or owner replies still
 * counts as silent.
 */
export class FileSystemSessionOutputActivityRepository implements SessionOutputActivityRepository {
  listSessionOutputActivities = async (
    transcriptPathBySessionName: Map<string, string>,
  ): Promise<LiveSessionOutputActivity[]> => {
    const activities: LiveSessionOutputActivity[] = [];
    for (const [sessionName, transcriptPath] of transcriptPathBySessionName) {
      const lastOutputEpochSeconds =
        this.readLastAssistantOutputEpochSeconds(transcriptPath);
      if (lastOutputEpochSeconds !== null) {
        activities.push({ sessionName, lastOutputEpochSeconds });
      }
    }
    return activities;
  };

  private readLastAssistantOutputEpochSeconds = (
    transcriptPath: string,
  ): number | null => {
    let content: string;
    try {
      content = fs.readFileSync(transcriptPath, 'utf8');
    } catch {
      return null;
    }
    let lastAssistantEpochMs: number | null = null;
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
      if (readString(parsed, 'type') !== 'assistant') {
        continue;
      }
      const epochMs = parseEpochMilliseconds(readString(parsed, 'timestamp'));
      if (epochMs === null) {
        continue;
      }
      if (lastAssistantEpochMs === null || epochMs > lastAssistantEpochMs) {
        lastAssistantEpochMs = epochMs;
      }
    }
    if (lastAssistantEpochMs === null) {
      return null;
    }
    return Math.floor(lastAssistantEpochMs / 1000);
  };
}
