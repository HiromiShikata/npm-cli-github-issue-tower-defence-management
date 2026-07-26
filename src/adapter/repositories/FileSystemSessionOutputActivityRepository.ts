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

const readContentBlocks = (
  message: Record<string, unknown>,
): Record<string, unknown>[] => {
  const content = message.content;
  if (!Array.isArray(content)) {
    return [];
  }
  return content.filter(isRecord);
};

type TranscriptActivity = {
  lastAssistantOutputEpochSeconds: number | null;
  hasInProgressToolCall: boolean;
};

export class FileSystemSessionOutputActivityRepository implements SessionOutputActivityRepository {
  listSessionOutputActivities = async (
    transcriptPathBySessionName: Map<string, string>,
  ): Promise<LiveSessionOutputActivity[]> => {
    const activities: LiveSessionOutputActivity[] = [];
    for (const [sessionName, transcriptPath] of transcriptPathBySessionName) {
      const { lastAssistantOutputEpochSeconds, hasInProgressToolCall } =
        this.readTranscriptActivity(transcriptPath);
      if (lastAssistantOutputEpochSeconds !== null) {
        activities.push({
          sessionName,
          lastOutputEpochSeconds: lastAssistantOutputEpochSeconds,
          hasInProgressToolCall,
        });
      }
    }
    return activities;
  };

  private readTranscriptActivity = (
    transcriptPath: string,
  ): TranscriptActivity => {
    let content: string;
    try {
      content = fs.readFileSync(transcriptPath, 'utf8');
    } catch {
      return {
        lastAssistantOutputEpochSeconds: null,
        hasInProgressToolCall: false,
      };
    }
    let lastAssistantOutputEpochMs: number | null = null;
    const pendingToolUseIds = new Set<string>();
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
      const message = parsed.message;
      if (readString(parsed, 'type') === 'assistant') {
        const epochMs = parseEpochMilliseconds(readString(parsed, 'timestamp'));
        if (epochMs !== null) {
          lastAssistantOutputEpochMs = epochMs;
        }
      }
      if (!isRecord(message)) {
        continue;
      }
      for (const block of readContentBlocks(message)) {
        const blockType = readString(block, 'type');
        if (blockType === 'tool_use') {
          const toolUseId = readString(block, 'id');
          if (toolUseId !== null) {
            pendingToolUseIds.add(toolUseId);
          }
        } else if (blockType === 'tool_result') {
          const toolUseId = readString(block, 'tool_use_id');
          if (toolUseId !== null) {
            pendingToolUseIds.delete(toolUseId);
          }
        }
      }
    }
    return {
      lastAssistantOutputEpochSeconds:
        lastAssistantOutputEpochMs === null
          ? null
          : Math.floor(lastAssistantOutputEpochMs / 1000),
      hasInProgressToolCall: pendingToolUseIds.size > 0,
    };
  };
}
